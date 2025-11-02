// ============================================================
// 文件路径: src/app/api/_lib/withAdminAuth.ts
// 功能: 管理员鉴权中间件 (Next.js App Router)
// 规范: 统一参数与接口规范 v1.0 第 4 节
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// ------------------------------------------------------------
// 管理员信息类型
// ------------------------------------------------------------
export interface AdminInfo {
  id: number;
  username: string;
  token: string;
  is_active: boolean;
}

// ------------------------------------------------------------
// 用于在请求处理期间存储管理员信息的 WeakMap
// ------------------------------------------------------------
const adminInfoStore = new WeakMap<NextRequest, AdminInfo>();

// ------------------------------------------------------------
// 从请求中获取当前管理员信息（仅在withAdminAuth包装的handler内有效）
// ------------------------------------------------------------
export function getAdminInfo(req: NextRequest): AdminInfo | null {
  return adminInfoStore.get(req) || null;
}

// ------------------------------------------------------------
// 封装统一的错误响应
// ------------------------------------------------------------
function unauthorized(message: string) {
  return NextResponse.json(
    { ok: false, errorCode: "AUTH_REQUIRED", message },
    { status: 401 }
  );
}

function forbidden(message: string) {
  return NextResponse.json(
    { ok: false, errorCode: "FORBIDDEN", message },
    { status: 403 }
  );
}

// ------------------------------------------------------------
// 管理员鉴权高阶函数
// 支持从数据库验证管理员token，并向后兼容环境变量ADMIN_TOKEN
// ------------------------------------------------------------
export function withAdminAuth<T extends (...args: any[]) => Promise<Response>>(
  handler: T
): T {
  return (async (req: NextRequest, ...rest: any[]) => {
    try {
      const header = req.headers.get("authorization");

      if (!header || !header.startsWith("Bearer ")) {
        return unauthorized("Missing Authorization header");
      }

      const token = header.replace("Bearer ", "").trim();

      // 优先从数据库验证（支持多管理员）
      let admin: AdminInfo | null = null;
      
      try {
        const adminRow = await db
          .selectFrom("admins")
          .select(["id", "username", "token", "is_active"])
          .where("token", "=", token)
          .where("is_active", "=", true)
          .executeTakeFirst();

        if (adminRow) {
          admin = {
            id: adminRow.id,
            username: adminRow.username,
            token: adminRow.token,
            is_active: adminRow.is_active,
          };
        }
      } catch (dbErr) {
        // 数据库查询失败，记录错误但继续尝试环境变量验证
        console.warn("[AdminAuth] Database query failed, falling back to env token:", dbErr);
      }

      // 如果没有找到数据库中的管理员，尝试环境变量（向后兼容）
      if (!admin) {
        const envToken = process.env.ADMIN_TOKEN;
        if (envToken && token === envToken) {
          // 环境变量token验证通过，但无法获取管理员信息（使用系统管理员）
          // 这种情况下，可以创建一个默认的管理员信息，或者返回错误
          // 为了安全，我们只允许数据库中的管理员
          console.warn("[AdminAuth] Env token found but admins table should be used");
          return forbidden("Please use admin account from database");
        }
      }

      if (!admin) {
        return forbidden("Invalid admin token");
      }

      // 存储管理员信息到WeakMap，供后续操作日志使用
      adminInfoStore.set(req, admin);

      // ✅ 鉴权通过，执行原始 handler
      return handler(req, ...rest);
    } catch (err) {
      console.error("[AdminAuth] Unexpected error:", err);
      return forbidden("Unexpected authentication error");
    }
  }) as T;
}

// ------------------------------------------------------------
// 💡 使用示例
// import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
// export const GET = withAdminAuth(async (req) => {
//   return NextResponse.json({ ok: true, message: "Admin access granted" });
// });
// ------------------------------------------------------------
