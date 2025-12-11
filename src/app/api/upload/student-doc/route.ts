export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs/promises";
import { getUserInfo } from "@/app/api/_lib/withUserAuth";
import { MAX_STUDENT_DOC_SIZE, STUDENT_DOC_STORAGE_PREFIX } from "@/constants/studentDocs";

// Vercel Serverless 为只读文件系统，写入需落到 /tmp；支持自定义环境变量覆盖
const STORAGE_DIR = process.env.STUDENT_DOC_STORAGE_DIR
  ? path.resolve(process.env.STUDENT_DOC_STORAGE_DIR)
  : path.join("/tmp", STUDENT_DOC_STORAGE_PREFIX);

function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

function err(errorCode: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, errorCode, message }, { status });
}

async function ensureStorageDir() {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
}

export async function GET(req: NextRequest) {
  try {
    const fileId = req.nextUrl.searchParams.get("fileId");
    if (!fileId) return err("FILE_ID_REQUIRED", "fileId is required", 400);

    const filePath = path.join(STORAGE_DIR, fileId);
    // 防止路径穿越
    if (!filePath.startsWith(STORAGE_DIR)) return err("INVALID_PATH", "invalid file path", 400);

    const metaPath = `${filePath}.json`;
    const meta = await fs
      .readFile(metaPath, "utf8")
      .then((c) => JSON.parse(c))
      .catch(() => null);

    const data = await fs.readFile(filePath);
    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": meta?.contentType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${meta?.originalName || fileId}"`,
      },
    });
  } catch (e) {
    console.error("[GET /api/upload/student-doc] error", e);
    return err("FILE_NOT_FOUND", "file not found", 404);
  }
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

    await ensureStorageDir();
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = path.extname(file.name) || "";
    const fileId = `${STUDENT_DOC_STORAGE_PREFIX}_${randomUUID()}${ext}`;
    const filePath = path.join(STORAGE_DIR, fileId);
    if (!filePath.startsWith(STORAGE_DIR)) return err("INVALID_PATH", "invalid file path", 400);
    await fs.writeFile(filePath, buffer);

    const meta = {
      originalName: file.name,
      size: file.size,
      contentType: file.type || "application/octet-stream",
      uploadedBy: user.userDbId,
      uploadedAt: new Date().toISOString(),
    };
    await fs.writeFile(`${filePath}.json`, JSON.stringify(meta));

    const url = `/api/upload/student-doc?fileId=${encodeURIComponent(fileId)}`;
    return ok({ fileId, name: file.name, size: file.size, url, contentType: file.type || "application/octet-stream" });
  } catch (e) {
    console.error("[POST /api/upload/student-doc] error", e);
    return err("INTERNAL_ERROR", "上传失败，请稍后重试", 500);
  }
}
