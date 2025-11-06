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

function toISO(v: Date | string | null | undefined): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  return v.toISOString();
}

/**
 * GET /api/admin/contact-info
 */
export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    const sp = req.nextUrl.searchParams;
    const type = sp.get("type") || "";

    let q = db.selectFrom("contact_info").selectAll();

    if (type && (type === "business" || type === "purchase")) {
      q = q.where("type", "=", type);
    }
    q = q.where("status", "=", "active").orderBy("type", "asc");

    const rows = await q.execute();

    const items = rows.map((row) => ({
      id: row.id,
      type: row.type,
      wechat: row.wechat || null,
      email: row.email || null,
      status: row.status,
      createdAt: toISO(row.created_at) || "",
      updatedAt: toISO(row.updated_at) || "",
    }));

    return success({ items });
  } catch (err: any) {
    console.error("[GET /api/admin/contact-info] Error:", err);
    if (err.message && err.message.includes("does not exist")) {
      return success({ items: [] });
    }
    return internalError("Failed to fetch contact info");
  }
});

/**
 * POST /api/admin/contact-info
 */
export const POST = withAdminAuth(async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { type, wechat, email, status } = body;

    if (!type || (type !== "business" && type !== "purchase")) {
      return badRequest("type must be 'business' or 'purchase'");
    }

    const now = new Date().toISOString();
    const inserted = await db
      .insertInto("contact_info")
      .values({
        type: type,
        wechat: wechat?.trim() || null,
        email: email?.trim() || null,
        status: status === "inactive" ? "inactive" : "active",
        created_at: sql`${now}::timestamp`,
        updated_at: sql`${now}::timestamp`,
      })
      .returningAll()
      .executeTakeFirst();

    if (!inserted) {
      return internalError("Failed to create contact info");
    }

    await logCreate(req, "contact_info", inserted.id, inserted, `创建联系信息: ${inserted.type}`);

    return success({
      id: inserted.id,
      type: inserted.type,
      wechat: inserted.wechat || null,
      email: inserted.email || null,
      status: inserted.status,
      createdAt: toISO(inserted.created_at) || "",
      updatedAt: toISO(inserted.updated_at) || "",
    });
  } catch (err: any) {
    console.error("[POST /api/admin/contact-info] Error:", err);
    if (err && err.ok === false) return err;
    return internalError("Failed to create contact info");
  }
});

