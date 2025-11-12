// ============================================================
// 文件路径: src/app/api/questions/package/route.ts
// 功能: 返回统一 questions.json 包（包含版本、题库、aiAnswers）
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
    return success(data);
  } catch (err: any) {
    console.error("[GET /api/questions/package] Error:", err);
    return internalError("Failed to read questions package");
  }
}


