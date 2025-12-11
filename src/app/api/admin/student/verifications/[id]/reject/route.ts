export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

import { NextRequest } from "next/server";
import { withAdminAuth, getAdminInfo } from "@/app/api/_lib/withAdminAuth";
import { success, badRequest, internalError } from "@/app/api/_lib/errors";
import { rejectStudentVerification } from "@/lib/studentVerification";
import { resolveReviewerId } from "@/lib/adminReviewer";

function normalizeReviewerId(input?: string | null): string | null {
  if (!input) return null;
  const trimmed = String(input).trim();
  // 仅当看起来是 UUID 时才返回，否则置空，避免 DB uuid 解析报错
  const uuidLike = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  return uuidLike.test(trimmed) ? trimmed : null;
}

export const POST = withAdminAuth(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { reviewNote, reviewerId } = body || {};

    if (!id) return badRequest("id is required");
    if (!reviewNote) return badRequest("reviewNote is required");

    const adminInfo = await getAdminInfo(req);
    const reviewer = resolveReviewerId(reviewerId, adminInfo);

    const updated = await rejectStudentVerification(id, reviewer, String(reviewNote).trim());
    if (!updated) return badRequest("record not pending or not found");

    return success({
      id: updated.id,
      status: "rejected",
      reviewNote: updated.review_note,
    });
  } catch (e) {
    console.error("[POST /api/admin/student/verifications/:id/reject] error:", e);
    const message = e instanceof Error ? e.message : "Failed to reject verification";
    // 若数据库缺少 review_note 字段或其他列导致报错，返回 400 以便前端感知
    if (typeof message === "string" && /review_note|column|does not exist|relation|invalid/i.test(message)) {
      return badRequest(`DB_ERROR: ${message}`);
    }
    return internalError("Failed to reject verification");
  }
});
