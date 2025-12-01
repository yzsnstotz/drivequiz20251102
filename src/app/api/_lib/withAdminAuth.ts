// ✅ 强制所有使用此中间件的 API 路由保持动态渲染（防止被静态化）
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { unauthorized, forbidden } from "./errors";
import { db } from "@/lib/db";

/**
 * 管理后台鉴权中间件
 * - 从数据库的 admins 表验证 token
 * - 检查 token 是否存在且对应的管理员处于活跃状态（is_active = true）
 * - 禁止静态化，确保 headers 与 env 可在运行时读取
 */

export interface AdminInfo {
  id: number;
  username: string;
  token: string;
  is_active: boolean;
}

// 缓存当前请求的 AdminInfo（避免重复查询）
const adminInfoCache = new WeakMap<NextRequest, AdminInfo | null>();

// ✅ 修复：模块级缓存（TTL 10秒），避免跨请求重复查询
interface CachedAdminInfo {
  admin: AdminInfo;
  expiresAt: number;
}

const adminTokenCache = new Map<string, CachedAdminInfo>();
const ADMIN_CACHE_TTL_MS = 10_000; // 10秒

// 定期清理过期缓存（每30秒清理一次）
setInterval(() => {
  const now = Date.now();
  // 使用 Array.from 兼容 ES5 target
  for (const [token, cached] of Array.from(adminTokenCache.entries())) {
    if (cached.expiresAt < now) {
      adminTokenCache.delete(token);
    }
  }
}, 30_000);

export async function getAdminInfo(req: NextRequest): Promise<AdminInfo | null> {
  // 检查请求级别缓存
  if (adminInfoCache.has(req)) {
    return adminInfoCache.get(req) || null;
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    adminInfoCache.set(req, null);
    return null;
  }

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    adminInfoCache.set(req, null);
    return null;
  }

  // ✅ 修复：先检查模块级缓存
  const cached = adminTokenCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    adminInfoCache.set(req, cached.admin);
    return cached.admin;
  }

  try {
    const admin = await db
      .selectFrom("admins")
      .select(["id", "username", "token", "is_active"])
      .where("token", "=", token)
      .where("is_active", "=", true)
      .executeTakeFirst();

    const adminInfo: AdminInfo | null = admin
      ? {
          id: admin.id,
          username: admin.username,
          token: admin.token,
          is_active: admin.is_active,
        }
      : null;

    // ✅ 修复：缓存结果（包括空结果，避免暴力探测）
    if (adminInfo) {
      adminTokenCache.set(token, {
        admin: adminInfo,
        expiresAt: Date.now() + ADMIN_CACHE_TTL_MS,
      });
    } else {
      // 缓存空结果，TTL 稍短（5秒）
      adminTokenCache.set(token, {
        admin: null as any, // 类型兼容，实际不会使用
        expiresAt: Date.now() + 5_000,
      });
    }

    adminInfoCache.set(req, adminInfo);
    return adminInfo;
  } catch (error) {
    console.error("[AdminAuth] Database error:", error);
    adminInfoCache.set(req, null);
    return null;
  }
}

export function withAdminAuth<T extends (...args: any[]) => Promise<Response>>(
  handler: T
): T {
  return (async (req: NextRequest, ...rest: any[]) => {
    const requestPath = req.url || req.nextUrl?.pathname || "unknown";
    console.log(`[AdminAuth] Request received: ${req.method} ${requestPath}`);
    
    // ✅ 修复：统一调用 getAdminInfo，不再直接查询数据库
    const adminInfo = await getAdminInfo(req);

    if (!adminInfo) {
      const authHeader = req.headers.get("authorization");
      if (!authHeader) {
        console.warn(`[AdminAuth] Missing Authorization header for ${requestPath}`);
        return unauthorized("Missing Authorization header");
      }
      const token = authHeader.replace("Bearer ", "").trim();
      if (!token) {
        console.warn("[AdminAuth] Empty token");
        return unauthorized("Empty token");
      }
      console.warn("[AdminAuth] Invalid or inactive admin token");
      return forbidden("Invalid or inactive admin token");
    }

    try {
      console.log(`[AdminAuth] Authentication successful for ${requestPath}, admin: ${adminInfo.username}`);
      return handler(req, ...rest);
    } catch (error) {
      console.error("[AdminAuth] Handler error:", error);
      
      // 提供更详细的错误信息
      let errorCode = "HANDLER_ERROR";
      let message = "Handler execution failed";
      let details: Record<string, unknown> = {};

      if (error instanceof Error) {
        const errorMessage = error.message;
        const errorStack = error.stack;

        // 检查是否是数据库相关错误
        if (errorMessage.includes("relation") && errorMessage.includes("does not exist")) {
          errorCode = "DATABASE_TABLE_NOT_FOUND";
          message = "数据库表不存在，请运行数据库迁移脚本";
          details = {
            hint: "运行迁移脚本: npm run db:migrate 或 tsx scripts/init-cloud-database.ts",
          };
        }
        // 检查是否是连接错误
        else if (errorMessage.includes("connection") || errorMessage.includes("Connection") || 
                 errorMessage.includes("ECONNREFUSED") || errorMessage.includes("ENOTFOUND")) {
          errorCode = "DATABASE_CONNECTION_ERROR";
          message = "数据库连接失败，请检查数据库配置";
          details = {
            hint: "检查 DATABASE_URL 环境变量是否正确配置",
            hasDatabaseUrl: !!process.env.DATABASE_URL,
            hasPostgresUrl: !!process.env.POSTGRES_URL,
          };
        }
        // 其他错误
        else {
          details = {
            errorMessage,
            errorStack: process.env.NODE_ENV === "development" ? errorStack : undefined,
          };
        }
      } else {
        details = {
          error: String(error),
        };
      }

      // 在生产环境记录详细错误（但不返回给客户端）
      if (process.env.NODE_ENV === "production") {
        console.error("[AdminAuth] Full error details:", {
          errorCode,
          message,
          details,
          timestamp: new Date().toISOString(),
        });
      }

      return NextResponse.json(
        { 
          ok: false, 
          errorCode, 
          message,
          ...(process.env.NODE_ENV === "development" ? { details } : {}),
        },
        { status: 500 }
      );
    }
  }) as T;
}

/**
 * 检查当前管理员是否为默认管理员（username === "admin"）
 * 只有默认管理员才能管理其他管理员
 */
export async function requireDefaultAdmin(req: NextRequest): Promise<Response | null> {
  const adminInfo = await getAdminInfo(req);
  if (!adminInfo) {
    return forbidden("Admin authentication required");
  }

  // 检查是否为默认管理员（用户名必须为 "admin"）
  if (adminInfo.username !== "admin") {
    console.warn(
      `[AdminAuth] Non-default admin attempted admin management: ${adminInfo.username}`
    );
    return forbidden("Only default admin can manage admins");
  }

  return null; // null 表示权限通过
}
