export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

import { NextRequest } from "next/server";
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { success, badRequest, internalError } from "@/app/api/_lib/errors";
import { rejectStudentVerification } from "@/lib/studentVerification";

export const POST = withAdminAuth(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { reviewNote, reviewerId } = body || {};

    if (!id) return badRequest("id is required");
    if (!reviewNote) return badRequest("reviewNote is required");

    const reviewer = reviewerId || "admin";

    const updated = await rejectStudentVerification(id, reviewer, String(reviewNote));
    if (!updated) return badRequest("record not pending or not found");

    return success({
      id: updated.id,
      status: "rejected",
      reviewNote: updated.review_note,
    });
  } catch (e) {
    console.error("[POST /api/admin/student/verifications/:id/reject] error:", e);
    return internalError("Failed to reject verification");
  }
});
