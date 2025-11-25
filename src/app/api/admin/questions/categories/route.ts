export const fetchCache = "force-no-store";
export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // 强制使用 Node.js runtime，避免 Edge runtime 兼容性问题

// ============================================================
// 文件路径: src/app/api/admin/questions/categories/route.ts
// 功能: 获取所有卷类列表（从数据库 questions 表的 category 字段读取）
// ============================================================

import { NextRequest } from "next/server";
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { success, internalError } from "@/app/api/_lib/errors";
import { db } from "@/lib/db";

// ============================================================
// GET /api/admin/questions/categories
// 获取所有卷类列表（从数据库读取）
// ============================================================
export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    // 从数据库 questions 表读取所有唯一的 category 值
    const result = await db
      .selectFrom("questions")
      .select("category")
      .where("category", "is not", null)
      .where("category", "!=", "")
      .groupBy("category")
      .orderBy("category", "asc")
      .execute();

    // 提取 category 值并去重
    const categories = Array.from(
      new Set(result.map((r) => r.category).filter(Boolean))
    ).sort();

    console.log(`[GET /api/admin/questions/categories] 从数据库读取到 ${categories.length} 个卷类`);

    return success(categories);
  } catch (err: any) {
    console.error("[GET /api/admin/questions/categories] Error:", err);
    return internalError("Failed to fetch categories");
  }
});

