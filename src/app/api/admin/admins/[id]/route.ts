/**
 * ✅ Dynamic Route Declaration
 * 防止 Next.js 静态预渲染报错 (DYNAMIC_SERVER_USAGE)
 * 原因: 本文件使用了 request.headers / nextUrl.searchParams 等动态上下文
 * 修复策略: 强制动态渲染 + 禁用缓存 + Node.js 运行时
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';
export const fetchCache = 'force-no-store';

// ============================================================
// 文件路径: src/app/api/admin/admins/[id]/route.ts
// 功能: 管理员详情查询 (GET)、编辑 (PUT) 与删除 (DELETE)
// ============================================================

import { NextRequest } from "next/server";
import { withAdminAuth, getAdminInfo } from "@/app/api/_lib/withAdminAuth";
import {
  success,
  badRequest,
  notFound,
  conflict,
  internalError,
} from "@/app/api/_lib/errors";
import { logUpdate, logDelete } from "@/app/api/_lib/operationLog";
import { db } from "@/lib/db";
import { sql } from "kysely";
import crypto from "crypto";

// ------------------------------------------------------------
// 工具：行数据 snake_case → camelCase，并统一时间为 ISO8601
// ------------------------------------------------------------
type RawRow = {
  id: number;
  username: string;
  token: string;
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
};

function toISO(v: Date | string | null | undefined): string | null {
  if (!v) return null;
  try {
    if (v instanceof Date) return v.toISOString();
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

// ============================================================
// GET /api/admin/admins/:id
// 查询单个管理员详情
// ============================================================
export const GET = withAdminAuth(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    try {
      const id = Number(params.id);
      if (isNaN(id)) return badRequest("Invalid ID parameter");

      const row = await db
        .selectFrom("admins")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();

      if (!row) return notFound("Admin not found");

      const data = {
        id: row.id,
        username: row.username,
        token: row.token.substring(0, 8) + "***", // 隐藏token
        isActive: row.is_active,
        createdAt: toISO(row.created_at) ?? "",
        updatedAt: toISO(row.updated_at) ?? "",
      };

      return success(data);
    } catch (err: any) {
      console.error("[GET /api/admin/admins/:id] Error:", err);
      if (err.ok === false) return err;
      return internalError("Failed to fetch admin");
    }
  }
);

// ============================================================
// PUT /api/admin/admins/:id
// 编辑管理员
// ============================================================
export const PUT = withAdminAuth(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    try {
      const id = Number(params.id);
      if (isNaN(id)) return badRequest("Invalid ID parameter");

      const body = await req.json();
      const { username, token, isActive } = body;

      // 校验输入（至少一个字段）
      if (username === undefined && token === undefined && isActive === undefined) {
        return badRequest("At least one field must be provided");
      }

      // 检查管理员是否存在
      const existing = await db
        .selectFrom("admins")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();

      if (!existing) return notFound("Admin not found");

      // 准备更新数据
      const updates: Record<string, any> = {};

      if (username !== undefined) {
        if (typeof username !== "string" || username.trim().length === 0) {
          return badRequest("Username cannot be empty");
        }

        if (username.length < 3 || username.length > 50) {
          return badRequest("Username must be between 3 and 50 characters");
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
          return badRequest(
            "Username can only contain letters, numbers, underscores, and hyphens"
          );
        }

        const trimmedUsername = username.trim();

        // 检查新用户名是否与其他管理员冲突
        if (trimmedUsername !== existing.username) {
          const conflictAdmin = await db
            .selectFrom("admins")
            .select(["id"])
            .where("username", "=", trimmedUsername)
            .where("id", "!=", id)
            .executeTakeFirst();

          if (conflictAdmin) {
            return conflict("Username already exists");
          }
        }

        updates.username = trimmedUsername;
      }

      if (token !== undefined) {
        if (typeof token !== "string" || token.trim().length === 0) {
          return badRequest("Token cannot be empty");
        }

        if (token.trim().length < 8) {
          return badRequest("Token must be at least 8 characters");
        }

        const trimmedToken = token.trim();

        // 检查新token是否与其他管理员冲突
        if (trimmedToken !== existing.token) {
          const conflictToken = await db
            .selectFrom("admins")
            .select(["id"])
            .where("token", "=", trimmedToken)
            .where("id", "!=", id)
            .executeTakeFirst();

          if (conflictToken) {
            return conflict("Token already exists");
          }
        }

        updates.token = trimmedToken;
      }

      if (isActive !== undefined) {
        updates.is_active = Boolean(isActive);
      }

      updates.updated_at = sql`NOW()`;

      // 执行更新
      const updated = await db
        .updateTable("admins")
        .set(updates)
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirst();

      if (!updated) {
        return internalError("Failed to update admin");
      }

      // 记录操作日志
      await logUpdate(
        req,
        "admins",
        id,
        existing,
        updated,
        `更新管理员: ${updated.username}`
      );

      const data = {
        id: updated.id,
        username: updated.username,
        token: updated.token.substring(0, 8) + "***", // 隐藏token
        isActive: updated.is_active,
        createdAt: toISO(updated.created_at) ?? "",
        updatedAt: toISO(updated.updated_at) ?? "",
      };

      return success(data);
    } catch (err: any) {
      console.error("[PUT /api/admin/admins/:id] Error:", err);
      if (err.ok === false) return err;
      return internalError("Failed to update admin");
    }
  }
);

// ============================================================
// DELETE /api/admin/admins/:id
// 删除管理员（软删除：禁用而不是真正删除）
// ============================================================
export const DELETE = withAdminAuth(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    try {
      const id = Number(params.id);
      if (isNaN(id)) return badRequest("Invalid ID parameter");

      const admin = await db
        .selectFrom("admins")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();

      if (!admin) return notFound("Admin not found");

      // 不能删除自己
      const currentAdmin = getAdminInfo(req);
      if (currentAdmin && currentAdmin.id === id) {
        return conflict("Cannot delete yourself");
      }

      // 软删除：禁用管理员而不是真正删除
      const updated = await db
        .updateTable("admins")
        .set({
          is_active: false,
          updated_at: sql`NOW()`,
        })
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirst();

      if (!updated) {
        return internalError("Failed to delete admin");
      }

      // 记录操作日志
      await logDelete(
        req,
        "admins",
        id,
        admin,
        `删除（禁用）管理员: ${admin.username}`
      );

      return success({ deleted: 1 });
    } catch (err: any) {
      console.error("[DELETE /api/admin/admins/:id] Error:", err);
      if (err.ok === false) return err;
      return internalError("Failed to delete admin");
    }
  }
);

