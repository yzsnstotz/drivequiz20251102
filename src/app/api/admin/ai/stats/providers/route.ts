// src/app/api/admin/ai/stats/providers/route.ts
import { NextRequest, NextResponse } from "next/server";
import { aiDb } from "@/lib/aiDb";

// 运行时配置
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ok<T> = { ok: true; data: T };
type Err = {
  ok: false;
  errorCode: "AUTH_REQUIRED" | "FORBIDDEN" | "VALIDATION_FAILED" | "INTERNAL_ERROR";
  message: string;
  details?: Record<string, unknown>;
};

// 统一响应构造
const ok = <T>(data: T) => NextResponse.json<Ok<T>>({ ok: true, data }, { status: 200 });

const badRequest = (message: string, details?: Record<string, unknown>) =>
  NextResponse.json<Err>(
    { ok: false, errorCode: "VALIDATION_FAILED", message, details },
    { status: 400 }
  );

const unauthorized = (message = "Unauthorized") =>
  NextResponse.json<Err>(
    { ok: false, errorCode: "AUTH_REQUIRED", message },
    { status: 401 }
  );

const internalError = (message = "Internal server error") =>
  NextResponse.json<Err>(
    { ok: false, errorCode: "INTERNAL_ERROR", message },
    { status: 500 }
  );

// Admin 鉴权
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";

/**
 * GET /api/admin/ai/stats/providers
 * Query:
 *   - date?: string (YYYY-MM-DD)，默认当天（UTC）
 * 返回按 provider、model、scene 的每日调用统计
 */
const handler = async (req: NextRequest): Promise<NextResponse> => {
  try {
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");

    // 日期校验
    let statDate: string;
    if (dateParam) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        return badRequest("Invalid date format. Expect YYYY-MM-DD");
      }
      statDate = dateParam;
    } else {
      // 默认当天（UTC）
      statDate = new Date().toISOString().slice(0, 10);
    }

    // 查询数据库
    const stats = await (aiDb as any)
      .selectFrom("ai_provider_daily_stats")
      .select([
        "provider",
        "model",
        "scene",
        "total_calls",
        "total_success",
        "total_error",
      ])
      .where("stat_date", "=", statDate)
      .orderBy("provider", "asc")
      .orderBy("model", "asc")
      .orderBy("scene", "asc")
      .execute();

    // 格式化返回数据
    const formattedStats = stats.map((stat: any) => ({
      provider: stat.provider,
      model: stat.model || null,
      scene: stat.scene || null,
      total_calls: stat.total_calls,
      total_success: stat.total_success,
      total_error: stat.total_error,
      success_rate:
        stat.total_calls > 0
          ? ((stat.total_success / stat.total_calls) * 100).toFixed(2) + "%"
          : "0%",
    }));

    return ok(formattedStats);
  } catch (err: unknown) {
    console.error("[GET /api/admin/ai/stats/providers] Error:", err);
    return internalError(
      err instanceof Error ? err.message : "Unexpected error"
    );
  }
};

// 通过 withAdminAuth 包装导出
export const GET = withAdminAuth(handler);

