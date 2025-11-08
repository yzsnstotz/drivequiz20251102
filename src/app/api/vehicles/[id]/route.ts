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
 * GET /api/vehicles/[id]
 * 获取车辆详情
 * 响应体: { ok: true, data: { ...vehicle details } }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const vehicleId = parseInt(id, 10);

    if (isNaN(vehicleId)) {
      return err("VALIDATION_FAILED", "无效的车辆ID", 400);
    }

    const vehicle = await db
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
      .where("vehicles.id", "=", vehicleId)
      .where("vehicles.status", "=", "active")
      .executeTakeFirst();

    if (!vehicle) {
      return err("NOT_FOUND", "车辆不存在", 404);
    }

    return ok({
      id: vehicle.id,
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      name: {
        ja: vehicle.name_ja,
        zh: vehicle.name_zh,
        en: vehicle.name_en,
      },
      description: {
        ja: vehicle.description_ja,
        zh: vehicle.description_zh,
        en: vehicle.description_en,
      },
      price: {
        min: vehicle.price_min,
        max: vehicle.price_max,
      },
      fuel_type: vehicle.fuel_type,
      transmission: vehicle.transmission,
      seats: vehicle.seats,
      image_url: vehicle.image_url,
      official_url: vehicle.official_url,
      dealer_url: vehicle.dealer_url,
      specifications: vehicle.specifications,
      metadata: vehicle.metadata,
      type: vehicle.type_name
        ? {
            name: vehicle.type_name,
            name_ja: vehicle.type_name_ja,
            name_zh: vehicle.type_name_zh,
            name_en: vehicle.type_name_en,
          }
        : null,
      status: vehicle.status,
      created_at: vehicle.created_at,
      updated_at: vehicle.updated_at,
    });
  } catch (error) {
    console.error("[Vehicles API] GET [id] error:", error);
    return err("INTERNAL_ERROR", "服务器内部错误", 500);
  }
}

