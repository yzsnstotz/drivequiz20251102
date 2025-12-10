import { db } from "@/lib/db";

export type StudentStatus = "none" | "pending" | "approved" | "rejected" | "expired";

export interface StudentVerificationRecord {
  id: string;
  user_id: string;
  full_name: string;
  nationality: string;
  email: string;
  phone_number: string;
  channel_source: string;
  school_name: string;
  study_period_from: Date | null;
  study_period_to: Date | null;
  admission_docs: any;
  status: StudentStatus | "pending" | "approved" | "rejected" | "expired";
  review_note: string | null;
  reviewer_id: string | null;
  reviewed_at: Date | null;
  valid_from: Date | null;
  valid_until: Date | null;
  created_at: Date;
  updated_at: Date;
}

export function deriveStatus(row: StudentVerificationRecord | null): StudentStatus {
  if (!row) return "none";
  if (row.status === "approved") {
    const now = Date.now();
    const validUntil = row.valid_until ? new Date(row.valid_until).getTime() : 0;
    if (validUntil && validUntil < now) return "expired";
  }
  if (row.status === "expired") return "expired";
  if (row.status === "rejected") return "rejected";
  if (row.status === "pending") return "pending";
  return "none";
}

export async function getLatestStudentVerification(userId: string): Promise<StudentVerificationRecord | null> {
  const row = await db
    .selectFrom("student_verifications")
    .selectAll()
    .where("user_id", "=", userId)
    .orderBy("created_at", "desc")
    .limit(1)
    .executeTakeFirst();
  return (row as StudentVerificationRecord | undefined) ?? null;
}

export async function approveStudentVerification(
  verificationId: string,
  reviewerId: string,
  validFrom: Date,
  validUntil: Date
): Promise<StudentVerificationRecord | null> {
  const existing = await db
    .selectFrom("student_verifications")
    .selectAll()
    .where("id", "=", verificationId)
    .executeTakeFirst();

  if (!existing || existing.status !== "pending") {
    return null;
  }

  const updated = await db
    .updateTable("student_verifications")
    .set({
      status: "approved",
      reviewer_id: reviewerId,
      reviewed_at: new Date(),
      valid_from: validFrom,
      valid_until: validUntil,
      updated_at: new Date(),
    })
    .where("id", "=", verificationId)
    .returningAll()
    .executeTakeFirst();

  return updated ?? null;
}

export async function rejectStudentVerification(
  verificationId: string,
  reviewerId: string,
  reviewNote: string
): Promise<StudentVerificationRecord | null> {
  const existing = await db
    .selectFrom("student_verifications")
    .selectAll()
    .where("id", "=", verificationId)
    .executeTakeFirst();

  if (!existing || existing.status !== "pending") {
    return null;
  }

  const updated = await db
    .updateTable("student_verifications")
    .set({
      status: "rejected",
      reviewer_id: reviewerId,
      review_note: reviewNote,
      reviewed_at: new Date(),
      updated_at: new Date(),
    })
    .where("id", "=", verificationId)
    .returningAll()
    .executeTakeFirst();

  return updated ?? null;
}

export async function upsertPendingVerification(
  userId: string,
  payload: {
    full_name: string;
    nationality: string;
    email: string;
    phone_number: string;
    channel_source: string;
    school_name: string;
    study_period_from: Date | null;
    study_period_to: Date | null;
    admission_docs: any;
  }
): Promise<StudentVerificationRecord> {
  const latest = await getLatestStudentVerification(userId);
  const now = new Date();
  if (latest && latest.status === "pending") {
    const updated = await db
      .updateTable("student_verifications")
      .set({
        ...payload,
        status: "pending",
        reviewer_id: null,
        reviewed_at: null,
        review_note: null,
        valid_from: null,
        valid_until: null,
        updated_at: now,
      })
      .where("id", "=", latest.id)
      .returningAll()
      .executeTakeFirst();
    if (updated) return updated as StudentVerificationRecord;
  }

  const inserted = await db
    .insertInto("student_verifications")
    .values({
      user_id: userId,
      ...payload,
      status: "pending",
    })
    .returningAll()
    .executeTakeFirst();

  return inserted as StudentVerificationRecord;
}

export function isApprovedAndValid(row: StudentVerificationRecord | null): boolean {
  if (!row) return false;
  const status = deriveStatus(row);
  if (status !== "approved") return false;
  if (!row.valid_until) return false;
  return new Date(row.valid_until).getTime() > Date.now();
}
