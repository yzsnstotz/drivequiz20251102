import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { ensureServiceAuth } from "../middlewares/auth.js";
import { getRagContext } from "../lib/rag.js";
import { callOllamaChat } from "../lib/ollamaClient.js";
import type { LocalAIConfig } from "../lib/config.js";
import { logAiInteraction } from "../lib/dbLogger.js";

type AskBody = {
  question?: string;
  userId?: string;
  lang?: string;
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
        const question = (body.question || "").trim();
        const lang = (body.lang || "zh").toLowerCase().trim();

        if (!question || question.length === 0 || question.length > 2000) {
          reply.code(400).send({
            ok: false,
            errorCode: "VALIDATION_FAILED",
            message: "Question is required and must be between 1 and 2000 characters",
          });
          return;
        }

        // 3) RAG 检索（获取上下文）
        const reference = await getRagContext(question, lang).catch((error) => {
          // RAG 检索失败不影响主流程，仅记录错误
          console.error("[LOCAL-AI] RAG检索失败:", error instanceof Error ? error.message : String(error));
          return "";
        });

        // 4) 调用 Ollama Chat
        const sys = buildSystemPrompt(lang);
        const userPrefix = lang === "ja" ? "質問：" : lang === "en" ? "Question:" : "问题：";
        const refPrefix =
          lang === "ja" ? "関連参照：" : lang === "en" ? "Related references:" : "相关参考资料：";

        const answer = await callOllamaChat(
          [
            { role: "system", content: sys },
            {
              role: "user",
              content: `${userPrefix} ${question}\n\n${refPrefix}\n${reference || "（無/None）"}`,
            },
          ],
          0.4
        );

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

