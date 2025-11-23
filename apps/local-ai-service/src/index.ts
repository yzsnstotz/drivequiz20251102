import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import cors from "@fastify/cors";
import { loadConfig, type LocalAIConfig } from "./lib/config.js";
import { logger } from "./lib/logger.js";

declare module "fastify" {
  interface FastifyInstance {
    config: LocalAIConfig;
  }
}

function buildServer(config: LocalAIConfig): FastifyInstance {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || "info",
      transport: process.env.NODE_ENV === "development" ? {
        target: "pino-pretty",
        options: {
          colorize: true,
        },
      } : undefined,
    },
  });

  app.decorate("config", config);

  // CORS 配置：通过环境变量控制允许的来源（与 ai-service 保持一致）
  const corsOrigin = config.allowedOrigins.length > 0
    ? (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        if (!origin) {
          // 没有 origin 头（如 Postman、curl），允许通过
          callback(null, true);
          return;
        }
        // 检查是否在允许列表中
        const isAllowed = config.allowedOrigins.includes(origin);
        callback(null, isAllowed);
      }
    : true; // 如果未配置，默认允许所有来源（向后兼容）

  app.register(cors, {
    origin: corsOrigin as any,
    credentials: false,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
  });

  // 为所有路由添加 CORS 头（确保所有响应都包含 CORS 头，与 ai-service 保持一致）
  app.addHook("onSend", async (request, reply) => {
    const origin = request.headers.origin;
    if (config.allowedOrigins.length > 0) {
      // 如果配置了允许的来源，只允许列表中的来源
      if (origin && config.allowedOrigins.includes(origin)) {
        reply.header("Access-Control-Allow-Origin", origin);
      }
      // 如果 origin 不在列表中，不设置 CORS 头（浏览器会拒绝）
    } else {
      // 如果未配置，默认允许所有来源（向后兼容）
      if (origin) {
        reply.header("Access-Control-Allow-Origin", origin);
      } else {
        reply.header("Access-Control-Allow-Origin", "*");
      }
    }
    reply.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    reply.header("Access-Control-Max-Age", "86400");
  });

  // 为 /v1/ask 注册 OPTIONS 预检请求处理（确保 CORS 正常工作，参考 ai-service 实现）
  app.options("/v1/ask", async (req, reply) => {
    const origin = req.headers.origin;
    if (config.allowedOrigins.length > 0) {
      // 如果配置了允许的来源，只允许列表中的来源
      if (origin && config.allowedOrigins.includes(origin)) {
        reply.header("Access-Control-Allow-Origin", origin);
      }
      // 如果 origin 不在列表中，不设置 CORS 头（浏览器会拒绝）
    } else {
      // 如果未配置，默认允许所有来源（向后兼容）
      reply.header("Access-Control-Allow-Origin", origin || "*");
    }
    reply
      .header("Access-Control-Allow-Methods", "POST, OPTIONS")
      .header("Access-Control-Allow-Headers", "Content-Type, Authorization")
      .header("Access-Control-Max-Age", "86400")
      .code(204)
      .send();
  });

  // 统一错误处理（与 ai-service 保持一致）
  // 注意：这确保所有未捕获的错误（如认证失败）都能正确返回响应体
  app.setErrorHandler((err: Error & { statusCode?: number }, _req: FastifyRequest, reply: FastifyReply) => {
    const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
    const message = status === 500 ? "Internal Server Error" : err.message || "Bad Request";
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
  });

  // 健康检查
  app.get("/healthz", async (_req, reply) => {
    reply.send({
      ok: true,
      data: {
        status: "ok",
        version: config.version,
        model: config.aiModel,
        embeddingModel: config.embeddingModel,
        env: config.nodeEnv,
        time: new Date().toISOString(),
      },
    });
  });

  return app;
}

async function registerRoutes(app: FastifyInstance): Promise<void> {
  // 路由注册：/v1/**（问答主路由，与 ai-service 保持一致）
  let askModule: any = null;
  try {
    askModule = await import("./routes/ask.js");
    if (!askModule || !askModule.default) {
      throw new Error("ask module default export is undefined");
    }
    await app.register(askModule.default, { prefix: "/v1" });
    logger.info("[ROUTE] Registered /v1/ask route");
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : undefined;
    logger.error({ 
      err, 
      errorMessage, 
      errorStack,
      hasDefault: !!askModule?.default,
      moduleKeys: askModule ? Object.keys(askModule) : [],
      moduleType: askModule ? typeof askModule : "undefined"
    }, "[ROUTE] Failed to register /v1/ask route");
    throw err;
  }
  
  // RAG 向量化路由
  try {
    const ragIngestModule = await import("./routes/ragIngest.js");
    await ragIngestModule.default(app);
    logger.info("[ROUTE] Registered /v1/admin/rag/ingest route");
  } catch (err) {
    logger.error({ err }, "[ROUTE] Failed to register /v1/admin/rag/ingest route");
    // RAG 路由注册失败不影响主服务启动
  }
}

async function start() {
  const config = loadConfig();
  const app = buildServer(config);

  // 注册路由（必须在 listen 之前）
  try {
    await registerRoutes(app);
    logger.info("[STARTUP] All routes registered successfully");
  } catch (e) {
    logger.error({ err: e }, "[STARTUP] Failed to register routes");
    process.exit(1);
  }

  // 优雅退出
  const close = async () => {
    try {
      await app.close();
      process.exit(0);
    } catch (e) {
      process.exit(1);
    }
  };
  process.on("SIGINT", close);
  process.on("SIGTERM", close);

  // 启动服务
  const port = config.port;
  const host = config.host;

  try {
    await app.listen({ port, host });
    logger.info(`本地AI服务启动成功: http://${host}:${port}`);
    logger.info(`Chat模型: ${config.aiModel}`);
    logger.info(`Embedding模型: ${config.embeddingModel}`);
  } catch (err) {
    console.error("服务启动失败:", err);
    if (err instanceof Error) {
      console.error("Error message:", err.message);
      console.error("Error stack:", err.stack);
    }
    process.exit(1);
  }
}

process.on("unhandledRejection", (reason, promise) => {
  logger.error({ reason, promise }, "Unhandled rejection");
  if (reason instanceof Error) {
    logger.error({ stack: reason.stack }, "Error stack");
  }
});

start().catch((err) => {
  console.error("启动失败:", err);
  if (err instanceof Error) {
    console.error("Error message:", err.message);
    console.error("Error stack:", err.stack);
  } else {
    console.error("Error object:", err);
  }
  process.exit(1);
});

