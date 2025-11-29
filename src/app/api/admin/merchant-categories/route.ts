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
import { logCreate, logUpdate, logDelete } from "@/app/api/_lib/operationLog";
import { isValidMultilangContent } from "@/lib/multilangUtils";

function toISO(v: Date | string | null | undefined): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  return v.toISOString();
}

/**
 * GET /api/admin/merchant-categories
 */
export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    const sp = req.nextUrl.searchParams;
    const status = sp.get("status") || "";

    let q = db.selectFrom("merchant_categories").selectAll();

    if (status && (status === "active" || status === "inactive")) {
      q = q.where("status", "=", status);
    }

    q = q.orderBy("display_order", "asc").orderBy(sql`name->>'zh'`, "asc");

    const rows = await q.execute();

    const items = rows.map((row) => ({
      id: row.id,
      name: row.name,
      displayOrder: row.display_order,
      status: row.status,
      createdAt: toISO(row.created_at) || "",
      updatedAt: toISO(row.updated_at) || "",
    }));

    return success({ items });
  } catch (err: any) {
    console.error("[GET /api/admin/merchant-categories] Error:", err);
    if (err.message && (err.message.includes("does not exist") || err.message.includes("relation"))) {
      return success({ items: [] });
    }
    return internalError("Failed to fetch merchant categories");
  }
});

/**
 * POST /api/admin/merchant-categories
 */
export const POST = withAdminAuth(async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { name, displayOrder, status } = body;

    // 验证多语言字段
    if (!name || !isValidMultilangContent(name)) {
      return badRequest("name is required and must have at least one language");
    }
    
    // 确保 name 是对象格式
    const nameObj = typeof name === "string" 
      ? { zh: name, en: "", ja: "" } 
      : name;

    const now = new Date().toISOString();
    const inserted = await db
      .insertInto("merchant_categories")
      .values({
        name: sql`${JSON.stringify(nameObj)}::jsonb`,
        display_order: Number(displayOrder) || 0,
        status: status === "inactive" ? "inactive" : "active",
        created_at: sql`${now}::timestamp`,
        updated_at: sql`${now}::timestamp`,
      })
      .returningAll()
      .executeTakeFirst();

    if (!inserted) {
      return internalError("Failed to create merchant category");
    }

    // 获取分类名称用于日志（优先使用中文）
    const categoryName = typeof inserted.name === "object" && inserted.name !== null
      ? (inserted.name as any).zh || (inserted.name as any).en || (inserted.name as any).ja || "未知"
      : String(inserted.name || "未知");
    
    await logCreate(req, "merchant_categories", inserted.id, inserted, `创建商户类型: ${categoryName}`);

    return success({
      id: inserted.id,
      name: inserted.name,
      displayOrder: inserted.display_order,
      status: inserted.status,
      createdAt: toISO(inserted.created_at) || "",
      updatedAt: toISO(inserted.updated_at) || "",
    });
  } catch (err: any) {
    console.error("[POST /api/admin/merchant-categories] Error:", err);
    if (err && err.ok === false) return err;
    return internalError("Failed to create merchant category");
  }
});

