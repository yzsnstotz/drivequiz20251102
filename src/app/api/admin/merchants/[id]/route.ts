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
      const { name, description, address, phone, email, imageUrl, category, status } = body;

      const merchant = await db.selectFrom("merchants").selectAll().where("id", "=", id).executeTakeFirst();

      if (!merchant) return notFound("Merchant not found");

      const updateData: Record<string, any> = {
        updated_at: sql`NOW()`,
      };

      if (name !== undefined) {
        if (typeof name !== "string" || name.trim().length === 0) {
          return badRequest("name cannot be empty");
        }
        updateData.name = name.trim();
      }
      if (description !== undefined) {
        updateData.description = description?.trim() || null;
      }
      if (address !== undefined) {
        updateData.address = address?.trim() || null;
      }
      if (phone !== undefined) {
        updateData.phone = phone?.trim() || null;
      }
      if (email !== undefined) {
        updateData.email = email?.trim() || null;
      }
      if (imageUrl !== undefined) {
        updateData.image_url = imageUrl?.trim() || null;
      }
      if (category !== undefined) {
        updateData.category = category?.trim() || null;
      }
      if (status !== undefined && (status === "active" || status === "inactive")) {
        updateData.status = status;
      }

      const updated = await db.updateTable("merchants").set(updateData).where("id", "=", id).returningAll().executeTakeFirst();

      if (!updated) {
        return internalError("Failed to update merchant");
      }

      await logUpdate(req, "merchants", id, merchant, updated, `更新商户: ${updated.name}`);

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

      await logDelete(req, "merchants", id, merchant, `删除商户: ${merchant.name}`);

      return success({ deleted: 1 });
    } catch (err: any) {
      console.error("[DELETE /api/admin/merchants/:id] Error:", err);
      if (err.ok === false) return err;
      return internalError("Failed to delete merchant");
    }
  }
);

