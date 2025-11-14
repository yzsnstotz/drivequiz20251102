// ============================================================
// 文件路径: src/app/api/questions/package/route.ts
// 功能: 返回统一 questions.json 包（包含版本、题库、aiAnswers）
// 公开接口，无需管理员权限
// ============================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import { success, notFound, internalError } from "@/app/api/_lib/errors";
import fs from "fs/promises";
import path from "path";

const QUESTIONS_DIR = path.join(process.cwd(), "src/data/questions/zh");
const UNIFIED_FILE = path.join(QUESTIONS_DIR, "questions.json");

export async function GET() {
  try {
    console.log(`[GET /api/questions/package] 开始读取文件: ${UNIFIED_FILE}`);
    
    // 检查文件是否存在
    try {
      await fs.access(UNIFIED_FILE);
    } catch (accessError) {
      console.error(`[GET /api/questions/package] 文件不存在: ${UNIFIED_FILE}`, accessError);
      return notFound("Unified questions.json not found");
    }
    
    const content = await fs.readFile(UNIFIED_FILE, "utf-8");
    if (!content) {
      console.error(`[GET /api/questions/package] 文件内容为空: ${UNIFIED_FILE}`);
      return notFound("Unified questions.json is empty");
    }
    
    const data = JSON.parse(content);
    console.log(`[GET /api/questions/package] 成功读取，题目数量: ${Array.isArray(data) ? data.length : (data.questions?.length || 0)}`);
    return success(data);
  } catch (err: any) {
    console.error("[GET /api/questions/package] Error:", err);
    return internalError(`Failed to read questions package: ${err.message || String(err)}`);
  }
}



