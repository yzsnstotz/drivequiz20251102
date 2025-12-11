export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

import { NextRequest } from "next/server";
import { withAdminAuth, getAdminInfo } from "@/app/api/_lib/withAdminAuth";
import { success, badRequest, internalError } from "@/app/api/_lib/errors";
import { approveStudentVerification, deriveStatus } from "@/lib/studentVerification";

function normalizeReviewerId(input?: string | null): string | null {
  if (!input) return null;
  const trimmed = String(input).trim();
  const uuidLike = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  return uuidLike.test(trimmed) ? trimmed : null;
}

export const POST = withAdminAuth(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { id } = await params;
    const { validFrom, validUntil, reviewerId } = body || {};

    if (!id) return badRequest("id is required");
    if (!validUntil) return badRequest("validUntil is required");

    const vf = validFrom ? new Date(validFrom) : new Date();
    const vu = new Date(validUntil);
    if (isNaN(vu.getTime())) {
      return badRequest("validUntil is invalid");
    }

    const adminInfo = await getAdminInfo(req);
    const adminReviewer =
      normalizeReviewerId(reviewerId) ||
      normalizeReviewerId(adminInfo?.username) ||
      null;

    const updated = await approveStudentVerification(id, adminReviewer ?? "admin", vf, vu);
    if (!updated) {
      return badRequest("record not pending or not found");
    }

    return success({
      id: updated.id,
      status: deriveStatus(updated as any),
      validFrom: updated.valid_from,
      validUntil: updated.valid_until,
    });
  } catch (e) {
    console.error("[POST /api/admin/student/verifications/:id/approve] error:", e);
    return internalError("Failed to approve verification");
  }
});
