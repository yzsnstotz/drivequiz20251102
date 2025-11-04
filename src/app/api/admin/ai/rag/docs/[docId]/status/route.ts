// apps/web/app/api/admin/ai/rag/docs/[docId]/status/route.ts
/* 功能：切换 RAG 文档状态（active/disabled） */
import { NextRequest } from "next/server";
import { sql } from "kysely";
import { aiDb } from "@/lib/aiDb";
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { success, badRequest, notFound, internalError } from "@/app/api/_lib/errors";
import { logUpdate } from "@/app/api/_lib/operationLog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DocRow = {
  id: string;
  title: string;
  url: string | null;
  lang: string | null;
  tags: string[] | null;
  status: string | null;
  version: string | null;
  chunks: number | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
};

function toIso(d?: Date | string | null): string | undefined {
  if (!d) return undefined;
  return typeof d === "string" ? d : d.toISOString();
}

const getAiRagDocsSelect = () => (aiDb as any).selectFrom("ai_rag_docs");
const getAiRagDocsUpdate = () => (aiDb as any).updateTable("ai_rag_docs");

/**
 * PUT /api/admin/ai/rag/docs/:docId/status
 * 切换文档状态
 * Body: { status: "active" | "disabled" }
 */
export const PUT = withAdminAuth(
  async (req: NextRequest, { params }: { params: Promise<{ docId: string }> }) => {
    try {
      const { docId: docIdParam } = await params;
      const docId = Number(docIdParam);
      if (isNaN(docId)) return badRequest("Invalid docId parameter");

      const body = (await req.json().catch(() => null)) as { status?: string } | null;
      if (!body || typeof body.status !== "string") {
        return badRequest("Body.status must be a string.");
      }

      const newStatus = body.status as "active" | "disabled";
      if (newStatus !== "active" && newStatus !== "disabled") {
        return badRequest("status must be 'active' or 'disabled'.");
      }

      // 检查文档是否存在
      const existing = await getAiRagDocsSelect()
        .selectAll()
        .where("id", "=", docId)
        .executeTakeFirst() as DocRow | undefined;

      if (!existing) {
        return notFound("Document not found");
      }

      // 执行状态更新
      const updated = await getAiRagDocsUpdate()
        .set({
          status: newStatus,
          updated_at: sql`NOW()`,
        })
        .where("id", "=", docId)
        .returningAll()
        .executeTakeFirst() as DocRow | undefined;

      if (!updated) {
        return internalError("Failed to update document status");
      }

      const oldStatus = existing.status || null;
      const newStatusValue = updated.status || null;

      // 记录操作日志
      await logUpdate(
        req,
        "ai_rag_docs",
        docId,
        { status: oldStatus },
        { status: newStatusValue },
        `RAG document "${existing.title}" status changed from ${oldStatus} to ${newStatusValue}`
      );

      const data = {
        id: updated.id,
        title: updated.title,
        url: updated.url || undefined,
        lang: updated.lang || undefined,
        tags: updated.tags || undefined,
        status: updated.status || undefined,
        version: updated.version || undefined,
        chunks: updated.chunks ?? 0,
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

