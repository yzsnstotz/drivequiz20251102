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

    if (!fullName || !nationality || !email || !phoneNumber || !channelSource || !schoolName) {
      return err("VALIDATION_FAILED", "必填字段不能为空", 400);
    }
    if (typeof email !== "string" || !email.includes("@")) {
      return err("VALIDATION_FAILED", "email 格式不正确", 400);
    }
    if (!Array.isArray(admissionDocs) || admissionDocs.length === 0) {
      return err("VALIDATION_FAILED", "admissionDocs 至少包含一条记录", 400);
    }

    const latest = await getLatestStudentVerification(user.userDbId);
    const derived = deriveStatus(latest);
    if (derived === "approved") {
      return err("ALREADY_APPROVED", "已通过审核，无需重复申请", 400);
    }

    const record = await upsertPendingVerification(user.userDbId, {
      full_name: String(fullName),
      nationality: String(nationality),
      email: String(email),
      phone_number: String(phoneNumber),
      channel_source: String(channelSource),
      school_name: String(schoolName),
      study_period_from: parseDate(studyPeriodFrom),
      study_period_to: parseDate(studyPeriodTo),
      admission_docs: admissionDocs,
    });

    return ok({
      id: record.id,
      status: record.status,
      validFrom: record.valid_from,
      validUntil: record.valid_until,
    });
  } catch (e) {
    console.error("[POST /api/student/verification] error:", e);
    return err("INTERNAL_ERROR", "服务器错误", 500);
  }
}
