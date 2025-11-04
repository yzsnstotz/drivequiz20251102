// apps/ai-service/src/routes/admin/cache-prewarm.ts
/**
 * ZALEM · AI-Service
 * Admin: Cache Prewarm API
 *
 * POST /v1/admin/cache/prewarm
 * - 服务侧鉴权：Authorization: Bearer <SERVICE_TOKEN>
 * - 从 ai_daily_summary.top_questions 读取 Top10 问题，调用生成并写入缓存
 * - 返回统一结构：{ ok, data | errorCode, message }
 *
 * 实现要点：
 * - 读取最新日期的 daily summary（从缓存或数据库）
 * - 提取 Top10 问题
 * - 对每个问题调用 OpenAI 生成答案并写入缓存
 * - 使用与 ask 路由相同的逻辑（RAG、安全审查等）
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { ServiceConfig } from "../../index.js";
import { ensureServiceAuth } from "../../middlewares/auth.js";
import { cacheGet, cacheSet } from "../../lib/cache.js";
import { getOpenAIClient } from "../../lib/openaiClient.js";
import { checkSafety } from "../../lib/safety.js";
import { ragSearch } from "../../lib/rag.js";
import { buildCacheKey } from "../ask.js";
import { defaultLogger } from "../../lib/logger.js";

// 统一响应类型
type Ok<T> = { ok: true; data: T };
type ErrCode = "AUTH_REQUIRED" | "FORBIDDEN" | "VALIDATION_FAILED" | "PROVIDER_ERROR" | "INTERNAL_ERROR";
type Err = { ok: false; errorCode: ErrCode; message: string; details?: unknown };

// RAG 检索配置
const RAG_TOP_K = Number(process.env.RAG_TOP_K || 3);
const RAG_THRESHOLD = Number(process.env.RAG_THRESHOLD || 0.75);

// 计算 UTC 昨天（YYYY-MM-DD）
function utcYesterday(): string {
  const now = new Date();
  const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  return yesterday.toISOString().slice(0, 10);
}

// 从缓存读取 daily summary
async function getDailySummaryFromCache(dateUtc: string): Promise<any | null> {
  const cacheKey = `ai:summary:${dateUtc}:day`;
  return await cacheGet<any>(cacheKey);
}

// 构建系统提示（与 ask 路由一致）
function buildSystemPrompt(lang: string): string {
  const base =
    "你是 ZALEM 驾驶考试学习助手。请基于日本交通法规与题库知识回答用户问题，引用时要简洁，不编造，不输出与驾驶考试无关的内容。";
  if (lang === "ja") {
    return "あなたは ZALEM の運転免許学習アシスタントです。日本の交通法規と問題集の知識に基づいて、簡潔かつ正確に回答してください。推測や捏造は禁止し、関係のない内容は出力しないでください。";
  }
  if (lang === "en") {
    return "You are ZALEM's driving-test study assistant. Answer based on Japan's traffic laws and question bank. Be concise and accurate. Do not fabricate or include unrelated content.";
  }
  return base;
}

// 处理单个问题的预热
async function prewarmQuestion(
  config: ServiceConfig,
  question: string,
  lang: string = "ja",
): Promise<{ success: boolean; question: string; error?: string }> {
  try {
    const model = (config as any).aiModel ?? config["aiModel"];
    const cacheKey = buildCacheKey(question, lang, model);

    // 检查是否已缓存
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return { success: true, question, error: "already cached" };
    }

    // 安全审查
    const safe = await checkSafety(question);
    const blockedCategories: string[] = ["sexual", "violence", "hate", "illegal", "malware", "privacy"];
    const safetyFlag: "ok" | "needs_human" | "blocked" = safe.ok
      ? "ok"
      : safe.category && blockedCategories.includes(safe.category)
      ? "blocked"
      : "needs_human";

    if (!safe.ok && safetyFlag === "blocked") {
      return { success: false, question, error: "blocked by safety policy" };
    }

    // RAG 检索
    const ragSources = await ragSearch(question, RAG_TOP_K, RAG_THRESHOLD, config);
    const ragHits = ragSources.length;

    // 构建参考上下文
    const reference = ragHits > 0
      ? ragSources
          .map((s) => `【${s.title}】${s.snippet || ""}`)
          .join("\n\n---\n\n")
      : "";

    // 调用 OpenAI
    const openai = getOpenAIClient(config);
    const sys = buildSystemPrompt(lang);
    const userPrefix = lang === "ja" ? "質問：" : lang === "en" ? "Question:" : "问题：";
    const refPrefix =
      lang === "ja" ? "関連参照：" : lang === "en" ? "Related references:" : "相关参考资料：";

    const completion = await openai.chat.completions.create({
      model: model,
      temperature: 0.4,
      messages: [
        { role: "system", content: sys },
        {
          role: "user",
          content: `${userPrefix} ${question}\n\n${refPrefix}\n${reference || "（無/None）"}`,
        },
      ],
    });

    const answer = completion.choices?.[0]?.message?.content?.trim() ?? "";
    if (!answer) {
      return { success: false, question, error: "empty response from AI" };
    }

    // 计算成本
    const usage = completion.usage;
    const inputTokens = usage?.prompt_tokens ?? 0;
    const outputTokens = usage?.completion_tokens ?? 0;

    // 估算成本（简化版，使用固定价格）
    const pricing: Record<string, { input: number; output: number }> = {
      "gpt-4o-mini": { input: 0.15 / 1_000_000, output: 0.60 / 1_000_000 },
      "gpt-4o": { input: 2.5 / 1_000_000, output: 10.0 / 1_000_000 },
      "gpt-4-turbo": { input: 10.0 / 1_000_000, output: 30.0 / 1_000_000 },
      "gpt-3.5-turbo": { input: 0.5 / 1_000_000, output: 1.5 / 1_000_000 },
    };

    const modelKey = model.toLowerCase().trim();
    const price = pricing[modelKey] || pricing["gpt-4o-mini"];
    const totalCost = inputTokens * price.input + outputTokens * price.output;
    const approxUsd = Math.round(totalCost * 10000) / 10000;

    // 构建缓存值（与 ask 路由返回结构一致）
    const cacheValue = {
      answer,
      sources: ragSources.map((s) => ({
        title: s.title,
        url: s.url || "",
        score: s.score,
      })),
      model,
      safetyFlag,
      costEstimate: {
        inputTokens,
        outputTokens,
        approxUsd,
      },
      time: new Date().toISOString(),
    };

    // 写入缓存（24小时）
    const cacheTtl = Number(process.env.AI_CACHE_TTL_SECONDS || 86400);
    await cacheSet(cacheKey, cacheValue, cacheTtl);

    return { success: true, question };
  } catch (error) {
    defaultLogger.error("Failed to prewarm question", { error, question });
    return {
      success: false,
      question,
      error: error instanceof Error ? error.message : "unknown error",
    };
  }
}

export default async function cachePrewarmRoute(app: FastifyInstance): Promise<void> {
  app.post(
    "/v1/admin/cache/prewarm",
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const config = app.config as ServiceConfig;

      try {
        // 1) 服务间鉴权
        ensureServiceAuth(request, config);

        // 2) 读取最新日期的 daily summary
        const dateUtc = utcYesterday(); // 使用昨天的数据
        const summary = await getDailySummaryFromCache(dateUtc);

        if (!summary || !summary.topQuestions || !Array.isArray(summary.topQuestions)) {
          reply.code(400).send({
            ok: false,
            errorCode: "VALIDATION_FAILED",
            message: `No daily summary found for date ${dateUtc}`,
          } as Err);
          return;
        }

        // 3) 提取 Top10 问题
        const topQuestions = summary.topQuestions.slice(0, 10);
        if (topQuestions.length === 0) {
          reply.code(400).send({
            ok: false,
            errorCode: "VALIDATION_FAILED",
            message: "No top questions found in daily summary",
          } as Err);
          return;
        }

        // 4) 对每个问题进行预热
        const results = await Promise.all(
          topQuestions.map((q: any) => {
            const question = q.question || q.q || "";
            const lang = q.locale || "ja"; // 默认使用日语
            return prewarmQuestion(config, question, lang);
          }),
        );

        // 统计结果
        const successCount = results.filter((r) => r.success).length;
        const failedCount = results.length - successCount;

        reply.send({
          ok: true,
          data: {
            date: dateUtc,
            total: topQuestions.length,
            success: successCount,
            failed: failedCount,
            results: results.map((r) => ({
              question: r.question,
              success: r.success,
              error: r.error,
            })),
          },
        } as Ok<{
          date: string;
          total: number;
          success: number;
          failed: number;
          results: Array<{ question: string; success: boolean; error?: string }>;
        }>);
      } catch (error) {
        defaultLogger.error("Cache prewarm failed", { error });
        reply.code(500).send({
          ok: false,
          errorCode: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unexpected error",
        } as Err);
      }
    },
  );
}

