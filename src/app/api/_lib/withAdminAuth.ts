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

export async function getAdminInfo(req: NextRequest): Promise<AdminInfo | null> {
  // 检查缓存
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
    const authHeader = req.headers.get("authorization");
    
    // 如果没有 Authorization header，返回 401 AUTH_REQUIRED
    if (!authHeader) {
      console.warn(`[AdminAuth] Missing Authorization header for ${requestPath}`);
      return unauthorized("Missing Authorization header");
    }

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      console.warn("[AdminAuth] Empty token");
      return unauthorized("Empty token");
    }

    try {
      // 从数据库查询管理员信息
      const admin = await db
        .selectFrom("admins")
        .select(["id", "username", "token", "is_active"])
        .where("token", "=", token)
        .where("is_active", "=", true)
        .executeTakeFirst();

      if (!admin) {
        console.warn("[AdminAuth] Invalid or inactive admin token");
        return forbidden("Invalid or inactive admin token");
      }

      // 缓存 AdminInfo 供后续使用
      const adminInfo: AdminInfo = {
        id: admin.id,
        username: admin.username,
        token: admin.token,
        is_active: admin.is_active,
      };
      adminInfoCache.set(req, adminInfo);

      console.log(`[AdminAuth] Authentication successful for ${requestPath}, admin: ${admin.username}`);
      return handler(req, ...rest);
    } catch (error) {
      console.error("[AdminAuth] Database error:", error);
      
      // 提供更详细的错误信息
      let errorCode = "DATABASE_ERROR";
      let message = "Failed to verify admin token";
      let details: Record<string, unknown> = {};

      if (error instanceof Error) {
        const errorMessage = error.message;
        const errorStack = error.stack;

        // 检查是否是表不存在错误
        if (errorMessage.includes("relation") && errorMessage.includes("does not exist")) {
          errorCode = "DATABASE_TABLE_NOT_FOUND";
          message = "admins 表不存在，请运行数据库迁移脚本";
          details = {
            hint: "运行迁移脚本: npm run db:migrate 或 tsx scripts/init-cloud-database.ts",
            table: "admins",
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
        // 检查是否是认证错误
        else if (errorMessage.includes("password") || errorMessage.includes("authentication")) {
          errorCode = "DATABASE_AUTH_ERROR";
          message = "数据库认证失败，请检查密码";
          details = {
            hint: "检查 DATABASE_URL 中的密码是否正确",
          };
        }
        // 检查是否是SSL错误
        else if (errorMessage.includes("SSL") || errorMessage.includes("ssl")) {
          errorCode = "DATABASE_SSL_ERROR";
          message = "数据库 SSL 连接错误";
          details = {
            hint: "Supabase 数据库需要使用 SSL 连接，请检查连接字符串是否包含 sslmode=require",
          };
        }
        // 检查是否是超时错误
        else if (errorMessage.includes("timeout") || errorMessage.includes("Timeout")) {
          errorCode = "DATABASE_TIMEOUT";
          message = "数据库查询超时";
          details = {
            hint: "数据库可能负载过高或网络连接不稳定",
          };
        }
        // 其他数据库错误
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
