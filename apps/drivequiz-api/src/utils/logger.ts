import pino from "pino";

const logLevel = process.env.LOG_LEVEL || "info";

/** 结构化日志实例 */
export const logger = pino({
  level: logLevel,
  transport:
    process.env.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        }
      : undefined,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
});

/** 日志事件类型 */
export type LogEvent =
  | "health.ok"
  | "ingest.success"
  | "ingest.failed"
  | "ingest.prechunk.detected"
  | "ingest.batch.start"
  | "ingest.batch.completed"
  | "ingest.batch.partial"
  | "operations.query"
  | "operations.detail"
  | "vectorize.start"
  | "vectorize.completed"
  | "vectorize.failed"
  | "auth.unauthorized"
  | "rate_limit.exceeded";

/** 记录结构化日志 */
export function logEvent(
  event: LogEvent,
  data: Record<string, unknown> = {}
): void {
  logger.info({
    event,
    timestamp: new Date().toISOString(),
    ...data,
  });
}

