// apps/ai-service/src/routes/ask.ts
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { checkSafety } from "../lib/safety";
import { getRagContext } from "../lib/rag";
import { getOpenAIClient } from "../lib/openaiClient";
import { cacheGet, cacheSet } from "../lib/cache";
import type { ServiceConfig } from "../index";
import { ensureServiceAuth } from "../middlewares/auth";
import { logAiInteraction } from "../lib/dbLogger";

/** 请求体类型 */
type AskBody = {
  question?: string;
  userId?: string;
  lang?: string; // "zh" | "ja" | "en" | ...
};

/** 响应体类型 */
type AskResult = {
  answer: string;
  sources?: Array<{ title: string; url: string; snippet?: string }>;
  model: string;
  safetyFlag: "ok" | "needs_human" | "blocked";
  costEstimate?: { inputTokens?: number; outputTokens?: number; approxUsd?: number };
  // 向后兼容字段
  question?: string;
  reference?: string | null;
  tokens?: { prompt?: number; completion?: number; total?: number };
  lang?: string;
  cached?: boolean;
  time?: string; // ISO8601
};

/** 简单语言白名单（可按需扩展） */
const LANG_WHITELIST = new Set(["zh", "ja", "en"]);

/** 问题长度限制，避免滥用 */
const MAX_QUESTION_LEN = 2000;

/** 缓存时长（秒） */
const CACHE_TTL_SECONDS = 1800;

/**
 * 估算 OpenAI 成本（USD）
 * 基于 2024 年 OpenAI 定价（gpt-4o-mini 等）
 * 参考：https://openai.com/pricing
 */
function estimateCostUsd(
  model: string,
  inputTokens?: number,
  outputTokens?: number,
): number | null {
  if (typeof inputTokens !== "number" || typeof outputTokens !== "number") {
    return null;
  }

  // gpt-4o-mini 定价（每 1M tokens）
  // Input: $0.15 / 1M tokens
  // Output: $0.60 / 1M tokens
  const pricing: Record<string, { input: number; output: number }> = {
    "gpt-4o-mini": { input: 0.15 / 1_000_000, output: 0.60 / 1_000_000 },
    "gpt-4o": { input: 2.5 / 1_000_000, output: 10.0 / 1_000_000 },
    "gpt-4-turbo": { input: 10.0 / 1_000_000, output: 30.0 / 1_000_000 },
    "gpt-3.5-turbo": { input: 0.5 / 1_000_000, output: 1.5 / 1_000_000 },
  };

  const modelKey = model.toLowerCase().trim();
  const price = pricing[modelKey] || pricing["gpt-4o-mini"]; // 默认使用 gpt-4o-mini 价格

  const inputCost = inputTokens * price.input;
  const outputCost = outputTokens * price.output;
  const total = inputCost + outputCost;

  // 保留 4 位小数，与数据库 numeric(10,4) 对齐
  return Math.round(total * 10000) / 10000;
}

/** 读取并校验请求体 */
function parseAndValidateBody(body: unknown): {
  question: string;
  lang: string;
  userId?: string;
} {
  const b = (body ?? {}) as AskBody;

  if (!b.question || typeof b.question !== "string") {
    const err: Error & { statusCode?: number } = new Error("Missing or invalid 'question'");
    err.statusCode = 400;
    throw err;
  }
  const question = b.question.trim();
  if (question.length === 0 || question.length > MAX_QUESTION_LEN) {
    const err: Error & { statusCode?: number } = new Error("Question length out of range");
    err.statusCode = 400;
    throw err;
  }

  const lang = (typeof b.lang === "string" ? b.lang.toLowerCase().trim() : "zh") || "zh";
  const validLang = LANG_WHITELIST.has(lang) ? lang : "zh";

  return { question, lang: validLang, userId: typeof b.userId === "string" ? b.userId : undefined };
}

/** 生成缓存 Key（包含语言与模型，避免跨配置命中） */
function buildCacheKey(question: string, lang: string, model: string): string {
  return `ask:v1:q=${encodeURIComponent(question)}:l=${lang}:m=${model}`;
}

/** System Prompt（根据语言输出） */
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

