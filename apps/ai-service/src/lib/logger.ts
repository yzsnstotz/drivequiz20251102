// apps/ai-service/src/lib/logger.ts
/**
 * ZALEM · AI-Service
 * Logger Utility
 *
 * 设计目标：
 * - 统一 info/warn/error 输出格式（JSON line + 可选 Fastify logger 透传）
 * - 提供 logAiEvent() 专用结构化日志，便于后端观测与检索
 * - 自动打上时间戳、服务名、进程信息，并进行敏感字段脱敏
 *
 * 使用方式：
 *   import { createLogger, defaultLogger } from "../lib/logger";
 *   const logger = createLogger({ service: "ai-service", fastify: app, env: process.env.NODE_ENV });
 *   logger.warn("cache miss", { key });
 *   logger.logAiEvent({ userId, question, answer, lang: "ja", model, ragHits, safetyFlag: "ok" });
 */

import type { FastifyInstance } from "fastify";

type LogLevel = "info" | "warn" | "error";

export type Logger = {
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
  /** 结构化 AI 事件日志（问答记录/埋点），不等同于数据库落库 */
  logAiEvent: (payload: LogAiEventPayload) => void;
};

export type CreateLoggerOptions = {
  /** 服务标识，默认 "ai-service" */
  service?: string;
  /** 环境标识，默认取 NODE_ENV */
  env?: string;
  /** 可选：透传 Fastify 实例以复用 app.log */
  fastify?: FastifyInstance | null;
};

export type LogAiEventPayload = {
  /** 业务维度 */
  userId?: string | null;
  question: string;
  answer?: string;
  lang?: string; // "ja" | "zh" | "en" ...
  model?: string;
  ragHits?: number;
  safetyFlag?: "ok" | "needs_human" | "blocked";
  /** 成本估算（USD，可空） */
  costEstUsd?: number | null;
  /** 是否命中缓存 */
  cached?: boolean;
  /** 附加上下文（请求ID、IP、UA 等） */
  meta?: Record<string, unknown>;
};

const REDACT_KEYS = new Set([
  "authorization",
  "apikey",
  "api_key",
  "access_token",
  "refresh_token",
  "service_token",
  "supabase_service_key",
  "openai_api_key",
  "password",
  "secret",
  "token",
]);

/** 简易脱敏：仅在键命中白名单时脱敏为 "***" */
function redact(obj: unknown): unknown {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(redact);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (REDACT_KEYS.has(k.toLowerCase())) {
      out[k] = "***";
    } else if (v && typeof v === "object") {
      out[k] = redact(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function toJsonLine(level: LogLevel, message: string, base: Record<string, unknown>): string {
  // 避免循环引用
  try {
    return JSON.stringify({ level, message, ...base });
  } catch {
    return JSON.stringify({ level, message, error: "serialize_failed" });
  }
}

/** 将 Error 转换为可序列化对象 */
function serializeError(err: unknown): Record<string, unknown> | undefined {
  if (!err) return undefined;
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
    };
  }
  return { value: err as unknown };
}

/** 控制台输出（降级路径） */
function consoleEmit(level: LogLevel, line: string) {
  switch (level) {
    case "info":
      // eslint-disable-next-line no-console
      console.log(line);
      break;
    case "warn":
      // eslint-disable-next-line no-console
      console.warn(line);
      break;
    case "error":
      // eslint-disable-next-line no-console
      console.error(line);
      break;
  }
}

/** 工厂：创建 Logger */
export function createLogger(opts?: CreateLoggerOptions): Logger {
  const service = opts?.service || "ai-service";
  const env = opts?.env || process.env.NODE_ENV || "development";
  const fastify = opts?.fastify ?? null;

  function emit(level: LogLevel, message: string, meta?: Record<string, unknown>) {
    const base = {
      t: new Date().toISOString(),
      service,
      env,
      pid: process.pid,
      meta: redact(meta),
    };
    const line = toJsonLine(level, message, base);

    // 1) 优先 Fastify 内置 logger
    if (fastify?.log && typeof fastify.log[level] === "function") {
      // fastify.log 支持对象 + msg
      try {
        (fastify.log[level] as (o: unknown, m?: string) => void)(base, message);
      } catch {
        consoleEmit(level, line);
      }
      return;
    }

    // 2) 降级 console
    consoleEmit(level, line);
  }

  function info(message: string, meta?: Record<string, unknown>) {
    emit("info", message, meta);
  }
  function warn(message: string, meta?: Record<string, unknown>) {
    emit("warn", message, meta);
  }
  function error(message: string, meta?: Record<string, unknown>) {
    const m = { ...meta };
    if (meta && "err" in meta) {
      m.err = serializeError((meta as Record<string, unknown>)["err"]);
    }
    emit("error", message, m);
  }

  function logAiEvent(payload: LogAiEventPayload) {
    const {
      userId = null,
      question,
      answer,
      lang,
      model,
      ragHits,
      safetyFlag,
      costEstUsd,
      cached,
      meta,
    } = payload;

    const event = {
      type: "ai_event",
      userId,
      lang,
      model,
      ragHits,
      safetyFlag,
      costEstUsd,
      cached: Boolean(cached),
      // 控制字段大小，避免问答超长刷屏：截断到 300/600 字符
      question: typeof question === "string" ? truncate(question, 300) : question,
      answer: typeof answer === "string" ? truncate(answer, 600) : answer,
      ...((meta && { meta }) || {}),
    };

    info("ai_event", event);
  }

  return { info, warn, error, logAiEvent };
}

/** 单例：可直接使用 */
export const defaultLogger: Logger = createLogger();

/** 工具：字符串截断（附加省略号） */
function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - 1)) + "…";
}
