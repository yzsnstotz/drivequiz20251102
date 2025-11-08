// apps/web/app/api/admin/ai/rag/docs/route.ts
/* 功能：管理员管理 RAG 文档（列表 + 新增），统一鉴权与响应结构 */

import { NextRequest } from "next/server";
import { sql } from "kysely";
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { aiDb } from "@/lib/aiDb";
import { success, badRequest, internalError } from "@/app/api/_lib/errors";
import { parsePagination, getPaginationMeta } from "@/app/api/_lib/pagination";

type DocRow = {
  id: string;
  title: string;
  url: string | null;
  lang: string | null;
  tags: string[] | null;
  status: string | null;
  version: string | null;
  chunks: number | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
};

function toIso(d?: Date | string | null): string | undefined {
  if (!d) return undefined;
  return typeof d === "string" ? d : d.toISOString();
}

const SORT_WHITELIST = new Set<"createdAt" | "updatedAt" | "title">([
  "createdAt",
  "updatedAt",
  "title",
]);

function mapSortColumn(sortBy?: string): { col: string; nullsLast?: boolean } {
  switch (sortBy) {
    case "title":
      return { col: "title" };
    case "updatedAt":
      return { col: "updated_at", nullsLast: true };
    case "createdAt":
    default:
      return { col: "created_at", nullsLast: true };
  }
}

/**
 * GET /api/admin/ai/rag/docs
 * 查询参数：
 *  - page, limit
 *  - q: 关键词（模糊匹配 title / url）
 *  - lang: 语言代码过滤
 *  - status: 状态过滤
 *  - sortBy: createdAt|updatedAt|title
 *  - sortOrder: asc|desc
 */
export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const lang = (searchParams.get("lang") || "").trim();
    const status = (searchParams.get("status") || "").trim();
    const sortByRaw = (searchParams.get("sortBy") || "createdAt") as
      | "createdAt"
      | "updatedAt"
      | "title";
    const sortOrder = (searchParams.get("sortOrder") === "asc" ? "asc" : "desc") as "asc" | "desc";

    if (!SORT_WHITELIST.has(sortByRaw)) {
      return badRequest("Invalid sortBy");
    }

    const { page, limit, offset } = parsePagination(searchParams);

    // 基础查询（由于 Database 未声明该表，使用 any）
    let base = (aiDb as any)
      .selectFrom("ai_rag_docs")
      .select([
        "id",
        "title",
        "url",
        "lang",
        "tags",
        "status",
        "version",
        "chunks",
        "created_at",
        "updated_at",
      ]) as any;

    // 过滤：q
    if (q) {
      const like = `%${q}%`;
      base = base.where(sql`(title ILIKE ${like} OR url ILIKE ${like})`);
    }

    // 过滤：lang
    if (lang) {
      base = base.where(sql`lang = ${lang}`);
    }

    // 过滤：status
    if (status) {
      base = base.where(sql`status = ${status}`);
    }

    // 统计
    let countQuery = (aiDb as any)
      .selectFrom("ai_rag_docs")
      .select((eb: any) => eb.fn.countAll().as("count")) as any;

    if (q) {
      const like = `%${q}%`;
      countQuery = countQuery.where(sql`(title ILIKE ${like} OR url ILIKE ${like})`);
    }
    if (lang) countQuery = countQuery.where(sql`lang = ${lang}`);
    if (status) countQuery = countQuery.where(sql`status = ${status}`);

    const countResult = (await countQuery.execute()) as { count: string | number }[];
    const count = countResult?.[0]?.count ?? 0;

    // 排序
    const { col } = mapSortColumn(sortByRaw);
    base = base.orderBy(col, sortOrder);

    // 分页
    const rows = (await base.limit(limit).offset(offset).execute()) as DocRow[];

    const items = rows.map((r) => ({
      id: r.id,
      title: r.title,
      url: r.url || undefined,
      lang: r.lang || undefined,
      tags: r.tags || undefined,
      status: r.status || undefined,
      version: r.version || "v1",
      chunks: r.chunks ?? 0,
      createdAt: toIso(r.created_at),
      updatedAt: toIso(r.updated_at),
    }));

    return success(
      { items },
      getPaginationMeta(page, limit, typeof count === "string" ? parseInt(count, 10) : (count as number)),
    );
  } catch (error) {
    // 记录详细错误信息以便调试
    console.error("[GET /api/admin/ai/rag/docs] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return internalError(`Database query failed: ${errorMessage}`);
  }
});

