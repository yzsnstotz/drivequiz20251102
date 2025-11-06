export const fetchCache = "force-no-store";
export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // 强制使用 Node.js runtime，避免 Edge runtime 兼容性问题

// ============================================================
// 文件路径: src/app/api/admin/questions/categories/route.ts
// 功能: 获取所有卷类列表
// ============================================================

import { NextRequest } from "next/server";
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { success, internalError } from "@/app/api/_lib/errors";
import fs from "fs/promises";
import path from "path";

// 题目数据目录
const QUESTIONS_DIR = path.join(process.cwd(), "src/data/questions/zh");

// ============================================================
// GET /api/admin/questions/categories
// 获取所有卷类列表
// ============================================================
export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    const files = await fs.readdir(QUESTIONS_DIR);
    const categories = files
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".json", ""))
      .sort();

    return success(categories);
  } catch (err: any) {
    console.error("[GET /api/admin/questions/categories] Error:", err);
    return internalError("Failed to fetch categories");
  }
});

