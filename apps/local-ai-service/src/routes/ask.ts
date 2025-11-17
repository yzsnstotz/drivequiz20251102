import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { ensureServiceAuth } from "../middlewares/auth.js";
import { getRagContext } from "../lib/rag.js";
import { callOllamaChat } from "../lib/ollamaClient.js";
import type { LocalAIConfig } from "../lib/config.js";

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type AskBody = {
  question?: string;
  userId?: string;
  lang?: string;
  // 对话历史（可选，用于上下文连贯）
  messages?: ChatMessage[];
  // 最大历史消息数（默认 10）
  maxHistory?: number;
  // 种子URL（可选，只返回该URL下的子页面）
  seedUrl?: string;
  // 场景标识（如 question_translation）
  scene?: string;
  // 源语言（用于翻译场景）
  sourceLanguage?: string;
  // 目标语言（用于翻译场景）
  targetLanguage?: string;
};

type AskResult = {
  answer: string;
  sources?: Array<{ title: string; url: string; snippet?: string }>;
  model: string;
  safetyFlag: "ok" | "needs_human" | "blocked";
  // 向后兼容字段
  reference?: string | null;
  tokens?: { prompt?: number; completion?: number; total?: number };
  lang?: string;
  cached?: boolean;
  time?: string;
};

/**
 * 从 Supabase 读取 AI Provider 超时配置
 */
async function getProviderTimeout(config: LocalAIConfig): Promise<number> {
  const SUPABASE_URL = config.supabaseUrl;
  const SUPABASE_SERVICE_KEY = config.supabaseServiceKey;
  const DEFAULT_TIMEOUT_MS = 120000; // 默认 120 秒（与 timeout_local 默认值一致）

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.warn("[LOCAL-AI] Supabase 配置缺失，使用默认超时时间:", DEFAULT_TIMEOUT_MS);
    return DEFAULT_TIMEOUT_MS;
  }

  try {
    const url = `${SUPABASE_URL.replace(/\/+$/, "")}/rest/v1/ai_config?key=eq.timeout_local&select=value`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(5000), // 读取配置的超时时间较短
    });

    if (res.ok) {
      const data = (await res.json()) as Array<{ value: string }>;
      if (data && data.length > 0) {
        const timeoutMs = Number(data[0].value);
        if (!isNaN(timeoutMs) && timeoutMs > 0) {
          console.log("[LOCAL-AI] 使用配置的超时时间:", timeoutMs, "ms");
          return timeoutMs;
        }
      }
    }
  } catch (error) {
    console.warn("[LOCAL-AI] 读取超时配置失败，使用默认值:", error instanceof Error ? error.message : String(error));
  }

  console.log("[LOCAL-AI] 使用默认超时时间:", DEFAULT_TIMEOUT_MS, "ms");
  return DEFAULT_TIMEOUT_MS;
}

/**
 * 从 Supabase 读取场景配置
 */
