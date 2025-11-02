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
      let dbQuerySucceeded = false;
      
      try {
        const adminRow = await db
          .selectFrom("admins")
          .select(["id", "username", "token", "is_active"])
          .where("token", "=", token)
          .where("is_active", "=", true)
          .executeTakeFirst();

        dbQuerySucceeded = true; // 数据库查询成功（无论是否找到记录）

        if (adminRow) {
          admin = {
            id: adminRow.id,
            username: adminRow.username,
            token: adminRow.token,
            is_active: adminRow.is_active,
          };
          console.info("[AdminAuth] Admin authenticated from database:", adminRow.username);
        }
      } catch (dbErr) {
        // 数据库查询失败（连接错误、表不存在等），记录错误但继续尝试环境变量验证
        console.warn("[AdminAuth] Database query failed, falling back to env token:", dbErr);
        dbQuerySucceeded = false;
      }

      // 如果没有找到数据库中的管理员，尝试环境变量（向后兼容）
      // 两种情况会fallback：
      // 1. 数据库查询失败（dbQuerySucceeded = false）
      // 2. 数据库查询成功但没找到匹配的管理员（admin = null）
      if (!admin) {
        const envToken = process.env.ADMIN_TOKEN;
        if (envToken && token === envToken) {
          // 环境变量token验证通过，创建默认管理员信息（用于向后兼容）
          admin = {
            id: 0,
            username: "system",
            token: envToken,
            is_active: true,
          };
          console.info(
            `[AdminAuth] Using env token as fallback (dbQuerySucceeded=${dbQuerySucceeded}, no matching admin in database)`
          );
        } else if (envToken) {
          // 环境变量存在但token不匹配
          console.warn("[AdminAuth] Env token exists but doesn't match provided token");
        } else {
          // 环境变量不存在
          console.warn("[AdminAuth] No env token configured (ADMIN_TOKEN not set)");
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
