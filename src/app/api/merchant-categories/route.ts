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
import { executeSafely } from "@/lib/dbUtils";

function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

/**
 * GET /api/merchant-categories
 * 公开接口，获取商户类型列表
 */
export async function GET(request: NextRequest) {
  const items = await executeSafely(
    async () => {
      const rows = await db
        .selectFrom("merchant_categories")
        .selectAll()
        .where("status", "=", "active")
        .orderBy("display_order", "asc")
        .orderBy(sql`name->>'zh'`, "asc")
        .execute();

      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        displayOrder: row.display_order,
      }));
    },
    [] // 默认返回空数组
  );

  const response = ok({ items });
  // 添加 HTTP 缓存头：分类数据变化少，缓存 5 分钟
  // s-maxage=300: CDN 缓存 5 分钟
  // stale-while-revalidate=600: 过期后 10 分钟内仍可使用旧数据，后台更新
  response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  return response;
}

