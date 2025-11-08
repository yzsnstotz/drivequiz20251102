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
import { logUpdate } from "@/app/api/_lib/operationLog";

function toISO(v: Date | string | null | undefined): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  return v.toISOString();
}

/**
 * GET /api/admin/ad-slots
 */
export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    const rows = await db
      .selectFrom("ad_slots_config")
      .selectAll()
      .orderBy("slot_key", "asc")
      .execute();

    const items = rows.map((row) => ({
      id: row.id,
      slotKey: row.slot_key,
      title: row.title,
      description: row.description || null,
      splashDuration: row.splash_duration || 3,
      isEnabled: row.is_enabled,
      createdAt: toISO(row.created_at) || "",
      updatedAt: toISO(row.updated_at) || "",
    }));

    return success({ items });
  } catch (err: any) {
    console.error("[GET /api/admin/ad-slots] Error:", err);
    if (err.message && err.message.includes("does not exist")) {
      return success({ items: [] });
    }
    return internalError("Failed to fetch ad slots");
  }
});

/**
 * POST /api/admin/ad-slots
 * 初始化广告位配置
 */
export const POST = withAdminAuth(async (req: NextRequest) => {
  try {
    const defaultSlots = [
      {
        slot_key: "home_first_column",
        title: "首页第一栏",
        description: "精选商家推荐",
        splash_duration: 3,
        is_enabled: true,
      },
      {
        slot_key: "home_second_column",
        title: "首页第二栏",
        description: "优质商家推荐",
        splash_duration: 3,
        is_enabled: true,
      },
      {
        slot_key: "splash_screen",
        title: "启动页广告",
        description: "应用启动时显示的广告",
        splash_duration: 3,
        is_enabled: true,
      },
      {
        slot_key: "popup_ad",
        title: "启动弹窗广告",
        description: "首次启动首页后显示的弹窗广告",
        splash_duration: 3,
        is_enabled: true,
      },
    ];

    const results = [];
    for (const slot of defaultSlots) {
      try {
        const existing = await db
          .selectFrom("ad_slots_config")
          .selectAll()
          .where("slot_key", "=", slot.slot_key)
          .executeTakeFirst();

        if (!existing) {
          const inserted = await db
            .insertInto("ad_slots_config")
            .values({
              slot_key: slot.slot_key,
              title: slot.title,
              description: slot.description,
              splash_duration: slot.splash_duration,
              is_enabled: slot.is_enabled,
              created_at: sql`NOW()`,
              updated_at: sql`NOW()`,
            })
            .returningAll()
            .executeTakeFirst();

          if (inserted) {
            results.push({
              slotKey: inserted.slot_key,
              action: "created",
            });
          }
        } else {
          results.push({
            slotKey: slot.slot_key,
            action: "exists",
          });
        }
      } catch (err: any) {
        console.error(`[POST /api/admin/ad-slots] Error creating ${slot.slot_key}:`, err);
        results.push({
          slotKey: slot.slot_key,
          action: "error",
          error: err.message,
        });
      }
    }

    return success({ results });
  } catch (err: any) {
    console.error("[POST /api/admin/ad-slots] Error:", err);
    return internalError("Failed to initialize ad slots");
  }
});

/**
 * PUT /api/admin/ad-slots
 */
export const PUT = withAdminAuth(async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { slotKey, title, description, splashDuration, isEnabled } = body;

    if (!slotKey || typeof slotKey !== "string") {
      return badRequest("slotKey is required");
    }

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return badRequest("title is required");
    }

    const existing = await db
      .selectFrom("ad_slots_config")
      .selectAll()
      .where("slot_key", "=", slotKey)
      .executeTakeFirst();

    if (!existing) {
      return badRequest("Ad slot not found");
    }

    const updateData: Record<string, any> = {
      title: title.trim(),
      description: description?.trim() || null,
      is_enabled: isEnabled === false ? false : true,
      updated_at: sql`NOW()`,
    };

    // 如果是启动页广告，更新持续时间
    if (slotKey === "splash_screen" && splashDuration !== undefined) {
      const duration = Number(splashDuration);
      if (duration >= 1 && duration <= 10) {
        updateData.splash_duration = duration;
      }
    }

    const updated = await db
      .updateTable("ad_slots_config")
      .set(updateData)
      .where("slot_key", "=", slotKey)
      .returningAll()
      .executeTakeFirst();

    if (!updated) {
      return internalError("Failed to update ad slot");
    }

    await logUpdate(req, "ad_slots_config", updated.id, existing, updated, `更新广告栏: ${updated.title}`);

    return success({
      id: updated.id,
      slotKey: updated.slot_key,
      title: updated.title,
      description: updated.description || null,
      splashDuration: updated.splash_duration || 3,
      isEnabled: updated.is_enabled,
      createdAt: toISO(updated.created_at) || "",
      updatedAt: toISO(updated.updated_at) || "",
    });
  } catch (err: any) {
    console.error("[PUT /api/admin/ad-slots] Error:", err);
    if (err && err.ok === false) return err;
    return internalError("Failed to update ad slot");
  }
});

