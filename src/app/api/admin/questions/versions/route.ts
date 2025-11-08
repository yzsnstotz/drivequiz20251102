// ============================================================
// 文件路径: src/app/api/admin/questions/versions/route.ts
// 功能: 获取所有题目包的版本号
// ============================================================

import { NextRequest } from "next/server";
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { success, internalError } from "@/app/api/_lib/errors";
import fs from "fs/promises";
import path from "path";

// 题目数据目录
const QUESTIONS_DIR = path.join(process.cwd(), "src/data/questions/zh");

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
// GET /api/admin/questions/versions
// 获取所有题目包的版本号
// ============================================================
export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    const categories = await getAllCategories();
    const versions: Array<{
      category: string;
      version: string | null;
      totalQuestions: number;
      updatedAt?: string;
    }> = [];

    for (const category of categories) {
      try {
        const filePath = path.join(QUESTIONS_DIR, `${category}.json`);
        const content = await fs.readFile(filePath, "utf-8");
        const data = JSON.parse(content);
        
        const questions = Array.isArray(data) ? data : (data.questions || []);
        const version = Array.isArray(data) ? null : (data.version || null);
        const stats = await fs.stat(filePath);
        
        versions.push({
          category,
          version,
          totalQuestions: questions.length,
          updatedAt: stats.mtime.toISOString(),
        });
      } catch (error) {
        console.error(`[versions] Error reading ${category}:`, error);
        versions.push({
          category,
          version: null,
          totalQuestions: 0,
        });
      }
    }

    return success(versions);
  } catch (err: any) {
    console.error("[GET /api/admin/questions/versions] Error:", err);
    return internalError("Failed to get question versions");
  }
});

