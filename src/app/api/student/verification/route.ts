export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

import { NextRequest, NextResponse } from "next/server";
import { getUserInfo } from "@/app/api/_lib/withUserAuth";
import { upsertPendingVerification, getLatestStudentVerification, deriveStatus, StudentVerificationRecord } from "@/lib/studentVerification";

function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

function err(errorCode: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, errorCode, message }, { status });
}

function parseDate(input?: string | null): Date | null {
  if (!input) return null;
  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

function mapResponse(rec: StudentVerificationRecord | null) {
  if (!rec) {
    return {
      id: null,
      status: "none" as const,
    };
  }
  const status = deriveStatus(rec);
  return {
    id: rec.id,
    status,
    fullName: rec.full_name,
    nationality: rec.nationality,
    email: rec.email,
    phoneNumber: rec.phone_number,
    channelSource: rec.channel_source,
    schoolName: rec.school_name,
    studyPeriodFrom: rec.study_period_from ? rec.study_period_from.toISOString().split("T")[0] : null,
    studyPeriodTo: rec.study_period_to ? rec.study_period_to.toISOString().split("T")[0] : null,
    admissionDocs: rec.admission_docs || [],
    reviewNote: rec.review_note,
    validFrom: rec.valid_from ? rec.valid_from.toISOString() : null,
    validUntil: rec.valid_until ? rec.valid_until.toISOString() : null,
    createdAt: rec.created_at?.toISOString?.() ?? null,
    updatedAt: rec.updated_at?.toISOString?.() ?? null,
  };
}

function normalizeRequiredString(
  value: any,
  field: string
): { ok: true; value: string } | { ok: false; message: string } {
  if (value === undefined || value === null) return { ok: false, message: `${field} 不能为空` };
  const str = String(value).trim();
  if (!str) return { ok: false, message: `${field} 不能为空` };
  return { ok: true, value: str };
}

type AdmissionDocInput = {
  fileId: string;
  bucket: string;
  url: string;
  name: string;
  contentType?: string;
  mimeType?: string;
  size?: number;
};

function normalizeAdmissionDocs(docs: any): { valid: boolean; data: AdmissionDocInput[]; message?: string } {
  if (!Array.isArray(docs) || docs.length === 0) {
    return { valid: false, data: [], message: "admissionDocs 至少包含一条记录" };
  }
  const normalized: AdmissionDocInput[] = [];
  for (const doc of docs) {
    if (!doc || typeof doc !== "object") return { valid: false, data: [], message: "admissionDocs 中存在无效记录" };
    const fileId = typeof doc.fileId === "string" ? doc.fileId.trim() : "";
    const bucket = typeof doc.bucket === "string" ? doc.bucket.trim() : "";
    const url = typeof doc.url === "string" ? doc.url.trim() : "";
    const name = typeof doc.name === "string" ? doc.name.trim() : "";
    const contentType = typeof doc.contentType === "string" ? doc.contentType.trim() : undefined;
    const mimeType = typeof doc.mimeType === "string" ? doc.mimeType.trim() : undefined;
    const size = typeof doc.size === "number" ? doc.size : undefined;
    if (!fileId || !bucket || !url || !name) {
      return { valid: false, data: [], message: "admissionDocs 需包含 fileId/bucket/url/name" };
    }
    normalized.push({ fileId, bucket, url, name, contentType, mimeType, size });
  }
  return { valid: true, data: normalized };
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUserInfo(req);
    if (!user?.userDbId) return err("AUTH_REQUIRED", "需要登录", 401);

    const latest = await getLatestStudentVerification(user.userDbId);
    return ok(mapResponse(latest));
  } catch (e) {
    console.error("[GET /api/student/verification] error:", e);
    return err("INTERNAL_ERROR", "服务器错误", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserInfo(req);
    if (!user?.userDbId) return err("AUTH_REQUIRED", "需要登录", 401);

    const body = await req.json().catch(() => ({}));
    const {
      fullName,
      nationality,
      email,
      phoneNumber,
      channelSource,
      schoolName,
      studyPeriodFrom,
      studyPeriodTo,
      admissionDocs,
    } = body || {};

    const fullNameNorm = normalizeRequiredString(fullName, "fullName");
    if (!fullNameNorm.ok) return err("VALIDATION_FAILED", fullNameNorm.message!, 400);
    const nationalityNorm = normalizeRequiredString(nationality, "nationality");
    if (!nationalityNorm.ok) return err("VALIDATION_FAILED", nationalityNorm.message!, 400);
    const emailNorm = normalizeRequiredString(email, "email");
    if (!emailNorm.ok) return err("VALIDATION_FAILED", emailNorm.message!, 400);
    const emailValue = emailNorm.value;
    if (!emailValue.includes("@")) {
      return err("VALIDATION_FAILED", "email 格式不正确", 400);
    }
    const phoneNorm = normalizeRequiredString(phoneNumber, "phoneNumber");
    if (!phoneNorm.ok) return err("VALIDATION_FAILED", phoneNorm.message!, 400);
    const channelNorm = normalizeRequiredString(channelSource, "channelSource");
    if (!channelNorm.ok) return err("VALIDATION_FAILED", channelNorm.message!, 400);
    const schoolNorm = normalizeRequiredString(schoolName, "schoolName");
    if (!schoolNorm.ok) return err("VALIDATION_FAILED", schoolNorm.message!, 400);
    const normalizedDocs = normalizeAdmissionDocs(admissionDocs);
    if (!normalizedDocs.valid) {
      return err("VALIDATION_FAILED", normalizedDocs.message || "admissionDocs 无效", 400);
    }

    const latest = await getLatestStudentVerification(user.userDbId);
    const derived = deriveStatus(latest);
    if (derived === "approved") {
      return err("ALREADY_APPROVED", "已通过审核且仍在有效期，无需重复申请", 409);
    }

    const studyFromDate = parseDate(studyPeriodFrom);
    const studyToDate = parseDate(studyPeriodTo);
    if (studyPeriodFrom && !studyFromDate) return err("VALIDATION_FAILED", "学习周期开始时间格式不正确", 400);
    if (studyPeriodTo && !studyToDate) return err("VALIDATION_FAILED", "学习周期结束时间格式不正确", 400);

    const docsForDb = JSON.parse(JSON.stringify(normalizedDocs.data)) as AdmissionDocInput[];

    const record = await upsertPendingVerification(user.userDbId, {
      full_name: fullNameNorm.value,
      nationality: nationalityNorm.value,
      email: emailValue,
      phone_number: phoneNorm.value,
      channel_source: channelNorm.value,
      school_name: schoolNorm.value,
      study_period_from: studyFromDate,
      study_period_to: studyToDate,
      admission_docs: docsForDb,
    });

    return ok({
      id: record.id,
      status: record.status,
      validFrom: record.valid_from,
      validUntil: record.valid_until,
    });
  } catch (e) {
    console.error("[POST /api/student/verification] error:", e);
    const message = e instanceof Error ? e.message : "服务器错误";
    // 数据库类错误返回 400，其他返回 500
    if (message && /invalid|violat|constraint|null value|syntax/i.test(message)) {
      return err("DB_ERROR", message, 400);
    }
    return err("INTERNAL_ERROR", "服务器错误", 500);
  }
}
