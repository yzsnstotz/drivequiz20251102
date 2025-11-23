// apps/ai-service/src/routes/ask.ts
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { checkSafety } from "../lib/safety.js";
import { getRagContext } from "../lib/rag.js";
import { cacheGet, cacheSet } from "../lib/cache.js";
import type { ServiceConfig } from "../index.js";
import { ensureServiceAuth } from "../middlewares/auth.js";
import { getModelFromConfig, getCacheTtlFromConfig } from "../lib/configLoader.js";
import { runScene } from "../lib/sceneRunner.js";
import { providerRateLimitMiddleware } from "../lib/rateLimit.js";

/** 请求体类型 */
type AskBody = {
  question?: string | {
    id?: number;
    questionText?: string;
    correctAnswer?: string;
    type?: string;
    options?: any;
    explanation?: string;
    licenseTypeTag?: string | null;
    stageTag?: string | null;
    topicTags?: any[];
    sourceLanguage?: string;
    [key: string]: any;
  };
  userId?: string;
  lang?: string; // "zh" | "ja" | "en" | ...
  // 场景标识（如 question_translation, question_polish, question_full_pipeline 等）
  scene?: string;
  // 源语言（用于翻译场景）
  sourceLanguage?: string;
  // 目标语言（用于翻译场景）
  targetLanguage?: string;
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
  question: string | {
    id?: number;
    questionText?: string;
    correctAnswer?: string;
    type?: string;
    options?: any;
    explanation?: string;
    licenseTypeTag?: string | null;
    stageTag?: string | null;
    topicTags?: any[];
    sourceLanguage?: string;
    [key: string]: any;
  };
  normalizedQuestion: string; // 规范化后的字符串，用于 prompt 构建
  lang: string;
  userId?: string | null;
  scene?: string | null;
  sourceLanguage?: string | null;
  targetLanguage?: string | null;
} {
  const b = (body ?? {}) as AskBody & { userId?: string | null };

  // ✅ 修复：支持 question 为字符串或对象
  if (!b.question) {
    const err: Error & { statusCode?: number } = new Error("Missing 'question'");
    err.statusCode = 400;
    throw err;
  }

  // 规范化 question：如果是对象，提取 questionText；如果是字符串，直接使用
  let normalizedQuestion: string;
  if (typeof b.question === "string") {
    normalizedQuestion = b.question.trim();
  } else if (typeof b.question === "object" && b.question !== null) {
    // 对象格式：优先使用 questionText，否则 JSON 化
    normalizedQuestion = b.question.questionText || JSON.stringify(b.question, null, 2);
  } else {
    const err: Error & { statusCode?: number } = new Error("Invalid 'question' type");
    err.statusCode = 400;
    throw err;
  }

  // 验证规范化后的 question 长度
  if (normalizedQuestion.length === 0 || normalizedQuestion.length > MAX_QUESTION_LEN) {
    const err: Error & { statusCode?: number } = new Error("Question length out of range");
    err.statusCode = 400;
    throw err;
  }

  const lang = (typeof b.lang === "string" ? b.lang.toLowerCase().trim() : "zh") || "zh";
  const validLang = LANG_WHITELIST.has(lang) ? lang : "zh";

  // 处理 userId：支持 string、null、undefined
  let userId: string | null | undefined = undefined;
  if (b.userId !== undefined && b.userId !== null) {
    if (typeof b.userId === "string") {
      userId = b.userId;
    } else {
      userId = null;
    }
  } else if (b.userId === null) {
    userId = null;
  }

  // ✅ 修复：确保 scene 从 body 正确解构
  const scene = typeof b.scene === "string" ? b.scene.trim() || null : null;
  const sourceLanguage = typeof b.sourceLanguage === "string" ? b.sourceLanguage.trim() || null : null;
  const targetLanguage = typeof b.targetLanguage === "string" ? b.targetLanguage.trim() || null : null;

  return { 
    question: b.question, // 保留原始 question（可能是对象或字符串）
    normalizedQuestion, // 规范化后的字符串
    lang: validLang, 
    userId, 
    scene, 
    sourceLanguage, 
    targetLanguage 
  };
}

