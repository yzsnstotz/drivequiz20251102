/**
 * ✅ Dynamic Route Declaration
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

import { NextRequest } from "next/server";
import { sql } from "kysely";
import { db } from "@/lib/db";
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { success, badRequest, internalError } from "@/app/api/_lib/errors";
import { parsePagination, getPaginationMeta } from "@/app/api/_lib/pagination";
import { logCreate, logUpdate, logDelete } from "@/app/api/_lib/operationLog";
import { isValidMultilangContent } from "@/lib/multilangUtils";

type MerchantSortKey = "createdAt" | "name" | "status";

const SORT_WHITELIST = new Set<MerchantSortKey>(["createdAt", "name", "status"]);

function mapSort(key: MerchantSortKey): "created_at" | "name" | "status" {
  switch (key) {
    case "name":
      return "name";
    case "status":
      return "status";
    case "createdAt":
    default:
      return "created_at";
  }
}

function toISO(v: Date | string | null | undefined): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  return v.toISOString();
}

/**
 * GET /api/admin/merchants
 */
export const GET = withAdminAuth(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  try {
    const name = (sp.get("name") || "").trim();
    const status = sp.get("status") || "";

    const { page, limit, sortBy, order } = parsePagination(sp) as {
      page?: number;
      limit?: number;
      sortBy?: string | null;
      order?: "asc" | "desc";
    };

    const safePage = Number(page) > 0 ? Number(page) : 1;
    const safeLimit = Number(limit) > 0 ? Number(limit) : 20;
    const offset = (safePage - 1) * safeLimit;

    const sortKey: MerchantSortKey = (sortBy as MerchantSortKey) || "createdAt";
    if (!SORT_WHITELIST.has(sortKey)) {
      return badRequest("Invalid sortBy");
    }
    const sortColumn = mapSort(sortKey);
    const sortOrder: "asc" | "desc" = order === "asc" ? "asc" : "desc";

    // 计数查询
    let countQ = db.selectFrom("merchants").select((eb) => eb.fn.countAll<number>().as("count"));

    if (name) {
      // JSONB 字段搜索：在 zh 字段中搜索
      countQ = countQ.where(sql`name->>'zh'`, "like", `%${name}%`);
    }
    if (status && (status === "active" || status === "inactive")) {
      countQ = countQ.where("status", "=", status);
    }

    const countRow = await countQ.executeTakeFirst();
    const total = Number(countRow?.count ?? 0);

    // 主查询
    let q = db
      .selectFrom("merchants")
      .selectAll();

    if (name) {
      // JSONB 字段搜索：在 zh 字段中搜索
      q = q.where(sql`name->>'zh'`, "like", `%${name}%`);
    }
    if (status && (status === "active" || status === "inactive")) {
      q = q.where("status", "=", status);
    }

    q = q.orderBy(sortColumn, sortOrder).limit(safeLimit).offset(offset);

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
      status: row.status,
      adStartDate: toISO(row.ad_start_date),
      adEndDate: toISO(row.ad_end_date),
      adSlot: row.ad_slot || null,
      createdAt: toISO(row.created_at) || "",
      updatedAt: toISO(row.updated_at) || "",
    }));

      return success({
        items,
        pagination: getPaginationMeta(safePage, safeLimit, total),
      });
    } catch (err: any) {
      console.error("[GET /api/admin/merchants] Error:", err);
      // 如果表不存在，返回空数组
      if (err.message && (err.message.includes("does not exist") || err.message.includes("relation"))) {
        // 在 catch 块中重新解析分页参数，因为 safePage 和 safeLimit 可能在 try 块外不可用
        const { page, limit } = parsePagination(sp);
        const fallbackPage = Number(page) > 0 ? Number(page) : 1;
        const fallbackLimit = Number(limit) > 0 ? Number(limit) : 20;
        return success({ items: [], pagination: getPaginationMeta(fallbackPage, fallbackLimit, 0) });
      }
      return internalError("Failed to fetch merchants");
    }
});

/**
 * POST /api/admin/merchants
 */
export const POST = withAdminAuth(async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { name, description, address, phone, email, imageUrl, category, status, adStartDate, adEndDate, adSlot } = body;

    // 验证多语言字段
    if (!name || !isValidMultilangContent(name)) {
      return badRequest("name is required and must have at least one language");
    }
    
    // 确保 name 是对象格式
    const nameObj = typeof name === "string" 
      ? { zh: name, en: "", ja: "" } 
      : name;
    
    // 验证 description 和 address（可选）
    const descriptionObj = description 
      ? (typeof description === "string" ? { zh: description, en: "", ja: "" } : description)
      : null;
    
    const addressObj = address 
      ? (typeof address === "string" ? { zh: address, en: "", ja: "" } : address)
      : null;

    // 验证广告位：如果设置了广告时间，则必须选择广告位
    if ((adStartDate || adEndDate) && (!adSlot || adSlot.trim() === "")) {
      return badRequest("设置广告时间后，请选择广告位");
    }

    // 验证广告位：如果选择了广告位，则必须设置广告时间
    if (adSlot && adSlot.trim() !== "" && (!adStartDate || !adEndDate)) {
      return badRequest("选择广告位后，必须设置广告开始时间和结束时间");
    }

    // 验证广告位值是否有效（如果提供了广告位）
    if (adSlot && adSlot.trim() !== "" && !["home_first_column", "home_second_column", "splash_screen", "popup_ad"].includes(adSlot)) {
      return badRequest("无效的广告位");
    }

    const now = new Date().toISOString();
    const inserted = await db
      .insertInto("merchants")
      .values({
        name: sql`${JSON.stringify(nameObj)}::jsonb`,
        description: descriptionObj ? sql`${JSON.stringify(descriptionObj)}::jsonb` : null,
        address: addressObj ? sql`${JSON.stringify(addressObj)}::jsonb` : null,
        phone: phone || null,
        email: email || null,
        image_url: imageUrl || null,
        category: category || null,
        status: status === "inactive" ? "inactive" : "active",
        ad_start_date: adStartDate ? sql`${adStartDate}::timestamp` : null,
        ad_end_date: adEndDate ? sql`${adEndDate}::timestamp` : null,
        ad_slot: (adSlot && adSlot.trim() !== "") ? adSlot : null,
        created_at: sql`${now}::timestamp`,
        updated_at: sql`${now}::timestamp`,
      })
      .returningAll()
      .executeTakeFirst();

    if (!inserted) {
      return internalError("Failed to create merchant");
    }

    // 获取商户名称用于日志（优先使用中文）
    const merchantName = typeof inserted.name === "object" && inserted.name !== null
      ? (inserted.name as any).zh || (inserted.name as any).en || (inserted.name as any).ja || "未知"
      : String(inserted.name || "未知");
    
    await logCreate(req, "merchants", inserted.id, inserted, `创建商户: ${merchantName}`);

    return success({
      id: inserted.id,
      name: inserted.name,
      description: inserted.description || null,
      address: inserted.address || null,
      phone: inserted.phone || null,
      email: inserted.email || null,
      imageUrl: inserted.image_url || null,
      category: inserted.category || null,
      status: inserted.status,
      adStartDate: toISO(inserted.ad_start_date),
      adEndDate: toISO(inserted.ad_end_date),
      adSlot: inserted.ad_slot || null,
      createdAt: toISO(inserted.created_at) || "",
      updatedAt: toISO(inserted.updated_at) || "",
    });
  } catch (err: any) {
    console.error("[POST /api/admin/merchants] Error:", err);
    if (err && err.ok === false) return err;
    return internalError("Failed to create merchant");
  }
});

