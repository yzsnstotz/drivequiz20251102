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
import type { UserInterests } from "@/types/db";

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
 * GET /api/interests
 * 获取用户兴趣
 * 响应体: { ok: true, data: { vehicle_brands, service_types, other_interests } }
 */
export async function GET(request: NextRequest) {
  try {
    const userInfo = await getUserInfo(request);

    if (!userInfo || !userInfo.userDbId) {
      return err("AUTH_REQUIRED", "需要登录才能访问此资源", 401);
    }

    // 查询用户兴趣
    const interests = await db
      .selectFrom("user_interests")
      .select(["id", "vehicle_brands", "service_types", "other_interests", "created_at", "updated_at"])
      .where("user_id", "=", userInfo.userDbId)
      .executeTakeFirst();

    if (!interests) {
      // 如果不存在，返回默认值
      return ok({
        vehicle_brands: [],
        service_types: [],
        other_interests: {},
      });
    }

    return ok({
      vehicle_brands: interests.vehicle_brands || [],
      service_types: interests.service_types || [],
      other_interests: interests.other_interests || {},
      created_at: interests.created_at,
      updated_at: interests.updated_at,
    });
  } catch (error) {
    console.error("[Interests API] GET error:", error);
    return err("INTERNAL_ERROR", "服务器内部错误", 500);
  }
}

/**
 * PUT /api/interests
 * 更新用户兴趣
 * 请求体: { vehicle_brands?: string[], service_types?: string[], other_interests?: object }
 * 响应体: { ok: true, data: { vehicle_brands, service_types, other_interests } }
 */
export async function PUT(request: NextRequest) {
  try {
    const userInfo = await getUserInfo(request);

    if (!userInfo || !userInfo.userDbId) {
      return err("AUTH_REQUIRED", "需要登录才能访问此资源", 401);
    }

    const body = await request.json().catch(() => ({}));
    const { vehicle_brands, service_types, other_interests } = body;

    // 验证参数
    if (vehicle_brands !== undefined && !Array.isArray(vehicle_brands)) {
      return err("VALIDATION_FAILED", "vehicle_brands 必须是数组", 400);
    }
    if (service_types !== undefined && !Array.isArray(service_types)) {
      return err("VALIDATION_FAILED", "service_types 必须是数组", 400);
    }
    if (other_interests !== undefined && typeof other_interests !== "object") {
      return err("VALIDATION_FAILED", "other_interests 必须是对象", 400);
    }

    // 检查用户兴趣是否存在
    const existing = await db
      .selectFrom("user_interests")
      .select(["id"])
      .where("user_id", "=", userInfo.userDbId)
      .executeTakeFirst();

    let interests;
    if (existing) {
      // 更新现有兴趣
      const updateData: {
        vehicle_brands?: string[];
        service_types?: string[];
        other_interests?: object;
      } = {};

      if (vehicle_brands !== undefined) updateData.vehicle_brands = vehicle_brands;
      if (service_types !== undefined) updateData.service_types = service_types;
      if (other_interests !== undefined) updateData.other_interests = other_interests as object;

      interests = await db
        .updateTable("user_interests")
        .set(updateData)
        .where("user_id", "=", userInfo.userDbId)
        .returning(["id", "vehicle_brands", "service_types", "other_interests", "created_at", "updated_at"])
        .executeTakeFirst();
    } else {
      // 创建新兴趣
      interests = await db
        .insertInto("user_interests")
        .values({
          user_id: userInfo.userDbId,
          vehicle_brands: vehicle_brands || [],
          service_types: service_types || [],
          other_interests: other_interests || {},
        })
        .returning(["id", "vehicle_brands", "service_types", "other_interests", "created_at", "updated_at"])
        .executeTakeFirst();
    }

    if (!interests) {
      return err("INTERNAL_ERROR", "更新用户兴趣失败", 500);
    }

    return ok({
      vehicle_brands: interests.vehicle_brands || [],
      service_types: interests.service_types || [],
      other_interests: interests.other_interests || {},
      created_at: interests.created_at,
      updated_at: interests.updated_at,
    });
  } catch (error) {
    console.error("[Interests API] PUT error:", error);
    return err("INTERNAL_ERROR", "服务器内部错误", 500);
  }
}

