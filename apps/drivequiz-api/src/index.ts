import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import dotenv from "dotenv";
import { logger } from "./utils/logger.js";

// 环境变量加载
dotenv.config();

// ============================================================
// 配置类型定义
// ============================================================

export type ServiceConfig = {
  port: number;
  host: string;
  apiTokenSecret: string;
  dbUrl: string;
  aiVectorizeUrl: string;
  maxBatchSize: number;
  enableServerChunk: boolean;
  nodeEnv: string;
  version: string;
};

// ============================================================
// 配置加载
// ============================================================

export function loadConfig(): ServiceConfig {
  const {
    PORT,
    HOST,
    DRIVEQUIZ_API_TOKEN_SECRET,
    DRIVEQUIZ_DB_URL,
    AI_VECTORIZE_URL,
    MAX_BATCH_SIZE,
    RAG_ENABLE_SERVER_CHUNK,
    NODE_ENV,
    npm_package_version,
  } = process.env;

  const errors: string[] = [];
  if (!DRIVEQUIZ_API_TOKEN_SECRET) errors.push("DRIVEQUIZ_API_TOKEN_SECRET");
  if (!DRIVEQUIZ_DB_URL && !process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    errors.push("DRIVEQUIZ_DB_URL, DATABASE_URL, or POSTGRES_URL");
  }
  if (!AI_VECTORIZE_URL) errors.push("AI_VECTORIZE_URL");

  if (errors.length) {
    throw new Error(`Missing required environment variables: ${errors.join(", ")}`);
  }

  return {
    port: Number(PORT || 8788),
    host: HOST || "0.0.0.0",
    apiTokenSecret: DRIVEQUIZ_API_TOKEN_SECRET as string,
    dbUrl: DRIVEQUIZ_DB_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || "",
    aiVectorizeUrl: AI_VECTORIZE_URL as string,
    maxBatchSize: Number(MAX_BATCH_SIZE || 100),
    enableServerChunk: RAG_ENABLE_SERVER_CHUNK === "true",
    nodeEnv: NODE_ENV || "development",
    version: npm_package_version || "1.1.0",
  };
}

declare module "fastify" {
  interface FastifyInstance {
    config: ServiceConfig;
  }
}

// ============================================================
// 服务器构建
// ============================================================

export function buildServer(config: ServiceConfig): FastifyInstance {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || "info",
    },
    trustProxy: true,
    bodyLimit: 10 * 1024 * 1024, // 10MB
  });

  // CORS 配置
  app.register(cors, {
    origin: false, // 默认拒绝，如需内部联调可临时放开
  });

  // 速率限制
  app.register(rateLimit, {
    max: Number(process.env.RATE_LIMIT_DOCS) || 100,
    timeWindow: Number(process.env.RATE_LIMIT_WINDOW) || 60000, // 1分钟
  });

  // 注入配置
  app.decorate("config", config);

  // 统一错误处理
  app.setErrorHandler((err, _req, reply) => {
    const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
    const message = status === 500 ? "Internal Server Error" : err.message || "Bad Request";

    logger.error({
      event: "error",
      status,
      message: err.message,
      stack: err.stack,
    });

    reply.code(status).send({
      success: false,
      error: {
        code:
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
      },
    });
  });

  return app;
}

// ============================================================
// 路由注册
// ============================================================

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  try {
    // 健康检查
    const healthModule = await import("./routes/health.js");
    await app.register(healthModule.default, { prefix: "/api/v1/rag" });

    // 单文档上传
    const docsModule = await import("./routes/docs.js");
    await app.register(docsModule.default, { prefix: "/api/v1/rag" });

    // 批量上传
    const docsBatchModule = await import("./routes/docs-batch.js");
    await app.register(docsBatchModule.default, { prefix: "/api/v1/rag" });

    // 操作记录查询
    const operationsModule = await import("./routes/operations.js");
    await app.register(operationsModule.default, { prefix: "/api/v1/rag" });
  } catch (err) {
    logger.error({
      event: "route.registration.failed",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
}

// ============================================================
// 主启动函数
// ============================================================

async function start() {
  try {
    const config = loadConfig();
    const app = buildServer(config);

    // 注册路由
    await registerRoutes(app);

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

    // 启动服务器
    const port = config.port;
    const host = config.host;

    await app.listen({ port, host });

    logger.info({
      event: "server.started",
      port,
      host,
      version: config.version,
      env: config.nodeEnv,
    });
  } catch (err) {
    logger.error({
      event: "server.start.failed",
      error: err instanceof Error ? err.message : "Unknown error",
    });
    process.exit(1);
  }
}

// 捕获未处理的异常
process.on("unhandledRejection", (reason) => {
  logger.error({
    event: "unhandled.rejection",
    error: reason instanceof Error ? reason.message : String(reason),
  });
});

process.on("uncaughtException", (err) => {
  logger.error({
    event: "uncaught.exception",
    error: err.message,
    stack: err.stack,
  });
  process.exit(1);
});

// 启动服务器
start();

