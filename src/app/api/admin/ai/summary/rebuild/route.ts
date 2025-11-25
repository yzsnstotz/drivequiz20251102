// apps/web/app/api/admin/ai/summary/rebuild/route.ts
import { NextRequest, NextResponse } from "next/server";
import { joinUrl } from "@/lib/urlJoin";

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

// 依赖环境变量（使用新的命名：render 服务）
// 指令版本：0003
const AI_RENDER_SERVICE_URL = process.env.AI_RENDER_SERVICE_URL;
const AI_RENDER_SERVICE_TOKEN = process.env.AI_RENDER_SERVICE_TOKEN;
const AI_SERVICE_SUMMARY_URL =
  process.env.AI_SERVICE_SUMMARY_URL ||
  (AI_RENDER_SERVICE_URL ? joinUrl(AI_RENDER_SERVICE_URL, "/v1/admin/daily-summary") : "");

// Admin 鉴权
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";

/**
 * POST /api/admin/ai/summary/rebuild
 * Query:
 *   - date?: string (YYYY-MM-DD)，默认昨天（UTC）
 * 行为：
 *   - 转发到 AI-Service POST /v1/admin/daily-summary/rebuild（携带 Service Token）
 *   - 统一包装返回结构 { ok, data }
 */
const handler = async (req: NextRequest): Promise<NextResponse> => {
  try {
    if (!AI_SERVICE_SUMMARY_URL || !AI_RENDER_SERVICE_TOKEN) {
      return providerError("AI service summary endpoint not configured", {
        AI_SERVICE_SUMMARY_URL: !!AI_SERVICE_SUMMARY_URL,
        AI_RENDER_SERVICE_TOKEN: !!AI_RENDER_SERVICE_TOKEN,
      });
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") ?? undefined;

    // 基础校验
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return badRequest("Invalid date format. Expect YYYY-MM-DD");
    }

    // 组装下游请求 URL（rebuild 端点）
    // 使用 joinUrl 安全拼接 URL
    const rebuildUrl = AI_SERVICE_SUMMARY_URL.replace(/\/v1\/admin\/daily-summary\/?$/, "");
    const finalRebuildUrl = joinUrl(rebuildUrl, "/v1/admin/daily-summary/rebuild");
    const qs = new URLSearchParams();
    if (date) qs.set("date", date);
    const url =
      qs.toString().length > 0
        ? `${finalRebuildUrl}?${qs.toString()}`
        : finalRebuildUrl;

    // 超时控制（30秒）
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    let resp: Response;
    try {
      resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AI_RENDER_SERVICE_TOKEN}`,
        },
        // 发送空的 JSON body（Fastify 要求如果设置了 Content-Type: application/json，必须有 body）
        body: JSON.stringify({}),
        // 避免边缘环境缓存
        cache: "no-store",
        signal: controller.signal,
      });
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      const isTimeout = errorMessage.includes("aborted") || errorMessage.includes("timeout");
      
      console.error("[rebuild] Network error:", {
        url,
        error: errorMessage,
        isTimeout,
        timestamp: new Date().toISOString(),
      });

      return providerError(
        isTimeout 
          ? "AI Service request timeout (30s). Please try again later."
          : `AI Service is unreachable: ${errorMessage}`,
        {
          url,
          error: errorMessage,
          isTimeout,
        },
      );
    } finally {
      clearTimeout(timeoutId);
    }

    const payload = (await resp.json().catch(() => ({}))) as
      | Ok<any>
      | Err
      | Record<string, unknown>;

    // 下游非 2xx 统一映射为 PROVIDER_ERROR
    if (!resp.ok) {
      console.error("[rebuild] AI Service returned error:", {
        url,
        status: resp.status,
        statusText: resp.statusText,
        body: payload,
        timestamp: new Date().toISOString(),
      });

      return providerError("AI Service returned an error", {
        status: resp.status,
        statusText: resp.statusText,
        url,
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
export const POST = withAdminAuth(handler);

