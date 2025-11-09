// ============================================================
// 文件路径: src/app/api/admin/questions/update-package/route.ts
// 功能: 手动更新 JSON 包（重新计算 hash 并更新统一版本号）
// ============================================================

import { NextRequest } from "next/server";
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { success, internalError } from "@/app/api/_lib/errors";
import { updateAllJsonPackages } from "@/lib/questionDb";

// ============================================================
// POST /api/admin/questions/update-package
// 手动更新所有 JSON 包（重新计算 hash 并更新统一版本号）
// ============================================================
export const POST = withAdminAuth(async (req: NextRequest) => {
  try {
    // 使用统一版本号更新所有JSON包
    const result = await updateAllJsonPackages();

    return success({
      version: result.version,
      totalQuestions: result.totalQuestions,
      aiAnswersCount: result.aiAnswersCount,
      message: `JSON 包更新完成：统一版本号 ${result.version}，共 ${result.totalQuestions} 个题目，${result.aiAnswersCount} 个AI回答`,
    });
  } catch (err: any) {
    console.error("[POST /api/admin/questions/update-package] Error:", err);
    return internalError("Failed to update question package");
  }
});