/**
 * POST /api/admin/ai/rag/docs
 * Body:
 *  {
 *    "title": string,            // 必填
 *    "url": string,              // 可选
 *    "lang": string,             // 可选（如 "ja" | "zh" | "en"...）
 *    "tags": string[],           // 可选
 *    "status": "ready"|"draft"   // 可选，默认 "ready"
 *  }
 */
export const POST = withAdminAuth(async (req: NextRequest) => {
  try {
    const body = (await req.json().catch(() => null)) as
      | {
          title?: string;
          url?: string;
          lang?: string;
          tags?: string[];
          status?: string;
        }
      | null;

    if (!body || typeof body.title !== "string" || body.title.trim().length === 0) {
      return badRequest("title is required.");
    }

    if (body.url && typeof body.url !== "string") {
      return badRequest("url must be a string.");
    }

    if (body.lang && typeof body.lang !== "string") {
      return badRequest("lang must be a string.");
    }

    if (body.tags && !Array.isArray(body.tags)) {
      return badRequest("tags must be an array of string.");
    }

    // 生成版本号（默认 v1，或使用时间戳）
    const version = `v1-${Date.now()}`;

    const payload: Record<string, unknown> = {
      title: body.title.trim(),
      url: body.url ? body.url.trim() : null,
      lang: body.lang ? body.lang.trim() : null,
      tags: body.tags ?? null,
      status: (body.status || "ready").trim(),
      version,
      chunks: 0, // 初始为 0，向量化后更新
    };

    const inserted = (await (aiDb as any)
      .insertInto("ai_rag_docs")
      .values(payload)
      .returning([
        "id",
        "title",
        "url",
        "lang",
        "tags",
        "status",
        "version",
        "chunks",
        "created_at",
        "updated_at",
      ])
      .execute()) as DocRow[];

    const r = inserted[0];

    // 异步发送向量化触发通知（失败不阻断主流程，仅记录警告）
    const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "";
    const AI_SERVICE_TOKEN = process.env.AI_SERVICE_TOKEN || "";
    if (AI_SERVICE_URL && AI_SERVICE_TOKEN) {
      void fetch(`${AI_SERVICE_URL.replace(/\/+$/, "")}/v1/admin/rag/ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AI_SERVICE_TOKEN}`,
        },
        body: JSON.stringify({
          docId: r.id,
          title: r.title,
          url: r.url || "",
          version: r.version || version,
          // 注意：实际 content 需要从上传文件或前端提供，此处仅触发通知
          // 后续可由前端直接调用 /v1/admin/rag/ingest 并传入 content
          content: "",
        }),
      }).catch((e) => {
        // eslint-disable-next-line no-console
        console.warn("[web] Failed to notify AI-Service for RAG ingestion", {
          docId: r.id,
          error: (e as Error).message,
        });
      });
    }

    return success({
      item: {
        docId: r.id,
        id: r.id,
        title: r.title,
        url: r.url || undefined,
        lang: r.lang || undefined,
        tags: r.tags || undefined,
        status: r.status || undefined,
        version: r.version || version,
        chunks: r.chunks ?? 0,
        createdAt: toIso(r.created_at),
        updatedAt: toIso(r.updated_at),
      },
    });
  } catch (error) {
    // 记录详细错误信息以便调试
    console.error("[POST /api/admin/ai/rag/docs] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return internalError(`Database insert failed: ${errorMessage}`);
  }
});

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
