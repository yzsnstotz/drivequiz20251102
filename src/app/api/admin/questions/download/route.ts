// ============================================================
// 文件路径: src/app/api/admin/questions/download/route.ts
// 功能: 下载题目 JSON 包
// ============================================================

import { NextRequest } from "next/server";
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { badRequest, notFound, internalError } from "@/app/api/_lib/errors";
import fs from "fs/promises";
import path from "path";

// 题目数据目录
const QUESTIONS_DIR = path.join(process.cwd(), "src/data/questions/zh");

// ============================================================
// GET /api/admin/questions/download?packageName=xxx
// 下载题目 JSON 包
// ============================================================
export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    const searchParams = req.nextUrl.searchParams;
    const packageName = searchParams.get("packageName");

    if (!packageName) {
      return badRequest("packageName is required");
    }

    const filePath = path.join(QUESTIONS_DIR, `${packageName}.json`);
    
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const data = JSON.parse(content);
      
      // 返回 JSON 文件
      return new Response(JSON.stringify(data, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${packageName}.json"`,
        },
      });
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return notFound(`Package ${packageName} not found`);
      }
      throw error;
    }
  } catch (err: any) {
    console.error("[GET /api/admin/questions/download] Error:", err);
    return internalError("Failed to download question package");
  }
});

