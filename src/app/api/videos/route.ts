/**
 * ✅ Dynamic Route Declaration
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

/**
 * GET /api/videos
 * 公开接口，获取视频列表
 */
export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams;
    const category = query.get("category") || "";

    let q = db.selectFrom("videos").selectAll().where("status", "=", "active");

    if (category && (category === "basic" || category === "advanced")) {
      q = q.where("category", "=", category);
    }

    q = q.orderBy("display_order", "asc").orderBy("created_at", "desc");

    const rows = await q.execute();

    const items = rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description || null,
      url: row.url,
      thumbnail: row.thumbnail || null,
      category: row.category,
      displayOrder: row.display_order,
    }));

    const response = ok({ items });
    // 添加 HTTP 缓存头：视频列表缓存 5 分钟
    // s-maxage=300: CDN 缓存 5 分钟
    // stale-while-revalidate=600: 过期后 10 分钟内仍可使用旧数据，后台更新
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return response;
  } catch (err: any) {
    console.error("[GET /api/videos] Error:", err);
    if (err.message && err.message.includes("does not exist")) {
      return ok({ items: [] });
    }
    return ok({ items: [] });
  }
}

