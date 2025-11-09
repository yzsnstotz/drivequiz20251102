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
    // 1. 从数据库读取版本号
    const dbVersions = await getAllUnifiedVersions();
    const versionMap = new Map<string, {
      version: string;
      totalQuestions: number;
      aiAnswersCount: number;
      createdAt: Date;
    }>();

    // 将数据库版本号添加到Map中
    for (const v of dbVersions) {
      versionMap.set(v.version, v);
    }

    // 2. 从统一的questions.json中读取版本号
    try {
      const unifiedFile = await loadQuestionFile(); // 不传参数，读取统一文件
      if (unifiedFile && unifiedFile.version && unifiedFile.questions) {
        const version = unifiedFile.version;
        const questionCount = unifiedFile.questions.length;
        const aiAnswerCount = unifiedFile.aiAnswers ? Object.keys(unifiedFile.aiAnswers).length : 0;

        // 尝试从文件系统获取创建时间
        let fileDate: Date;
        try {
          const unifiedFilePath = path.join(QUESTIONS_DIR, "questions.json");
          const stats = await fs.stat(unifiedFilePath);
          fileDate = stats.mtime;
        } catch {
          fileDate = new Date();
        }

        // 如果数据库中没有该版本号，从JSON包添加
        if (!versionMap.has(version)) {
          versionMap.set(version, {
            version,
            totalQuestions: questionCount,
            aiAnswersCount: aiAnswerCount,
            createdAt: fileDate,
          });
        } else {
          // 如果数据库中有，使用数据库的数据（更准确），但如果没有题目数，使用JSON包的统计
          const existing = versionMap.get(version)!;
          if (existing.totalQuestions === 0 && questionCount > 0) {
            existing.totalQuestions = questionCount;
          }
          if (existing.aiAnswersCount === 0 && aiAnswerCount > 0) {
            existing.aiAnswersCount = aiAnswerCount;
          }
        }
      }
    } catch (error) {
      console.error(`[GET /api/admin/questions/versions] Error loading unified file:`, error);
    }
    
    // 兼容旧逻辑：如果统一的questions.json不存在，从各个JSON包中扫描版本号
    const categories = await getAllCategories();
    const versionStats = new Map<string, {
      totalQuestions: number;
      aiAnswersCount: number;
      earliestDate: Date;
    }>();

    // 第一遍扫描：统计每个版本号的题目总数
    for (const category of categories) {
      try {
        const file = await loadQuestionFile(category);
        if (file && file.version && file.questions) {
          const version = file.version;
          const questionCount = file.questions.length;
          const aiAnswerCount = file.aiAnswers ? Object.keys(file.aiAnswers).length : 0;

          // 尝试从文件系统获取创建时间
          let fileDate: Date;
          try {
            const filePath = path.join(QUESTIONS_DIR, `${category}.json`);
            const stats = await fs.stat(filePath);
            fileDate = stats.mtime;
          } catch {
            fileDate = new Date();
          }

          if (!versionStats.has(version)) {
            versionStats.set(version, {
              totalQuestions: questionCount,
              aiAnswersCount: aiAnswerCount,
              earliestDate: fileDate,
            });
          } else {
            // 累加题目数和AI回答数（因为同一版本号可能出现在多个JSON包中）
            const stats = versionStats.get(version)!;
            stats.totalQuestions += questionCount;
            stats.aiAnswersCount += aiAnswerCount;
            // 使用最早的日期
            if (fileDate < stats.earliestDate) {
              stats.earliestDate = fileDate;
            }
          }
        }
      } catch (error) {
        console.error(`[GET /api/admin/questions/versions] Error loading ${category}:`, error);
      }
    }

    // 3. 合并数据库版本号和JSON包版本号
    for (const [version, stats] of versionStats.entries()) {
      if (!versionMap.has(version)) {
        // 如果数据库中没有该版本号，从JSON包添加
        versionMap.set(version, {
          version,
          totalQuestions: stats.totalQuestions,
          aiAnswersCount: stats.aiAnswersCount,
          createdAt: stats.earliestDate,
        });
      } else {
        // 如果数据库中有，使用数据库的数据（更准确），但如果没有题目数，使用JSON包的统计
        const existing = versionMap.get(version)!;
        if (existing.totalQuestions === 0 && stats.totalQuestions > 0) {
          existing.totalQuestions = stats.totalQuestions;
        }
        if (existing.aiAnswersCount === 0 && stats.aiAnswersCount > 0) {
          existing.aiAnswersCount = stats.aiAnswersCount;
        }
      }
    }

    // 4. 转换为数组并按创建时间排序
    const versions = Array.from(versionMap.values()).sort((a, b) => {
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

