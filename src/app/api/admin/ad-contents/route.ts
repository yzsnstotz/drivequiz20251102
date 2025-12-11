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

type Status = "draft" | "active" | "paused" | "archived";

function toISO(v: Date | string | null | undefined): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  return v.toISOString();
}

function buildTitleStrings(title: any) {
  const obj = typeof title === "string" ? { zh: title, en: "", ja: "" } : title || {};
  const zh = (obj.zh || "").trim();
  const en = (obj.en || "").trim();
  const ja = (obj.ja || "").trim();
  const fallback = zh || en || ja || "";
  return { fallback, zh: zh || null, en: en || null, ja: ja || null };
}

function buildDescStrings(desc: any) {
  if (!desc) return { fallback: null, zh: null, en: null, ja: null };
  const obj = typeof desc === "string" ? { zh: desc, en: "", ja: "" } : desc;
  const zh = (obj.zh || "").trim();
  const en = (obj.en || "").trim();
  const ja = (obj.ja || "").trim();
  const fallback = zh || en || ja || null;
  return { fallback, zh: zh || null, en: en || null, ja: ja || null };
}

async function ensureSlot(position: string) {
  const slot = await db
    .selectFrom("ad_slots")
    .selectAll()
    .where("position", "=", position)
    .executeTakeFirst();

  if (slot) return slot;

  const inserted = await db
    .insertInto("ad_slots")
    .values({
      position,
      name: "Home Banner",
      name_zh: "首页顶部横幅",
      name_en: "Home Banner",
      name_ja: "ホームバナー",
      description: "首页顶部横幅广告位",
      format: "banner",
      status: "active",
      created_at: sql`NOW()`,
      updated_at: sql`NOW()`,
    })
    .returningAll()
    .executeTakeFirst();

  if (!inserted) {
    throw new Error("Failed to ensure ad slot");
  }
  return inserted;
}

/**
 * GET /api/admin/ad-contents?slotKey=home_banner
 */
export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    const sp = req.nextUrl.searchParams;
    const slotKey = (sp.get("slotKey") || "home_banner").trim();
    const status = (sp.get("status") || "").trim() as Status | "";

    const slot = await ensureSlot(slotKey);

    let q = db
      .selectFrom("ad_contents")
      .selectAll()
      .where("slot_id", "=", slot.id)
      .orderBy("priority", "desc")
      .orderBy("weight", "desc")
      .orderBy("created_at", "desc");

    if (status && ["draft", "active", "paused", "archived"].includes(status)) {
      q = q.where("status", "=", status);
    }

    const rows = await q.execute();

    const items = rows.map((row) => ({
      id: row.id,
      slotKey,
      title: {
        zh: row.title_zh,
        en: row.title_en,
        ja: row.title_ja,
        default: row.title,
      },
      description: {
        zh: row.description_zh,
        en: row.description_en,
        ja: row.description_ja,
        default: row.description,
      },
      imageUrl: row.image_url,
      linkUrl: row.link_url,
      startDate: toISO(row.start_date),
      endDate: toISO(row.end_date),
      priority: row.priority,
      weight: row.weight,
      status: row.status as Status,
      createdAt: toISO(row.created_at),
      updatedAt: toISO(row.updated_at),
    }));

    return success({ items });
  } catch (err: any) {
    console.error("[GET /api/admin/ad-contents] Error:", err);
    if (err.message && err.message.includes("does not exist")) {
      return success({ items: [] });
    }
    return internalError("Failed to fetch ad contents");
  }
});

/**
 * POST /api/admin/ad-contents
 */
