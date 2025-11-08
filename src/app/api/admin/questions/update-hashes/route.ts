// ============================================================
// 文件路径: src/app/api/admin/questions/update-hashes/route.ts
// 功能: 批量更新所有题目的 hash（无论有没有都重新计算）
// ============================================================

import { NextRequest } from "next/server";
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { success, internalError } from "@/app/api/_lib/errors";
import { calculateQuestionHash, Question } from "@/lib/questionHash";
import fs from "fs/promises";
import path from "path";

// 题目数据目录
const QUESTIONS_DIR = path.join(process.cwd(), "src/data/questions/zh");

// 加载指定卷类的题目文件
async function loadQuestionFile(category: string): Promise<{ questions: Question[] } | null> {
  try {
    const filePath = path.join(QUESTIONS_DIR, `${category}.json`);
    const content = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(content);
    // 兼容两种格式：{ questions: [...] } 或直接是数组，或 { version, questions: [...] }
    return {
      questions: Array.isArray(data) ? data : (data.questions || []),
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
// POST /api/admin/questions/update-hashes
// 批量更新所有题目的 hash（无论有没有都重新计算）
// ============================================================
export const POST = withAdminAuth(async (req: NextRequest) => {
  try {
    const categories = await getAllCategories();
    let totalProcessed = 0;
    let totalUpdated = 0;
    let totalErrors = 0;
    const errors: string[] = [];

    // 遍历所有卷类
    for (const category of categories) {
      try {
        const filePath = path.join(QUESTIONS_DIR, `${category}.json`);
        const file = await loadQuestionFile(category);
        if (!file || !file.questions) continue;

        let fileUpdated = false;
        const updatedQuestions = file.questions.map((question) => {
          try {
            totalProcessed++;
            // 重新计算 hash（无论有没有都重新计算）
            const contentHash = calculateQuestionHash(question);
            
            // 如果题目没有 hash 字段，或者 hash 不同，则更新
            if ((question as any).hash !== contentHash) {
              fileUpdated = true;
              totalUpdated++;
              return {
                ...question,
                hash: contentHash,
              };
            }
            return question;
          } catch (error: any) {
            totalErrors++;
            const errorMsg = `处理题目 ${question.id} (${category}) 时出错: ${error.message}`;
            errors.push(errorMsg);
            console.error("[update-hashes] Error:", errorMsg, error);
            return question; // 返回原题目，不更新
          }
        });

        // 如果有更新，保存文件
        if (fileUpdated) {
          // 读取原始文件以保持格式
          const originalContent = await fs.readFile(filePath, "utf-8");
          const originalData = JSON.parse(originalContent);
          
          // 更新文件（保持原有格式）
          const outputData = Array.isArray(originalData)
            ? updatedQuestions
            : { ...originalData, questions: updatedQuestions };
          
          await fs.writeFile(filePath, JSON.stringify(outputData, null, 2), "utf-8");
        }
      } catch (error: any) {
        totalErrors++;
        const errorMsg = `处理卷类 ${category} 时出错: ${error.message}`;
        errors.push(errorMsg);
        console.error("[update-hashes] Error:", errorMsg, error);
      }
    }

    return success({
      totalProcessed,
      totalUpdated,
      totalErrors,
      totalCategories: categories.length,
      errors: errors.slice(0, 10), // 只返回前10个错误
    });
  } catch (err: any) {
    console.error("[POST /api/admin/questions/update-hashes] Error:", err);
    return internalError("Failed to update question hashes");
  }
});

