/* eslint-disable @typescript-eslint/no-explicit-any */
// apps/ai-service/src/index.ts
import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import cors from "@fastify/cors";
import dotenv from "dotenv";
import { registerCronDailySummarize } from "./jobs/cron.dailySummarize.js";

// 环境变量加载（优先 .env）
dotenv.config();

/** 运行配置 */
export type ServiceConfig = {
  port: number;
  host: string;
  serviceTokens: Set<string>;
  aiModel: string;
  openaiApiKey: string;
  openrouterApiKey?: string; // OpenRouter API key（可选）
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
    OPENROUTER_API_KEY,
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

  // 实现 fetchAskLogs provider：从 Supabase 读取 ai_logs 表数据
  const fetchAskLogs = async (fromIso: string, toIso: string) => {
    try {
      // Supabase PostgREST 查询语法：使用 gte (>=) 和 lt (<) 进行时间范围查询
      // 注意：PostgREST 需要在参数值周围加引号，但 URL 编码会自动处理
      const fromEncoded = encodeURIComponent(fromIso);
      const toEncoded = encodeURIComponent(toIso);
      const url = `${SUPABASE_URL}/rest/v1/ai_logs?created_at=gte.${fromEncoded}&created_at=lt.${toEncoded}&order=created_at.asc&limit=10000`;
      
      const res = await fetch(url, {
        headers: {
          apikey: SUPABASE_SERVICE_KEY as string,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Supabase fetch failed: ${res.status} ${text}`);
      }

      const rows = (await res.json()) as Array<{
        id: number;
        user_id: string | null;
        question: string;
        answer: string | null;
        locale: string | null;
        model: string | null;
        rag_hits: number | null;
        safety_flag: string;
        cost_est: number | null;
        sources?: any;
        created_at: string;
      }>;

      // 转换为 AskLogRecord 格式
      return rows.map((r) => ({
        id: String(r.id),
        userId: r.user_id,
        question: r.question,
        answer: r.answer || undefined,
        locale: r.locale || undefined,
        createdAt: r.created_at,
        sources: Array.isArray(r.sources) ? r.sources : undefined,
        safetyFlag: r.safety_flag as "ok" | "needs_human" | "blocked",
        model: r.model || undefined,
        meta: {},
      }));
    } catch (error) {
      return [];
    }
  };

  const defaultProviders: ServiceConfig["providers"] = {
    fetchAskLogs,
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
    openrouterApiKey: OPENROUTER_API_KEY,
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
      level: "info",
    },
    trustProxy: true,
    bodyLimit: 1 * 1024 * 1024, // 1MB
  });

  // 允许浏览器直接调用 ai-service（支持跨域）
  app.register(cors, {
    origin: true, // 允许所有来源
    credentials: false,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
  });

  // 为 /v1/ask 注册 OPTIONS 预检请求处理（确保 CORS 正常工作）
  app.options("/v1/ask", async (req, reply) => {
    reply
      .header("Access-Control-Allow-Origin", "*")
      .header("Access-Control-Allow-Methods", "POST, OPTIONS")
      .header("Access-Control-Allow-Headers", "Content-Type, Authorization")
      .send();
  });

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

  // --- 健康检查（Render 用） ---
  // 纯健康检查，不依赖任何外部服务，避免 Render 部署失败
  app.get("/healthz", async (_req, reply) => {
    reply.send({ ok: true });
  });

  // 就绪检查端点（仅检查环境变量配置，不实际请求外部服务）
  app.get("/readyz", async (_req, reply) => {
    // 仅检查依赖是否配置，不实际请求外部
    const required = ["OPENAI_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_KEY"];
    const missing = required.filter((k) => !process.env[k]);
    if (missing.length > 0) {
      reply.code(503).send({
        ok: false,
        errorCode: "SERVICE_UNAVAILABLE",
        message: "Required environment variables missing",
        missing,
      });
    } else {
      reply.send({ ok: true });
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

  return app;
}

/** 注册所有路由（必须在 listen 之前调用） */
export async function registerRoutes(app: FastifyInstance): Promise<void> {
  try {
    // 路由注册：/v1/**（问答主路由）
    try {
      const askModule = await import("./routes/ask.js");
      await app.register(askModule.default, { prefix: "/v1" });
      console.log("[ROUTE] Registered /v1/ask route");
    } catch (err) {
      console.error("[ROUTE] Failed to register /v1/ask route:", err);
      throw err;
    }

    // 路由注册：/v1/admin/daily-summary（管理摘要）
    try {
      const dailySummaryModule = await import("./routes/admin/daily-summary.js");
      await app.register(dailySummaryModule.default);
      console.log("[ROUTE] Registered /v1/admin/daily-summary route");
    } catch (err) {
      console.error("[ROUTE] Failed to register /v1/admin/daily-summary route:", err);
    }

    // 路由注册：/v1/admin/rag/ingest（RAG 向量化）
    try {
      const ragIngestModule = await import("./routes/admin/ragIngest.js");
      await app.register(ragIngestModule.default);
      console.log("[ROUTE] Registered /v1/admin/rag/ingest route");
    } catch (err) {
      console.error("[ROUTE] Failed to register /v1/admin/rag/ingest route:", err);
    }
  } catch (e) {
    console.error("[ROUTE] Failed to register routes:", e);
    throw e;
  }
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
      stopCron();
      await app.close();
      process.exit(0);
    } catch (e) {
      process.exit(1);
    }
  };
  process.on("SIGINT", close);
  process.on("SIGTERM", close);

  // --- 注册主路由（必须在 listen 之前） ---
  try {
    await registerRoutes(app);
    console.log("[STARTUP] All routes registered successfully");
  } catch (e) {
    console.error("[STARTUP] Failed to register routes:", e);
    process.exit(1);
  }

  // --- 启动 ---
  const port = Number(process.env.PORT) || config.port;
  const host = "0.0.0.0";

  try {
    await app.listen({ port, host });
  } catch (err) {
    process.exit(1);
  }
}

// 捕获潜在异常避免静默失败
process.on("unhandledRejection", () => {
  // Silent handling
});
process.on("uncaughtException", () => {
  // Silent handling
});

// 仅当直接运行时启动（便于测试 import）
// 在 ES 模块中，入口文件应该总是启动
// 检查是否为主模块（通过 import.meta.url 和 process.argv[1] 比较）
const isMainModule = process.argv[1] && import.meta.url.startsWith("file://") && import.meta.url.replace("file://", "") === process.argv[1];
if (isMainModule) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  start();
}
