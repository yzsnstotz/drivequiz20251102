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
 * GET /api/services/[id]
 * 获取服务详情
 * 响应体: { ok: true, data: { ...service details } }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const serviceId = parseInt(id, 10);

    if (isNaN(serviceId)) {
      return err("VALIDATION_FAILED", "无效的服务ID", 400);
    }

    const service = await db
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
      .where("services.id", "=", serviceId)
      .where("services.status", "=", "active")
      .executeTakeFirst();

    if (!service) {
      return err("NOT_FOUND", "服务不存在", 404);
    }

    // 获取评价列表（最近10条）
    const reviews = await db
      .selectFrom("service_reviews")
      .select(["id", "rating", "comment", "created_at"])
      .where("service_id", "=", serviceId)
      .where("status", "=", "active")
      .orderBy("created_at", "desc")
      .limit(10)
      .execute();

    const response = ok({
      id: service.id,
      name: {
        default: service.name,
        ja: service.name_ja,
        zh: service.name_zh,
        en: service.name_en,
      },
      description: {
        default: service.description,
        ja: service.description_ja,
        zh: service.description_zh,
        en: service.description_en,
      },
      location: {
        address: service.address,
        location: service.location,
        prefecture: service.prefecture,
        city: service.city,
        latitude: service.latitude,
        longitude: service.longitude,
      },
      contact: {
        phone: service.phone,
        email: service.email,
        website: service.website,
      },
      price: {
        min: service.price_min,
        max: service.price_max,
        unit: service.price_unit,
      },
      rating: {
        avg: service.rating_avg,
        count: service.rating_count,
      },
      image_url: service.image_url,
      official_url: service.official_url,
      business_hours: service.business_hours,
      features: service.features,
      metadata: service.metadata,
      category: service.category_name
        ? {
            name: service.category_name,
            name_ja: service.category_name_ja,
            name_zh: service.category_name_zh,
            name_en: service.category_name_en,
          }
        : null,
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        created_at: r.created_at,
      })),
      status: service.status,
      created_at: service.created_at,
      updated_at: service.updated_at,
    });
    // 添加 HTTP 缓存头：服务详情缓存 5 分钟
    // s-maxage=300: CDN 缓存 5 分钟
    // stale-while-revalidate=600: 过期后 10 分钟内仍可使用旧数据，后台更新
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return response;
  } catch (error) {
    console.error("[Services API] GET [id] error:", error);
    return err("INTERNAL_ERROR", "服务器内部错误", 500);
  }
}

