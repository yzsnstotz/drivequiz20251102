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
import type { PaginationMeta } from "@/types/db";

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
 * GET /api/services
 * 获取服务列表
 * 查询参数: ?page=1&limit=20&category=&location=&prefecture=&city=&status=active
 * 响应体: { ok: true, data: [...], pagination: { page, limit, total, totalPages } }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const offset = (page - 1) * limit;

    const category = searchParams.get("category")?.trim();
    const location = searchParams.get("location")?.trim();
    const prefecture = searchParams.get("prefecture")?.trim();
    const city = searchParams.get("city")?.trim();
    const status = searchParams.get("status") || "active";

    // 构建查询
    let query = db
      .selectFrom("services")
      .leftJoin("service_categories", "services.category_id", "service_categories.id")
      .select([
        "services.id",
        "services.name",
        "services.name_ja",
        "services.name_zh",
        "services.name_en",
        "services.description",
        "services.description_ja",
        "services.description_zh",
        "services.description_en",
        "services.location",
        "services.address",
        "services.latitude",
        "services.longitude",
        "services.prefecture",
        "services.city",
        "services.phone",
        "services.email",
        "services.website",
        "services.price_min",
        "services.price_max",
        "services.price_unit",
        "services.rating_avg",
        "services.rating_count",
        "services.image_url",
        "services.official_url",
        "services.business_hours",
        "services.features",
        "services.metadata",
        "services.status",
        "services.created_at",
        "services.updated_at",
        "service_categories.name as category_name",
        "service_categories.name_ja as category_name_ja",
        "service_categories.name_zh as category_name_zh",
        "service_categories.name_en as category_name_en",
      ])
      .where("services.status", "=", status);

    // 应用过滤条件
    if (category) {
      query = query.where("service_categories.name", "ilike", `%${category}%`);
    }
    if (location) {
      query = query.where("services.location", "ilike", `%${location}%`);
    }
    if (prefecture) {
      query = query.where("services.prefecture", "ilike", `%${prefecture}%`);
    }
    if (city) {
      query = query.where("services.city", "ilike", `%${city}%`);
    }

    // 获取总数
    const countQuery = query.select(({ fn }) => [fn.count<number>("services.id").as("count")]);
    const countResult = await countQuery.executeTakeFirst();
    const total = Number(countResult?.count || 0);

    // 获取数据
    const services = await query
      .orderBy("services.rating_avg", "desc")
      .orderBy("services.created_at", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    return NextResponse.json({
      ok: true,
      data: services.map((s) => ({
        id: s.id,
        name: {
          default: s.name,
          ja: s.name_ja,
          zh: s.name_zh,
          en: s.name_en,
        },
        description: {
          default: s.description,
          ja: s.description_ja,
          zh: s.description_zh,
          en: s.description_en,
        },
        location: {
          address: s.address,
          location: s.location,
          prefecture: s.prefecture,
          city: s.city,
          latitude: s.latitude,
          longitude: s.longitude,
        },
        contact: {
          phone: s.phone,
          email: s.email,
          website: s.website,
        },
        price: {
          min: s.price_min,
          max: s.price_max,
          unit: s.price_unit,
        },
        rating: {
          avg: s.rating_avg,
          count: s.rating_count,
        },
        image_url: s.image_url,
        official_url: s.official_url,
        business_hours: s.business_hours,
        features: s.features,
        metadata: s.metadata,
        category: s.category_name
          ? {
              name: s.category_name,
              name_ja: s.category_name_ja,
              name_zh: s.category_name_zh,
              name_en: s.category_name_en,
            }
          : null,
        status: s.status,
        created_at: s.created_at,
        updated_at: s.updated_at,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[Services API] GET error:", error);
    return err("INTERNAL_ERROR", "服务器内部错误", 500);
  }
}

