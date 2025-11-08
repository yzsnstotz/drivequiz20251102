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
 * GET /api/merchant-ads
 * 公开接口，获取有效期的商家广告
 * 查询参数：
 *   - adSlot: 广告位（如 "home_first_column"、"home_second_column"）
 *   - category: 商家分类（已废弃，保留以兼容旧代码）
 */
export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams;
    const adSlot = query.get("adSlot") || query.get("ad_slot") || "";
    const category = query.get("category") || ""; // 保留以兼容旧代码

    const now = new Date();
    console.log(`[GET /api/merchant-ads] 请求参数: adSlot=${adSlot}, category=${category}, now=${now.toISOString()}`);

    // 构建查询：获取有广告且在有效期内的商家
    let q = db
      .selectFrom("merchants")
      .selectAll()
      .where("status", "=", "active")
      .where("ad_start_date", "is not", null)
      .where("ad_end_date", "is not", null)
      .where("ad_start_date", "<=", now)
      .where("ad_end_date", ">=", now);

    // 优先使用广告位筛选
    if (adSlot) {
      console.log(`[GET /api/merchant-ads] 筛选广告位: ${adSlot}`);
      q = q.where("ad_slot", "=", adSlot);
    } else if (category) {
      // 兼容旧代码：如果指定了分类，则按分类筛选
      console.log(`[GET /api/merchant-ads] 筛选分类: ${category}`);
      q = q.where("category", "=", category);
    }

    // 按广告开始时间排序（最新的在前）
    q = q.orderBy("ad_start_date", "desc").orderBy("created_at", "desc");

    const rows = await q.execute();
    console.log(`[GET /api/merchant-ads] 查询结果数量: ${rows.length}`);

    const items = rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description || null,
      address: row.address || null,
      phone: row.phone || null,
      email: row.email || null,
      imageUrl: row.image_url || null,
      category: row.category || null,
      adSlot: row.ad_slot || null,
      adStartDate: row.ad_start_date ? row.ad_start_date.toISOString() : null,
      adEndDate: row.ad_end_date ? row.ad_end_date.toISOString() : null,
    }));

    console.log(`[GET /api/merchant-ads] 返回广告项:`, items.map(item => ({ id: item.id, name: item.name, adSlot: item.adSlot })));

    return ok({ items });
  } catch (err: any) {
    console.error("[GET /api/merchant-ads] Error:", err);
    if (err.message && err.message.includes("does not exist")) {
      return ok({ items: [] });
    }
    return ok({ items: [] });
  }
}

