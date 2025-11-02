// ✅ 强制所有使用此中间件的 API 路由保持动态渲染（防止被静态化）
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

/**
 * 管理后台鉴权中间件
 * - 仅检查 .env 中的 ADMIN_TOKEN
 * - 禁止静态化，确保 headers 与 env 可在运行时读取
 */

// 向后兼容：导出空的 AdminInfo 接口和 getAdminInfo 函数
export interface AdminInfo {
  id: number;
  username: string;
  token: string;
  is_active: boolean;
}

export function getAdminInfo(req: NextRequest): AdminInfo | null {
  // 简化版本暂不支持，返回 null
  return null;
}

export function withAdminAuth<T extends (...args: any[]) => Promise<Response>>(
  handler: T
): T {
  return (async (req: NextRequest, ...rest: any[]) => {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "").trim();

    const envToken = process.env.ADMIN_TOKEN;
    if (!envToken) {
      console.error("[AdminAuth] Missing ADMIN_TOKEN in env");
      return NextResponse.json(
        { ok: false, errorCode: "MISSING_TOKEN", message: "Missing admin token" },
        { status: 403 }
      );
    }

    if (token !== envToken) {
      console.warn("[AdminAuth] Invalid admin token");
      return NextResponse.json(
        { ok: false, errorCode: "FORBIDDEN", message: "Invalid admin token" },
        { status: 403 }
      );
    }

    return handler(req, ...rest);
  }) as T;
}
