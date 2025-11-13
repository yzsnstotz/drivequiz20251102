// ============================================================
// 文件路径: src/app/api/admin/questions/versions/route.ts
// 功能: 获取统一版本号列表（历史版本）
// 从数据库和JSON包中读取版本号
// ============================================================

import { NextRequest } from "next/server";
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { success, internalError } from "@/app/api/_lib/errors";
import { getAllUnifiedVersions, loadQuestionFile, deleteUnifiedVersion } from "@/lib/questionDb";
import fs from "fs/promises";
import path from "path";

// 题目数据目录
const QUESTIONS_DIR = path.join(process.cwd(), "src/data/questions/zh");

// 获取所有卷类列表（从统一的questions.json或文件系统）
async function getAllCategories(): Promise<string[]> {
  try {
    // 优先从统一的questions.json读取category列表
    const unifiedFilePath = path.join(QUESTIONS_DIR, "questions.json");
    try {
      const unifiedContent = await fs.readFile(unifiedFilePath, "utf-8");
      const unifiedData = JSON.parse(unifiedContent);
      const questions = Array.isArray(unifiedData) ? unifiedData : (unifiedData.questions || []);
      
      // 从题目中提取所有唯一的category
      const categories = new Set<string>();
      questions.forEach((q: any) => {
        if (q.category) {
          categories.add(q.category);
        }
      });
      
      return Array.from(categories).sort();
    } catch {
      // 如果统一的questions.json不存在，从文件系统读取（兼容旧逻辑）
      const files = await fs.readdir(QUESTIONS_DIR);
      return files
        .filter((f) => f.endsWith(".json") && f !== "questions.json")
        .map((f) => f.replace(".json", ""));
    }
  } catch (error) {
    console.error("[getAllCategories] Error:", error);
    return [];
  }
}

// ============================================================
// GET /api/admin/questions/versions
// 获取所有统一版本号列表（历史版本）
// 从数据库和JSON包中读取版本号
// ============================================================
export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    // 只从数据库读取版本号（数据库是版本号的权威来源）
    // 已删除的版本号不会出现在数据库中，因此不会显示在前端
    const dbVersions = await getAllUnifiedVersions();
    
    console.log(`[GET /api/admin/questions/versions] 从数据库读取到 ${dbVersions.length} 个版本号`);

    // 转换为数组并按创建时间排序
    const versions = dbVersions.sort((a, b) => {
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    return success(versions.map((v) => ({
      version: v.version,
      totalQuestions: v.totalQuestions,
      aiAnswersCount: v.aiAnswersCount,
      createdAt: v.createdAt.toISOString(),
    })));
  } catch (err: any) {
    console.error("[GET /api/admin/questions/versions] Error:", err);
    return internalError("Failed to get question versions");
  }
});

// ============================================================
// DELETE /api/admin/questions/versions
// 删除指定版本号的JSON包数据
// ============================================================
export const DELETE = withAdminAuth(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const version = searchParams.get("version");
    
    if (!version) {
      return internalError("Version parameter is required");
    }
    
    console.log(`[DELETE /api/admin/questions/versions] 删除版本号: ${version}`);
    
    // 1. 从数据库删除版本号记录
    await deleteUnifiedVersion(version);
    
    // 2. 如果当前questions.json的版本号是被删除的版本，不删除文件（保留文件，只是删除数据库记录）
    // 因为文件可能被其他版本使用，或者需要保留作为备份
    // 如果需要删除文件，可以在这里添加逻辑
    
    return success({
      message: `版本号 ${version} 已成功删除`,
      version,
    });
  } catch (err: any) {
    console.error("[DELETE /api/admin/questions/versions] Error:", err);
    return internalError(err.message || "Failed to delete question version");
  }
});

