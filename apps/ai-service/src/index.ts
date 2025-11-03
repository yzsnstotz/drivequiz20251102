/* eslint-disable @typescript-eslint/no-explicit-any */
// apps/ai-service/src/index.ts
import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import cors from "@fastify/cors";
import dotenv from "dotenv";
import { AddressInfo } from "net";
import { registerCronDailySummarize } from "./jobs/cron.dailySummarize";

// 环境变量加载（优先 .env）
dotenv.config();

/** 运行配置 */
export type ServiceConfig = {
  port: number;
  host: string;
  serviceTokens: Set<string>;
  aiModel: string;
  openaiApiKey: string;
  supabaseUrl: string;
  supabaseServiceKey: string;
  cacheRedisUrl?: string;
  nodeEnv: string;
  version: string;
  /** 可选：注入 provider（如问答日志拉取） */
  providers?: {
    fetchAskLogs?: (fromIso: string, toIso: string) => Promise<
      Array<{
        id: string;
        userId: string | null;
        question: string;
        answer?: string;
        locale?: string;
        createdAt: string;
        sources?: Array<{ title: string; url: string; score?: number }>;
        safetyFlag?: "ok" | "needs_human" | "blocked";
        model?: string;
        meta?: Record<string, unknown>;
      }>
    >;
  };
};

