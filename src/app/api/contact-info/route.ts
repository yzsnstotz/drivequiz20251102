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
 * GET /api/contact-info
 * 公开接口，获取联系信息
 */
export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams;
    const type = query.get("type") || "";

    let q = db.selectFrom("contact_info").selectAll().where("status", "=", "active");

    if (type && (type === "business" || type === "purchase")) {
      q = q.where("type", "=", type);
    }

    q = q.orderBy("type", "asc");

    const rows = await q.execute();

    const items = rows.map((row) => ({
      type: row.type,
      wechat: row.wechat || null,
      email: row.email || null,
    }));

    return ok({ items });
  } catch (err: any) {
    console.error("[GET /api/contact-info] Error:", err);
    // 如果表不存在，返回空数组
    if (err.message && err.message.includes("does not exist")) {
      return ok({ items: [] });
    }
    return ok({ items: [] });
  }
}

