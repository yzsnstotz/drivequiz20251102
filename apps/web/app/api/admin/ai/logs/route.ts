// apps/web/app/api/admin/ai/logs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { sql } from "kysely";
import { aiDb } from "@/lib/aiDb";
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { success, badRequest, internalError } from "@/app/api/_lib/errors";
import { parsePagination, getPaginationMeta } from "@/app/api/_lib/pagination";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * 允许的排序字段（前端以 camelCase 传入）
 * - 与《📐 接口与命名规范 v1.0》一致
 */
const SORT_WHITELIST = new Set<"createdAt" | "id" | "ragHits" | "costEstimate">([
  "createdAt",
  "id",
  "ragHits",
  "costEstimate",
]);

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
  sources?: any; // JSONB 字段，可能为 null，也可能不存在
  created_at: Date | string;
};

/** 排序字段映射（camel → snake） */
const SORT_MAP: Record<"createdAt" | "id" | "ragHits" | "costEstimate", keyof RawRow> = {
  id: "id",
  createdAt: "created_at",
  ragHits: "rag_hits",
  costEstimate: "cost_est",
};

/** 来源信息类型 */
type SourceInfo = {
  title: string;
  url: string;
  snippet?: string;
  score?: number;
  version?: string;
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
  costEstimate: number | null; // 成本估算（USD）
  sources: SourceInfo[]; // 来源信息数组
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
  // 解析 sources JSONB 字段
  let sources: SourceInfo[] = [];
  if (r.sources) {
    try {
      if (typeof r.sources === "string") {
        sources = JSON.parse(r.sources);
      } else if (Array.isArray(r.sources)) {
        sources = r.sources;
      } else if (typeof r.sources === "object") {
        sources = [r.sources];
      }
    } catch {
      sources = [];
    }
  }

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
    costEstimate: r.cost_est == null ? null : Number(r.cost_est),
    sources,
    createdAt: toISO(r.created_at) ?? "",
  };
}

/**
 * GET /api/admin/ai/logs
 * 查询 ai_logs
 * Query:
 *  - page, limit
 *  - sortBy: "createdAt" | "id" | "ragHits" | "costEstimate"
 *  - order: "asc" | "desc" (默认 desc)
 *  - from: YYYY-MM-DD (开始日期)
 *  - to: YYYY-MM-DD (结束日期)
 *  - userId: UUID (用户ID)
 *  - locale: string (语言代码)
 *  - model: string (模型名称)
 *  - q: string (搜索关键词，匹配 question/answer)
 *  - format: "csv" | "json" (默认 json)
 */
