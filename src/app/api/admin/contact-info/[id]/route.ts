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
 * PUT /api/admin/contact-info/:id
 */
export const PUT = withAdminAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id: idParam } = await params;
      const id = Number(idParam);
      if (isNaN(id)) return badRequest("Invalid ID parameter");

      const body = await req.json().catch(() => ({}));
      const { wechat, email, status } = body;

      const contactInfo = await db.selectFrom("contact_info").selectAll().where("id", "=", id).executeTakeFirst();

      if (!contactInfo) return notFound("Contact info not found");

      const updateData: Record<string, any> = {
        updated_at: sql`NOW()`,
      };

      if (wechat !== undefined) {
        updateData.wechat = wechat?.trim() || null;
      }
      if (email !== undefined) {
        updateData.email = email?.trim() || null;
      }
      if (status !== undefined && (status === "active" || status === "inactive")) {
        updateData.status = status;
      }

      const updated = await db.updateTable("contact_info").set(updateData).where("id", "=", id).returningAll().executeTakeFirst();

      if (!updated) {
        return internalError("Failed to update contact info");
      }

      await logUpdate(req, "contact_info", id, contactInfo, updated, `更新联系信息: ${updated.type}`);

      return success({
        id: updated.id,
        type: updated.type,
        wechat: updated.wechat || null,
        email: updated.email || null,
        status: updated.status,
        createdAt: toISO(updated.created_at) || "",
        updatedAt: toISO(updated.updated_at) || "",
      });
    } catch (err: any) {
      console.error("[PUT /api/admin/contact-info/:id] Error:", err);
      if (err.ok === false) return err;
      return internalError("Failed to update contact info");
    }
  }
);

/**
 * DELETE /api/admin/contact-info/:id
 */
export const DELETE = withAdminAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id: idParam } = await params;
      const id = Number(idParam);
      if (isNaN(id)) return badRequest("Invalid ID parameter");

      const contactInfo = await db.selectFrom("contact_info").selectAll().where("id", "=", id).executeTakeFirst();

      if (!contactInfo) return notFound("Contact info not found");

      await db.deleteFrom("contact_info").where("id", "=", id).execute();

      await logDelete(req, "contact_info", id, contactInfo, `删除联系信息: ${contactInfo.type}`);

      return success({ deleted: 1 });
    } catch (err: any) {
      console.error("[DELETE /api/admin/contact-info/:id] Error:", err);
      if (err.ok === false) return err;
      return internalError("Failed to delete contact info");
    }
  }
);

