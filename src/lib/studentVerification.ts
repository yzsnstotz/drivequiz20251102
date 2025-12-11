import { db } from "@/lib/db";
import { sql } from "kysely";
export type StudentStatus = "none" | "pending" | "approved" | "rejected" | "expired";

type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

export type AdmissionDoc = {
  fileId: string;
  bucket: string;
  url: string;
  name: string;
  size?: number;
  mimeType?: string;
  contentType?: string;
};

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
  admission_docs: Json | null;
  status: StudentStatus | "pending" | "approved" | "rejected" | "expired";
  review_note: string | null;
  reviewer_id: string | null;
  reviewed_at: Date | null;
  valid_from: Date | null;
  valid_until: Date | null;
  created_at: Date;
  updated_at: Date;
}

function buildAdmissionDocsJsonExpr(docs: AdmissionDoc[]) {
  const cleaned = docs.map((doc) => {
    const base: Record<string, any> = {
      fileId: String(doc.fileId),
      bucket: String(doc.bucket),
      url: String(doc.url),
      name: String(doc.name),
    };
    if (typeof doc.size === "number") base.size = doc.size;
    if (typeof doc.mimeType === "string" && doc.mimeType.trim()) base.mimeType = doc.mimeType.trim();
    if (typeof doc.contentType === "string" && doc.contentType.trim()) base.contentType = doc.contentType.trim();
    return base;
  });
  const jsonText = JSON.stringify(cleaned);
  return sql`to_jsonb(${jsonText}::jsonb)`;
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
    admission_docs: AdmissionDoc[];
  }
): Promise<StudentVerificationRecord> {
  const admissionDocsExpr = buildAdmissionDocsJsonExpr(payload.admission_docs);

  const latest = await getLatestStudentVerification(userId);
  const now = new Date();
  if (latest && latest.status === "pending") {
    const updated = await db
      .updateTable("student_verifications")
      .set({
        ...payload,
        admission_docs: admissionDocsExpr as unknown as Json,
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
      admission_docs: admissionDocsExpr as unknown as Json,
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
