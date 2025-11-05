// apps/ai-service/src/routes/admin/daily-summary.ts
/**
 * ZALEM · AI-Service
 * Admin: Daily Summary API
 *
 * GET /v1/admin/daily-summary?date=YYYY-MM-DD&range=day|week|month
 * - 服务侧鉴权：Authorization: Bearer <SERVICE_TOKEN>
 * - 返回统一结构：{ ok, data | errorCode, message }
 *
 * 实现要点：
 * - 优先从缓存读取：key = ai:daily-summary:{date}（默认 date=UTC 当天）
 * - 缓存命中则原样返回；miss 时返回占位空结构（不报错）
 * - 兼容 range（目前按天维度聚合，后续如需可扩展为：ai:daily-summary:{date}:{range}）
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { ServiceConfig } from "../../index.js";
import { ensureServiceAuth } from "../../middlewares/auth.js";
import { cacheGet } from "../../lib/cache.js";
import { triggerDailySummarizeOnce } from "../../jobs/cron.dailySummarize.js";

// 统一响应类型
type Ok<T> = { ok: true; data: T };
type ErrCode = "AUTH_REQUIRED" | "FORBIDDEN" | "VALIDATION_FAILED" | "INTERNAL_ERROR";
type Err = { ok: false; errorCode: ErrCode; message: string; details?: unknown };

// 校验：YYYY-MM-DD
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// 计算 UTC 当天（YYYY-MM-DD）
function utcToday(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return d.toISOString().slice(0, 10);
}

type QueryParams = {
  date?: string;
  range?: string; // 'day' | 'week' | 'month'
};

// 缓存结构（与 dailySummarize 任务输出对齐）
type SummaryDoc = {
  date: string; // YYYY-MM-DD
  range: "day" | "week" | "month";
  generatedAt: string; // ISO8601
  version: "v1";
  sections: {
    faq: Array<{
      question: string;
      answer: string;
      count: number;
      sources: Array<{ title: string; url: string; score?: number }>;
    }>;
    topSources: Array<{ title: string; url: string; hits: number }>;
    safety: { okCount: number; needsHuman: number; blocked: number };
    gaps: string[];
  };
  meta?: Record<string, unknown>;
};

function buildCacheKey(date: string, range: string = "day"): string {
  // 与 dailySummarize 任务保持一致：ai:summary:<YYYY-MM-DD>:<range>
  return `ai:summary:${date}:${range}`;
}

export default async function dailySummaryRoute(app: FastifyInstance): Promise<void> {
  app.get(
    "/v1/admin/daily-summary",
    async (
      request: FastifyRequest<{ Querystring: QueryParams }>,
      reply: FastifyReply,
    ): Promise<void> => {
      const config = app.config as ServiceConfig;

      try {
        // 1) 服务间鉴权
        ensureServiceAuth(request, config);

        // 2) 解析与校验参数
        const date = (request.query.date && String(request.query.date)) || utcToday();
        const range = (String(request.query.range || "day").toLowerCase() as "day" | "week" | "month");

        if (!["day", "week", "month"].includes(range)) {
          reply.code(400).send({
            ok: false,
            errorCode: "VALIDATION_FAILED",
            message: "Invalid range. Allowed: day | week | month",
            details: { received: range },
          } as Err);
          return;
        }

        if (!DATE_RE.test(date)) {
          reply.code(400).send({
            ok: false,
            errorCode: "VALIDATION_FAILED",
            message: "Invalid date format. Expect YYYY-MM-DD",
            details: { received: date },
          } as Err);
          return;
        }

        // 3) 读取缓存（与 dailySummarize 任务键名对齐）
        const cacheKey = buildCacheKey(date, range);
        const cached = await cacheGet<SummaryDoc | null>(cacheKey);

        if (cached && typeof cached === "object") {
          // 命中缓存：补齐必要字段的默认值（避免历史数据缺字段）
          const doc: SummaryDoc = {
            date: cached.date || date,
            range: (cached.range as SummaryDoc["range"]) || "day",
            generatedAt: cached.generatedAt || new Date().toISOString(),
            version: (cached.version as SummaryDoc["version"]) || "v1",
            sections: {
              faq: Array.isArray(cached.sections?.faq) ? cached.sections.faq : [],
              topSources: Array.isArray(cached.sections?.topSources) ? cached.sections.topSources : [],
              safety: cached.sections?.safety ?? { okCount: 0, needsHuman: 0, blocked: 0 },
              gaps: Array.isArray(cached.sections?.gaps) ? cached.sections.gaps : [],
            },
            meta: { ...(cached.meta || {}), source: "cache-hit", cacheKey },
          };
          reply.send({ ok: true, data: doc } as Ok<SummaryDoc>);
          return;
        }

        // 4) 缓存未命中：返回占位空结构（不报错）
        reply.send({
          ok: true,
          data: {},
          note: "no_cached_summary",
        } as Ok<Record<string, never>> & { note: string });
      } catch (e) {
        request.log.error({ err: e }, "daily_summary_route_error");
        const err = e as Error & { statusCode?: number };
        const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
        const message = status >= 500 ? "Internal Server Error" : err.message || "Bad Request";
        reply.code(status).send({
          ok: false,
          errorCode:
            status === 400
              ? "VALIDATION_FAILED"
              : status === 401
              ? "AUTH_REQUIRED"
              : status === 403
              ? "FORBIDDEN"
              : "INTERNAL_ERROR",
          message,
        } as Err);
      }
    },
  );

  // POST /v1/admin/daily-summary/rebuild - 手动触发重建指定日期的摘要
  app.post(
    "/v1/admin/daily-summary/rebuild",
    async (
      request: FastifyRequest<{ Querystring: QueryParams }>,
      reply: FastifyReply,
    ): Promise<void> => {
      const config = app.config as ServiceConfig;

      try {
        // 1) 服务间鉴权
        ensureServiceAuth(request, config);

        // 2) 解析与校验参数（默认昨天）
        const yesterday = new Date();
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        const defaultDate = yesterday.toISOString().slice(0, 10);
        const dateUtc = (request.query.date && String(request.query.date)) || defaultDate;

        if (!DATE_RE.test(dateUtc)) {
          reply.code(400).send({
            ok: false,
            errorCode: "VALIDATION_FAILED",
            message: "Invalid date format. Expect YYYY-MM-DD",
            details: { received: dateUtc },
          } as Err);
          return;
        }

        // 3) 触发重建任务（异步执行，不阻塞响应）
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        triggerDailySummarizeOnce(app, config, { dateUtc });

        // 4) 立即返回成功响应（任务已在后台执行）
        reply.send({
          ok: true,
          data: {
            date: dateUtc,
            message: "Rebuild task started. Summary will be available shortly.",
          },
        } as Ok<{ date: string; message: string }>);
      } catch (e) {
        request.log.error({ err: e }, "daily_summary_rebuild_route_error");
        const err = e as Error & { statusCode?: number };
        const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
        const message = status >= 500 ? "Internal Server Error" : err.message || "Bad Request";
        reply.code(status).send({
          ok: false,
          errorCode:
            status === 400
              ? "VALIDATION_FAILED"
              : status === 401
              ? "AUTH_REQUIRED"
              : status === 403
              ? "FORBIDDEN"
              : "INTERNAL_ERROR",
          message,
        } as Err);
      }
    },
  );
}
