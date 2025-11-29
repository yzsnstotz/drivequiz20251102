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
 * PUT /api/admin/merchant-categories/:id
 */
export const PUT = withAdminAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id: idParam } = await params;
      const id = Number(idParam);
      if (isNaN(id)) return badRequest("Invalid ID parameter");

      const body = await req.json().catch(() => ({}));
      const { name, displayOrder, status } = body;

      const category = await db.selectFrom("merchant_categories").selectAll().where("id", "=", id).executeTakeFirst();

      if (!category) return notFound("Merchant category not found");

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
      if (displayOrder !== undefined) {
        updateData.display_order = Number(displayOrder) || 0;
      }
      if (status !== undefined && (status === "active" || status === "inactive")) {
        updateData.status = status;
      }

      const updated = await db.updateTable("merchant_categories").set(updateData).where("id", "=", id).returningAll().executeTakeFirst();

      if (!updated) {
        return internalError("Failed to update merchant category");
      }

      // 获取分类名称用于日志（优先使用中文）
      const updatedName = typeof updated.name === "object" && updated.name !== null
        ? (updated.name as any).zh || (updated.name as any).en || (updated.name as any).ja || "未知"
        : String(updated.name || "未知");
      
      await logUpdate(req, "merchant_categories", id, category, updated, `更新商户类型: ${updatedName}`);

      return success({
        id: updated.id,
        name: updated.name,
        displayOrder: updated.display_order,
        status: updated.status,
        createdAt: toISO(updated.created_at) || "",
        updatedAt: toISO(updated.updated_at) || "",
      });
    } catch (err: any) {
      console.error("[PUT /api/admin/merchant-categories/:id] Error:", err);
      if (err.ok === false) return err;
      return internalError("Failed to update merchant category");
    }
  }
);

/**
 * DELETE /api/admin/merchant-categories/:id
 */
export const DELETE = withAdminAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id: idParam } = await params;
      const id = Number(idParam);
      if (isNaN(id)) return badRequest("Invalid ID parameter");

      const category = await db.selectFrom("merchant_categories").selectAll().where("id", "=", id).executeTakeFirst();

      if (!category) return notFound("Merchant category not found");

      await db.deleteFrom("merchant_categories").where("id", "=", id).execute();

      // 获取分类名称用于日志（优先使用中文）
      const categoryName = typeof category.name === "object" && category.name !== null
        ? (category.name as any).zh || (category.name as any).en || (category.name as any).ja || "未知"
        : String(category.name || "未知");
      
      await logDelete(req, "merchant_categories", id, category, `删除商户类型: ${categoryName}`);

      return success({ deleted: 1 });
    } catch (err: any) {
      console.error("[DELETE /api/admin/merchant-categories/:id] Error:", err);
      if (err.ok === false) return err;
      return internalError("Failed to delete merchant category");
    }
  }
);