/** 生成缓存 Key（包含语言、模型和场景，避免跨配置命中） */
export function buildCacheKey(question: string, lang: string, model: string, scene?: string | null, sourceLanguage?: string | null, targetLanguage?: string | null): string {
  const parts = [
    `q=${encodeURIComponent(question)}`,
    `l=${lang}`,
    `m=${model}`,
  ];
  if (scene) {
    parts.push(`s=${encodeURIComponent(scene)}`);
  }
  if (sourceLanguage) {
    parts.push(`from=${encodeURIComponent(sourceLanguage)}`);
  }
  if (targetLanguage) {
    parts.push(`to=${encodeURIComponent(targetLanguage)}`);
  }
  return `ask:v1:${parts.join(":")}`;
}

export default async function askRoute(app: FastifyInstance): Promise<void> {
  const config = app.config as ServiceConfig;

  // 为 /ask 路由注册 Provider 频率限制中间件
  app.addHook("onRequest", async (request, reply) => {
    await providerRateLimitMiddleware(request, reply);
  });

  app.post(
    "/ask",
    async (request: FastifyRequest<{ Body: AskBody }>, reply: FastifyReply): Promise<void> => {
      const config = app.config as ServiceConfig;
      const startTime = Date.now(); // 记录开始时间

      try {
        // 1) 服务间鉴权（统一中间件）
        ensureServiceAuth(request, config);

        // 2) 校验请求体
        const { question, normalizedQuestion, lang, scene, sourceLanguage, targetLanguage } = parseAndValidateBody(request.body);
        
        // ✅ 修复：确保 scene 已正确解构，并记录关键日志
        if (!scene) {
          reply.code(400).send({
            ok: false,
            errorCode: "VALIDATION_FAILED",
            message: "scene is required",
          });
          return;
        }

        // 记录接收到的参数（注意：不打印完整 question 内容，避免日志爆炸）
        const questionType = typeof question === "string" ? "string" : "object";
        const questionLength = typeof question === "string" 
          ? question.length 
          : (question?.questionText?.length || JSON.stringify(question).length);
        
        app.log.info(
          { 
            scene, 
            hasQuestion: !!question, 
            questionType, 
            questionLength,
            sourceLanguage, 
            targetLanguage,
            lang 
          },
          "[ai-service] /v1/ask received"
        );

        // 3) 从数据库读取模型配置（优先）或使用环境变量
        const model = await getModelFromConfig();
        // ✅ 修复：使用 normalizedQuestion 构建缓存 key（确保一致性）
        const cacheKey = buildCacheKey(normalizedQuestion, lang, model, scene, sourceLanguage, targetLanguage);
        const cached = await cacheGet<AskResult>(cacheKey);
        if (cached) {
          // 注意：不再在这里写入 ai_logs，由主路由统一写入（包含题目标识等完整信息）
          // 主路由会在 STEP 4.5.3 或 STEP 7 中写入日志

          // 计算耗时（缓存命中时耗时很短）
          const durationMs = Date.now() - startTime;
          const durationSec = (durationMs / 1000).toFixed(2);

          // 构建 sources 数组（包含耗时信息）
          const sources: Array<{ title: string; url: string; snippet?: string }> = [
            { title: "处理耗时", url: "", snippet: `${durationSec} 秒` },
            ...(cached.sources || []),
          ];

          // 返回标准响应结构（标记为缓存答案，始终包含耗时信息）
          reply.send({
            ok: true,
            data: {
              answer: cached.answer,
              sources: sources, // 始终返回 sources（包含耗时信息）
              model: cached.model,
              safetyFlag: cached.safetyFlag || "ok",
              costEstimate: cached.costEstimate,
              cached: true, // 标记为缓存答案
            },
          });
          return;
        }

        // 4) 并行执行：安全审查、RAG检索、配置读取（优化性能）
        // 优先从请求头读取 X-AI-Provider，避免不必要的数据库查询
        const { getAiProviderFromConfig } = await import("../lib/configLoader.js");
        
        // 获取 aiProvider（用于 RAG 检索）
        // 注意：HTTP 头名称是大小写不敏感的，但 Fastify 会将其转换为小写
        const headerProvider = (request.headers["x-ai-provider"] || request.headers["X-AI-Provider"]) as string | undefined;
        const aiProviderPromise = (async (): Promise<"openai" | "openrouter" | "gemini"> => {
          if (headerProvider === "openai" || headerProvider === "openrouter" || headerProvider === "gemini") {
            console.log("[ASK ROUTE] AI provider from header", { 
              aiProvider: headerProvider,
              rawHeader: request.headers["x-ai-provider"] || request.headers["X-AI-Provider"],
              allHeaders: Object.keys(request.headers).filter(k => k.toLowerCase().includes("ai-provider")),
            });
            return headerProvider;
          }
          console.log("[ASK ROUTE] AI provider not found in header, reading from config", {
            headerProvider,
            availableHeaders: Object.keys(request.headers).filter(k => k.toLowerCase().includes("ai") || k.toLowerCase().includes("provider")),
          });
          const provider = await getAiProviderFromConfig();
          console.log("[ASK ROUTE] AI provider from config", { aiProvider: provider });
          return provider;
        })();
        
        // ✅ 修复：使用 normalizedQuestion 进行安全审查和 RAG 检索
        // 并行执行：安全审查、RAG检索（需要aiProvider）、配置读取
        const [safe, reference, aiProviderResult] = await Promise.all([
          checkSafety(normalizedQuestion),
          // RAG 检索需要先获取 aiProvider，但可以并行执行
          aiProviderPromise.then(provider => getRagContext(normalizedQuestion, lang, config, provider).catch(() => "")),
          aiProviderPromise,
        ]);

        // 处理安全审查结果
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

        const aiProvider = aiProviderResult;

        // 5) 使用统一的场景执行模块
        // ⚠️ 注意：所有场景执行逻辑都在 sceneRunner.ts 中，这里只负责调用
        const promptLocale = targetLanguage || lang; // 优先使用 targetLanguage（翻译目标语言）
        const userPrefix = lang === "ja" ? "質問：" : lang === "en" ? "Question:" : "问题：";
        const refPrefix =
          lang === "ja" ? "関連参照：" : lang === "en" ? "Related references:" : "相关参考资料：";

        let sceneResult;
        let inputTokens: number | undefined;
        let outputTokens: number | undefined;
        let totalTokens: number | undefined;
        
        try {
          // ✅ 修复：scene 已在上方验证，这里直接使用
          app.log.debug({ scene }, "[ai-service] buildPromptForScene");
          
          console.log("[ASK ROUTE] 使用场景执行模块:", {
            scene,
            locale: promptLocale,
            sourceLanguage,
            targetLanguage,
            model,
            aiProvider,
          });
          
          // ✅ 修复：使用 normalizedQuestion 传递给 runScene（确保 prompt 构建正确）
          sceneResult = await runScene({
            sceneKey: scene, // ✅ 确保 scene 从解构中获取，不是自由变量
            locale: promptLocale,
            question: normalizedQuestion, // 使用规范化后的字符串
            reference: reference || null,
            userPrefix,
            refPrefix,
            config: {
              supabaseUrl: config.supabaseUrl,
              supabaseServiceKey: config.supabaseServiceKey,
              aiModel: model,
            },
            providerKind: "openai",
            serviceConfig: config,
            aiProvider,
            model,
            sourceLanguage: sourceLanguage || null,
            targetLanguage: targetLanguage || null,
            temperature: 0.4,
          });
            
          // 从 sceneResult 中获取 tokens 信息（如果可用）
          inputTokens = sceneResult.tokens?.prompt;
          outputTokens = sceneResult.tokens?.completion;
          totalTokens = sceneResult.tokens?.total;
        } catch (e) {
          const error = e as Error & { status?: number; code?: string };
          console.error("[ASK ROUTE] 场景执行失败:", {
            error: error.message,
            name: error.name,
            status: error.status,
            code: error.code,
            stack: error.stack?.substring(0, 500),
            scene,
            model,
            aiProvider,
          });
          
          // 提取更详细的错误信息
          let errorMessage = error.message || "Scene execution failed";
          let errorCode = "PROVIDER_ERROR";
          let statusCode = 502;

          // 处理常见的错误
          if (error.message?.includes("Scene not found")) {
            errorCode = "SCENE_NOT_FOUND";
            errorMessage = `Scene '${scene}' not found or disabled`;
            statusCode = 404;
          } else if (error.message?.includes("timeout")) {
            errorCode = "TIMEOUT";
            errorMessage = "Scene execution timeout";
            statusCode = 504;
          } else if (error.message?.includes("API key") || error.message?.includes("auth")) {
            errorCode = "AUTH_REQUIRED";
            errorMessage = "Invalid API key or authentication failed";
            statusCode = 401;
          }

          reply.code(statusCode).send({
            ok: false,
            errorCode,
            message: errorMessage,
            details: {
              scene,
              model,
              aiProvider,
            },
          });
          return;
        }

        const answer = sceneResult.rawText;
        if (!answer) {
          reply.code(502).send({
            ok: false,
            errorCode: "PROVIDER_ERROR",
            message: "Empty response from AI model",
          });
          return;
        }

        // 计算成本估算
        const approxUsd = estimateCostUsd(model, inputTokens, outputTokens);

        // 计算处理耗时
        const durationMs = Date.now() - startTime;
        const durationSec = (durationMs / 1000).toFixed(2);

        // 构建 sources 数组（包含耗时信息和 RAG 参考）
        const sources: Array<{ title: string; url: string; snippet?: string }> = [
          { title: "处理耗时", url: "", snippet: `${durationSec} 秒` },
          ...(reference ? [{ title: "RAG Reference", url: "", snippet: reference.slice(0, 200) }] : []),
        ];

        const ragHits = reference ? 1 : 0;

        const result: AskResult = {
          answer,
          sources: sources, // 始终返回 sources（包含耗时信息）
          model,
          safetyFlag,
          costEstimate: {
            inputTokens,
            outputTokens,
            approxUsd: approxUsd ?? undefined,
          },
          // 向后兼容字段
          question: normalizedQuestion, // 使用规范化后的字符串
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
        // 从数据库读取缓存 TTL 配置（优先）或使用环境变量
        const cacheTtl = await getCacheTtlFromConfig();
        void cacheSet(cacheKey, result, cacheTtl).catch(() => {});

        // 8) 注意：不再在这里写入 ai_logs，由主路由统一写入（包含题目标识等完整信息）
        // 主路由会在 STEP 7 中写入日志

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
        const err = e as Error & { statusCode?: number; code?: string; status?: number };
        console.error("[ASK ROUTE] Error caught:", {
          message: err.message,
          name: err.name,
          stack: err.stack,
          statusCode: err.statusCode,
          code: err.code,
          status: err.status,
        });

        // 根据错误类型确定状态码和错误码
        let status = 500;
        let errorCode = "INTERNAL_ERROR";
        let message = "Internal Server Error";

        if (err.statusCode && err.statusCode >= 400) {
          status = err.statusCode;
        } else if (err.status && err.status >= 400) {
          status = err.status;
        }

        // 根据状态码设置错误码
        if (status === 400) {
          errorCode = "VALIDATION_FAILED";
          message = err.message || "Bad Request";
        } else if (status === 401) {
          errorCode = "AUTH_REQUIRED";
          message = err.message || "Authentication required";
        } else if (status === 403) {
          errorCode = "FORBIDDEN";
          message = err.message || "Forbidden";
        } else if (status === 429) {
          errorCode = "RATE_LIMIT_EXCEEDED";
          message = err.message || "Rate limit exceeded";
        } else if (status >= 500) {
          errorCode = "INTERNAL_ERROR";
          // 在开发环境中返回详细错误信息，生产环境返回通用错误
          message = process.env.NODE_ENV === "development" 
            ? err.message || "Internal Server Error"
            : "Internal Server Error";
        } else {
          message = err.message || "Bad Request";
        }

        reply.code(status).send({
          ok: false,
          errorCode,
          message,
          // 在开发环境中包含详细错误信息
          ...(process.env.NODE_ENV === "development" && {
            details: {
              errorName: err.name,
              errorMessage: err.message,
              stack: err.stack,
            },
          }),
        });
      }
    },
  );
}
