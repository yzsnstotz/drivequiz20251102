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
 * GET /api/merchants
 * 公开接口，获取商户列表
 */
export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams;
    const category = query.get("category") || "";

    let q = db.selectFrom("merchants").selectAll().where("status", "=", "active");

    if (category) {
      q = q.where("category", "=", category);
    }

    q = q.orderBy("created_at", "desc");

    const rows = await q.execute();

    const items = rows.map((row) => ({
      id: row.id,
      name: row.name, // 保持多语言对象格式
      description: row.description || null, // 保持多语言对象格式
      address: row.address || null, // 保持多语言对象格式
      phone: row.phone || null,
      email: row.email || null,
      imageUrl: row.image_url || null,
      category: row.category || null,
    }));

    const response = ok({ items });
    // 添加 HTTP 缓存头：商户列表缓存 60 秒
    // s-maxage=60: CDN 缓存 60 秒
    // stale-while-revalidate=120: 过期后 2 分钟内仍可使用旧数据，后台更新
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
    return response;
  } catch (err: any) {
    console.error("[GET /api/merchants] Error:", err);
    if (err.message && err.message.includes("does not exist")) {
      return ok({ items: [] });
    }
    return ok({ items: [] });
  }
}

