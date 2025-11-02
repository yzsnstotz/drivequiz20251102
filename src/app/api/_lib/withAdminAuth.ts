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
    const authHeader = req.headers.get("authorization");
    
    // 如果没有 Authorization header，返回 401 AUTH_REQUIRED
    if (!authHeader) {
      console.warn("[AdminAuth] Missing Authorization header");
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

      return handler(req, ...rest);
    } catch (error) {
      console.error("[AdminAuth] Database error:", error);
      return NextResponse.json(
        { 
          ok: false, 
          errorCode: "DATABASE_ERROR", 
          message: "Failed to verify admin token" 
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
