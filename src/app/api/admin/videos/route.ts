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
import { parsePagination, getPaginationMeta } from "@/app/api/_lib/pagination";
import { logCreate, logUpdate, logDelete } from "@/app/api/_lib/operationLog";

type VideoSortKey = "createdAt" | "title" | "category" | "displayOrder";

const SORT_WHITELIST = new Set<VideoSortKey>(["createdAt", "title", "category", "displayOrder"]);

function mapSort(key: VideoSortKey): "created_at" | "title" | "category" | "display_order" {
  switch (key) {
    case "title":
      return "title";
    case "category":
      return "category";
    case "displayOrder":
      return "display_order";
    case "createdAt":
    default:
      return "created_at";
  }
}

function toISO(v: Date | string | null | undefined): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  return v.toISOString();
}

/**
 * GET /api/admin/videos
 */
export const GET = withAdminAuth(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  try {
    const title = (sp.get("title") || "").trim();
    const category = sp.get("category") || "";
    const status = sp.get("status") || "";

    const { page, limit, sortBy, order } = parsePagination(sp) as {
      page?: number;
      limit?: number;
      sortBy?: string | null;
      order?: "asc" | "desc";
    };

    const safePage = Number(page) > 0 ? Number(page) : 1;
    const safeLimit = Number(limit) > 0 ? Number(limit) : 20;
    const offset = (safePage - 1) * safeLimit;

    const sortKey: VideoSortKey = (sortBy as VideoSortKey) || "displayOrder";
    if (!SORT_WHITELIST.has(sortKey)) {
      return badRequest("Invalid sortBy");
    }
    const sortColumn = mapSort(sortKey);
    const sortOrder: "asc" | "desc" = order === "asc" ? "asc" : "desc";

    // 计数查询
    let countQ = db.selectFrom("videos").select((eb) => eb.fn.countAll<number>().as("count"));

    if (title) {
      countQ = countQ.where("title", "like", `%${title}%`);
    }
    if (category && (category === "basic" || category === "advanced")) {
      countQ = countQ.where("category", "=", category);
    }
    if (status && (status === "active" || status === "inactive")) {
      countQ = countQ.where("status", "=", status);
    }

    const countRow = await countQ.executeTakeFirst();
    const total = Number(countRow?.count ?? 0);

    // 主查询
    let q = db.selectFrom("videos").selectAll();

    if (title) {
      q = q.where("title", "like", `%${title}%`);
    }
    if (category && (category === "basic" || category === "advanced")) {
      q = q.where("category", "=", category);
    }
    if (status && (status === "active" || status === "inactive")) {
      q = q.where("status", "=", status);
    }

    q = q.orderBy(sortColumn, sortOrder).limit(safeLimit).offset(offset);

    const rows = await q.execute();

    const items = rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description || null,
      url: row.url,
      thumbnail: row.thumbnail || null,
      category: row.category,
      displayOrder: row.display_order,
      status: row.status,
      createdAt: toISO(row.created_at) || "",
      updatedAt: toISO(row.updated_at) || "",
    }));

      return success({
        items,
        pagination: getPaginationMeta(safePage, safeLimit, total),
      });
    } catch (err: any) {
      console.error("[GET /api/admin/videos] Error:", err);
      // 如果表不存在，返回空数组
      if (err.message && (err.message.includes("does not exist") || err.message.includes("relation"))) {
        // 在 catch 块中重新解析分页参数，因为 safePage 和 safeLimit 可能在 try 块外不可用
        const { page, limit } = parsePagination(sp);
        const fallbackPage = Number(page) > 0 ? Number(page) : 1;
        const fallbackLimit = Number(limit) > 0 ? Number(limit) : 20;
        return success({ items: [], pagination: getPaginationMeta(fallbackPage, fallbackLimit, 0) });
      }
      return internalError("Failed to fetch videos");
    }
});

/**
 * POST /api/admin/videos
 */
export const POST = withAdminAuth(async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { title, description, url, thumbnail, category, displayOrder, status } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return badRequest("title is required");
    }
    if (!url || typeof url !== "string" || url.trim().length === 0) {
      return badRequest("url is required");
    }
    if (!category || (category !== "basic" && category !== "advanced")) {
      return badRequest("category must be 'basic' or 'advanced'");
    }

    const now = new Date().toISOString();
    const inserted = await db
      .insertInto("videos")
      .values({
        title: title.trim(),
        description: description?.trim() || null,
        url: url.trim(),
        thumbnail: thumbnail?.trim() || null,
        category: category,
        display_order: Number(displayOrder) || 0,
        status: status === "inactive" ? "inactive" : "active",
        created_at: sql`${now}::timestamp`,
        updated_at: sql`${now}::timestamp`,
      })
      .returningAll()
      .executeTakeFirst();

    if (!inserted) {
      return internalError("Failed to create video");
    }

    await logCreate(req, "videos", inserted.id, inserted, `创建视频: ${inserted.title}`);

    return success({
      id: inserted.id,
      title: inserted.title,
      description: inserted.description || null,
      url: inserted.url,
      thumbnail: inserted.thumbnail || null,
      category: inserted.category,
      displayOrder: inserted.display_order,
      status: inserted.status,
      createdAt: toISO(inserted.created_at) || "",
      updatedAt: toISO(inserted.updated_at) || "",
    });
  } catch (err: any) {
    console.error("[POST /api/admin/videos] Error:", err);
    if (err && err.ok === false) return err;
    return internalError("Failed to create video");
  }
});

