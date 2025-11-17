// apps/ai-service/src/routes/ask.ts
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { checkSafety } from "../lib/safety.js";
import { getRagContext } from "../lib/rag.js";
import { getOpenAIClient } from "../lib/openaiClient.js";
import { cacheGet, cacheSet } from "../lib/cache.js";
import type { ServiceConfig } from "../index.js";
import { ensureServiceAuth } from "../middlewares/auth.js";
import { getModelFromConfig, getCacheTtlFromConfig } from "../lib/configLoader.js";

/** 请求体类型 */
type AskBody = {
  question?: string;
  userId?: string;
  lang?: string; // "zh" | "ja" | "en" | ...
  // 场景标识（如 question_translation, question_polish 等）
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
  question: string;
  lang: string;
  userId?: string | null;
  scene?: string | null;
  sourceLanguage?: string | null;
  targetLanguage?: string | null;
} {
  const b = (body ?? {}) as AskBody & { userId?: string | null };

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

  // 处理场景相关参数
  const scene = typeof b.scene === "string" ? b.scene.trim() || null : null;
  const sourceLanguage = typeof b.sourceLanguage === "string" ? b.sourceLanguage.trim() || null : null;
  const targetLanguage = typeof b.targetLanguage === "string" ? b.targetLanguage.trim() || null : null;

  return { question, lang: validLang, userId, scene, sourceLanguage, targetLanguage };
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

/**
 * 从 Supabase 读取场景配置
 */
async function getSceneConfig(
  sceneKey: string,
  locale: string,
  config: ServiceConfig
): Promise<{ prompt: string; outputFormat: string | null } | null> {
  const SUPABASE_URL = config.supabaseUrl;
  const SUPABASE_SERVICE_KEY = config.supabaseServiceKey;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return null;
  }

  try {
    const url = `${SUPABASE_URL.replace(/\/+$/, "")}/rest/v1/ai_scene_config?scene_key=eq.${encodeURIComponent(sceneKey)}&enabled=eq.true&select=system_prompt_zh,system_prompt_ja,system_prompt_en,output_format`;
    console.log("[AI-SERVICE] 读取场景配置:", { sceneKey, locale, url: url.substring(0, 100) + "..." });
    const res = await fetch(url, {
      method: "GET",
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      console.warn("[AI-SERVICE] 场景配置请求失败:", { status: res.status, statusText: res.statusText });
      return null;
    }

    const data = (await res.json()) as Array<{
      system_prompt_zh: string;
      system_prompt_ja: string | null;
      system_prompt_en: string | null;
      output_format: string | null;
    }>;

    if (!data || data.length === 0) {
      console.warn("[AI-SERVICE] 场景配置不存在:", { sceneKey });
      return null;
    }

    const sceneConfig = data[0];
    const lang = locale.toLowerCase();

    // 根据语言选择 prompt
    let prompt = sceneConfig.system_prompt_zh;
    if (lang.startsWith("ja") && sceneConfig.system_prompt_ja) {
      prompt = sceneConfig.system_prompt_ja;
      console.log("[AI-SERVICE] 使用日文 prompt");
    } else if (lang.startsWith("en") && sceneConfig.system_prompt_en) {
      prompt = sceneConfig.system_prompt_en;
      console.log("[AI-SERVICE] 使用英文 prompt");
    } else {
      console.log("[AI-SERVICE] 使用中文 prompt (locale:", locale, "lang:", lang, ")");
    }

    const finalPrompt = prompt || sceneConfig.system_prompt_zh;
    console.log("[AI-SERVICE] 场景配置读取成功:", { 
      sceneKey, 
      locale, 
      promptLength: finalPrompt.length,
      promptPreview: finalPrompt.substring(0, 100) + "..."
    });

    return {
      prompt: finalPrompt,
      outputFormat: sceneConfig.output_format,
    };
  } catch (error) {
    console.error("[AI-SERVICE] 读取场景配置失败:", error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * 替换 prompt 中的占位符
 */
function replacePlaceholders(
  prompt: string,
  sourceLanguage?: string,
  targetLanguage?: string
): string {
  let result = prompt;

  // 替换 {sourceLanguage} 和 {源语言}
  if (sourceLanguage) {
    result = result.replace(/{sourceLanguage}/gi, sourceLanguage);
    result = result.replace(/{源语言}/g, sourceLanguage);
  }

  // 替换 {targetLanguage} 和 {目标语言}
  if (targetLanguage) {
    result = result.replace(/{targetLanguage}/gi, targetLanguage);
    result = result.replace(/{目标语言}/g, targetLanguage);
  }

  return result;
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
      const startTime = Date.now(); // 记录开始时间

      try {
        // 1) 服务间鉴权（统一中间件）
        ensureServiceAuth(request, config);

        // 2) 校验请求体
        const { question, lang, scene, sourceLanguage, targetLanguage } = parseAndValidateBody(request.body);
        
        // 记录接收到的参数
        console.log("[AI-SERVICE] 接收到的请求参数:", {
          scene,
          sourceLanguage,
          targetLanguage,
          lang,
          questionLength: question.length
        });

        // 3) 从数据库读取模型配置（优先）或使用环境变量
        const model = await getModelFromConfig();
        const cacheKey = buildCacheKey(question, lang, model, scene, sourceLanguage, targetLanguage);
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
        const aiProviderPromise = (async (): Promise<"openai" | "openrouter"> => {
          if (headerProvider === "openai" || headerProvider === "openrouter") {
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
        
        // 并行执行：安全审查、RAG检索（需要aiProvider）、配置读取
        const [safe, reference, aiProviderResult] = await Promise.all([
          checkSafety(question),
          // RAG 检索需要先获取 aiProvider，但可以并行执行
          aiProviderPromise.then(provider => getRagContext(question, lang, config, provider).catch(() => "")),
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

        // 6) 调用 OpenAI
        let openai;
        try {
          openai = getOpenAIClient(config, aiProvider);
          console.log("[ASK ROUTE] AI client initialized successfully", {
            aiProvider,
            baseUrl: openai.baseURL,
            isOpenRouter: aiProvider === "openrouter",
            hasOpenRouterKey: !!config.openrouterApiKey,
            hasOpenAIKey: !!config.openaiApiKey,
          });
        } catch (e) {
          const error = e as Error;
          console.error("[ASK ROUTE] Failed to initialize AI client:", {
            error: error.message,
            stack: error.stack,
            aiProvider,
            openaiBaseUrl: process.env.OPENAI_BASE_URL,
            openrouterBaseUrl: process.env.OPENROUTER_BASE_URL,
          });
          reply.code(500).send({
            ok: false,
            errorCode: "CONFIG_ERROR",
            message: error.message || "Failed to initialize AI client",
          });
          return;
        }

        // 5) 构建系统 prompt（优先使用场景配置）
        // 重要：对于翻译场景，应该使用 targetLanguage 来选择 prompt 语言，而不是 lang
        // lang 是请求的语言标识，targetLanguage 是翻译的目标语言
        let sys: string;
        const promptLocale = targetLanguage || lang; // 优先使用 targetLanguage（翻译目标语言）
        console.log("[AI-SERVICE] 构建系统 prompt:", { 
          scene, 
          sourceLanguage, 
          targetLanguage, 
          lang, 
          promptLocale,
          willUseTargetLanguage: !!targetLanguage
        });
        
        if (scene) {
          // 尝试从数据库读取场景配置
          // 使用 targetLanguage 或 lang 来选择 prompt 的语言版本
          const sceneConfig = await getSceneConfig(scene, promptLocale, config);
          if (sceneConfig) {
            // 使用场景配置的 prompt，并替换占位符
            sys = replacePlaceholders(sceneConfig.prompt, sourceLanguage || undefined, targetLanguage || undefined);
            console.log("[AI-SERVICE] 使用场景配置:", { 
              scene, 
              sourceLanguage, 
              targetLanguage,
              promptLocale,
              promptLength: sys.length,
              promptPreview: sys.substring(0, 200) + "..."
            });
          } else {
            // 场景配置不存在，使用默认 prompt
            // 对于翻译场景，如果 targetLanguage 存在，应该使用 targetLanguage 的语言
            const defaultPromptLang = targetLanguage || lang;
            sys = buildSystemPrompt(defaultPromptLang);
            console.warn("[AI-SERVICE] 场景配置不存在，使用默认 prompt:", { scene, lang: defaultPromptLang });
          }
        } else {
          // 没有指定场景，使用默认 prompt
          const defaultPromptLang = targetLanguage || lang;
          sys = buildSystemPrompt(defaultPromptLang);
          console.log("[AI-SERVICE] 未指定场景，使用默认 prompt:", { lang: defaultPromptLang });
        }
        
        const userPrefix = lang === "ja" ? "質問：" : lang === "en" ? "Question:" : "问题：";
        const refPrefix =
          lang === "ja" ? "関連参照：" : lang === "en" ? "Related references:" : "相关参考资料：";

        let completion;
        try {
          console.log("[ASK ROUTE] Calling AI API", {
            model,
            questionLength: question.length,
            hasReference: !!reference,
            referenceLength: reference?.length || 0,
          });
          completion = await openai.chat.completions.create({
            model: model, // 使用从数据库读取的模型配置
            temperature: 0.4,
            messages: [
              { role: "system", content: sys },
              {
                role: "user",
                content: `${userPrefix} ${question}\n\n${refPrefix}\n${reference || "（無/None）"}`,
              },
            ],
          });
          console.log("[ASK ROUTE] AI API call successful", {
            model,
            hasAnswer: !!completion.choices?.[0]?.message?.content,
            inputTokens: completion.usage?.prompt_tokens,
            outputTokens: completion.usage?.completion_tokens,
          });
        } catch (e) {
          const error = e as Error & { status?: number; code?: string };
          const resolvedBaseUrl = openai.baseURL;
          console.error("[ASK ROUTE] AI API call failed:", {
            error: error.message,
            name: error.name,
            status: error.status,
            code: error.code,
            stack: error.stack,
            model,
            baseUrl: resolvedBaseUrl,
            aiProvider,
          });
          // 提取更详细的错误信息
          let errorMessage = error.message || "AI API call failed";
          let errorCode = "PROVIDER_ERROR";
          let statusCode = 502;

          // 处理常见的 OpenRouter/OpenAI 错误
          if (error.status === 401 || error.code === "invalid_api_key") {
            errorCode = "AUTH_REQUIRED";
            errorMessage = "Invalid API key. Please check your OPENROUTER_API_KEY or OPENAI_API_KEY.";
            statusCode = 401;
          } else if (error.status === 429 || error.code === "rate_limit_exceeded") {
            errorCode = "RATE_LIMIT_EXCEEDED";
            errorMessage = "Rate limit exceeded. Please try again later.";
            statusCode = 429;
          } else if (error.status === 400 || error.code === "invalid_request_error") {
            errorCode = "VALIDATION_FAILED";
            errorMessage = `Invalid request: ${errorMessage}`;
            statusCode = 400;
          } else if (error.message?.includes("model")) {
            errorMessage = `Model '${model}' not found or unavailable. Please check the model name.`;
          }

          reply.code(statusCode).send({
            ok: false,
            errorCode,
            message: errorMessage,
            details: {
              model,
              baseUrl: resolvedBaseUrl,
              aiProvider,
            },
          });
          return;
        }

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