export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    // 检查 AI_DATABASE_URL 环境变量是否配置
    if (!process.env.AI_DATABASE_URL) {
      console.error("[GET /api/admin/ai/logs] AI_DATABASE_URL environment variable is not configured");
      return internalError(
        "AI_DATABASE_URL environment variable is not configured. Please configure it in Vercel Dashboard for Preview/Production environments."
      );
    }

    const { searchParams } = new URL(req.url);

    // 分页 + 排序参数
    const { page, limit, offset, sortBy, order } = parsePagination(searchParams);

    // 排序白名单校验
    const sortKey = (sortBy || "createdAt") as "createdAt" | "id" | "ragHits" | "costEstimate";
    if (!SORT_WHITELIST.has(sortKey)) {
      return badRequest("Invalid sortBy. Allowed: createdAt | id | ragHits | costEstimate");
    }
    const sortColumn = SORT_MAP[sortKey];

    // 排序方向校验
    const sortOrder = order === "asc" ? "asc" : "desc";

    // 筛选参数
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const userId = searchParams.get("userId");
    const locale = searchParams.get("locale");
    const model = searchParams.get("model");
    const q = searchParams.get("q");
    const format = searchParams.get("format") || "json";

    // 检查 sources 字段是否存在
    let hasSourcesColumn = false;
    try {
      const columnCheck = await sql<{ column_name: string }>`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'ai_logs'
          AND column_name = 'sources'
      `.execute(aiDb);
      hasSourcesColumn = columnCheck.rows.length > 0;
    } catch {
      // 如果检查失败，假设字段不存在
      hasSourcesColumn = false;
    }

    // 基础查询（只查询 ai_logs）
    // 注意：数据库表中的字段名是 locale，不是 language
    // 注意：sources 字段可能不存在，需要根据检查结果决定是否包含
    const baseFields = [
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
    ] as const;

    const fieldsWithSources = hasSourcesColumn
      ? ([...baseFields, "sources"] as const)
      : baseFields;

    let base = aiDb
      .selectFrom("ai_logs")
      .select(fieldsWithSources);

    // 应用筛选条件
    if (from) {
      try {
        const fromDate = new Date(from);
        if (!isNaN(fromDate.getTime())) {
          base = base.where("created_at", ">=", fromDate);
        }
      } catch {
        // 忽略无效日期
      }
    }

    if (to) {
      try {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        if (!isNaN(toDate.getTime())) {
          base = base.where("created_at", "<=", toDate);
        }
      } catch {
        // 忽略无效日期
      }
    }

    if (userId) {
      base = base.where("user_id", "=", userId);
    }

    if (locale) {
      base = base.where("locale", "=", locale);
    }

    if (model) {
      base = base.where("model", "=", model);
    }

    if (q) {
      base = base.where((eb) =>
        eb.or([
          eb("question", "ilike", `%${q}%`),
          eb("answer", "ilike", `%${q}%`),
        ])
      );
    }

    let countBase = aiDb
      .selectFrom("ai_logs")
      .select((eb) => eb.fn.countAll<number>().as("cnt"));
    
    // 应用相同的筛选条件
    if (from) {
      try {
        const fromDate = new Date(from);
        if (!isNaN(fromDate.getTime())) {
          countBase = countBase.where("created_at", ">=", fromDate);
        }
      } catch {
        // 忽略无效日期
      }
    }

    if (to) {
      try {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        if (!isNaN(toDate.getTime())) {
          countBase = countBase.where("created_at", "<=", toDate);
        }
      } catch {
        // 忽略无效日期
      }
    }

    if (userId) {
      countBase = countBase.where("user_id", "=", userId);
    }

    if (locale) {
      countBase = countBase.where("locale", "=", locale);
    }

    if (model) {
      countBase = countBase.where("model", "=", model);
    }

    if (q) {
      countBase = countBase.where((eb) =>
        eb.or([
          eb("question", "ilike", `%${q}%`),
          eb("answer", "ilike", `%${q}%`),
        ])
      );
    }

    const totalRow = await countBase.executeTakeFirst();
    const total = Number(totalRow?.cnt ?? 0);

    // CSV 导出：不限制数量
    if (format === "csv") {
      const rows = await base.orderBy(sortColumn, sortOrder).execute();
      const items = rows.map(mapRow);
      const csv = convertToCSV(items);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="ai-logs-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    // JSON 返回（分页）
    const rows = await base.orderBy(sortColumn, sortOrder).limit(limit).offset(offset).execute();
    const items = rows.map(mapRow);

    return success({ items }, getPaginationMeta(page, limit, total));
  } catch (err) {
    console.error("[GET /api/admin/ai/logs] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown Error";
    
    // 检查是否是 DNS 解析错误
    if (message.includes("ENOTFOUND") || message.includes("getaddrinfo")) {
      const connectionString = process.env.AI_DATABASE_URL || "";
      const isDirectConnection = connectionString.includes("db.") && connectionString.includes(".supabase.co:5432");
      
      let errorMessage = `Database connection failed: ${message}`;
      
      if (isDirectConnection) {
        errorMessage += "\n\nPossible solutions:\n";
        errorMessage += "1. The Supabase database may be paused (free tier projects pause after inactivity). Please check your Supabase dashboard and resume the project.\n";
        errorMessage += "2. Try using the connection pooler instead of direct connection in Vercel Dashboard:\n";
        errorMessage += "   For project ID 'cgpmpfnjzlzbquakmmrj', use:\n";
        errorMessage += "   postgresql://postgres.cgpmpfnjzlzbquakmmrj:zKV0rtIV1QOByu89@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require\n";
        errorMessage += "   Or check your Supabase Dashboard → Settings → Database → Connection Pooling for the correct pooler URL.\n";
      }
      
      console.error("[GET /api/admin/ai/logs] DNS resolution error. Connection string:", connectionString.substring(0, 50) + "...");
      return internalError(errorMessage);
    }
    
    return internalError(`Failed to fetch AI logs: ${message}`);
  }
});

/**
 * 将数据转换为 CSV 格式
 */
function convertToCSV(items: CamelRow[]): string {
  const headers = [
    "id",
    "userId",
    "question",
    "answer",
    "locale",
    "model",
    "ragHits",
    "safetyFlag",
    "costEstimate",
    "sources",
    "createdAt",
  ];

  const rows = items.map((item) => {
    const sourcesStr = item.sources && item.sources.length > 0
      ? item.sources.map((s) => `${s.title}(${s.url})`).join("; ")
      : "";
    return [
      item.id,
      item.userId || "",
      `"${item.question.replace(/"/g, '""')}"`,
      item.answer ? `"${item.answer.replace(/"/g, '""')}"` : "",
      item.locale || "",
      item.model || "",
      item.ragHits,
      item.safetyFlag,
      item.costEstimate ?? "",
      `"${sourcesStr.replace(/"/g, '""')}"`,
      item.createdAt,
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}
