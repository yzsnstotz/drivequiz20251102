export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

import { NextRequest } from "next/server";
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { success, internalError } from "@/app/api/_lib/errors";
import { parsePagination, getPaginationMeta } from "@/app/api/_lib/pagination";
import { db } from "@/lib/db";
import { deriveStatus } from "@/lib/studentVerification";

const STATUS_WHITELIST = new Set(["pending", "approved", "rejected", "expired"]);

function toISO(v: Date | null | undefined) {
  if (!v) return null;
  return v.toISOString();
}

export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    const sp = req.nextUrl.searchParams;
    const status = sp.get("status") || "";
    const from = sp.get("from");
    const to = sp.get("to");

    const { page, limit } = parsePagination(sp);
    const safePage = Number(page) > 0 ? Number(page) : 1;
    const safeLimit = Number(limit) > 0 ? Number(limit) : 20;
    const offset = (safePage - 1) * safeLimit;

    let countQ = db
      .selectFrom("student_verifications")
      .select(({ fn }) => fn.countAll<number>().as("count"));

    let listQ = db
      .selectFrom("student_verifications")
      .selectAll();

    if (status && STATUS_WHITELIST.has(status)) {
      if (status === "expired") {
        const now = new Date();
        listQ = listQ.where((eb) =>
          eb.and([
            eb("status", "=", "approved"),
            eb("valid_until", "<", now),
          ]),
        );
        countQ = countQ.where((eb) =>
          eb.and([
            eb("status", "=", "approved"),
            eb("valid_until", "<", now),
          ]),
        );
      } else {
        listQ = listQ.where("status", "=", status as any);
        countQ = countQ.where("status", "=", status as any);
      }
    }

    if (from) {
      const d = new Date(from);
      if (!isNaN(d.getTime())) {
        listQ = listQ.where("created_at", ">=", d);
        countQ = countQ.where("created_at", ">=", d);
      }
    }
    if (to) {
      const d = new Date(to);
      if (!isNaN(d.getTime())) {
        listQ = listQ.where("created_at", "<=", d);
        countQ = countQ.where("created_at", "<=", d);
      }
    }

    const totalRow = await countQ.executeTakeFirst();
    const total = Number(totalRow?.count ?? 0);

    const rows = await listQ
      .orderBy("created_at", "desc")
      .limit(safeLimit)
      .offset(offset)
      .execute();

    const nowTs = Date.now();
    const items = rows.map((row) => {
      const derived = deriveStatus({
        ...row,
        valid_until: row.valid_until,
      } as any);
      const isExpired = derived === "expired" || (row.status === "approved" && row.valid_until && row.valid_until.getTime() < nowTs);
      return {
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
      };
    });

    return success({
      items,
      pagination: getPaginationMeta(safePage, safeLimit, total),
    });
  } catch (e) {
    console.error("[GET /api/admin/student/verifications] error:", e);
    return internalError("Failed to fetch student verifications");
  }
});
