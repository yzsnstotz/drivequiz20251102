// src/app/api/admin/ai/filters/route.ts
/* 功能：管理员读取/更新 AI 禁答关键词规则（not-driving / sensitive），统一响应结构与鉴权 */
import { NextRequest } from "next/server";
import { sql } from "kysely";
import { db } from "@/lib/db";
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { success, badRequest, internalError } from "@/app/api/_lib/errors";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

type FilterItem = {
  type: "not-driving" | "sensitive";
  pattern: string;
};

type Row = {
  id: string;
  type: string;
  pattern: string;
  created_at: Date | string | null;
  updated_at: Date | string | null;
};

function toIso(d?: Date | string | null): string | undefined {
  if (!d) return undefined;
  return typeof d === "string" ? d : d.toISOString();
}

// 由于 ai_filters 表可能尚未在 Database 接口中声明，使用 any 访问（保持运行不中断）
const getAiFiltersSelect = () => (db as any).selectFrom("ai_filters");
const getAiFiltersInsert = (trx: unknown) => (trx as any).insertInto("ai_filters");

export const GET = withAdminAuth(async (_req: NextRequest) => {
  try {
    const rows = await getAiFiltersSelect()
      .select(["id", "type", "pattern", "created_at", "updated_at"])
      .orderBy("updated_at", "desc")
      .orderBy("created_at", "desc")
      .execute();

    const items = (rows as Row[]).map((r) => ({
      id: r.id,
      type: r.type,
      pattern: r.pattern,
      createdAt: toIso(r.created_at),
      updatedAt: toIso(r.updated_at),
    }));

    return success({ items });
  } catch (err) {
    // 统一内部错误
    const msg = err instanceof Error ? err.message : "Unexpected server error.";
    return internalError(msg);
  }
});

export const POST = withAdminAuth(async (req: NextRequest) => {
  try {
    const body = (await req.json().catch(() => null)) as { items?: FilterItem[] } | null;

    if (!body || !Array.isArray(body.items)) {
      return badRequest("Body.items must be an array.");
    }
    const items = body.items;

    if (items.length === 0) {
      return badRequest("items cannot be empty.");
    }
    if (items.length > 200) {
      return badRequest("items too many (max 200).");
    }

    // 校验 + 归一化
    const normalized: FilterItem[] = [];
    for (const it of items) {
      if (!it || typeof it !== "object") return badRequest("Invalid item.");
      if (it.type !== "not-driving" && it.type !== "sensitive") {
        return badRequest("type must be 'not-driving' or 'sensitive'.");
      }
      if (typeof it.pattern !== "string") return badRequest("pattern must be a string.");
      const p = it.pattern.trim();
      if (p.length === 0) return badRequest("pattern must be a non-empty string.");
      if (p.length > 2000) return badRequest("pattern too long (max 2000).");
      normalized.push({ type: it.type, pattern: p });
    }

    // 逐项 UPSERT（同 type 合并：最新 pattern 覆盖）
    await db.transaction().execute(async (trx) => {
      for (const it of normalized) {
        await getAiFiltersInsert(trx)
          .values({
            type: it.type,
            pattern: it.pattern,
          })
          .onConflict((oc: any) =>
            oc.column("type").doUpdateSet({
              pattern: sql`excluded.pattern`,
              updated_at: sql`NOW()`,
            }),
          )
          .execute();
      }
    });

    // 返回最新列表
    const rows = await getAiFiltersSelect()
      .select(["id", "type", "pattern", "created_at", "updated_at"])
      .orderBy("updated_at", "desc")
      .orderBy("created_at", "desc")
      .execute();

    const out = (rows as Row[]).map((r) => ({
      id: r.id,
      type: r.type,
      pattern: r.pattern,
      createdAt: toIso(r.created_at),
      updatedAt: toIso(r.updated_at),
    }));

    return success({ items: out });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unexpected server error.";
    return internalError(msg);
  }
});

