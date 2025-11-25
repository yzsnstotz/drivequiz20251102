export const fetchCache = "force-no-store";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ============================================================
// 文件路径: src/app/api/admin/questions/filesystem/route.ts
// 功能: 获取文件系统中的JSON文件列表
// ============================================================

import { NextRequest } from "next/server";
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { success, internalError } from "@/app/api/_lib/errors";
import fs from "fs/promises";
import path from "path";

// 题目数据目录
const QUESTIONS_DIR = path.join(process.cwd(), "src/data/questions/zh");

// ============================================================
// GET /api/admin/questions/filesystem
// 获取文件系统中的JSON文件列表
// ============================================================
export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    const files = await fs.readdir(QUESTIONS_DIR);
    
    // 过滤出JSON文件，排除questions.json（统一包）
    const jsonFiles = files
      .filter((f) => f.endsWith(".json") && f !== "questions.json")
      .map(async (f) => {
        const filePath = path.join(QUESTIONS_DIR, f);
        try {
          const stats = await fs.stat(filePath);
          const content = await fs.readFile(filePath, "utf-8");
          const data = JSON.parse(content);
          
          // 计算题目数量
          let questionCount = 0;
          if (Array.isArray(data)) {
            questionCount = data.length;
          } else if (data.questions && Array.isArray(data.questions)) {
            questionCount = data.questions.length;
          }
          
          return {
            filename: f,
            category: f.replace(".json", ""),
            questionCount,
            modifiedAt: stats.mtime.toISOString(),
            size: stats.size,
          };
        } catch (error) {
          console.error(`[GET /api/admin/questions/filesystem] Error reading ${f}:`, error);
          return null;
        }
      });
    
    const fileList = (await Promise.all(jsonFiles))
      .filter((f) => f !== null)
      .sort((a, b) => {
        // 按文件名排序
        if (a && b) {
          return a.filename.localeCompare(b.filename);
        }
        return 0;
      });
    
    console.log(`[GET /api/admin/questions/filesystem] 找到 ${fileList.length} 个JSON文件`);
    
    return success(fileList);
  } catch (err: any) {
    console.error("[GET /api/admin/questions/filesystem] Error:", err);
    return internalError("Failed to fetch filesystem files");
  }
});

