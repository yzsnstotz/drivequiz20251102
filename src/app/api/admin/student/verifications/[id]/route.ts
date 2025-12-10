export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

import { NextRequest } from "next/server";
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { success, badRequest, internalError, notFound } from "@/app/api/_lib/errors";
import { db } from "@/lib/db";
import { deriveStatus } from "@/lib/studentVerification";

function toISO(v: Date | null | undefined) {
  if (!v) return null;
  return v.toISOString();
}

export const GET = withAdminAuth(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    if (!id) return badRequest("id is required");

    const row = await db
      .selectFrom("student_verifications")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    if (!row) return notFound("verification not found");

    const derived = deriveStatus({
      ...row,
    } as any);
    const nowTs = Date.now();
    const isExpired = derived === "expired" || (row.status === "approved" && row.valid_until && row.valid_until.getTime() < nowTs);

    return success({
      id: row.id,
      userId: row.user_id,
      fullName: row.full_name,
      nationality: row.nationality,
      email: row.email,
      phoneNumber: row.phone_number,
      channelSource: row.channel_source,
      schoolName: row.school_name,
      studyPeriodFrom: row.study_period_from ? row.study_period_from.toISOString().split("T")[0] : null,
      studyPeriodTo: row.study_period_to ? row.study_period_to.toISOString().split("T")[0] : null,
      admissionDocs: row.admission_docs || [],
      status: isExpired ? "expired" : row.status,
      reviewNote: row.review_note,
      reviewerId: row.reviewer_id,
      reviewedAt: toISO(row.reviewed_at),
      validFrom: toISO(row.valid_from),
      validUntil: toISO(row.valid_until),
      createdAt: toISO(row.created_at),
      updatedAt: toISO(row.updated_at),
    });
  } catch (e) {
    console.error("[GET /api/admin/student/verifications/:id] error:", e);
    return internalError("Failed to fetch verification");
  }
});