async function getSceneConfig(
  sceneKey: string,
  locale: string,
  config: LocalAIConfig
): Promise<{ prompt: string; outputFormat: string | null } | null> {
  const SUPABASE_URL = config.supabaseUrl;
  const SUPABASE_SERVICE_KEY = config.supabaseServiceKey;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.warn("[LOCAL-AI] Supabase 配置缺失，无法读取场景配置");
    return null;
  }

  // 获取 AI Provider 超时配置
  const timeoutMs = await getProviderTimeout(config);

  const url = `${SUPABASE_URL.replace(/\/+$/, "")}/rest/v1/ai_scene_config?scene_key=eq.${encodeURIComponent(sceneKey)}&enabled=eq.true&select=system_prompt_zh,system_prompt_ja,system_prompt_en,output_format`;
  
  try {
    console.log("[LOCAL-AI] 读取场景配置:", { sceneKey, locale, timeoutMs, url: url.substring(0, 100) + "..." });

    const startTime = Date.now();
    const res = await fetch(url, {
      method: "GET",
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const duration = Date.now() - startTime;

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      console.warn("[LOCAL-AI] 场景配置请求失败:", { 
        status: res.status, 
        statusText: res.statusText,
        errorText: errorText.substring(0, 200),
        duration: `${duration}ms`,
        timeoutMs
      });
      return null;
    }

    const data = (await res.json()) as Array<{
      system_prompt_zh: string;
      system_prompt_ja: string | null;
      system_prompt_en: string | null;
      output_format: string | null;
    }>;

    if (!data || data.length === 0) {
      console.warn("[LOCAL-AI] 场景配置不存在:", { sceneKey, duration: `${duration}ms` });
      return null;
    }

    const sceneConfig = data[0];
    const lang = locale.toLowerCase().trim();

    // 根据语言选择 prompt
    // 注意：对于翻译场景，应该使用目标语言来选择 prompt
    let prompt = sceneConfig.system_prompt_zh;
    let selectedLang = "zh";
    
    if (lang.startsWith("ja") && sceneConfig.system_prompt_ja) {
      prompt = sceneConfig.system_prompt_ja;
      selectedLang = "ja";
      console.log("[LOCAL-AI] 使用日文 prompt (locale:", locale, "lang:", lang, ")");
    } else if (lang.startsWith("en") && sceneConfig.system_prompt_en) {
      prompt = sceneConfig.system_prompt_en;
      selectedLang = "en";
      console.log("[LOCAL-AI] 使用英文 prompt (locale:", locale, "lang:", lang, ")");
    } else {
      console.log("[LOCAL-AI] 使用中文 prompt (locale:", locale, "lang:", lang, ")");
    }

    const finalPrompt = prompt || sceneConfig.system_prompt_zh;
    console.log("[LOCAL-AI] 场景配置读取成功:", { 
      sceneKey, 
      locale, 
      selectedLang,
      promptLength: finalPrompt.length,
      promptPreview: finalPrompt.substring(0, 200) + "...",
      duration: `${duration}ms`,
      timeoutMs,
      hasZhPrompt: !!sceneConfig.system_prompt_zh,
      hasJaPrompt: !!sceneConfig.system_prompt_ja,
      hasEnPrompt: !!sceneConfig.system_prompt_en,
    });

    return {
      prompt: finalPrompt,
      outputFormat: sceneConfig.output_format,
    };
  } catch (error) {
    const isTimeout = error instanceof Error && (
      error.name === "AbortError" || 
      error.message.includes("timeout") ||
      error.message.includes("aborted")
    );
    
    if (isTimeout) {
      console.error(`[LOCAL-AI] 读取场景配置超时 (${timeoutMs}ms):`, { sceneKey, locale });
    } else {
      console.error("[LOCAL-AI] 读取场景配置失败:", { 
        error: error instanceof Error ? error.message : String(error),
        sceneKey,
        locale,
        timeoutMs
      });
    }
    
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

  console.log("[LOCAL-AI] 替换占位符前:", {
    promptLength: prompt.length,
    promptPreview: prompt.substring(0, 200) + "...",
    sourceLanguage,
    targetLanguage,
    hasSourceLanguage: !!sourceLanguage,
    hasTargetLanguage: !!targetLanguage,
  });

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

  console.log("[LOCAL-AI] 替换占位符后:", {
    resultLength: result.length,
    resultPreview: result.substring(0, 300) + "...",
    replacedSourceLanguage: sourceLanguage || "未替换",
    replacedTargetLanguage: targetLanguage || "未替换",
  });

  return result;
}

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

/**
 * 处理对话历史，限制长度并过滤无效消息
 */
function processHistory(
  messages: ChatMessage[] | undefined,
  maxHistory: number = 10
): ChatMessage[] {
  if (!messages || messages.length === 0) {
    return [];
  }

  // 过滤无效消息
  const validMessages = messages.filter(
    (msg) =>
      msg &&
      msg.role &&
      msg.content &&
      typeof msg.content === "string" &&
      msg.content.trim().length > 0 &&
      (msg.role === "user" || msg.role === "assistant" || msg.role === "system")
  );

  // 只保留最近的 N 条消息（不包括 system）
  const nonSystemMessages = validMessages.filter((msg) => msg.role !== "system");
  const recentMessages = nonSystemMessages.slice(-maxHistory);

  // 如果原始消息中有 system 消息，保留第一个
  const systemMessages = validMessages.filter((msg) => msg.role === "system");
  const systemMessage = systemMessages.length > 0 ? [systemMessages[0]] : [];

  return [...systemMessage, ...recentMessages];
}

/**
 * 从对话历史中提取上下文关键词，用于增强 RAG 检索
 */
function extractContextFromHistory(
  messages: ChatMessage[],
  currentQuestion: string
): string {
  // 提取最近 3 轮对话的关键内容
  const recentMessages = messages.slice(-6); // 最近 3 轮（每轮 user + assistant）
  
  const contextParts: string[] = [];
  
  for (const msg of recentMessages) {
    if (msg.role === "user" || msg.role === "assistant") {
      const content = msg.content.trim();
      // 只保留较短的摘要（避免过长）
      if (content.length > 0 && content.length < 500) {
        contextParts.push(content);
      }
    }
  }
  
  // 结合当前问题
  return [currentQuestion, ...contextParts].join(" ").slice(0, 1000);
}

export default async function askRoute(app: FastifyInstance): Promise<void> {
  app.post(
    "/v1/ask",
    async (request: FastifyRequest<{ Body: AskBody }>, reply: FastifyReply): Promise<void> => {
      const config = app.config as LocalAIConfig;
      const startTime = Date.now(); // 记录开始时间
      try {
        // 1) 服务间鉴权
        ensureServiceAuth(request, config);

        // 2) 校验请求体
        const body = request.body as AskBody;
        const question = (body.question || "").trim();
        const lang = (body.lang || "zh").toLowerCase().trim();
        const maxHistory = body.maxHistory || 10;
        const seedUrl = body.seedUrl?.trim() || null;
        const scene = body.scene?.trim() || null;
        // 注意：如果 body.sourceLanguage 是 undefined，trim() 会报错，需要先检查
        const sourceLanguage = body.sourceLanguage ? body.sourceLanguage.trim() || null : null;
        const targetLanguage = body.targetLanguage ? body.targetLanguage.trim() || null : null;
        
        // 记录接收到的参数（包括原始值）
        console.log("[LOCAL-AI] 接收到的请求参数:", {
          scene,
          sourceLanguage,
          targetLanguage,
          lang,
          questionLength: question.length,
          rawBody: {
            scene: body.scene,
            sourceLanguage: body.sourceLanguage,
            targetLanguage: body.targetLanguage,
            hasSourceLanguage: body.sourceLanguage !== undefined,
            hasTargetLanguage: body.targetLanguage !== undefined,
          }
        });

        if (!question || question.length === 0 || question.length > 2000) {
          reply.code(400).send({
            ok: false,
            errorCode: "VALIDATION_FAILED",
            message: "Question is required and must be between 1 and 2000 characters",
          });
          return;
        }

        // 3) 处理对话历史
        const history = processHistory(body.messages, maxHistory);
        
        // 4) RAG 检索（结合对话历史增强上下文）
        // 注意：对于翻译场景（question_translation），不需要 RAG 检索
        let reference = "";
        if (scene !== "question_translation" && scene !== "question_polish") {
          let ragQuery = question;
          if (history.length > 0) {
            // 从对话历史中提取上下文，增强 RAG 检索
            ragQuery = extractContextFromHistory(history, question);
          }
          
          // 使用种子URL过滤（如果提供）
          reference = await getRagContext(ragQuery, lang, seedUrl).catch((error) => {
            // RAG 检索失败不影响主流程，仅记录错误
            console.error("[LOCAL-AI] RAG检索失败:", error instanceof Error ? error.message : String(error));
            return "";
          });
        } else {
          console.log("[LOCAL-AI] 翻译/润色场景，跳过 RAG 检索");
        }

        // 5) 构建系统 prompt（优先使用场景配置）
        // 重要：对于翻译场景，应该使用 targetLanguage 来选择 prompt 语言，而不是 lang
        // lang 是请求的语言标识，targetLanguage 是翻译的目标语言
        let sys: string;
        const promptLocale = targetLanguage || lang; // 优先使用 targetLanguage（翻译目标语言）
        console.log("[LOCAL-AI] 构建系统 prompt:", { 
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
            console.log("[LOCAL-AI] 使用场景配置:", { 
              scene, 
              sourceLanguage, 
              targetLanguage,
              promptLocale,
              promptLength: sys.length,
              promptPreview: sys.substring(0, 300) + "...",
              promptAfterReplace: sys.substring(0, 500) + "..."
            });
          } else {
            // 场景配置不存在，使用默认 prompt
            // 对于翻译场景，如果 targetLanguage 存在，应该使用 targetLanguage 的语言
            const defaultPromptLang = targetLanguage || lang;
            sys = buildSystemPrompt(defaultPromptLang);
            console.warn("[LOCAL-AI] 场景配置不存在，使用默认 prompt:", { 
              scene, 
              lang: defaultPromptLang,
              sourceLanguage,
              targetLanguage,
              promptLocale,
              warning: "⚠️ 翻译场景应该使用场景配置，默认 prompt 可能无法正确翻译"
            });
          }
        } else {
          // 没有指定场景，使用默认 prompt
          const defaultPromptLang = targetLanguage || lang;
          sys = buildSystemPrompt(defaultPromptLang);
          console.log("[LOCAL-AI] 未指定场景，使用默认 prompt:", { lang: defaultPromptLang });
        }
        
        // 构建完整的消息列表
        const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
          { role: "system", content: sys },
        ];

        // 对于翻译和润色场景，直接使用 question 作为用户消息，不添加前缀和 RAG 上下文
        // 对于其他场景，使用问答格式
        if (scene === "question_translation" || scene === "question_polish") {
          // 翻译/润色场景：直接使用 question 作为用户消息
          messages.push({
            role: "user",
            content: question,
          });
          console.log("[LOCAL-AI] 翻译/润色场景，直接使用 question 作为用户消息");
        } else {
          // 其他场景：使用问答格式，包含 RAG 上下文
          const userPrefix = lang === "ja" ? "質問：" : lang === "en" ? "Question:" : "问题：";
          const refPrefix =
            lang === "ja" ? "関連参照：" : lang === "en" ? "Related references:" : "相关参考资料：";

          // 添加历史消息（如果有）
          if (history.length > 0) {
            // 过滤掉 system 消息（已经在上面添加了）
            const historyMessages = history
              .filter((msg) => msg.role !== "system")
              .map((msg) => ({
                role: msg.role as "user" | "assistant",
                content: msg.content,
              }));
            messages.push(...historyMessages);
          }

          // 添加当前问题和 RAG 上下文
          messages.push({
            role: "user",
            content: `${userPrefix} ${question}\n\n${refPrefix}\n${reference || "（無/None）"}`,
          });
        }

        // 6) 调用 Ollama Chat（传递完整对话历史）
        const answer = await callOllamaChat(messages, 0.4);

        if (!answer) {
          console.error("[LOCAL-AI] Ollama返回空响应");
          reply.code(502).send({
            ok: false,
            errorCode: "PROVIDER_ERROR",
            message: "Empty response from Ollama",
          });
          return;
        }

        // 5) 构建 sources（从 reference 中提取）
        const sources: Array<{ title: string; url: string; snippet?: string }> = reference
          ? [{ title: "RAG Reference", url: "", snippet: reference.slice(0, 200) }]
          : [];

        // 6) 计算 RAG 命中数
        const ragHits = reference ? 1 : 0;

        // 7) 注意：不再在这里写入 ai_logs，由主路由统一写入（包含题目标识等完整信息）
        // 主路由会在 STEP 7 中写入日志（但 local 模式会跳过，因为 aiServiceMode === "local"）

        // 计算处理耗时
        const durationMs = Date.now() - startTime;
        const durationSec = (durationMs / 1000).toFixed(2);

        // 构建 sources 数组（包含耗时信息）
        const sourcesWithDuration: Array<{ title: string; url: string; snippet?: string }> = [
          { title: "处理耗时", url: "", snippet: `${durationSec} 秒` },
          ...sources,
        ];

        // 8) 返回结果（与在线AI服务格式完全一致）
        const result: AskResult & { aiProvider?: string } = {
          answer,
          sources: sourcesWithDuration, // 包含耗时信息
          model: config.aiModel,
          safetyFlag: "ok", // 本地服务暂不实现安全审查
          aiProvider: "local", // 明确标识为本地 AI 服务
          // 向后兼容字段
          reference: reference || null,
          lang,
          cached: false,
          time: new Date().toISOString(),
        };

        reply.send({
          ok: true,
          data: result,
        });
      } catch (e) {
        const err = e as Error & { statusCode?: number };
        const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
        const message = status >= 500 ? "Internal Server Error" : err.message || "Bad Request";
        
        console.error("[LOCAL-AI] 处理请求时出错:", err.message);
        
        reply.code(status).send({
          ok: false,
          errorCode:
            status === 400
              ? "VALIDATION_FAILED"
              : status === 401
              ? "AUTH_REQUIRED"
              : "INTERNAL_ERROR",
          message,
        });
      }
    }
  );
}