export default async function askRoute(app: FastifyInstance): Promise<void> {
  app.post(
    "/ask",
    async (request: FastifyRequest<{ Body: AskBody }>, reply: FastifyReply): Promise<void> => {
      const config = app.config as ServiceConfig;

      try {
        // 1) 服务间鉴权（统一中间件）
        ensureServiceAuth(request, config);

        // 2) 校验请求体
        const { question, lang, userId } = parseAndValidateBody(request.body);

        // 3) 命中缓存
        const model = (config as any).aiModel ?? config["aiModel"];
        const cacheKey = buildCacheKey(question, lang, model);
        const cached = await cacheGet<AskResult>(cacheKey);
        if (cached) {
          // 异步记录日志（不阻断）
          void logAiInteraction({
            userId,
            question,
            answer: cached.answer,
            lang,
            model: cached.model,
            ragHits: Array.isArray(cached.sources) ? cached.sources.length : (cached.reference ? 1 : 0),
            safetyFlag: cached.safetyFlag || "ok",
            costEstUsd: cached.costEstimate?.approxUsd ?? null,
            createdAtIso: cached.time || new Date().toISOString(),
          }).catch(() => {});

          // 返回标准响应结构
          reply.send({
            ok: true,
            data: {
              answer: cached.answer,
              sources: cached.sources,
              model: cached.model,
              safetyFlag: cached.safetyFlag || "ok",
              costEstimate: cached.costEstimate,
            },
          });
          return;
        }

        // 4) 安全审查
        const safe = await checkSafety(question);
        // 映射 category 到 safetyFlag: 高风险类别视为 blocked，其他为 needs_human
        const blockedCategories: string[] = ["sexual", "violence", "hate", "illegal", "malware", "privacy"];
        const safetyFlag: "ok" | "needs_human" | "blocked" = safe.ok
          ? "ok"
          : safe.category && blockedCategories.includes(safe.category)
          ? "blocked"
          : "needs_human";
        if (!safe.ok && safetyFlag === "blocked") {
          reply.code(403).send({
            ok: false,
            errorCode: "CONTENT_BLOCKED",
            message: safe.message || "Content blocked by safety policy",
          });
          return;
        }

        // 5) RAG 检索（可能为空）
        const reference = await getRagContext(question, lang, config);

        // 6) 调用 OpenAI
        const openai = getOpenAIClient(config);
        const sys = buildSystemPrompt(lang);
        const userPrefix = lang === "ja" ? "質問：" : lang === "en" ? "Question:" : "问题：";
        const refPrefix =
          lang === "ja" ? "関連参照：" : lang === "en" ? "Related references:" : "相关参考资料：";

        const completion = await openai.chat.completions.create({
          model: (config as any).aiModel ?? config["aiModel"],
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
          reply.code(502).send({
            ok: false,
            errorCode: "PROVIDER_ERROR",
            message: "Empty response from AI model",
          });
          return;
        }

        // 提取 tokens 信息
        const inputTokens = completion.usage?.prompt_tokens;
        const outputTokens = completion.usage?.completion_tokens;
        const totalTokens = completion.usage?.total_tokens;

        // 计算成本估算
        const approxUsd = estimateCostUsd(model, inputTokens, outputTokens);

        // 构建 sources 数组（从 reference 转换，后续可从 RAG 返回完整结构）
        const sources: Array<{ title: string; url: string; snippet?: string }> = reference
          ? [{ title: "RAG Reference", url: "", snippet: reference.slice(0, 200) }]
          : [];

        const ragHits = sources.length;

        const result: AskResult = {
          answer,
          sources: ragHits > 0 ? sources : undefined,
          model,
          safetyFlag,
          costEstimate: {
            inputTokens,
            outputTokens,
            approxUsd: approxUsd ?? undefined,
          },
          // 向后兼容字段
          question,
          reference: reference || null,
          tokens: {
            prompt: inputTokens,
            completion: outputTokens,
            total: totalTokens,
          },
          lang,
          cached: false,
          time: new Date().toISOString(),
        };

        // 7) 写入缓存（不影响主流程）
        void cacheSet(cacheKey, result, CACHE_TTL_SECONDS).catch(() => {});

        // 8) 异步写 ai_logs（失败仅告警，不阻断）
        void logAiInteraction({
          userId,
          question,
          answer,
          lang,
          model,
          ragHits,
          safetyFlag,
          costEstUsd: approxUsd,
          createdAtIso: result.time,
        }).catch(() => {});

        // 9) 返回标准响应结构
        reply.send({
          ok: true,
          data: {
            answer,
            sources: ragHits > 0 ? sources : undefined,
            model,
            safetyFlag,
            costEstimate: {
              inputTokens,
              outputTokens,
              approxUsd: approxUsd ?? undefined,
            },
          },
        });
      } catch (e) {
        request.log.error({ err: e }, "ask_route_error");
        const err = e as Error & { statusCode?: number };
        const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
        const message = status >= 500 ? "Internal Server Error" : err.message || "Bad Request";
        reply.code(status).send({
          ok: false,
          errorCode:
            status === 400
              ? "VALIDATION_FAILED"
              : status === 401
              ? "AUTH_REQUIRED"
              : status === 403
              ? "FORBIDDEN"
              : status === 429
              ? "RATE_LIMIT_EXCEEDED"
              : "INTERNAL_ERROR",
          message,
        });
      }
    },
  );
}
