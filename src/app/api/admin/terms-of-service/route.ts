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
import { isValidMultilangContent } from "@/lib/multilangUtils";

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

    // 验证多语言字段
    if (!title || !isValidMultilangContent(title)) {
      return badRequest("title is required and must have at least one language");
    }
    if (!content || !isValidMultilangContent(content)) {
      return badRequest("content is required and must have at least one language");
    }
    
    // 确保 title 和 content 是对象格式
    const titleObj = typeof title === "string" 
      ? { zh: title, en: "", ja: "" } 
      : title;
    
    const contentObj = typeof content === "string" 
      ? { zh: content, en: "", ja: "" } 
      : content;

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
        title: sql`${JSON.stringify(titleObj)}::jsonb`,
        content: sql`${JSON.stringify(contentObj)}::jsonb`,
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

    // 获取服务条款标题用于日志（优先使用中文）
    const termsTitle = typeof inserted.title === "object" && inserted.title !== null
      ? (inserted.title as any).zh || (inserted.title as any).en || (inserted.title as any).ja || "未知"
      : String(inserted.title || "未知");
    
    await logCreate(req, "terms_of_service", inserted.id, inserted, `创建服务条款: ${termsTitle}`);

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
      if (!isValidMultilangContent(title)) {
        return badRequest("title must have at least one language");
      }
      // 确保 title 是对象格式
      const titleObj = typeof title === "string" 
        ? { zh: title, en: "", ja: "" } 
        : title;
      updateData.title = sql`${JSON.stringify(titleObj)}::jsonb`;
    }
    if (content !== undefined) {
      if (!isValidMultilangContent(content)) {
        return badRequest("content must have at least one language");
      }
      // 确保 content 是对象格式
      const contentObj = typeof content === "string" 
        ? { zh: content, en: "", ja: "" } 
        : content;
      updateData.content = sql`${JSON.stringify(contentObj)}::jsonb`;
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

    // 获取服务条款标题用于日志（优先使用中文）
    const updatedTitle = typeof updated.title === "object" && updated.title !== null
      ? (updated.title as any).zh || (updated.title as any).en || (updated.title as any).ja || "未知"
      : String(updated.title || "未知");
    
    await logUpdate(req, "terms_of_service", Number(id), terms, updated, `更新服务条款: ${updatedTitle}`);

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

