import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { ensureServiceAuth } from "../middlewares/auth.js";
import { getRagContext } from "../lib/rag.js";
import { callOllamaChat } from "../lib/ollamaClient.js";
import type { LocalAIConfig } from "../lib/config.js";
import { logAiInteraction } from "../lib/dbLogger.js";
import { logger } from "../lib/logger.js";

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
        const startedAt = Date.now();
        const requestId = String(request.id ?? `ask-${startedAt}`);
        const body = (request.body ?? {}) as AskBody;
        const previewQuestion = (body.question || "").slice(0, 120);

        try {
          logger.info(
            {
              event: "ask.request.received",
              requestId,
              userId: body.userId ?? null,
              lang: body.lang ?? null,
              questionLength: body.question?.length ?? 0,
              questionPreview: previewQuestion,
              hasAuthHeader: Boolean(request.headers.authorization),
            },
            "收到 /v1/ask 请求"
          );

          // 1) 服务间鉴权
          logger.info(
            { event: "ask.auth.start", requestId },
            "开始执行服务鉴权"
          );
          ensureServiceAuth(request, config);
          logger.info(
            { event: "ask.auth.success", requestId },
            "服务鉴权通过"
          );

          // 2) 校验请求体
          const question = (body.question || "").trim();
          const lang = (body.lang || "zh").toLowerCase().trim();

          if (!question || question.length === 0 || question.length > 2000) {
            logger.warn(
              {
                event: "ask.validation.failed",
                requestId,
                questionLength: question.length,
              },
              "问题字段校验失败"
            );
            reply.code(400).send({
              ok: false,
              errorCode: "VALIDATION_FAILED",
              message: "Question is required and must be between 1 and 2000 characters",
            });
            return;
          }

          logger.info(
            {
              event: "ask.validation.success",
              requestId,
              lang,
              questionLength: question.length,
            },
            "请求体验证通过"
          );

          // 3) RAG 检索（获取上下文）
          logger.info(
            {
              event: "ask.rag.start",
              requestId,
              lang,
            },
            "开始执行 RAG 检索"
          );
          const ragStartedAt = Date.now();
          const reference = await getRagContext(question, lang);
          const ragDuration = Date.now() - ragStartedAt;
          logger.info(
            {
              event: "ask.rag.complete",
              requestId,
              lang,
              contextLength: reference.length,
              durationMs: ragDuration,
              hasContext: Boolean(reference),
            },
            "RAG 检索完成"
          );

          // 4) 调用 Ollama Chat
          const sys = buildSystemPrompt(lang);
          const userPrefix = lang === "ja" ? "質問：" : lang === "en" ? "Question:" : "问题：";
          const refPrefix =
            lang === "ja" ? "関連参照：" : lang === "en" ? "Related references:" : "相关参考资料：";

          logger.info(
            {
              event: "ask.ollama.start",
              requestId,
              model: config.aiModel,
              promptLength: question.length + reference.length,
            },
            "开始调用 Ollama Chat"
          );
          const ollamaStartedAt = Date.now();
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
          const ollamaDuration = Date.now() - ollamaStartedAt;

          if (!answer) {
            logger.error(
              {
                event: "ask.ollama.empty",
                requestId,
                durationMs: ollamaDuration,
              },
              "Ollama 返回空响应"
            );
            reply.code(502).send({
              ok: false,
              errorCode: "PROVIDER_ERROR",
              message: "Empty response from Ollama",
            });
            return;
          }

          logger.info(
            {
              event: "ask.ollama.success",
              requestId,
              durationMs: ollamaDuration,
              answerLength: answer.length,
            },
            "Ollama 响应成功"
          );

          // 5) 构建 sources（从 reference 中提取）
          const sources: Array<{ title: string; url: string; snippet?: string }> = reference
            ? [{ title: "RAG Reference", url: "", snippet: reference.slice(0, 200) }]
            : [];

          // 6) 计算 RAG 命中数
          const ragHits = reference ? 1 : 0;

          // 7) 异步写入 ai_logs（不阻断响应）
          logger.info(
            {
              event: "ask.dbLogger.enqueue",
              requestId,
              ragHits,
              hasSources: sources.length > 0,
            },
            "异步写入 ai_logs"
          );
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
          })
            .then(() => {
              logger.debug(
                {
                  event: "ask.dbLogger.success",
                  requestId,
                },
                "ai_logs 写入成功"
              );
            })
            .catch((error) => {
              logger.error(
                {
                  event: "ask.dbLogger.error",
                  requestId,
                  error: error instanceof Error ? error.message : String(error),
                },
                "写入 ai_logs 失败"
              );
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

          const totalDuration = Date.now() - startedAt;
          logger.info(
            {
              event: "ask.request.success",
              requestId,
              durationMs: totalDuration,
            },
            "本地 ask 请求处理完成"
          );

          reply.send({
            ok: true,
            data: result,
          });
      } catch (e) {
        const err = e as Error & { statusCode?: number };
          const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
          const message = status >= 500 ? "Internal Server Error" : err.message || "Bad Request";

          logger.error(
            {
              event: "ask.request.error",
              requestId,
              status,
              errorMessage: err.message,
              stack: err.stack,
            },
            "处理 /v1/ask 请求失败"
          );

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

