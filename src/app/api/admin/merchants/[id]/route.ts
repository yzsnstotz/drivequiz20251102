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
import { success, badRequest, notFound, internalError } from "@/app/api/_lib/errors";
import { logUpdate, logDelete } from "@/app/api/_lib/operationLog";
import { isValidMultilangContent } from "@/lib/multilangUtils";

function toISO(v: Date | string | null | undefined): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  return v.toISOString();
}

/**
 * GET /api/admin/merchants/:id
 */
export const GET = withAdminAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id: idParam } = await params;
      const id = Number(idParam);
      if (isNaN(id)) return badRequest("Invalid ID parameter");

      const merchant = await db.selectFrom("merchants").selectAll().where("id", "=", id).executeTakeFirst();

      if (!merchant) return notFound("Merchant not found");

      return success({
        id: merchant.id,
        name: merchant.name,
        description: merchant.description || null,
        address: merchant.address || null,
        phone: merchant.phone || null,
        email: merchant.email || null,
        imageUrl: merchant.image_url || null,
        category: merchant.category || null,
        status: merchant.status,
        adStartDate: toISO(merchant.ad_start_date),
        adEndDate: toISO(merchant.ad_end_date),
        adSlot: merchant.ad_slot || null,
        createdAt: toISO(merchant.created_at) || "",
        updatedAt: toISO(merchant.updated_at) || "",
      });
    } catch (err: any) {
      console.error("[GET /api/admin/merchants/:id] Error:", err);
      if (err.ok === false) return err;
      return internalError("Failed to fetch merchant");
    }
  }
);

/**
 * PUT /api/admin/merchants/:id
 */
