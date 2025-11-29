/**
 * ✅ Dynamic Route Declaration
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

import { NextRequest, NextResponse } from "next/server";
import { sql } from "kysely";
import { db } from "@/lib/db";

function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

/**
 * GET /api/merchant-categories
 * 公开接口，获取商户类型列表
 */
export async function GET(request: NextRequest) {
  try {
    const rows = await db
      .selectFrom("merchant_categories")
      .selectAll()
      .where("status", "=", "active")
      .orderBy("display_order", "asc")
      .orderBy(sql`name->>'zh'`, "asc")
      .execute();

    const items = rows.map((row) => ({
      id: row.id,
      name: row.name,
      displayOrder: row.display_order,
    }));

    return ok({ items });
  } catch (err: any) {
    console.error("[GET /api/merchant-categories] Error:", err);
    if (err.message && err.message.includes("does not exist")) {
      return ok({ items: [] });
    }
    return ok({ items: [] });
  }
}

