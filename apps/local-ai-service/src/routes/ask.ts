import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { ensureServiceAuth } from "../middlewares/auth.js";
import { getRagContext } from "../lib/rag.js";
import { callOllamaChat } from "../lib/ollamaClient.js";
import type { LocalAIConfig } from "../lib/config.js";
import { logAiInteraction } from "../lib/dbLogger.js";

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
      try {
        // 1) 服务间鉴权
        ensureServiceAuth(request, config);

        // 2) 校验请求体
        const body = request.body as AskBody;
        
        // 调试日志：记录原始请求体
        console.error("[Context Debug] Local-AI原始请求体", {
          bodyKeys: Object.keys(body),
          hasQuestion: !!body.question,
          hasMessages: !!body.messages,
          messagesType: typeof body.messages,
          messagesIsArray: Array.isArray(body.messages),
          messagesValue: body.messages,
          rawBody: JSON.stringify(body).substring(0, 500),
        });
        
        const question = (body.question || "").trim();
        const lang = (body.lang || "zh").toLowerCase().trim();
        const maxHistory = body.maxHistory || 10;
        const seedUrl = body.seedUrl?.trim() || null;

        if (!question || question.length === 0 || question.length > 2000) {
          reply.code(400).send({
            ok: false,
            errorCode: "VALIDATION_FAILED",
            message: "Question is required and must be between 1 and 2000 characters",
          });
          return;
        }

        // 3) 处理对话历史
        console.log("[Context Debug] Local-AI接收到的对话历史", {
          hasMessages: !!body.messages,
          rawMessageCount: body.messages?.length || 0,
          maxHistory,
          messagesPreview: body.messages?.slice(-3).map(m => ({
            role: m.role,
            contentLength: m.content?.length || 0,
            contentPreview: m.content?.substring(0, 50) || "",
          })) || [],
        });
        
        const history = processHistory(body.messages, maxHistory);
        
        console.log("[Context Debug] Local-AI处理后的对话历史", {
          processedCount: history.length,
          historyPreview: history.slice(-3).map(m => ({
            role: m.role,
            contentLength: m.content?.length || 0,
            contentPreview: m.content?.substring(0, 50) || "",
          })),
        });
        
        // 4) RAG 检索（结合对话历史增强上下文）
        let ragQuery = question;
        if (history.length > 0) {
          // 从对话历史中提取上下文，增强 RAG 检索
          ragQuery = extractContextFromHistory(history, question);
          console.log("[Context Debug] RAG查询增强", {
            originalQuestion: question.substring(0, 100),
            enhancedQuery: ragQuery.substring(0, 200),
            queryLength: ragQuery.length,
          });
        }
        
        // 使用种子URL过滤（如果提供）
        const reference = await getRagContext(ragQuery, lang, seedUrl).catch((error) => {
          // RAG 检索失败不影响主流程，仅记录错误
          console.error("[LOCAL-AI] RAG检索失败:", error instanceof Error ? error.message : String(error));
          return "";
        });
        
        // 调试日志：记录种子URL过滤
        if (seedUrl) {
          console.log("[Context Debug] 使用种子URL过滤]", {
          seedUrl,
          referenceLength: reference.length,
        });
        }

        // 5) 构建消息列表（包含对话历史）
        const sys = buildSystemPrompt(lang);
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
          console.log("[Context Debug] 已添加历史消息到Ollama", {
            historyMessageCount: historyMessages.length,
            totalMessagesBeforeCurrent: messages.length,
          });
        }

        // 添加当前问题和 RAG 上下文
        messages.push({
          role: "user",
          content: `${userPrefix} ${question}\n\n${refPrefix}\n${reference || "（無/None）"}`,
        });

        // 调试日志：验证最终消息列表
        console.log("[Context Debug] 发送给Ollama的完整消息列表", {
          totalMessages: messages.length,
          messageRoles: messages.map(m => m.role),
          messageLengths: messages.map(m => m.content.length),
          hasHistory: messages.length > 2, // system + current + history
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

        // 7) 异步写入 ai_logs（不阻断响应）
        void logAiInteraction({
          userId: body.userId || null,
          question,
          answer,
          lang,
          model: config.aiModel,
          ragHits,
          safetyFlag: "ok", // 本地服务暂不实现安全审查
          costEstUsd: null, // 本地AI不计算成本
          createdAtIso: new Date().toISOString(),
          sources: sources.length > 0 ? sources : undefined,
        }).catch((error) => {
          // 写入失败不影响主流程，仅记录错误
          console.error("[LOCAL-AI] Failed to write ai_logs:", error instanceof Error ? error.message : String(error));
        });

        // 8) 返回结果（与在线AI服务格式完全一致）
        const result: AskResult = {
          answer,
          sources: sources.length > 0 ? sources : undefined,
          model: config.aiModel,
          safetyFlag: "ok", // 本地服务暂不实现安全审查
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

