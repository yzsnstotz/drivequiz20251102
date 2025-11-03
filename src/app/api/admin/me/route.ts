/**
 * ✅ Dynamic Route Declaration
 * 防止 Next.js 静态预渲染报错 (DYNAMIC_SERVER_USAGE)
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

// ============================================================
// 文件路径: src/app/api/admin/me/route.ts
// 功能: 获取当前登录管理员的信息
// ============================================================

import { NextRequest } from "next/server";
import { withAdminAuth, getAdminInfo } from "@/app/api/_lib/withAdminAuth";
import { success, internalError } from "@/app/api/_lib/errors";
import { db } from "@/lib/db";

// ============================================================
// GET /api/admin/me
// 获取当前登录管理员的信息
// ============================================================
export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    const adminInfo = await getAdminInfo(req);
    if (!adminInfo) {
      return internalError("Failed to get admin info");
    }

    // 查询管理员的完整信息（包括permissions）
    const admin = await db
      .selectFrom("admins")
      .selectAll()
      .where("id", "=", adminInfo.id)
      .executeTakeFirst();

    if (!admin) {
      return internalError("Admin not found");
    }

    // 解析permissions（JSONB数组）
    let permissions: string[] = [];
    if (admin.permissions) {
      try {
        permissions = Array.isArray(admin.permissions) 
          ? admin.permissions 
          : (typeof admin.permissions === 'string' ? JSON.parse(admin.permissions) : []);
      } catch (e) {
        console.error("[GET /api/admin/me] Failed to parse permissions:", e);
        permissions = [];
      }
    }

    // 返回管理员信息（不返回 token）
    const data = {
      id: adminInfo.id,
      username: adminInfo.username,
      isActive: adminInfo.is_active,
      isDefaultAdmin: adminInfo.username === "admin",
      permissions: permissions,
    };

    return success(data);
  } catch (err: any) {
    console.error("[GET /api/admin/me] Error:", err);
    if (err && err.ok === false) return err;
    return internalError("Failed to get admin info");
  }
});

