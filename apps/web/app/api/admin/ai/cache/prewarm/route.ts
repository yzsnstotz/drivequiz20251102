// apps/web/app/api/admin/ai/cache/prewarm/route.ts
/* 功能：预热缓存 - 将 Top10 问题预热到缓存 */
import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ok<T> = { ok: true; data: T };
type Err = {
  ok: false;
  errorCode: "AUTH_REQUIRED" | "FORBIDDEN" | "VALIDATION_FAILED" | "PROVIDER_ERROR" | "INTERNAL_ERROR";
  message: string;
  details?: Record<string, unknown>;
};

const ok = <T>(data: T) => NextResponse.json<Ok<T>>({ ok: true, data }, { status: 200 });

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

/**
 * POST /api/admin/ai/cache/prewarm
 * 行为：
 *   - 转发到 AI-Service POST /v1/admin/cache/prewarm（携带 Service Token）
 *   - 统一包装返回结构 { ok, data }
 */
const handler = async (req: NextRequest): Promise<NextResponse> => {
  try {
    if (!AI_SERVICE_URL || !AI_SERVICE_TOKEN) {
      return providerError("AI service not configured", {
        AI_SERVICE_URL: !!AI_SERVICE_URL,
        AI_SERVICE_TOKEN: !!AI_SERVICE_TOKEN,
      });
    }

    // 组装下游请求 URL
    const baseUrl = AI_SERVICE_URL.replace(/\/v1\/?$/, "").replace(/\/+$/, "");
    const prewarmUrl = `${baseUrl}/v1/admin/cache/prewarm`;

    const resp = await fetch(prewarmUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AI_SERVICE_TOKEN}`,
      },
      cache: "no-store",
    });

    const payload = (await resp.json().catch(() => ({}))) as Ok<any> | Err | Record<string, unknown>;

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
    return internalError(err instanceof Error ? err.message : "Unexpected error");
  }
};

// 通过 withAdminAuth 包装导出
export const POST = withAdminAuth(handler);

