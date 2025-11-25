// apps/web/app/api/admin/ai/summary/route.ts
import { NextRequest, NextResponse } from "next/server";
import { aiDb } from "@/lib/aiDb";
import { sql } from "kysely";

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

const internalError = (message = "Internal server error") =>
  NextResponse.json<Err>(
    { ok: false, errorCode: "INTERNAL_ERROR", message },
    { status: 500 },
  );

// Admin 鉴权
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";

/**
 * GET /api/admin/ai/summary
 * Query:
 *   - date?: string (YYYY-MM-DD)，默认当天（UTC）
 * 行为：
 *   - 直接查询 ai_logs 表，聚合统计当天的数据
 *   - 统一包装返回结构 { ok, data }
 */
const handler = async (req: NextRequest): Promise<NextResponse> => {
  try {
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");

    // 日期校验和默认值处理
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

    // 计算时间范围：当天 00:00:00 ～ 次日 00:00:00 (UTC)
    const startDate = new Date(`${statDate}T00:00:00.000Z`);
    const endDate = new Date(startDate);
    endDate.setUTCDate(endDate.getUTCDate() + 1);

    // 查询 ai_logs 表，聚合统计
    const logs = await (aiDb as any)
      .selectFrom("ai_logs")
      .select([
        sql<number>`COUNT(*)`.as("total_calls"),
        sql<number>`COUNT(CASE WHEN cached = true THEN 1 END)`.as("cached_calls"),
        sql<number>`COUNT(CASE WHEN rag_hits > 0 THEN 1 END)`.as("rag_hit_calls"),
        sql<number>`COUNT(CASE WHEN safety_flag = 'blocked' THEN 1 END)`.as("blocked_calls"),
        sql<number>`COUNT(CASE WHEN safety_flag = 'needs_human' THEN 1 END)`.as("needs_human_calls"),
        sql<number>`COALESCE(AVG(cost_est), 0)`.as("avg_cost"),
      ])
      .where("created_at", ">=", startDate)
      .where("created_at", "<", endDate)
      .executeTakeFirst();

    // 查询语言分布
    const localeStats = await (aiDb as any)
      .selectFrom("ai_logs")
      .select([
        "locale",
        sql<number>`COUNT(*)`.as("count"),
      ])
      .where("created_at", ">=", startDate)
      .where("created_at", "<", endDate)
      .where("locale", "is not", null)
      .groupBy("locale")
      .orderBy("count", "desc")
      .limit(10)
      .execute();

    // 查询热门问题（Top 10）
    const topQuestions = await (aiDb as any)
      .selectFrom("ai_logs")
      .select([
        "question",
        sql<number>`COUNT(*)`.as("count"),
      ])
      .where("created_at", ">=", startDate)
      .where("created_at", "<", endDate)
      .groupBy("question")
      .orderBy("count", "desc")
      .limit(10)
      .execute();

    // 处理聚合结果，确保所有字段都有默认值
    const totalCalls = Number(logs?.total_calls || 0);
    const cachedCalls = Number(logs?.cached_calls || 0);
    const ragHitCalls = Number(logs?.rag_hit_calls || 0);
    const blockedCalls = Number(logs?.blocked_calls || 0);
    const needsHumanCalls = Number(logs?.needs_human_calls || 0);
    const avgCost = Number(logs?.avg_cost || 0);

    // 计算缓存命中率和 RAG 命中率
    const cacheHitRate = totalCalls > 0 ? cachedCalls / totalCalls : 0;
    const ragHitRate = totalCalls > 0 ? ragHitCalls / totalCalls : 0;

    // 构建语言分布对象
    const locales: Record<string, number> = {};
    for (const stat of localeStats || []) {
      if (stat.locale) {
        locales[stat.locale] = Number(stat.count || 0);
      }
    }

    // 构建热门问题数组
    const topQuestionsList = (topQuestions || []).map((item: any) => ({
      question: item.question || "",
      count: Number(item.count || 0),
    }));

    // 构建返回数据
    const summary = {
      date: statDate,
      totalCalls,
      avgCostUsd: avgCost,
      avgCost: avgCost,
      cacheHitRate,
      ragHitRate,
      blocked: blockedCalls,
      needsHuman: needsHumanCalls,
      locales,
      topQuestions: topQuestionsList,
      totals: {
        totalCalls,
        cacheHitRate,
        ragHitRate,
        avgCost,
        avgCostUsd: avgCost,
      },
    };

    return ok(summary);
  } catch (err: unknown) {
    console.error("[GET /api/admin/ai/summary] Error:", err);
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
