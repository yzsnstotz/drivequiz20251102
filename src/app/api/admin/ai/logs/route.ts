// src/app/api/admin/ai/logs/route.ts
import { NextRequest } from "next/server";
import { aiDb } from "@/lib/aiDb";
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { success, badRequest, internalError } from "@/app/api/_lib/errors";
import { parsePagination, getPaginationMeta } from "@/app/api/_lib/pagination";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

/**
 * 允许的排序字段（前端以 camelCase 传入）
 * - 与《📐 接口与命名规范 v1.0》一致
 */
const SORT_WHITELIST = new Set<"createdAt" | "id">(["createdAt", "id"]);

/** ai_logs 原始数据行类型（数据库 snake_case） */
type RawRow = {
  id: number;
  user_id: string | null;
  question: string;
  answer: string | null;
  locale: string | null; // 注意：数据库表中的字段名是 locale，不是 language
  model: string | null;
  rag_hits: number | null;
  safety_flag: string; // 数据库返回 string，在 mapRow 中进行类型校验
  cost_est: string | number | null; // numeric 在 node-pg 中通常为 string
  created_at: Date | string;
};

/** 排序字段映射（camel → snake） */
const SORT_MAP: Record<"createdAt" | "id", keyof RawRow> = {
  id: "id",
  createdAt: "created_at",
};

/** 返回给前端的 camelCase 类型 */
type CamelRow = {
  id: number;
  userId: string | null;
  question: string;
  answer: string | null;
  locale: string | null; // 返回 locale 字段（与数据库字段名一致）
  model: string | null;
  ragHits: number;
  safetyFlag: "ok" | "needs_human" | "blocked";
  costEst: string | null; // 以字符串返回，保持一致性
  createdAt: string; // ISO8601
};

/** 工具：转 ISO8601 字符串 */
function toISO(v: Date | string | null | undefined): string | null {
  if (!v) return null;
  try {
    return typeof v === "string" ? (/\d{4}-\d{2}-\d{2}T/.test(v) ? v : new Date(v).toISOString()) : v.toISOString();
  } catch {
    return null;
  }
}

/** 映射 snake_case → camelCase */
function mapRow(r: RawRow): CamelRow {
  return {
    id: r.id,
    userId: r.user_id,
    question: r.question,
    answer: r.answer,
    locale: r.locale, // 使用 locale 字段（数据库表中的实际字段名）
    model: r.model,
    ragHits: Number(r.rag_hits ?? 0),
    safetyFlag: (r.safety_flag === "ok" || r.safety_flag === "needs_human" || r.safety_flag === "blocked") 
      ? r.safety_flag 
      : "ok", // 默认值，如果数据库返回了意外的值
    costEst: r.cost_est == null ? null : String(r.cost_est),
    createdAt: toISO(r.created_at) ?? "",
  };
}

/**
 * GET /api/admin/ai/logs
 * 查询 ai_logs
 * Query:
 *  - page, limit
 *  - sortBy: "createdAt" | "id"
 *  - order: "asc" | "desc" (默认 desc)
 */
export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);

    // 分页 + 排序参数
    const { page, limit, offset, sortBy, order } = parsePagination(searchParams);

    // 排序白名单校验
    const sortKey = (sortBy || "createdAt") as "createdAt" | "id";
    if (!SORT_WHITELIST.has(sortKey)) {
      return badRequest("Invalid sortBy");
    }
    const sortColumn = SORT_MAP[sortKey];

    // 基础查询（只查询 ai_logs）
    // 注意：数据库表中的字段名是 locale，不是 language
    const base = aiDb
      .selectFrom("ai_logs")
      .select([
        "id",
        "user_id",
        "question",
        "answer",
        "locale", // 使用 locale 字段（数据库表中的实际字段名）
        "model",
        "rag_hits",
        "safety_flag",
        "cost_est",
        "created_at",
      ] as const);

    // 计数
    const totalRow = await aiDb
      .selectFrom("ai_logs")
      .select((eb) => eb.fn.countAll().as("cnt"))
      .executeTakeFirst();
    const total = Number(totalRow?.cnt ?? 0);

    // 列表（排序 + 分页）
    const rows = await base.orderBy(sortColumn, order).limit(limit).offset(offset).execute();

    const items = rows.map(mapRow);

    return success({ items }, getPaginationMeta(page, limit, total));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown Error";
    return internalError(message);
  }
});

