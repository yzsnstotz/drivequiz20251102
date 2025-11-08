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
 * GET /api/vehicles
 * 获取车辆列表
 * 查询参数: ?page=1&limit=20&brand=&type=&minPrice=&maxPrice=&status=active
 * 响应体: { ok: true, data: [...], pagination: { page, limit, total, totalPages } }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const offset = (page - 1) * limit;

    const brand = searchParams.get("brand")?.trim();
    const type = searchParams.get("type")?.trim();
    const minPrice = searchParams.get("minPrice") ? parseFloat(searchParams.get("minPrice")!) : null;
    const maxPrice = searchParams.get("maxPrice") ? parseFloat(searchParams.get("maxPrice")!) : null;
    type VehicleStatus = "active" | "inactive" | "archived";
    const statusParam = (searchParams.get("status") || "active").trim();
    const isVehicleStatus = (value: string): value is VehicleStatus =>
      value === "active" || value === "inactive" || value === "archived";
    const status: VehicleStatus = isVehicleStatus(statusParam) ? statusParam : "active";

    // 构建查询
    let query = db
      .selectFrom("vehicles")
      .leftJoin("vehicle_types", "vehicles.vehicle_type_id", "vehicle_types.id")
      .select([
        "vehicles.id",
        "vehicles.brand",
        "vehicles.model",
        "vehicles.year",
        "vehicles.name_ja",
        "vehicles.name_zh",
        "vehicles.name_en",
        "vehicles.description_ja",
        "vehicles.description_zh",
        "vehicles.description_en",
        "vehicles.price_min",
        "vehicles.price_max",
        "vehicles.fuel_type",
        "vehicles.transmission",
        "vehicles.seats",
        "vehicles.image_url",
        "vehicles.official_url",
        "vehicles.dealer_url",
        "vehicles.specifications",
        "vehicles.metadata",
        "vehicles.status",
        "vehicles.created_at",
        "vehicles.updated_at",
        "vehicle_types.name as type_name",
        "vehicle_types.name_ja as type_name_ja",
        "vehicle_types.name_zh as type_name_zh",
        "vehicle_types.name_en as type_name_en",
      ])
      .where("vehicles.status", "=", status);

    // 应用过滤条件
    if (brand) {
      query = query.where("vehicles.brand", "ilike", `%${brand}%`);
    }
    if (type) {
      query = query.where("vehicle_types.name", "ilike", `%${type}%`);
    }
    if (minPrice !== null) {
      query = query.where("vehicles.price_max", ">=", minPrice);
    }
    if (maxPrice !== null) {
      query = query.where("vehicles.price_min", "<=", maxPrice);
    }

    // 获取总数
    const countQuery = query.select(({ fn }) => [fn.count<number>("vehicles.id").as("count")]);
    const countResult = await countQuery.executeTakeFirst();
    const total = Number(countResult?.count || 0);

    // 获取数据
    const vehicles = await query
      .orderBy("vehicles.created_at", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    return NextResponse.json({
      ok: true,
      data: vehicles.map((v) => ({
        id: v.id,
        brand: v.brand,
        model: v.model,
        year: v.year,
        name: {
          ja: v.name_ja,
          zh: v.name_zh,
          en: v.name_en,
        },
        description: {
          ja: v.description_ja,
          zh: v.description_zh,
          en: v.description_en,
        },
        price: {
          min: v.price_min,
          max: v.price_max,
        },
        fuel_type: v.fuel_type,
        transmission: v.transmission,
        seats: v.seats,
        image_url: v.image_url,
        official_url: v.official_url,
        dealer_url: v.dealer_url,
        specifications: v.specifications,
        metadata: v.metadata,
        type: v.type_name
          ? {
              name: v.type_name,
              name_ja: v.type_name_ja,
              name_zh: v.type_name_zh,
              name_en: v.type_name_en,
            }
          : null,
        status: v.status,
        created_at: v.created_at,
        updated_at: v.updated_at,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[Vehicles API] GET error:", error);
    return err("INTERNAL_ERROR", "服务器内部错误", 500);
  }
}