export const POST = withAdminAuth(async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      slotKey = "home_banner",
      title,
      description,
      imageUrl,
      linkUrl,
      startDate,
      endDate,
      priority,
      weight,
      status,
    } = body || {};

    if (!title || !isValidMultilangContent(title)) {
      return badRequest("title is required and must have at least one language");
    }
    if (!imageUrl || typeof imageUrl !== "string") {
      return badRequest("imageUrl is required");
    }
    if (!linkUrl || typeof linkUrl !== "string") {
      return badRequest("linkUrl is required");
    }

    const slot = await ensureSlot(slotKey);

    const titleStrings = buildTitleStrings(title);
    const descStrings = buildDescStrings(description);
    const safePriority = Number.isFinite(Number(priority)) ? Number(priority) : 0;
    const safeWeight = Number.isFinite(Number(weight)) ? Number(weight) : 1;
    const safeStatus: Status = ["draft", "active", "paused", "archived"].includes(status) ? status : "active";

    const inserted = await db
      .insertInto("ad_contents")
      .values({
        slot_id: slot.id,
        title: titleStrings.fallback,
        title_zh: titleStrings.zh,
        title_en: titleStrings.en,
        title_ja: titleStrings.ja,
        description: descStrings.fallback,
        description_zh: descStrings.zh,
        description_en: descStrings.en,
        description_ja: descStrings.ja,
        image_url: imageUrl,
        link_url: linkUrl,
        start_date: startDate ? sql`${startDate}::date` : null,
        end_date: endDate ? sql`${endDate}::date` : null,
        priority: safePriority,
        weight: safeWeight,
        status: safeStatus,
        created_at: sql`NOW()`,
        updated_at: sql`NOW()`,
      })
      .returningAll()
      .executeTakeFirst();

    if (!inserted) {
      return internalError("Failed to create ad content");
    }

    await logCreate(req, "ad_contents", inserted.id, inserted, `创建广告内容(${slotKey})`);

    return success({
      id: inserted.id,
      slotKey,
    });
  } catch (err: any) {
    console.error("[POST /api/admin/ad-contents] Error:", err);
    if (err && err.ok === false) return err;
    return internalError("Failed to create ad content");
  }
});

/**
 * PUT /api/admin/ad-contents
 */
export const PUT = withAdminAuth(async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      id,
      slotKey = "home_banner",
      title,
      description,
      imageUrl,
      linkUrl,
      startDate,
      endDate,
      priority,
      weight,
      status,
    } = body || {};

    if (!id || typeof id !== "number") {
      return badRequest("id is required");
    }
    if (!title || !isValidMultilangContent(title)) {
      return badRequest("title is required and must have at least one language");
    }
    if (!imageUrl || typeof imageUrl !== "string") {
      return badRequest("imageUrl is required");
    }
    if (!linkUrl || typeof linkUrl !== "string") {
      return badRequest("linkUrl is required");
    }

    const slot = await ensureSlot(slotKey);

    const existing = await db
      .selectFrom("ad_contents")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    if (!existing) {
      return badRequest("Ad content not found");
    }

    const titleStrings = buildTitleStrings(title);
    const descStrings = buildDescStrings(description);
    const safePriority = Number.isFinite(Number(priority)) ? Number(priority) : existing.priority;
    const safeWeight = Number.isFinite(Number(weight)) ? Number(weight) : existing.weight;
    const safeStatus: Status = ["draft", "active", "paused", "archived"].includes(status) ? status : (existing.status as Status);

    const updated = await db
      .updateTable("ad_contents")
      .set({
        slot_id: slot.id,
        title: titleStrings.fallback,
        title_zh: titleStrings.zh,
        title_en: titleStrings.en,
        title_ja: titleStrings.ja,
        description: descStrings.fallback,
        description_zh: descStrings.zh,
        description_en: descStrings.en,
        description_ja: descStrings.ja,
        image_url: imageUrl,
        link_url: linkUrl,
        start_date: startDate ? sql`${startDate}::date` : null,
        end_date: endDate ? sql`${endDate}::date` : null,
        priority: safePriority,
        weight: safeWeight,
        status: safeStatus,
        updated_at: sql`NOW()`,
      })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();

    if (!updated) {
      return internalError("Failed to update ad content");
    }

    await logUpdate(req, "ad_contents", updated.id, existing, updated, `更新广告内容(${slotKey})`);

    return success({
      id: updated.id,
      slotKey,
    });
  } catch (err: any) {
    console.error("[PUT /api/admin/ad-contents] Error:", err);
    if (err && err.ok === false) return err;
    return internalError("Failed to update ad content");
  }
});

/**
 * DELETE /api/admin/ad-contents?id=123
 */
export const DELETE = withAdminAuth(async (req: NextRequest) => {
  try {
    const sp = req.nextUrl.searchParams;
    const id = Number(sp.get("id") || 0);

    if (!id) {
      return badRequest("id is required");
    }

    const existing = await db
      .selectFrom("ad_contents")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    if (!existing) {
      return badRequest("Ad content not found");
    }

    await db.deleteFrom("ad_contents").where("id", "=", id).execute();
    await logDelete(req, "ad_contents", id, existing, `删除广告内容(${id})`);

    return success({ id });
  } catch (err: any) {
    console.error("[DELETE /api/admin/ad-contents] Error:", err);
    if (err && err.ok === false) return err;
    return internalError("Failed to delete ad content");
  }
});

