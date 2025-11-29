/**
 * ✅ Dynamic Route Declaration
 * 防止 Next.js 静态预渲染报错 (DYNAMIC_SERVER_USAGE)
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserInfo } from "@/app/api/_lib/withUserAuth";

/**
 * 统一成功响应
 */
function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

/**
 * 统一错误响应
 */
function err(errorCode: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, errorCode, message }, { status });
}

/**
 * GET /api/profile
 * 获取用户资料
 * 响应体: { ok: true, data: { language, goals, level, metadata } }
 */
export async function GET(request: NextRequest) {
  try {
    const userInfo = await getUserInfo(request);

    if (!userInfo || !userInfo.userDbId) {
      return err("AUTH_REQUIRED", "需要登录才能访问此资源", 401);
    }

    // 查询用户资料
    const profile = await db
      .selectFrom("user_profiles")
      .select(["id", "language", "goals", "level", "metadata", "created_at", "updated_at"])
      .where("user_id", "=", userInfo.userDbId)
      .executeTakeFirst();

    if (!profile) {
      // 如果不存在，返回默认值
      const response = ok({
        language: "ja",
        goals: [],
        level: "beginner",
        metadata: {},
        userid: userInfo.userId ?? null,
      });
      // 添加 HTTP 缓存头：用户资料缓存 60 秒（private，避免CDN缓存用户敏感信息）
      // private: 仅客户端缓存，CDN不缓存
      // s-maxage=60: 客户端缓存 60 秒
      // stale-while-revalidate=120: 过期后 2 分钟内仍可使用旧数据，后台更新
      response.headers.set('Cache-Control', 'private, s-maxage=60, stale-while-revalidate=120');
      return response;
    }

    const response = ok({
      language: profile.language || "ja",
      goals: profile.goals || [],
      level: profile.level || "beginner",
      metadata: profile.metadata || {},
      created_at: profile.created_at,
      updated_at: profile.updated_at,
      userid: userInfo.userId ?? null,
    });
    // 添加 HTTP 缓存头：用户资料缓存 60 秒（private，避免CDN缓存用户敏感信息）
    // private: 仅客户端缓存，CDN不缓存
    // s-maxage=60: 客户端缓存 60 秒
    // stale-while-revalidate=120: 过期后 2 分钟内仍可使用旧数据，后台更新
    response.headers.set('Cache-Control', 'private, s-maxage=60, stale-while-revalidate=120');
    return response;
  } catch (error) {
    console.error("[Profile API] GET error:", error);
    return err("INTERNAL_ERROR", "服务器内部错误", 500);
  }
}

/**
 * PUT /api/profile
 * 更新用户资料
 * 请求体: { language?: string, goals?: string[], level?: string, metadata?: object }
 * 响应体: { ok: true, data: { language, goals, level, metadata } }
 */
export async function PUT(request: NextRequest) {
  try {
    const userInfo = await getUserInfo(request);

    if (!userInfo || !userInfo.userDbId) {
      return err("AUTH_REQUIRED", "需要登录才能访问此资源", 401);
    }

    const body = await request.json().catch(() => ({}));
    const { language, goals, level, metadata } = body;

    // 验证参数
    if (language !== undefined && typeof language !== "string") {
      return err("VALIDATION_FAILED", "language 必须是字符串", 400);
    }
    if (goals !== undefined && !Array.isArray(goals)) {
      return err("VALIDATION_FAILED", "goals 必须是数组", 400);
    }
    if (level !== undefined && !["beginner", "intermediate", "advanced", "expert"].includes(level)) {
      return err("VALIDATION_FAILED", "level 必须是 beginner/intermediate/advanced/expert 之一", 400);
    }
    if (metadata !== undefined && typeof metadata !== "object") {
      return err("VALIDATION_FAILED", "metadata 必须是对象", 400);
    }

    // 检查用户资料是否存在
    const existing = await db
      .selectFrom("user_profiles")
      .select(["id"])
      .where("user_id", "=", userInfo.userDbId)
      .executeTakeFirst();

    let profile;
    if (existing) {
      // 更新现有资料
      const updateData: Partial<{
        language: string;
        goals: string[];
        level: "beginner" | "intermediate" | "advanced" | "expert";
        metadata: Record<string, any>;
      }> = {};

      if (language !== undefined) updateData.language = language;
      if (goals !== undefined) updateData.goals = goals;
      if (level !== undefined) updateData.level = level;
      if (metadata !== undefined) updateData.metadata = metadata as Record<string, any>;

      profile = await db
        .updateTable("user_profiles")
        .set(updateData)
        .where("user_id", "=", userInfo.userDbId)
        .returning(["id", "language", "goals", "level", "metadata", "created_at", "updated_at"])
        .executeTakeFirst();
    } else {
      // 创建新资料
      profile = await db
        .insertInto("user_profiles")
        .values({
          user_id: userInfo.userDbId,
          language: language || "ja",
          goals: goals || [],
          level: level || "beginner",
          metadata: metadata || {},
        })
        .returning(["id", "language", "goals", "level", "metadata", "created_at", "updated_at"])
        .executeTakeFirst();
    }

    if (!profile) {
      return err("INTERNAL_ERROR", "更新用户资料失败", 500);
    }

    return ok({
      language: profile.language || "ja",
      goals: profile.goals || [],
      level: profile.level || "beginner",
      metadata: profile.metadata || {},
      created_at: profile.created_at,
      updated_at: profile.updated_at,
      userid: userInfo.userId ?? null,
    });
  } catch (error) {
    console.error("[Profile API] PUT error:", error);
    return err("INTERNAL_ERROR", "服务器内部错误", 500);
  }
}

