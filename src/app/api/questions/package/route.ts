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
import { getLatestUnifiedVersionContent } from "@/lib/questionDb";
import fs from "fs/promises";
import path from "path";

const QUESTIONS_DIR = path.join(process.cwd(), "src/data/questions/zh");
const UNIFIED_FILE = path.join(QUESTIONS_DIR, "questions.json");

export async function GET() {
  try {
    console.log(`[GET /api/questions/package] 开始获取JSON包`);
    
    // 步骤1：最优先从数据库question_package_versions表的最新记录读取（package_content字段）
    try {
      const latestVersionContent = await getLatestUnifiedVersionContent();
      if (latestVersionContent && latestVersionContent.questions) {
        const packageData = {
          version: latestVersionContent.version,
          questions: latestVersionContent.questions,
          aiAnswers: latestVersionContent.aiAnswers || {},
        };
        console.log(`[GET /api/questions/package] 从数据库最新版本读取成功，版本: ${latestVersionContent.version}，题目数量: ${latestVersionContent.questions.length}`);
        const response = success(packageData);
        // 添加 HTTP 缓存头：题目包缓存 1 小时（数据量大，但变化不频繁）
        // s-maxage=3600: CDN 缓存 1 小时
        // stale-while-revalidate=7200: 过期后 2 小时内仍可使用旧数据，后台更新
        response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');
        return response;
      } else {
        console.log(`[GET /api/questions/package] 数据库中没有找到最新版本的JSON包内容`);
      }
    } catch (dbError) {
      console.error(`[GET /api/questions/package] 从数据库读取失败:`, dbError);
    }
    
    // 步骤2：如果数据库没有，从文件系统questions.json读取
    console.log(`[GET /api/questions/package] 尝试从文件系统读取: ${UNIFIED_FILE}`);
    
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
    console.log(`[GET /api/questions/package] 从文件系统读取成功，题目数量: ${Array.isArray(data) ? data.length : (data.questions?.length || 0)}`);
    const response = success(data);
    // 添加 HTTP 缓存头：题目包缓存 1 小时（数据量大，但变化不频繁）
    // s-maxage=3600: CDN 缓存 1 小时
    // stale-while-revalidate=7200: 过期后 2 小时内仍可使用旧数据，后台更新
    response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');
    return response;
  } catch (err: any) {
    console.error("[GET /api/questions/package] Error:", err);
    return internalError(`Failed to read questions package: ${err.message || String(err)}`);
  }
}