/** 读取并校验环境变量 */
export function loadConfig(): ServiceConfig {
  const {
    PORT,
    HOST,
    SERVICE_TOKENS,
    AI_MODEL,
    OPENAI_API_KEY,
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    AI_CACHE_REDIS_URL,
    NODE_ENV,
    npm_package_version,
  } = process.env;

  const errors: string[] = [];
  if (!SERVICE_TOKENS) errors.push("SERVICE_TOKENS");
  if (!OPENAI_API_KEY) errors.push("OPENAI_API_KEY");
  if (!SUPABASE_URL) errors.push("SUPABASE_URL");
  if (!SUPABASE_SERVICE_KEY) errors.push("SUPABASE_SERVICE_KEY");
  if (errors.length) {
    throw new Error(`Missing required environment variables: ${errors.join(", ")}`);
  }

  // 缺省 provider：未实现时返回空数组，保证系统可运行（Cron 会打印告警）
  const defaultProviders: ServiceConfig["providers"] = {
    fetchAskLogs: async () => [],
  };

  return {
    port: Number(PORT || 8787),
    host: HOST || "0.0.0.0",
    serviceTokens: new Set(
      (SERVICE_TOKENS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
    aiModel: AI_MODEL || "gpt-4o-mini",
    openaiApiKey: OPENAI_API_KEY as string,
    supabaseUrl: SUPABASE_URL as string,
    supabaseServiceKey: SUPABASE_SERVICE_KEY as string,
    cacheRedisUrl: AI_CACHE_REDIS_URL,
    nodeEnv: NODE_ENV || "development",
    version: npm_package_version || "0.0.0",
    providers: defaultProviders,
  };
}

declare module "fastify" {
  interface FastifyInstance {
    config: ServiceConfig;
  }
}

/** 创建 Fastify 实例 */
export function buildServer(config: ServiceConfig): FastifyInstance {
  const app = Fastify({
    logger: {
      level: config.nodeEnv === "production" ? "info" : "debug",
      transport:
        config.nodeEnv === "production"
          ? undefined
          : { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:standard" } },
    },
    trustProxy: true,
    bodyLimit: 1 * 1024 * 1024, // 1MB
  });

  // 关闭对外 CORS（默认拒绝），如需内部联调可临时放开
  app.register(cors, { origin: false });

  // 注入配置
  app.decorate("config", config);

  // 统一成功/失败响应封装
  app.setReplySerializer((payload: any) => {
    try {
      return JSON.stringify(payload);
    } catch {
      return JSON.stringify({
        ok: false,
        errorCode: "INTERNAL_ERROR",
        message: "Serialization error",
      });
    }
  });

  // 统一错误处理
  app.setErrorHandler((err: Error & { statusCode?: number }, _req: FastifyRequest, reply: FastifyReply) => {
    app.log.error({ err }, "unhandled_error");
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

  // 健康检查端点（Railway 健康探针）
  app.get("/healthz", async (_req, reply) => {
    reply.send({
      ok: true,
      data: {
        status: "ok",
        version: config.version,
        model: config.aiModel,
        env: config.nodeEnv,
        time: new Date().toISOString(),
      },
    });
  });

  // 就绪检查端点（依赖可用性检查）
  app.get("/readyz", async (_req, reply) => {
    const checks: Record<string, boolean | string> = {};
    let allReady = true;

    // 1. 检查 OpenAI API Key
    if (!config.openaiApiKey) {
      checks.openai = false;
      allReady = false;
    } else {
      checks.openai = true;
    }

    // 2. 检查 Supabase 连通性
    try {
      const res = await fetch(`${config.supabaseUrl.replace(/\/+$/, "")}/rest/v1/`, {
        method: "HEAD",
        headers: {
          apikey: config.supabaseServiceKey,
          Authorization: `Bearer ${config.supabaseServiceKey}`,
        },
        signal: AbortSignal.timeout(3000),
      });
      checks.supabase = res.ok;
      if (!res.ok) allReady = false;
    } catch (e) {
      checks.supabase = `error: ${(e as Error).message}`;
      allReady = false;
    }

    // 3. 检查 RPC 函数可用性（通过调用一个简单查询）
    try {
      const res = await fetch(
        `${config.supabaseUrl.replace(/\/+$/, "")}/rest/v1/rpc/match_documents`,
        {
          method: "POST",
          headers: {
            apikey: config.supabaseServiceKey,
            Authorization: `Bearer ${config.supabaseServiceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query_embedding: new Array(1536).fill(0),
            match_threshold: 0.99,
            match_count: 1,
          }),
          signal: AbortSignal.timeout(3000),
        },
      );
      // RPC 存在且可调用（即使返回空结果也算就绪）
      checks.rpc = res.status !== 404;
      if (res.status === 404) allReady = false;
    } catch (e) {
      const error = e as Error;
      if (error.message.includes("404")) {
        checks.rpc = false;
        allReady = false;
      } else {
        // 其他错误（如超时）不影响就绪状态
        checks.rpc = true;
      }
    }

    if (allReady) {
      reply.send({
        ok: true,
        data: {
          status: "ready",
          checks,
          time: new Date().toISOString(),
        },
      });
    } else {
      reply.code(503).send({
        ok: false,
        errorCode: "SERVICE_UNAVAILABLE",
        message: "Service dependencies not ready",
        details: checks,
      });
    }
  });

  // 向后兼容：保留 /health 端点
  app.get("/health", async (_req, reply) => {
    reply.send({
      ok: true,
      data: {
        status: "ok",
        version: config.version,
        model: config.aiModel,
        env: config.nodeEnv,
        time: new Date().toISOString(),
      },
    });
  });

  // 路由注册：/v1/**（问答主路由）
  import("./routes/ask")
    .then((m) => m.default)
    .then((askRoute) => {
      app.register(askRoute, { prefix: "/v1" });
    })
    .catch((err) => app.log.error({ err }, "Failed to load ask route"));

  // 路由注册：/v1/admin/daily-summary（管理摘要）
  import("./routes/admin/daily-summary")
    .then((m) => m.default)
    .then((dailySummaryRoute) => {
      // 模块内已声明完整路径 /v1/admin/daily-summary，这里不再叠加 prefix
      app.register(dailySummaryRoute);
    })
    .catch((err) => app.log.error({ err }, "Failed to load admin/dailySummary route"));

  // 路由注册：/v1/admin/rag/ingest（RAG 向量化）
  import("./routes/admin/ragIngest")
    .then((m) => m.default)
    .then((ragIngestRoute) => {
      // 模块内已声明完整路径 /v1/admin/rag/ingest，这里不再叠加 prefix
      app.register(ragIngestRoute);
    })
    .catch((err) => app.log.error({ err }, "Failed to load admin/ragIngest route"));

  return app;
}

/** 主启动函数 */
async function start() {
  const config = loadConfig();
  const app = buildServer(config);

  // 注册每日定时任务（UTC）
  const stopCron = registerCronDailySummarize(app, config);

  // 优雅退出
  const close = async () => {
    try {
      app.log.info("Shutting down...");
      stopCron();
      await app.close();
      process.exit(0);
    } catch (e) {
      app.log.error(e, "Shutdown error");
      process.exit(1);
    }
  };
  process.on("SIGINT", close);
  process.on("SIGTERM", close);

  try {
    await app.listen({ port: config.port, host: config.host });
    const address = app.server.address() as AddressInfo;
    app.log.info(
      `AI-Service listening on http://${address.address}:${address.port} (env=${config.nodeEnv})`,
    );
  } catch (err) {
    app.log.error({ err }, "Failed to start server");
    process.exit(1);
  }
}

// 仅当直接运行时启动（便于测试 import）
if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  start();
}
