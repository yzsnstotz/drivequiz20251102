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
import { logCreate, logUpdate } from "@/app/api/_lib/operationLog";

function toISO(v: Date | string | null | undefined): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  return v.toISOString();
}

/**
 * GET /api/admin/terms-of-service
 */
export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    const row = await db
      .selectFrom("terms_of_service")
      .selectAll()
      .where("status", "=", "active")
      .orderBy("created_at", "desc")
      .limit(1)
      .executeTakeFirst();

    if (!row) {
      return success({ title: "", content: "", version: "" });
    }

    return success({
      id: row.id,
      title: row.title,
      content: row.content,
      version: row.version || "",
      status: row.status,
      createdAt: toISO(row.created_at) || "",
      updatedAt: toISO(row.updated_at) || "",
    });
  } catch (err: any) {
    console.error("[GET /api/admin/terms-of-service] Error:", err);
    if (err.message && err.message.includes("does not exist")) {
      return success({ title: "", content: "", version: "" });
    }
    return internalError("Failed to fetch terms of service");
  }
});

/**
 * POST /api/admin/terms-of-service
 */
export const POST = withAdminAuth(async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { title, content, version, status } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return badRequest("title is required");
    }
    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return badRequest("content is required");
    }

    // 将旧的服务条款设为 inactive
    await db
      .updateTable("terms_of_service")
      .set({
        status: "inactive",
        updated_at: sql`NOW()`,
      })
      .where("status", "=", "active")
      .execute();

    const now = new Date().toISOString();
    const inserted = await db
      .insertInto("terms_of_service")
      .values({
        title: title.trim(),
        content: content.trim(),
        version: version?.trim() || "1.0",
        status: status === "inactive" ? "inactive" : "active",
        created_at: sql`${now}::timestamp`,
        updated_at: sql`${now}::timestamp`,
      })
      .returningAll()
      .executeTakeFirst();

    if (!inserted) {
      return internalError("Failed to create terms of service");
    }

    await logCreate(req, "terms_of_service", inserted.id, inserted, `创建服务条款: ${inserted.title}`);

    return success({
      id: inserted.id,
      title: inserted.title,
      content: inserted.content,
      version: inserted.version || "",
      status: inserted.status,
      createdAt: toISO(inserted.created_at) || "",
      updatedAt: toISO(inserted.updated_at) || "",
    });
  } catch (err: any) {
    console.error("[POST /api/admin/terms-of-service] Error:", err);
    if (err && err.ok === false) return err;
    return internalError("Failed to create terms of service");
  }
});

/**
 * PUT /api/admin/terms-of-service
 */
export const PUT = withAdminAuth(async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { id, title, content, version, status } = body;

    if (!id || isNaN(Number(id))) {
      return badRequest("id is required");
    }

    const terms = await db.selectFrom("terms_of_service").selectAll().where("id", "=", Number(id)).executeTakeFirst();

    if (!terms) {
      return badRequest("Terms of service not found");
    }

    const updateData: Record<string, any> = {
      updated_at: sql`NOW()`,
    };

    if (title !== undefined) {
      if (typeof title !== "string" || title.trim().length === 0) {
        return badRequest("title cannot be empty");
      }
      updateData.title = title.trim();
    }
    if (content !== undefined) {
      if (typeof content !== "string" || content.trim().length === 0) {
        return badRequest("content cannot be empty");
      }
      updateData.content = content.trim();
    }
    if (version !== undefined) {
      updateData.version = version?.trim() || "1.0";
    }
    if (status !== undefined && (status === "active" || status === "inactive")) {
      updateData.status = status;
    }

    const updated = await db.updateTable("terms_of_service").set(updateData).where("id", "=", Number(id)).returningAll().executeTakeFirst();

    if (!updated) {
      return internalError("Failed to update terms of service");
    }

    await logUpdate(req, "terms_of_service", Number(id), terms, updated, `更新服务条款: ${updated.title}`);

    return success({
      id: updated.id,
      title: updated.title,
      content: updated.content,
      version: updated.version || "",
      status: updated.status,
      createdAt: toISO(updated.created_at) || "",
      updatedAt: toISO(updated.updated_at) || "",
    });
  } catch (err: any) {
    console.error("[PUT /api/admin/terms-of-service] Error:", err);
    if (err.ok === false) return err;
    return internalError("Failed to update terms of service");
  }
});

