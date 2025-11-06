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
 * GET /api/admin/videos/:id
 */
export const GET = withAdminAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id: idParam } = await params;
      const id = Number(idParam);
      if (isNaN(id)) return badRequest("Invalid ID parameter");

      const video = await db.selectFrom("videos").selectAll().where("id", "=", id).executeTakeFirst();

      if (!video) return notFound("Video not found");

      return success({
        id: video.id,
        title: video.title,
        description: video.description || null,
        url: video.url,
        thumbnail: video.thumbnail || null,
        category: video.category,
        displayOrder: video.display_order,
        status: video.status,
        createdAt: toISO(video.created_at) || "",
        updatedAt: toISO(video.updated_at) || "",
      });
    } catch (err: any) {
      console.error("[GET /api/admin/videos/:id] Error:", err);
      if (err.ok === false) return err;
      return internalError("Failed to fetch video");
    }
  }
);

/**
 * PUT /api/admin/videos/:id
 */
export const PUT = withAdminAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id: idParam } = await params;
      const id = Number(idParam);
      if (isNaN(id)) return badRequest("Invalid ID parameter");

      const body = await req.json().catch(() => ({}));
      const { title, description, url, thumbnail, category, displayOrder, status } = body;

      const video = await db.selectFrom("videos").selectAll().where("id", "=", id).executeTakeFirst();

      if (!video) return notFound("Video not found");

      const updateData: Record<string, any> = {
        updated_at: sql`NOW()`,
      };

      if (title !== undefined) {
        if (typeof title !== "string" || title.trim().length === 0) {
          return badRequest("title cannot be empty");
        }
        updateData.title = title.trim();
      }
      if (description !== undefined) {
        updateData.description = description?.trim() || null;
      }
      if (url !== undefined) {
        if (typeof url !== "string" || url.trim().length === 0) {
          return badRequest("url cannot be empty");
        }
        updateData.url = url.trim();
      }
      if (thumbnail !== undefined) {
        updateData.thumbnail = thumbnail?.trim() || null;
      }
      if (category !== undefined) {
        if (category !== "basic" && category !== "advanced") {
          return badRequest("category must be 'basic' or 'advanced'");
        }
        updateData.category = category;
      }
      if (displayOrder !== undefined) {
        updateData.display_order = Number(displayOrder) || 0;
      }
      if (status !== undefined && (status === "active" || status === "inactive")) {
        updateData.status = status;
      }

      const updated = await db.updateTable("videos").set(updateData).where("id", "=", id).returningAll().executeTakeFirst();

      if (!updated) {
        return internalError("Failed to update video");
      }

      await logUpdate(req, "videos", id, video, updated, `更新视频: ${updated.title}`);

      return success({
        id: updated.id,
        title: updated.title,
        description: updated.description || null,
        url: updated.url,
        thumbnail: updated.thumbnail || null,
        category: updated.category,
        displayOrder: updated.display_order,
        status: updated.status,
        createdAt: toISO(updated.created_at) || "",
        updatedAt: toISO(updated.updated_at) || "",
      });
    } catch (err: any) {
      console.error("[PUT /api/admin/videos/:id] Error:", err);
      if (err.ok === false) return err;
      return internalError("Failed to update video");
    }
  }
);

/**
 * DELETE /api/admin/videos/:id
 */
export const DELETE = withAdminAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id: idParam } = await params;
      const id = Number(idParam);
      if (isNaN(id)) return badRequest("Invalid ID parameter");

      const video = await db.selectFrom("videos").selectAll().where("id", "=", id).executeTakeFirst();

      if (!video) return notFound("Video not found");

      await db.deleteFrom("videos").where("id", "=", id).execute();

      await logDelete(req, "videos", id, video, `删除视频: ${video.title}`);

      return success({ deleted: 1 });
    } catch (err: any) {
      console.error("[DELETE /api/admin/videos/:id] Error:", err);
      if (err.ok === false) return err;
      return internalError("Failed to delete video");
    }
  }
);

