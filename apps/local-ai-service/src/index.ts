import Fastify, { FastifyInstance } from "fastify";
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

  // 注册 CORS
  app.register(cors, {
    origin: false, // 默认关闭跨域，仅接受内部请求
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
  try {
    const askModule = await import("./routes/ask.js");
    await askModule.default(app);
  } catch (err) {
    logger.error({ err }, "路由注册失败");
  }
}

async function start() {
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

