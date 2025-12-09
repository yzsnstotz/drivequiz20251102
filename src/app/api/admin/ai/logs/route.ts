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
  from: string | null; // "study" | "question" | "chat" 等，标识来源
  aiProvider: string | null; // "openai" | "local" | "openrouter" | "openrouter_direct" | "openai_direct" | "cache"
  cached: boolean | null; // 是否是缓存
  cacheSource: string | null; // "json" | "database"，缓存来源
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
    from: (r as any).from || null, // 来源标识
    aiProvider: (r as any).ai_provider || null, // AI服务提供商
    cached: (r as any).cached ?? false, // 是否是缓存
    cacheSource: (r as any).cache_source || null, // 缓存来源
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
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  console.log(`[GET /api/admin/ai/logs] [${requestId}] ===== Request started =====`);
  
  try {
    // 步骤 1: 检查环境变量
    console.log(`[GET /api/admin/ai/logs] [${requestId}] [Step 1] Checking AI_DATABASE_URL...`);
    const hasAiDbUrl = !!process.env.AI_DATABASE_URL;
    console.log(`[GET /api/admin/ai/logs] [${requestId}] [Step 1] AI_DATABASE_URL exists:`, hasAiDbUrl);
    
    if (!hasAiDbUrl) {
      console.error(`[GET /api/admin/ai/logs] [${requestId}] [Step 1] ❌ AI_DATABASE_URL is not configured!`);
      return NextResponse.json(
        {
          ok: false,
          errorCode: "AI_DATABASE_URL_NOT_CONFIGURED",
          message:
            "AI 日志数据库未配置。请在部署环境设置 AI_DATABASE_URL（直连 5432，sslmode=require）并重新部署。",
          requestId,
        },
        { status: 500 }
      );
    }
    
    // 记录连接字符串信息（隐藏密码）
    const maskedConnection = (process.env.AI_DATABASE_URL || '').replace(/:([^:@]+)@/, ':***@');
    console.log(`[GET /api/admin/ai/logs] [${requestId}] [Step 1] ✅ AI_DATABASE_URL found:`, maskedConnection.substring(0, 80) + '...');
    
    const { searchParams } = new URL(req.url);
    console.log(`[GET /api/admin/ai/logs] [${requestId}] [Step 2] Parsing query parameters...`);

    // 分页 + 排序参数
    const { page, limit, offset, sortBy, order } = parsePagination(searchParams);
    console.log(`[GET /api/admin/ai/logs] [${requestId}] [Step 2] Pagination: page=${page}, limit=${limit}, offset=${offset}`);

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
    console.log(`[GET /api/admin/ai/logs] [${requestId}] [Step 3] Checking if 'sources' column exists...`);
    let hasSourcesColumn = false;
    try {
      console.log(`[GET /api/admin/ai/logs] [${requestId}] [Step 3] Executing column check query...`);
      const columnCheck = await sql<{ column_name: string }>`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'ai_logs'
          AND column_name = 'sources'
      `.execute(aiDb);
      hasSourcesColumn = columnCheck.rows.length > 0;
      console.log(`[GET /api/admin/ai/logs] [${requestId}] [Step 3] ✅ Column check completed. hasSourcesColumn:`, hasSourcesColumn);
    } catch (err) {
      // 如果检查失败，假设字段不存在
      console.error(`[GET /api/admin/ai/logs] [${requestId}] [Step 3] ❌ Column check failed:`, err);
      console.error(`[GET /api/admin/ai/logs] [${requestId}] [Step 3] Error details:`, err instanceof Error ? err.message : String(err));
      hasSourcesColumn = false;
    }

    // 基础查询（只查询 ai_logs）
    // 注意：数据库表中的字段名是 locale，不是 language
    // 注意：sources 字段可能不存在，需要根据检查结果决定是否包含
    // 注意：from、ai_provider、cached、cache_source 字段可能不存在，需要根据检查结果决定是否包含
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

    // 检查 from、ai_provider、cached、cache_source 字段是否存在
    let hasFromColumn = false;
    let hasAiProviderColumn = false;
    let hasCachedColumn = false;
    let hasCacheSourceColumn = false;
    
    try {
      const columnCheck = await sql<{ column_name: string }>`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'ai_logs'
          AND column_name IN ('from', 'ai_provider', 'cached', 'cache_source')
      `.execute(aiDb);
      
      const existingColumns = new Set(columnCheck.rows.map(r => r.column_name));
      hasFromColumn = existingColumns.has('from');
      hasAiProviderColumn = existingColumns.has('ai_provider');
      hasCachedColumn = existingColumns.has('cached');
      hasCacheSourceColumn = existingColumns.has('cache_source');
    } catch {
      // 如果检查失败，假设字段不存在
    }

    let fieldsWithMetadata = baseFields;
    if (hasFromColumn) fieldsWithMetadata = [...fieldsWithMetadata, "from"] as any;
    if (hasAiProviderColumn) fieldsWithMetadata = [...fieldsWithMetadata, "ai_provider"] as any;
    if (hasCachedColumn) fieldsWithMetadata = [...fieldsWithMetadata, "cached"] as any;
    if (hasCacheSourceColumn) fieldsWithMetadata = [...fieldsWithMetadata, "cache_source"] as any;

    const fieldsWithSources = hasSourcesColumn
      ? ([...fieldsWithMetadata, "sources"] as const)
      : fieldsWithMetadata;

    console.log(`[GET /api/admin/ai/logs] [${requestId}] [Step 4] Building query...`);
    console.log(`[GET /api/admin/ai/logs] [${requestId}] [Step 4] Selected fields:`, fieldsWithSources);
    
    let base = aiDb
      .selectFrom("ai_logs")
      .select(fieldsWithSources);
    
    console.log(`[GET /api/admin/ai/logs] [${requestId}] [Step 4] ✅ Base query built`);

    // 应用筛选条件
    console.log(`[GET /api/admin/ai/logs] [${requestId}] [Step 5] Applying filters...`);
    console.log(`[GET /api/admin/ai/logs] [${requestId}] [Step 5] Filters: from=${from}, to=${to}, userId=${userId}, locale=${locale}, model=${model}, q=${q}`);
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

    console.log(`[GET /api/admin/ai/logs] [${requestId}] [Step 6] Building count query...`);
    let countBase = aiDb
      .selectFrom("ai_logs")
      .select((eb) => eb.fn.countAll<number>().as("cnt"));
    
    console.log(`[GET /api/admin/ai/logs] [${requestId}] [Step 6] ✅ Count query built`);
    
    // 应用相同的筛选条件
    console.log(`[GET /api/admin/ai/logs] [${requestId}] [Step 7] Applying same filters to count query...`);
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

    console.log(`[GET /api/admin/ai/logs] [${requestId}] [Step 8] Executing count query...`);
    let totalRow;
    try {
      totalRow = await countBase.executeTakeFirst();
      console.log(`[GET /api/admin/ai/logs] [${requestId}] [Step 8] ✅ Count query executed successfully`);
      console.log(`[GET /api/admin/ai/logs] [${requestId}] [Step 8] Count result:`, totalRow);
    } catch (err) {
      console.error(`[GET /api/admin/ai/logs] [${requestId}] [Step 8] ❌ Count query failed:`, err);
      console.error(`[GET /api/admin/ai/logs] [${requestId}] [Step 8] Error details:`, err instanceof Error ? err.message : String(err));
      console.error(`[GET /api/admin/ai/logs] [${requestId}] [Step 8] Error stack:`, err instanceof Error ? err.stack : 'N/A');
      throw err;
    }
    
    const total = Number(totalRow?.cnt ?? 0);
    console.log(`[GET /api/admin/ai/logs] [${requestId}] [Step 8] Total count:`, total);

    // CSV 导出：不限制数量
    if (format === "csv") {
      console.log(`[GET /api/admin/ai/logs] [${requestId}] [Step 9] Format: CSV, executing full query...`);
      let rows;
      try {
        rows = await base.orderBy(sortColumn, sortOrder).execute();
        console.log(`[GET /api/admin/ai/logs] [${requestId}] [Step 9] ✅ Query executed successfully, rows:`, rows.length);
      } catch (err) {
        console.error(`[GET /api/admin/ai/logs] [${requestId}] [Step 9] ❌ Query execution failed:`, err);
        console.error(`[GET /api/admin/ai/logs] [${requestId}] [Step 9] Error details:`, err instanceof Error ? err.message : String(err));
        console.error(`[GET /api/admin/ai/logs] [${requestId}] [Step 9] Error stack:`, err instanceof Error ? err.stack : 'N/A');
        throw err;
      }
      const items = rows.map(mapRow);
      const csv = convertToCSV(items);
      console.log(`[GET /api/admin/ai/logs] [${requestId}] [Step 9] ✅ CSV generated, returning response`);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="ai-logs-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    // JSON 返回（分页）
    console.log(`[GET /api/admin/ai/logs] [${requestId}] [Step 9] Format: JSON, executing paginated query...`);
    console.log(`[GET /api/admin/ai/logs] [${requestId}] [Step 9] Query: orderBy=${sortColumn} ${sortOrder}, limit=${limit}, offset=${offset}`);
    let rows;
    try {
      rows = await base.orderBy(sortColumn, sortOrder).limit(limit).offset(offset).execute();
      console.log(`[GET /api/admin/ai/logs] [${requestId}] [Step 9] ✅ Query executed successfully, rows:`, rows.length);
    } catch (err) {
      console.error(`[GET /api/admin/ai/logs] [${requestId}] [Step 9] ❌ Query execution failed:`, err);
      console.error(`[GET /api/admin/ai/logs] [${requestId}] [Step 9] Error details:`, err instanceof Error ? err.message : String(err));
      console.error(`[GET /api/admin/ai/logs] [${requestId}] [Step 9] Error stack:`, err instanceof Error ? err.stack : 'N/A');
      throw err;
    }
    const items = rows.map(mapRow);
    console.log(`[GET /api/admin/ai/logs] [${requestId}] [Step 9] ✅ Mapped ${items.length} items, returning response`);
    console.log(`[GET /api/admin/ai/logs] [${requestId}] ===== Request completed successfully =====`);

    return success({ items }, getPaginationMeta(page, limit, total));
  } catch (err) {
    // requestId is defined in outer scope, reuse it for error logging
    console.error(`[GET /api/admin/ai/logs] [${requestId || 'unknown'}] ===== Request failed =====`);
    console.error(`[GET /api/admin/ai/logs] [${requestId}] Error:`, err);
    console.error(`[GET /api/admin/ai/logs] [${requestId}] Error type:`, err instanceof Error ? err.constructor.name : typeof err);
    console.error(`[GET /api/admin/ai/logs] [${requestId}] Error message:`, err instanceof Error ? err.message : String(err));
    console.error(`[GET /api/admin/ai/logs] [${requestId}] Error stack:`, err instanceof Error ? err.stack : 'N/A');
    
    // 检查是否是连接错误
    const message = err instanceof Error ? err.message : "Unknown Error";
    const errorString = message.toLowerCase();
    
    if (errorString.includes('enotfound') || errorString.includes('getaddrinfo')) {
      console.error(`[GET /api/admin/ai/logs] [${requestId}] ❌ DNS resolution error detected`);
      const connectionString = process.env.AI_DATABASE_URL || "";
      const maskedConnection = connectionString.replace(/:([^:@]+)@/, ':***@');
      console.error(`[GET /api/admin/ai/logs] [${requestId}] Connection string:`, maskedConnection.substring(0, 80) + '...');
    }
    
    if (errorString.includes('timeout') || errorString.includes('timed out')) {
      console.error(`[GET /api/admin/ai/logs] [${requestId}] ❌ Connection timeout detected`);
    }
    
    if (errorString.includes('connection') && errorString.includes('refused')) {
      console.error(`[GET /api/admin/ai/logs] [${requestId}] ❌ Connection refused - database may be down or unreachable`);
    }
    
    if (errorString.includes('authentication') || errorString.includes('password')) {
      console.error(`[GET /api/admin/ai/logs] [${requestId}] ❌ Authentication error - check credentials`);
    }
    
    console.error(`[GET /api/admin/ai/logs] [${requestId}] ===== End error report =====`);
    
    let code = "INTERNAL_ERROR";
    if (errorString.includes("enotfound") || errorString.includes("getaddrinfo")) {
      code = "AI_DB_DNS_ERROR";
    } else if (errorString.includes("timeout") || errorString.includes("timed out")) {
      code = "AI_DB_TIMEOUT";
    } else if (errorString.includes("connection") && errorString.includes("refused")) {
      code = "AI_DB_CONNECTION_REFUSED";
    } else if (errorString.includes("authentication") || errorString.includes("password")) {
      code = "AI_DB_AUTH_FAILED";
    }
    return NextResponse.json(
      {
        ok: false,
        errorCode: code,
        message: `Failed to fetch AI logs: ${message}`,
        requestId,
      },
      { status: 500 }
    );
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
    "from",
    "locale",
    "model",
    "ragHits",
    "safetyFlag",
    "costEstimate",
    "aiProvider",
    "cached",
    "cacheSource",
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
      item.from || "",
      item.locale || "",
      item.model || "",
      item.ragHits,
      item.safetyFlag,
      item.costEstimate ?? "",
      item.aiProvider || "",
      item.cached ?? "",
      item.cacheSource || "",
      `"${sourcesStr.replace(/"/g, '""')}"`,
      item.createdAt,
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}
