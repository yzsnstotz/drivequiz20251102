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
 * POST /api/user-behaviors
 * 记录用户行为
 * 请求体: {
 *   behaviorType: 'start_quiz' | 'complete_quiz' | 'pause_quiz' | 'resume_quiz' | 'view_page' | 'other',
 *   metadata?: object,
 *   userAgent?: string,
 *   clientType?: 'web' | 'mobile' | 'api' | 'desktop' | 'other'
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { behaviorType, metadata, userAgent, clientType } = body;

    // 验证行为类型
    const validBehaviorTypes = ['start_quiz', 'complete_quiz', 'pause_quiz', 'resume_quiz', 'view_page', 'ai_chat', 'other'];
    if (!behaviorType || !validBehaviorTypes.includes(behaviorType)) {
      return NextResponse.json(
        { ok: false, errorCode: "INVALID_BEHAVIOR_TYPE", message: "无效的行为类型" },
        { status: 400 }
      );
    }

    // 从请求头获取 IP 地址
    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip")?.trim() ||
      null;

    // 从 Authorization header 获取用户 token
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "") || null;

    // 如果没有 token，无法记录用户行为（匿名用户不记录）
    if (!token) {
      return NextResponse.json(
        { ok: false, errorCode: "NO_TOKEN", message: "需要用户认证" },
        { status: 401 }
      );
    }

    // 从 token 中提取用户 ID（支持 act-{activationId} 格式）
    let userId: number | null = null;
    
    if (token.startsWith("act-")) {
      try {
        // 从 act-{hash}-{activationId} 格式中提取 activationId
        const parts = token.split("-");
        if (parts.length >= 3 && parts[0] === "act") {
          const activationId = parseInt(parts[parts.length - 1], 16); // 从hex转换为数字
          if (!isNaN(activationId) && activationId > 0) {
            // 通过 activation_id 查找 users 表中的用户
            const activation = await db
              .selectFrom("activations")
              .select(["id", "email"])
              .where("id", "=", activationId)
              .executeTakeFirst();

            if (activation) {
              // 通过邮箱查找用户
              const user = await db
                .selectFrom("users")
                .select(["id", "email"])
                .where("email", "=", activation.email)
                .executeTakeFirst();

              if (user) {
                userId = user.id;
              }
            }
          }
        }
      } catch (e) {
        console.error("[POST /api/user-behaviors] Failed to parse activation token:", e);
      }
    }

    // 如果无法找到用户，返回错误
    if (!userId) {
      return NextResponse.json(
        { ok: false, errorCode: "USER_NOT_FOUND", message: "无法找到对应的用户" },
        { status: 404 }
      );
    }

    // 检测客户端类型（如果没有提供）
    let detectedClientType: "web" | "mobile" | "api" | "desktop" | "other" | null = clientType || null;
    if (!detectedClientType && userAgent) {
      const ua = userAgent.toLowerCase();
      if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone") || ua.includes("ipad")) {
        detectedClientType = "mobile";
      } else if (ua.includes("electron") || ua.includes("desktop")) {
        detectedClientType = "desktop";
      } else if (ua.includes("api") || ua.includes("curl") || ua.includes("postman")) {
        detectedClientType = "api";
      } else {
        detectedClientType = "web";
      }
    }

    // 记录用户行为
    await db
      .insertInto("user_behaviors")
      .values({
        user_id: userId,
        behavior_type: behaviorType,
        ip_address: ipAddress,
        user_agent: userAgent || null,
        client_type: detectedClientType,
        metadata: metadata || {},
      })
      .execute();

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    console.error("[POST /api/user-behaviors] Error:", error);
    return NextResponse.json(
      { ok: false, errorCode: "INTERNAL_ERROR", message: "服务器内部错误" },
      { status: 500 }
    );
  }
}

