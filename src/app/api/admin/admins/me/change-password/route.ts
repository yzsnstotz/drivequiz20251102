/**
 * ✅ Dynamic Route Declaration
 * 防止 Next.js 静态预渲染报错 (DYNAMIC_SERVER_USAGE)
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

// ============================================================
// 文件路径: src/app/api/admin/admins/me/change-password/route.ts
// 功能: 管理员修改自己的登录口令（Token）
// ============================================================

import { NextRequest } from "next/server";
import { withAdminAuth, getAdminInfo } from "@/app/api/_lib/withAdminAuth";
import {
  success,
  badRequest,
  unauthorized,
  conflict,
  internalError,
} from "@/app/api/_lib/errors";
import { logUpdate } from "@/app/api/_lib/operationLog";
import { db } from "@/lib/db";
import { sql } from "kysely";

// ============================================================
// POST /api/admin/admins/me/change-password
// 修改当前登录管理员的 token（口令）
// ============================================================
export const POST = withAdminAuth(async (req: NextRequest) => {
  try {
    // 获取当前登录的管理员信息
    const currentAdmin = await getAdminInfo(req);
    if (!currentAdmin) {
      return unauthorized("Admin info not found");
    }

    const body = await req.json();
    const { oldToken, newToken } = body;

    // 校验输入
    if (!oldToken || typeof oldToken !== "string" || oldToken.trim().length === 0) {
      return badRequest("Old token is required");
    }

    if (!newToken || typeof newToken !== "string" || newToken.trim().length === 0) {
      return badRequest("New token is required");
    }

    const trimmedOldToken = oldToken.trim();
    const trimmedNewToken = newToken.trim();

    // 验证新 token 长度
    if (trimmedNewToken.length < 8) {
      return badRequest("New token must be at least 8 characters");
    }

    // 验证旧 token 是否匹配当前管理员的 token
    const admin = await db
      .selectFrom("admins")
      .selectAll()
      .where("id", "=", currentAdmin.id)
      .where("is_active", "=", true)
      .executeTakeFirst();

    if (!admin) {
      return unauthorized("Admin not found or inactive");
    }

    // 验证旧 token 是否正确
    if (admin.token !== trimmedOldToken) {
      return unauthorized("Old token is incorrect");
    }

    // 检查新 token 是否与其他管理员冲突
    if (trimmedNewToken !== admin.token) {
      const conflictAdmin = await db
        .selectFrom("admins")
        .select(["id"])
        .where("token", "=", trimmedNewToken)
        .where("id", "!=", currentAdmin.id)
        .executeTakeFirst();

      if (conflictAdmin) {
        return conflict("New token already exists");
      }
    }

    // 记录旧值
    const oldValue = {
      id: admin.id,
      username: admin.username,
      token: admin.token,
      is_active: admin.is_active,
      created_at: admin.created_at,
      updated_at: admin.updated_at,
    };

    // 更新 token
    const updated = await db
      .updateTable("admins")
      .set({
        token: trimmedNewToken,
        updated_at: sql`NOW()`,
      })
      .where("id", "=", currentAdmin.id)
      .returningAll()
      .executeTakeFirst();

    if (!updated) {
      return internalError("Failed to update token");
    }

    // 记录操作日志
    await logUpdate(
      req,
      "admins",
      currentAdmin.id,
      oldValue,
      {
        id: updated.id,
        username: updated.username,
        token: updated.token,
        is_active: updated.is_active,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
      },
      `管理员修改自己的登录口令: ${updated.username}`
    );

    // 返回成功（新 token 在响应中完整返回，因为需要前端更新 localStorage）
    const data = {
      id: updated.id,
      username: updated.username,
      token: updated.token, // 返回完整新 token
      isActive: updated.is_active,
      message: "Token updated successfully. Please save the new token.",
    };

    return success(data);
  } catch (err: any) {
    console.error("[POST /api/admin/admins/me/change-password] Error:", err);
    if (err && err.ok === false) return err;
    return internalError("Failed to change password");
  }
});

