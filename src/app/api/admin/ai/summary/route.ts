// apps/web/app/api/admin/ai/summary/route.ts
import { NextRequest, NextResponse } from "next/server";

// 运行时配置（保持与项目其他路由一致）
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ok<T> = { ok: true; data: T; pagination?: never };
type Err = {
  ok: false;
  errorCode:
    | "AUTH_REQUIRED"
    | "FORBIDDEN"
    | "VALIDATION_FAILED"
    | "PROVIDER_ERROR"
    | "INTERNAL_ERROR";
  message: string;
  details?: Record<string, unknown>;
};

// 统一响应构造
const ok = <T>(data: T) =>
  NextResponse.json<Ok<T>>({ ok: true, data }, { status: 200 });

const badRequest = (message: string, details?: Record<string, unknown>) =>
  NextResponse.json<Err>(
    { ok: false, errorCode: "VALIDATION_FAILED", message, details },
    { status: 400 },
  );

const unauthorized = (message = "Unauthorized") =>
  NextResponse.json<Err>(
    { ok: false, errorCode: "AUTH_REQUIRED", message },
    { status: 401 },
  );

const providerError = (message: string, details?: Record<string, unknown>) =>
  NextResponse.json<Err>(
    { ok: false, errorCode: "PROVIDER_ERROR", message, details },
    { status: 502 },
  );

const internalError = (message = "Internal server error") =>
  NextResponse.json<Err>(
    { ok: false, errorCode: "INTERNAL_ERROR", message },
    { status: 500 },
  );

// 依赖环境变量
const AI_SERVICE_URL = process.env.AI_SERVICE_URL;
const AI_SERVICE_TOKEN = process.env.AI_SERVICE_TOKEN;
const AI_SERVICE_SUMMARY_URL =
  process.env.AI_SERVICE_SUMMARY_URL ||
  (AI_SERVICE_URL ? `${AI_SERVICE_URL.replace(/\/+$/, "")}/v1/admin/daily-summary` : "");

// Admin 鉴权（与项目现有中间件保持一致用法）
/**
 * 说明：
 * 本路由依赖现有的 withAdminAuth 高阶函数（/app/api/_lib/withAdminAuth）。
 * 该函数负责：
 *  - 验证 Bearer Admin JWT
 *  - 注入 admin 上下文（如 userId/roles）
 *  - 失败时返回 401/403 的统一错误结构
 *
 * 约定：withAdminAuth(handler) -> (req) => NextResponse
 */
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";

/**
 * GET /api/admin/ai/summary
 * Query:
 *   - date?: string (YYYY-MM-DD)，默认当天（UTC）
 *   - range?: string ('day' | 'week' | 'month') 可选，预留扩展
 * 行为：
 *   - 转发到 AI-Service /v1/admin/daily-summary（携带 Service Token）
 *   - 统一包装返回结构 { ok, data }
 */
const handler = async (req: NextRequest): Promise<NextResponse> => {
  try {
    if (!AI_SERVICE_SUMMARY_URL || !AI_SERVICE_TOKEN) {
      return providerError("AI service summary endpoint not configured", {
        AI_SERVICE_SUMMARY_URL: !!AI_SERVICE_SUMMARY_URL,
        AI_SERVICE_TOKEN: !!AI_SERVICE_TOKEN,
      });
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") ?? undefined;
    const range = searchParams.get("range") ?? undefined;

    // 基础校验
    if (range && !["day", "week", "month"].includes(range)) {
      return badRequest("Invalid range. Allowed: day | week | month");
    }
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return badRequest("Invalid date format. Expect YYYY-MM-DD");
    }

    // 组装下游请求
    const qs = new URLSearchParams();
    if (date) qs.set("date", date);
    if (range) qs.set("range", range);

    const url =
      qs.toString().length > 0
        ? `${AI_SERVICE_SUMMARY_URL}?${qs.toString()}`
        : AI_SERVICE_SUMMARY_URL;

    const resp = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AI_SERVICE_TOKEN}`,
      },
      // 避免边缘环境缓存
      cache: "no-store",
    });

    const payload = (await resp.json().catch(() => ({}))) as
      | Ok<any>
      | Err
      | Record<string, unknown>;

    // 下游非 2xx 统一映射为 PROVIDER_ERROR
    if (!resp.ok) {
      return providerError("Upstream error", {
        status: resp.status,
        body: payload,
      });
    }

    // 期待下游同样是 { ok, ... } 结构；若不是则包一层
    if (typeof (payload as any).ok === "boolean") {
      return NextResponse.json(payload, { status: 200 });
    }

    return ok(payload);
  } catch (err: unknown) {
    return internalError(
      err instanceof Error ? err.message : "Unexpected error",
    );
  }
};

// 通过 withAdminAuth 包装导出
export const GET = withAdminAuth(handler);

// 仅为对齐团队习惯导出 HEAD 支持（可被健康检查/探活利用）
export const HEAD = withAdminAuth(async (req: NextRequest) => {
  const res = await GET(req);
  // 仅返回头部与状态
  return new NextResponse(null, { status: res.status, headers: res.headers });
});
