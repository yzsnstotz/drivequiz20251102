// ============================================================
// 文件路径: src/app/api/questions/version/route.ts
// 功能: 返回统一 questions.json 的最新版本号
// 公开接口，无需管理员权限
// ============================================================

import { success, notFound, internalError } from "@/app/api/_lib/errors";
import fs from "fs/promises";
import path from "path";

const QUESTIONS_DIR = path.join(process.cwd(), "src/data/questions/zh");
const UNIFIED_FILE = path.join(QUESTIONS_DIR, "questions.json");

export async function GET() {
  try {
    const content = await fs.readFile(UNIFIED_FILE, "utf-8").catch(() => null);
    if (!content) {
      return notFound("Unified questions.json not found");
    }
    const data = JSON.parse(content);
    const version: string | undefined = data?.version;
    if (!version || typeof version !== "string") {
      return internalError("Version not found in questions.json");
    }
    return success({ version });
  } catch (err: any) {
    console.error("[GET /api/questions/version] Error:", err);
    return internalError("Failed to read questions version");
  }
}


