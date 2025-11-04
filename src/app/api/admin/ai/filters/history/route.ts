// apps/web/app/api/admin/ai/filters/history/route.ts
/* 功能：查询过滤规则变更历史 */
import { NextRequest } from "next/server";
import { aiDb } from "@/lib/aiDb";
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { success, badRequest, internalError } from "@/app/api/_lib/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type HistoryRow = {
  id: string;
  filter_id: string;
  type: string;
  pattern: string;
  status: string;
  changed_by: number | null;
  changed_at: Date | string | null;
  action: string;
};

function toIso(d?: Date | string | null): string | undefined {
  if (!d) return undefined;
  return typeof d === "string" ? d : d.toISOString();
}

const getAiFiltersHistorySelect = () => (aiDb as any).selectFrom("ai_filters_history");

/**
 * GET /api/admin/ai/filters/history?filterId=...
 * 查询过滤规则变更历史
 * Query参数：
 *   - filterId: 过滤规则ID（必需）
 */
export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const filterIdParam = searchParams.get("filterId");

    if (!filterIdParam) {
      return badRequest("filterId query parameter is required.");
    }

    const filterId = Number(filterIdParam);
    if (isNaN(filterId)) {
      return badRequest("filterId must be a valid number.");
    }

    // 查询历史记录
    const rows = await getAiFiltersHistorySelect()
      .selectAll()
      .where("filter_id", "=", filterId)
      .orderBy("changed_at", "desc")
      .execute() as HistoryRow[];

    const items = rows.map((r) => ({
      id: r.id,
      filterId: Number(r.filter_id),
      type: r.type,
      pattern: r.pattern,
      status: r.status as "draft" | "active" | "inactive",
      changedBy: r.changed_by || undefined,
      changedAt: toIso(r.changed_at),
      action: r.action,
    }));

    return success({ items });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unexpected server error.";
    return internalError(msg);
  }
});

