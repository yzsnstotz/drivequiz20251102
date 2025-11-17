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
    return null;
  }

  try {
    const url = `${SUPABASE_URL.replace(/\/+$/, "")}/rest/v1/ai_scene_config?scene_key=eq.${encodeURIComponent(sceneKey)}&enabled=eq.true&select=system_prompt_zh,system_prompt_ja,system_prompt_en,output_format`;
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
      return null;
    }

    const data = (await res.json()) as Array<{
      system_prompt_zh: string;
      system_prompt_ja: string | null;
      system_prompt_en: string | null;
      output_format: string | null;
    }>;

    if (!data || data.length === 0) {
      return null;
    }

    const sceneConfig = data[0];
    const lang = locale.toLowerCase();

    // 根据语言选择 prompt
    let prompt = sceneConfig.system_prompt_zh;
    if (lang.startsWith("ja") && sceneConfig.system_prompt_ja) {
      prompt = sceneConfig.system_prompt_ja;
    } else if (lang.startsWith("en") && sceneConfig.system_prompt_en) {
      prompt = sceneConfig.system_prompt_en;
    }

    return {
      prompt: prompt || sceneConfig.system_prompt_zh,
      outputFormat: sceneConfig.output_format,
    };
  } catch (error) {
    console.error("[LOCAL-AI] 读取场景配置失败:", error instanceof Error ? error.message : String(error));
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
        const sourceLanguage = body.sourceLanguage?.trim() || null;
        const targetLanguage = body.targetLanguage?.trim() || null;

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
        let ragQuery = question;
        if (history.length > 0) {
          // 从对话历史中提取上下文，增强 RAG 检索
          ragQuery = extractContextFromHistory(history, question);
        }
        
        // 使用种子URL过滤（如果提供）
        const reference = await getRagContext(ragQuery, lang, seedUrl).catch((error) => {
          // RAG 检索失败不影响主流程，仅记录错误
          console.error("[LOCAL-AI] RAG检索失败:", error instanceof Error ? error.message : String(error));
          return "";
        });

        // 5) 构建系统 prompt（优先使用场景配置）
        let sys: string;
        if (scene) {
          // 尝试从数据库读取场景配置
          const sceneConfig = await getSceneConfig(scene, targetLanguage || lang, config);
          if (sceneConfig) {
            // 使用场景配置的 prompt，并替换占位符
            sys = replacePlaceholders(sceneConfig.prompt, sourceLanguage || undefined, targetLanguage || undefined);
            console.log("[LOCAL-AI] 使用场景配置:", { scene, sourceLanguage, targetLanguage });
          } else {
            // 场景配置不存在，使用默认 prompt
            sys = buildSystemPrompt(lang);
            console.warn("[LOCAL-AI] 场景配置不存在，使用默认 prompt:", { scene });
          }
        } else {
          // 没有指定场景，使用默认 prompt
          sys = buildSystemPrompt(lang);
        }
        
        const userPrefix = lang === "ja" ? "質問：" : lang === "en" ? "Question:" : "问题：";
        const refPrefix =
          lang === "ja" ? "関連参照：" : lang === "en" ? "Related references:" : "相关参考资料：";

        // 构建完整的消息列表
        const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
          { role: "system", content: sys },
        ];

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

