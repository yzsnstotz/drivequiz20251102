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
      name: row.name,
      description: row.description || null,
      address: row.address || null,
      phone: row.phone || null,
      email: row.email || null,
      imageUrl: row.image_url || null,
      category: row.category || null,
    }));

    return ok({ items });
  } catch (err: any) {
    console.error("[GET /api/merchants] Error:", err);
    if (err.message && err.message.includes("does not exist")) {
      return ok({ items: [] });
    }
    return ok({ items: [] });
  }
}

