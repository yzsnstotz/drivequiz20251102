/**
 * ✅ Dynamic Route Declaration
 * 防止 Next.js 静态预渲染报错 (DYNAMIC_SERVER_USAGE)
 * 原因: 本文件使用了 request.headers / nextUrl.searchParams 等动态上下文
 * 修复策略: 强制动态渲染 + 禁用缓存 + Node.js 运行时
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

// ============================================================
// 文件路径: src/app/api/admin/activation-codes/by-code/[code]/route.ts
// 功能: 通过激活码代码查找激活码ID
// 规范: Zalem 后台管理接口规范 v1.0
// ============================================================

import { NextRequest } from "next/server";
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { success, badRequest, notFound, internalError } from "@/app/api/_lib/errors";
import { db } from "@/lib/db";

// ============================================================
// GET /api/admin/activation-codes/by-code/:code
// 通过激活码代码查找激活码ID和基本信息
// ============================================================
export const GET = withAdminAuth(async (req: NextRequest, { params }: { params: Promise<{ code: string }> }) => {
  try {
    const { code: codeParam } = await params;
    const code = codeParam?.trim();
    if (!code) {
      return badRequest("Activation code is required");
    }

    const row = await db
      .selectFrom("activation_codes")
      .select(["id", "code", "status"])
      .where("code", "=", code)
      .executeTakeFirst();

    if (!row) {
      return notFound("Activation code not found");
    }

    return success({
      id: row.id,
      code: row.code,
      status: row.status,
    });
  } catch (err: any) {
    console.error("[GET /activation-codes/by-code/:code] Error:", err);
    if (err.ok === false) return err;
    return internalError("Failed to find activation code");
  }
});

