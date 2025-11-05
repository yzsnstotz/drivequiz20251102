/**
 * ✅ Dynamic Route Declaration
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * POST /api/login
 * 记录用户登录行为（用于已激活用户每次访问时记录登录）
 * 请求体: { email?: string } (可选，如果不提供则从 token 中获取)
 * 
 * 逻辑：
 * 1. 通过 email 或 token 查找用户
 * 2. 检查距离上次登录的时间
 * 3. 如果超过阈值（默认5分钟）或 IP/User-Agent 变化，记录新的登录行为
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email } = body;

    // 从请求头获取 IP 地址和 User-Agent
    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip")?.trim() ||
      null;
    const userAgent = request.headers.get("user-agent") || null;

    // 从 Authorization header 获取用户 token
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "") || null;

    // 查找用户
    let user;
    
    // 方式1: 通过邮箱查找
    if (email) {
      user = await db
        .selectFrom("users")
        .select(["id", "email", "last_login_at"])
        .where("email", "=", email)
        .executeTakeFirst();
    }
    
    // 方式2: 通过 token 查找（如果邮箱未找到）
    if (!user && token && token.startsWith("act-")) {
      try {
        // 从 act-{hash}-{activationId} 格式中提取 activationId
        const parts = token.split("-");
        if (parts.length >= 3 && parts[0] === "act") {
          const activationId = parseInt(parts[parts.length - 1], 16);
          if (!isNaN(activationId) && activationId > 0) {
            // 通过 activation_id 查找激活记录
            const activation = await db
              .selectFrom("activations")
              .select(["id", "email"])
              .where("id", "=", activationId)
              .executeTakeFirst();

            if (activation) {
              // 通过邮箱查找用户
              user = await db
                .selectFrom("users")
                .select(["id", "email", "last_login_at"])
                .where("email", "=", activation.email)
                .executeTakeFirst();
            }
          }
        }
      } catch (e) {
        console.error("[POST /api/login] Failed to parse activation token:", e);
      }
    }

    // 如果找不到用户，返回错误
    if (!user) {
      return NextResponse.json(
        { ok: false, errorCode: "USER_NOT_FOUND", message: "无法找到对应的用户" },
        { status: 404 }
      );
    }

    // 检查是否需要记录新的登录
    // 1. 获取用户最近一次登录记录
    const lastLogin = await db
      .selectFrom("user_behaviors")
      .select(["id", "ip_address", "user_agent", "created_at"])
      .where("user_id", "=", user.id)
      .where("behavior_type", "=", "login")
      .orderBy("created_at", "desc")
      .limit(1)
      .executeTakeFirst();

    const now = new Date();
    const shouldLogLogin = (() => {
      // 如果没有登录记录，需要记录
      if (!lastLogin) {
        return true;
      }

      // 如果距离上次登录超过5分钟，需要记录
      const lastLoginTime = new Date(lastLogin.created_at);
      const timeDiff = now.getTime() - lastLoginTime.getTime();
      const fiveMinutes = 5 * 60 * 1000; // 5分钟（毫秒）
      
      if (timeDiff > fiveMinutes) {
        return true;
      }

      // 如果 IP 地址变化，需要记录
      if (ipAddress && lastLogin.ip_address && ipAddress !== lastLogin.ip_address) {
        return true;
      }

      // 如果 User-Agent 变化，需要记录
      if (userAgent && lastLogin.user_agent && userAgent !== lastLogin.user_agent) {
        return true;
      }

      // 其他情况不需要记录（距离上次登录不到5分钟，且IP和User-Agent都相同）
      return false;
    })();

    // 如果需要记录登录，插入登录行为
    if (shouldLogLogin) {
      // 检测客户端类型
      let clientType: "web" | "mobile" | "api" | "desktop" | "other" | null = null;
      if (userAgent) {
        const ua = userAgent.toLowerCase();
        if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone") || ua.includes("ipad")) {
          clientType = "mobile";
        } else if (ua.includes("electron") || ua.includes("desktop")) {
          clientType = "desktop";
        } else if (ua.includes("api") || ua.includes("curl") || ua.includes("postman")) {
          clientType = "api";
        } else {
          clientType = "web";
        }
      }

      await db
        .insertInto("user_behaviors")
        .values({
          user_id: user.id,
          behavior_type: "login",
          ip_address: ipAddress !== "unknown" ? ipAddress : null,
          user_agent: userAgent,
          client_type: clientType,
          metadata: {
            login_source: "activation_check",
            has_last_login: !!lastLogin,
            time_since_last_login: lastLogin
              ? Math.round((now.getTime() - new Date(lastLogin.created_at).getTime()) / 1000)
              : null,
          },
        })
        .execute();

      // 更新 users 表的 last_login_at（触发器会自动更新，但这里也显式更新以确保）
      await db
        .updateTable("users")
        .set({
          last_login_at: now,
          updated_at: now,
        })
        .where("id", "=", user.id)
        .execute();

      return NextResponse.json(
        {
          ok: true,
          logged: true,
          message: "登录行为已记录",
        },
        { status: 200 }
      );
    } else {
      // 不需要记录登录（距离上次登录太近）
      return NextResponse.json(
        {
          ok: true,
          logged: false,
          message: "距离上次登录时间太近，跳过记录",
          lastLoginTime: lastLogin?.created_at.toISOString(),
        },
        { status: 200 }
      );
    }
  } catch (error: any) {
    console.error("[POST /api/login] Error:", error);
    return NextResponse.json(
      { ok: false, errorCode: "INTERNAL_ERROR", message: "服务器内部错误" },
      { status: 500 }
    );
  }
}

