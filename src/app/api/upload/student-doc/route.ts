export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getUserInfo } from "@/app/api/_lib/withUserAuth";
import {
  MAX_STUDENT_DOC_SIZE,
  STUDENT_DOC_BUCKET,
  STUDENT_DOC_PREFIX,
} from "@/constants/studentDocs";
import { getSupabaseServiceClient } from "@/lib/supabaseServer";

function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

function err(errorCode: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, errorCode, message }, { status });
}

function getExtension(name: string) {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx + 1) : "";
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserInfo(req);
    if (!user?.userDbId) return err("AUTH_REQUIRED", "需要登录", 401);

    const formData = await req.formData().catch(() => null);
    if (!formData) return err("INVALID_FORM", "无法解析表单", 400);
    const file = formData.get("file");
    if (!file || !(file instanceof File)) return err("FILE_REQUIRED", "未找到文件", 400);

    if (file.size > MAX_STUDENT_DOC_SIZE) {
      return err("FILE_TOO_LARGE", "文件大小超出限制（5MB）", 413);
    }

    const supabase = getSupabaseServiceClient();
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = getExtension(file.name);
    const safeExt = ext ? `.${ext}` : "";
    const path = `${STUDENT_DOC_PREFIX}/${user.userDbId}/${Date.now()}_${randomUUID()}${safeExt}`;

    const { error: uploadError } = await supabase.storage
      .from(STUDENT_DOC_BUCKET)
      .upload(path, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      console.error("[POST /api/upload/student-doc] supabase upload error", uploadError);
      return err("UPLOAD_FAILED", uploadError.message || "上传失败", 500);
    }

    const { data: publicData } = supabase.storage
      .from(STUDENT_DOC_BUCKET)
      .getPublicUrl(path);

    const url = publicData?.publicUrl || "";

    return ok({
      fileId: path,
      bucket: STUDENT_DOC_BUCKET,
      url,
      name: file.name,
      size: buffer.length,
      mimeType: file.type || "application/octet-stream",
    });
  } catch (e) {
    console.error("[POST /api/upload/student-doc] error", e);
    return err("INTERNAL_ERROR", "上传失败，请稍后重试", 500);
  }
}
