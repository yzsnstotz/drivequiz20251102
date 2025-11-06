// apps/web/app/api/admin/ai/filters/[id]/status/route.ts
/* 功能：切换过滤规则状态（草案→生效/停用） */
import { NextRequest } from "next/server";
import { sql } from "kysely";
import { aiDb } from "@/lib/aiDb";
import { withAdminAuth, getAdminInfo } from "@/app/api/_lib/withAdminAuth";
import { success, badRequest, notFound, invalidState, internalError } from "@/app/api/_lib/errors";
import { logUpdate } from "@/app/api/_lib/operationLog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Row = {
  id: string;
  type: string;
  pattern: string;
  status: string | null;
  changed_by: number | null;
  changed_at: Date | string | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
};

function toIso(d?: Date | string | null): string | undefined {
  if (!d) return undefined;
  return typeof d === "string" ? d : d.toISOString();
}

const getAiFiltersSelect = () => (aiDb as any).selectFrom("ai_filters");
const getAiFiltersUpdate = () => (aiDb as any).updateTable("ai_filters");

/**
 * PUT /api/admin/ai/filters/:id/status
 * 切换过滤规则状态
 * Body: { status: "draft" | "active" | "inactive" }
 */
export const PUT = withAdminAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const adminInfo = await getAdminInfo(req);
      if (!adminInfo) {
        return internalError("Failed to get admin info");
      }

      const { id: idParam } = await params;
      const id = Number(idParam);
      if (isNaN(id)) return badRequest("Invalid ID parameter");

      const body = await req.json().catch(() => null) as { status?: string } | null;
      if (!body || typeof body.status !== "string") {
        return badRequest("Body.status must be a string.");
      }

      const newStatus = body.status as "draft" | "active" | "inactive";
      if (newStatus !== "draft" && newStatus !== "active" && newStatus !== "inactive") {
        return badRequest("status must be 'draft', 'active', or 'inactive'.");
      }

      // 检查规则是否存在
      const existing = await getAiFiltersSelect()
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst() as Row | undefined;

      if (!existing) {
        return notFound("Filter not found");
      }

      const oldStatus = (existing.status as "draft" | "active" | "inactive") || "draft";

      // 验证状态转换（草案→生效/停用；生效→停用；停用→生效/草案）
      if (oldStatus === newStatus) {
        return invalidState(`Filter is already in '${newStatus}' status`);
      }

      // 执行状态更新
      const updated = await getAiFiltersUpdate()
        .set({
          status: newStatus,
          changed_by: adminInfo.id,
          changed_at: sql`NOW()`,
          updated_at: sql`NOW()`,
        })
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirst() as Row | undefined;

      if (!updated) {
        return internalError("Failed to update filter status");
      }

      // 记录操作日志
      await logUpdate(
        req,
        "ai_filters",
        id,
        { type: existing.type, pattern: existing.pattern, status: oldStatus },
        { type: updated.type, pattern: updated.pattern, status: newStatus },
        `Filter ${existing.type} status changed from ${oldStatus} to ${newStatus}`
      );

      const data = {
        id: updated.id,
        type: updated.type,
        pattern: updated.pattern,
        status: (updated.status as "draft" | "active" | "inactive") || "draft",
        changedBy: updated.changed_by || undefined,
        changedAt: toIso(updated.changed_at),
        createdAt: toIso(updated.created_at),
        updatedAt: toIso(updated.updated_at),
      };

      return success(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unexpected server error.";
      return internalError(msg);
    }
  }
);

