// ============================================================
// 文件路径: src/app/api/questions/version/route.ts
// 功能: 返回统一 questions.json 的最新版本号
// 公开接口，无需管理员权限
// ============================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import { success, notFound, internalError } from "@/app/api/_lib/errors";
import { getLatestUnifiedVersion } from "@/lib/questionDb";
import fs from "fs/promises";
import path from "path";

const QUESTIONS_DIR = path.join(process.cwd(), "src/data/questions/zh");
const UNIFIED_FILE = path.join(QUESTIONS_DIR, "questions.json");

export async function GET() {
  try {
    console.log(`[GET /api/questions/version] 开始获取版本号`);
    
    // 优先从数据库读取最新版本号（更可靠）
    try {
      const dbVersion = await getLatestUnifiedVersion();
      if (dbVersion) {
        console.log(`[GET /api/questions/version] 从数据库读取版本号: ${dbVersion}`);
        const response = success({ version: dbVersion });
        // 添加 HTTP 缓存头：题目版本号缓存 5 分钟
        // s-maxage=300: CDN 缓存 5 分钟
        // stale-while-revalidate=600: 过期后 10 分钟内仍可使用旧数据，后台更新
        response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
        return response;
      }
    } catch (dbError) {
      console.warn(`[GET /api/questions/version] 从数据库读取版本号失败:`, dbError);
    }

    // 如果数据库没有版本号，尝试从文件读取（兼容旧逻辑）
    console.log(`[GET /api/questions/version] 数据库没有版本号，尝试从文件读取: ${UNIFIED_FILE}`);
    
    try {
      await fs.access(UNIFIED_FILE);
    } catch (accessError) {
      console.error(`[GET /api/questions/version] 文件不存在: ${UNIFIED_FILE}`, accessError);
      return notFound("Unified questions.json not found");
    }
    
    const content = await fs.readFile(UNIFIED_FILE, "utf-8");
    if (!content) {
      console.error(`[GET /api/questions/version] 文件内容为空: ${UNIFIED_FILE}`);
      return notFound("Unified questions.json is empty");
    }
    
    const data = JSON.parse(content);
    const version: string | undefined = data?.version;
    if (!version || typeof version !== "string") {
      console.error(`[GET /api/questions/version] 文件中没有版本号字段`);
      return internalError("Version not found in questions.json");
    }
    console.log(`[GET /api/questions/version] 从文件读取版本号: ${version}`);
    const response = success({ version });
    // 添加 HTTP 缓存头：题目版本号缓存 5 分钟
    // s-maxage=300: CDN 缓存 5 分钟
    // stale-while-revalidate=600: 过期后 10 分钟内仍可使用旧数据，后台更新
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return response;
  } catch (err: any) {
    console.error("[GET /api/questions/version] Error:", err);
    return internalError(`Failed to read questions version: ${err.message || String(err)}`);
  }
}



