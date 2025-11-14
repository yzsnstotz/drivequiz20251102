// ============================================================
// 文件路径: src/app/api/questions/version/route.ts
// 功能: 返回统一 questions.json 的最新版本号
// 公开接口，无需管理员权限
// ============================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { success, notFound, internalError } from "@/app/api/_lib/errors";
import { getLatestUnifiedVersion } from "@/lib/questionDb";
import fs from "fs/promises";
import path from "path";

const QUESTIONS_DIR = path.join(process.cwd(), "src/data/questions/zh");
const UNIFIED_FILE = path.join(QUESTIONS_DIR, "questions.json");

export async function GET() {
  try {
    // 优先从数据库读取最新版本号（更可靠）
    const dbVersion = await getLatestUnifiedVersion();
    if (dbVersion) {
      console.log(`[GET /api/questions/version] 从数据库读取版本号: ${dbVersion}`);
      return success({ version: dbVersion });
    }

    // 如果数据库没有版本号，尝试从文件读取（兼容旧逻辑）
    console.log(`[GET /api/questions/version] 数据库没有版本号，尝试从文件读取`);
    const content = await fs.readFile(UNIFIED_FILE, "utf-8").catch(() => null);
    if (!content) {
      return notFound("Unified questions.json not found");
    }
    const data = JSON.parse(content);
    const version: string | undefined = data?.version;
    if (!version || typeof version !== "string") {
      return internalError("Version not found in questions.json");
    }
    console.log(`[GET /api/questions/version] 从文件读取版本号: ${version}`);
    return success({ version });
  } catch (err: any) {
    console.error("[GET /api/questions/version] Error:", err);
    return internalError("Failed to read questions version");
  }
}


