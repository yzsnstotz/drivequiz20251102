/**
 * ✅ Dynamic Route Declaration
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

import { NextRequest } from "next/server";
import { db } from "@/lib/db";

function ok<T>(data: T, status = 200) {
  return Response.json({ ok: true, data }, { status });
}

/**
 * GET /api/ad-slots
 * 公开接口，获取启用的广告栏配置
 */
export async function GET(request: NextRequest) {
  try {
    const rows = await db
      .selectFrom("ad_slots_config")
      .selectAll()
      .where("is_enabled", "=", true)
      .orderBy("slot_key", "asc")
      .execute();

    const items = rows.map((row) => ({
      slotKey: row.slot_key,
      title: row.title,
      description: row.description || null,
      splashDuration: row.splash_duration || 3,
    }));

    const response = ok({ items });
    // 添加 HTTP 缓存头：广告位配置缓存 5 分钟
    // s-maxage=300: CDN 缓存 5 分钟
    // stale-while-revalidate=600: 过期后 10 分钟内仍可使用旧数据，后台更新
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return response;
  } catch (err: any) {
    console.error("[GET /api/ad-slots] Error:", err);
    if (err.message && err.message.includes("does not exist")) {
      return ok({ items: [] });
    }
    return ok({ items: [] });
  }
}

