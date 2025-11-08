// ============================================================
// 文件路径: src/app/api/admin/questions/update-package/route.ts
// 功能: 手动更新 JSON 包（重新计算 hash 并更新版本号）
// ============================================================

import { NextRequest } from "next/server";
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { success, badRequest, internalError } from "@/app/api/_lib/errors";
import { calculateQuestionHash, generateVersion, Question } from "@/lib/questionHash";
import fs from "fs/promises";
import path from "path";

// 题目数据目录
const QUESTIONS_DIR = path.join(process.cwd(), "src/data/questions/zh");

// 加载指定卷类的题目文件
async function loadQuestionFile(category: string): Promise<{ questions: Question[]; version?: string } | null> {
  try {
    const filePath = path.join(QUESTIONS_DIR, `${category}.json`);
    const content = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(content);
    // 兼容多种格式
    if (Array.isArray(data)) {
      return { questions: data };
    }
    return {
      questions: data.questions || [],
      version: data.version,
    };
  } catch (error) {
    console.error(`[loadQuestionFile] Error loading ${category}:`, error);
    return null;
  }
}

// 获取所有卷类列表
async function getAllCategories(): Promise<string[]> {
  try {
    const files = await fs.readdir(QUESTIONS_DIR);
    return files
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".json", ""));
  } catch (error) {
    console.error("[getAllCategories] Error:", error);
    return [];
  }
}

// ============================================================
// POST /api/admin/questions/update-package
// 手动更新 JSON 包（重新计算 hash 并更新版本号）
// ============================================================
export const POST = withAdminAuth(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { packageName } = body;

    // 如果指定了包名，只更新该包；否则更新所有包
    const categories = packageName ? [packageName] : await getAllCategories();
    
    let totalProcessed = 0;
    let totalHashUpdated = 0;
    let totalVersionUpdated = 0;
    let totalErrors = 0;
    const errors: string[] = [];
    const results: Array<{
      category: string;
      version: string;
      hashUpdated: number;
      success: boolean;
    }> = [];

    // 处理每个卷类
    for (const category of categories) {
      try {
        const filePath = path.join(QUESTIONS_DIR, `${category}.json`);
        const file = await loadQuestionFile(category);
        if (!file || !file.questions) {
          if (packageName) {
            return badRequest(`Package ${packageName} not found`);
          }
          continue;
        }

        let hashUpdated = 0;
        // 重新计算所有题目的 hash
        const updatedQuestions = file.questions.map((question) => {
          totalProcessed++;
          const contentHash = calculateQuestionHash(question);
          
          // 如果题目没有 hash 字段，或者 hash 不同，则更新
          if ((question as any).hash !== contentHash) {
            hashUpdated++;
            totalHashUpdated++;
            return {
              ...question,
              hash: contentHash,
            };
          }
          return question;
        });

        // 生成新版本号
        const newVersion = generateVersion(1);

        // 读取原始文件以保持格式
        const originalContent = await fs.readFile(filePath, "utf-8");
        const originalData = JSON.parse(originalContent);

        // 更新文件（保持原有格式，添加/更新 version 和 hash）
        const outputData = Array.isArray(originalData)
          ? { version: newVersion, questions: updatedQuestions }
          : { ...originalData, version: newVersion, questions: updatedQuestions };

        // 保存文件
        await fs.writeFile(filePath, JSON.stringify(outputData, null, 2), "utf-8");

        totalVersionUpdated++;
        results.push({
          category,
          version: newVersion,
          hashUpdated,
          success: true,
        });
      } catch (error: any) {
        totalErrors++;
        const errorMsg = `处理 ${category} 时出错: ${error.message}`;
        errors.push(errorMsg);
        results.push({
          category,
          version: "",
          hashUpdated: 0,
          success: false,
        });
        console.error("[update-package] Error:", errorMsg, error);
      }
    }

    return success({
      totalProcessed,
      totalHashUpdated,
      totalVersionUpdated,
      totalErrors,
      totalCategories: categories.length,
      results,
      errors: errors.slice(0, 10), // 只返回前10个错误
    });
  } catch (err: any) {
    console.error("[POST /api/admin/questions/update-package] Error:", err);
    return internalError("Failed to update question package");
  }
});