export const PUT = withAdminAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id: idParam } = await params;
      const id = Number(idParam);
      if (isNaN(id)) return badRequest("Invalid ID parameter");

      const body = await req.json().catch(() => ({}));
      const { name, description, address, phone, email, imageUrl, category, status, adStartDate, adEndDate, adSlot } = body;

      const merchant = await db.selectFrom("merchants").selectAll().where("id", "=", id).executeTakeFirst();

      if (!merchant) return notFound("Merchant not found");

      const updateData: Record<string, any> = {
        updated_at: sql`NOW()`,
      };

      if (name !== undefined) {
        if (!isValidMultilangContent(name)) {
          return badRequest("name must have at least one language");
        }
        // 确保 name 是对象格式
        const nameObj = typeof name === "string" 
          ? { zh: name, en: "", ja: "" } 
          : name;
        updateData.name = sql`${JSON.stringify(nameObj)}::jsonb`;
      }
      if (description !== undefined) {
        if (description === null || description === "") {
          updateData.description = null;
        } else {
          const descriptionObj = typeof description === "string" 
            ? { zh: description, en: "", ja: "" } 
            : description;
          updateData.description = sql`${JSON.stringify(descriptionObj)}::jsonb`;
        }
      }
      if (address !== undefined) {
        if (address === null || address === "") {
          updateData.address = null;
        } else {
          const addressObj = typeof address === "string" 
            ? { zh: address, en: "", ja: "" } 
            : address;
          updateData.address = sql`${JSON.stringify(addressObj)}::jsonb`;
        }
      }
      if (phone !== undefined) {
        updateData.phone = phone || null;
      }
      if (email !== undefined) {
        updateData.email = email || null;
      }
      if (imageUrl !== undefined) {
        updateData.image_url = imageUrl || null;
      }
      if (category !== undefined) {
        updateData.category = category || null;
      }
      if (status !== undefined && (status === "active" || status === "inactive")) {
        updateData.status = status;
      }
      if (adStartDate !== undefined) {
        updateData.ad_start_date = adStartDate ? sql`${adStartDate}::timestamp` : null;
      }
      if (adEndDate !== undefined) {
        updateData.ad_end_date = adEndDate ? sql`${adEndDate}::timestamp` : null;
      }
      // 验证广告位和广告时间的逻辑（仅在更新时验证）
      if (adSlot !== undefined || adStartDate !== undefined || adEndDate !== undefined) {
        // 获取最终的广告时间值（可能是新设置的，也可能是原有的）
        const finalAdStartDate = adStartDate !== undefined ? adStartDate : (merchant.ad_start_date ? merchant.ad_start_date.toISOString() : null);
        const finalAdEndDate = adEndDate !== undefined ? adEndDate : (merchant.ad_end_date ? merchant.ad_end_date.toISOString() : null);
        const finalAdSlot = adSlot !== undefined ? (adSlot && adSlot.trim() !== "" ? adSlot : null) : (merchant.ad_slot || null);

        // 如果设置了广告时间，则必须选择广告位
        if ((finalAdStartDate || finalAdEndDate) && (!finalAdSlot || finalAdSlot.trim() === "")) {
          return badRequest("设置广告时间后，请选择广告位");
        }

        // 如果选择了广告位，则必须设置广告时间
        if (finalAdSlot && finalAdSlot.trim() !== "" && (!finalAdStartDate || !finalAdEndDate)) {
          return badRequest("选择广告位后，必须设置广告开始时间和结束时间");
        }

        // 验证广告位值是否有效（如果提供了广告位）
        if (finalAdSlot && finalAdSlot.trim() !== "" && !["home_first_column", "home_second_column", "splash_screen", "popup_ad"].includes(finalAdSlot)) {
          return badRequest("无效的广告位");
        }
      }

      if (adSlot !== undefined) {
        updateData.ad_slot = (adSlot && adSlot.trim() !== "") ? adSlot : null;
      }

      const updated = await db.updateTable("merchants").set(updateData).where("id", "=", id).returningAll().executeTakeFirst();

      if (!updated) {
        return internalError("Failed to update merchant");
      }

      // 获取商户名称用于日志（优先使用中文）
      const updatedName = typeof updated.name === "object" && updated.name !== null
        ? (updated.name as any).zh || (updated.name as any).en || (updated.name as any).ja || "未知"
        : String(updated.name || "未知");
      
      await logUpdate(req, "merchants", id, merchant, updated, `更新商户: ${updatedName}`);

      return success({
        id: updated.id,
        name: updated.name,
        description: updated.description || null,
        address: updated.address || null,
        phone: updated.phone || null,
        email: updated.email || null,
        imageUrl: updated.image_url || null,
        category: updated.category || null,
        status: updated.status,
        adStartDate: toISO(updated.ad_start_date),
        adEndDate: toISO(updated.ad_end_date),
        adSlot: updated.ad_slot || null,
        createdAt: toISO(updated.created_at) || "",
        updatedAt: toISO(updated.updated_at) || "",
      });
    } catch (err: any) {
      console.error("[PUT /api/admin/merchants/:id] Error:", err);
      if (err.ok === false) return err;
      return internalError("Failed to update merchant");
    }
  }
);

/**
 * DELETE /api/admin/merchants/:id
 */
export const DELETE = withAdminAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id: idParam } = await params;
      const id = Number(idParam);
      if (isNaN(id)) return badRequest("Invalid ID parameter");

      const merchant = await db.selectFrom("merchants").selectAll().where("id", "=", id).executeTakeFirst();

      if (!merchant) return notFound("Merchant not found");

      await db.deleteFrom("merchants").where("id", "=", id).execute();

      // 获取商户名称用于日志（优先使用中文）
      const merchantName = typeof merchant.name === "object" && merchant.name !== null
        ? (merchant.name as any).zh || (merchant.name as any).en || (merchant.name as any).ja || "未知"
        : String(merchant.name || "未知");
      
      await logDelete(req, "merchants", id, merchant, `删除商户: ${merchantName}`);

      return success({ deleted: 1 });
    } catch (err: any) {
      console.error("[DELETE /api/admin/merchants/:id] Error:", err);
      if (err.ok === false) return err;
      return internalError("Failed to delete merchant");
    }
  }
);

