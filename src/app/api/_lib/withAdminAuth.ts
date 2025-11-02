import { NextRequest, NextResponse } from "next/server";
import { forbidden } from "@/app/api/_lib/errors";

/**
 * 管理后台鉴权中间件
 * - 当前临时改为使用 .env 中的 ADMIN_TOKEN 进行校验
 * - 禁用 admins 表逻辑（DB 模式）
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
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return forbidden("Missing Authorization header");
    }
    
    const token = authHeader.replace("Bearer ", "").trim();

    const envToken = process.env.ADMIN_TOKEN;
    if (!envToken) {
      console.error("[AdminAuth] Missing ADMIN_TOKEN in env");
      return forbidden("Missing admin token");
    }

    // 🚫 暂时禁用 DB 模式，强制使用 ENV token
    if (token !== envToken) {
      console.warn("[AdminAuth] Invalid admin token (ENV mode)");
      return forbidden("Invalid admin token");
    }

    return handler(req, ...rest);
  }) as T;
}

// ------------------------------------------------------------
// 💡 使用示例
// import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
// export const GET = withAdminAuth(async (req) => {
//   return NextResponse.json({ ok: true, message: "Admin access granted" });
// });
// ------------------------------------------------------------
