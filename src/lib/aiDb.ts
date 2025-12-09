// ============================================================
// 文件路径: src/lib/aiDb.ts
// 功能: AI Service 数据库连接配置 (PostgreSQL + Kysely)
// 更新日期: 2025-11-08
// 说明: 独立的 AI 数据库连接，使用 DIRECT 连接方式
// ============================================================

import { Kysely, PostgresDialect, Generated } from "kysely";
import { Pool } from "pg";

// ------------------------------------------------------------
// AI 数据库表结构定义
// ------------------------------------------------------------

// ai_logs 表
interface AiLogsTable {
  id: Generated<number>;
  user_id: string | null;
  question: string;
  answer: string | null;
  locale: string | null;
  model: string | null;
  rag_hits: number | null;
  cost_est: number | null; // NUMERIC(10,4)
  safety_flag: string; // "ok" | "needs_human" | "blocked"
  sources: any; // JSONB 字段，存储来源信息数组
  context_tag: string | null; // "license" | "vehicle" | "service" | "general"
  from: string | null; // "study" | "question" | "chat" 等，标识来源
  ai_provider: string | null; // "openai" | "local" | "openrouter" | "openrouter_direct" | "openai_direct" | "cache"
  cached: boolean | null; // 是否是缓存
  cache_source: string | null; // "json" | "database"，缓存来源
  created_at: Generated<Date>;
}

// ai_filters 表
interface AiFiltersTable {
  id: Generated<number>;
  type: string; // "not-driving" | "sensitive"
  pattern: string;
  status: string | null; // "draft" | "active" | "inactive"
  changed_by: number | null;
  changed_at: Date | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

// ai_filters_history 表
interface AiFiltersHistoryTable {
  id: Generated<number>;
  filter_id: number;
  type: string;
  pattern: string;
  status: string | null;
  changed_by: number | null;
  changed_at: Date | null;
  created_at: Generated<Date>;
}

// ai_rag_docs 表
interface AiRagDocsTable {
  id: Generated<number>;
  title: string;
  url: string | null;
  lang: string | null;
  tags: string[] | null;
  status: string | null;
  version: string | null;
  chunks: number | null;
  uploaded_by: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

// ai_daily_summary 表
interface AiDailySummaryTable {
  date: Date;
  total_calls: number;
  avg_cost: number | null;
  cache_hit_rate: number | null;
  rag_hit_rate: number | null;
  top_questions: any | null; // JSONB
  new_topics: any | null; // JSONB
  created_at: Generated<Date>;
}

// ai_vectors 表
interface AiVectorsTable {
  id: Generated<number>;
  doc_id: string | null;
  content: string | null;
  embedding: any; // vector(1536)
  source_title: string | null;
  source_url: string | null;
  version: string | null;
  updated_at: Generated<Date>;
}

// ai_config 表
interface AiConfigTable {
  key: string;
  value: string;
  description: string | null;
  updated_by: number | null;
  updated_at: Date | null;
}

// ai_scene_config 表
interface AiSceneConfigTable {
  id: Generated<number>;
  scene_key: string;
  scene_name: string;
  system_prompt_zh: string;
  system_prompt_ja: string | null;
  system_prompt_en: string | null;
  output_format: string | null;
  max_length: number;
  temperature: number;
  enabled: boolean;
  description: string | null;
  updated_by: number | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

// ai_provider_daily_stats 表
interface AiProviderDailyStatsTable {
  stat_date: Date; // date
  provider: string;
  model: string | null;
  scene: string | null;
  total_calls: number;
  total_success: number;
  total_error: number;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

// ai_provider_config 表
interface AiProviderConfigTable {
  id: Generated<number>;
  provider: string;
  model: string | null;
  is_enabled: boolean;
  daily_limit: number | null;
  priority: number;
  is_local_fallback: boolean;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

// ------------------------------------------------------------
// AI 数据库总接口定义
// ------------------------------------------------------------
interface AiDatabase {
  ai_logs: AiLogsTable;
  ai_filters: AiFiltersTable;
  ai_filters_history: AiFiltersHistoryTable;
  ai_rag_docs: AiRagDocsTable;
  ai_daily_summary: AiDailySummaryTable;
  ai_vectors: AiVectorsTable;
  ai_config: AiConfigTable;
  ai_scene_config: AiSceneConfigTable;
  ai_provider_daily_stats: AiProviderDailyStatsTable;
  ai_provider_config: AiProviderConfigTable;
}

// ------------------------------------------------------------
// 数据库连接配置
// 使用 AI_DATABASE_URL 环境变量，DIRECT 连接方式（端口 5432）
// ------------------------------------------------------------

let aiDbInstance: Kysely<AiDatabase> | null = null;
let aiDbPool: Pool | null = null;
export let aiDbDebugTag: string = "unknown";

// 检查是否在构建阶段
function isBuildTime(): boolean {
  const hasDbUrl = !!process.env.AI_DATABASE_URL;
  const isNextBuild = process.env.NEXT_PHASE === 'phase-production-build' || 
                      process.env.NEXT_PHASE === 'phase-development-build';
  return isNextBuild || !hasDbUrl;
}

function getAiConnectionString(): string {
  const connectionString = process.env.AI_DATABASE_URL;
  
  if (!connectionString) {
    console.error('[AI DB] AI_DATABASE_URL is not configured!');
    return 'postgresql://placeholder:placeholder@placeholder:5432/placeholder';
  }
  
  return connectionString;
}

/**
 * 解析连接字符串，提取配置信息
 */
function parseAiConnectionString(connectionString: string): {
  host: string;
  port: number;
  database: string | undefined;
  user: string | undefined;
  password: string | undefined;
  sslMode: string | null;
  sslEnabled: boolean;
} {
  // 清理可能的前缀
  let cleanedConnectionString = connectionString.trim();
  if (cleanedConnectionString.startsWith('DATABASE_URL=')) {
    cleanedConnectionString = cleanedConnectionString.substring('DATABASE_URL='.length);
  } else if (cleanedConnectionString.startsWith('AI_DATABASE_URL=')) {
    cleanedConnectionString = cleanedConnectionString.substring('AI_DATABASE_URL='.length);
  }
  
  // 处理 postgres:// 和 postgresql:// 协议
  if (cleanedConnectionString.startsWith('postgres://')) {
    cleanedConnectionString = cleanedConnectionString.replace('postgres://', 'postgresql://');
  }
  
  const url = new URL(cleanedConnectionString);

  const host = url.hostname;
  const port = url.port ? Number(url.port) : 5432;
  const database = url.pathname ? url.pathname.slice(1) : undefined;
  const user = url.username ? decodeURIComponent(url.username) : undefined;
  const password = url.password ? decodeURIComponent(url.password) : undefined;

  const sslMode = url.searchParams.get("sslmode");
  const sslEnabled = !!(sslMode && sslMode !== "disable");

  return {
    host,
    port,
    database,
    user,
    password,
    sslMode,
    sslEnabled,
  };
}

function createAiDbInstance(): Kysely<AiDatabase> {
  const connectionString = getAiConnectionString();

  const isPlaceholder = connectionString === 'postgresql://placeholder:placeholder@placeholder:5432/placeholder';
  try {
    const url = new URL(connectionString);
    aiDbDebugTag = `${url.hostname}/${url.pathname.replace("/", "")}`;
  } catch {
    aiDbDebugTag = connectionString.slice(0, 50);
  }
  
  if (isPlaceholder) {
    return createPlaceholderAiDb();
  }

  // 验证连接字符串存在
  if (!connectionString) {
    throw new Error("[AI DB][Config] AI_DATABASE_URL is not set");
  }

  // 解析连接字符串
  const parsed = parseAiConnectionString(connectionString);

  // 仅在开发环境记录配置日志
  if (process.env.NODE_ENV === "development") {
    console.log("[AI DB][Config] Using AI_DATABASE_URL (first 80 chars):",
      connectionString.substring(0, 80) + "...",
    );
    console.log("[AI DB][Config] Parsed connection:", {
      host: parsed.host,
      port: parsed.port,
      database: parsed.database,
      sslMode: parsed.sslMode,
      sslEnabled: parsed.sslEnabled,
    });
  }

  // 检测是否需要 SSL 连接（Supabase 必须使用 SSL）
  const isSupabase =
    parsed.host.includes("supabase.com") ||
    parsed.host.includes("supabase.co") ||
    parsed.sslEnabled;

  // 构建 SSL 配置
  const ssl = isSupabase || parsed.sslEnabled
    ? { rejectUnauthorized: false }
    : undefined;

  // 创建 Pool 配置对象（使用分离的配置，确保 SSL 配置正确应用）
  const poolConfig: {
    host: string;
    port: number;
    database: string | undefined;
    user: string | undefined;
    password: string | undefined;
    ssl?: boolean | { rejectUnauthorized: boolean };
    max?: number; // 最大连接数
    min?: number; // 最小连接数
    idleTimeoutMillis?: number; // 空闲连接超时时间（毫秒）
    connectionTimeoutMillis?: number; // 连接超时时间（毫秒）
    statement_timeout?: number; // 语句超时时间（毫秒）
    query_timeout?: number; // 查询超时时间（毫秒）
  } = {
    host: parsed.host,
    port: parsed.port,
    database: parsed.database,
    user: parsed.user,
    password: parsed.password,
    ssl, // 使用分离的配置确保 SSL 设置正确应用
    // 连接池配置：相对主库更"克制"，避免争抢过多连接资源
    max: 10, // 降低 AI DB 最大连接数，减少对主库的压力
    min: 1, // 保持最小连接数较低
    idleTimeoutMillis: 20000, // 空闲连接 20 秒后关闭
    connectionTimeoutMillis: 15000, // 更短的连接超时，快速失败
    statement_timeout: 40000, // 语句超时 40 秒
    query_timeout: 40000, // 查询超时 40 秒
  };

  // 创建 Pool 实例并传递给 PostgresDialect
  const pool = new Pool(poolConfig);
  aiDbPool = pool; // 保存 Pool 实例以便后续获取统计信息

  // 添加连接池错误处理
  pool.on('error', (err) => {
    const errorMessage = err?.message || String(err);
    const errorCode = (err as any)?.code || '';

    console.error('[AI DB Pool] Unexpected error on idle client:', {
      message: errorMessage,
      code: errorCode,
      stack: process.env.NODE_ENV === 'development' ? (err as Error)?.stack : undefined,
    });
  });

  // 添加连接错误监听
  pool.on('connect', (client) => {
    client.on('error', (err) => {
      const errorMessage = err?.message || String(err);
      console.error('[AI DB Pool] Client connection error:', {
        message: errorMessage,
        code: (err as any)?.code,
      });
    });
  });

  const dialect = new PostgresDialect({
    pool,
  });

  const kysely = new Kysely<AiDatabase>({
    dialect,
  });

  return kysely;
}

// 创建一个占位符对象，用于构建时
function createPlaceholderAiDb(): Kysely<AiDatabase> {
  // 创建一个支持链式调用的查询构建器占位符
  const createQueryBuilder = () => {
    const builder: any = {
      select: (...args: any[]) => builder,
      selectAll: () => builder,
      where: (...args: any[]) => builder, // 支持多种 where 调用方式
      orderBy: (...args: any[]) => builder,
      limit: (...args: any[]) => builder,
      offset: (...args: any[]) => builder,
      execute: async () => [],
      executeTakeFirst: async () => undefined,
    };
    return builder;
  };

  const placeholder = {
    selectFrom: (table: string) => createQueryBuilder(),
    insertInto: (table: string) => ({
      values: (values: any) => ({
        returning: (...args: any[]) => createQueryBuilder(),
        onConflict: (column?: string) => ({
          column: (col: string) => ({
            doUpdateSet: (updates: any) => createQueryBuilder(),
          }),
          doUpdateSet: (updates: any) => createQueryBuilder(),
        }),
        execute: async () => [],
      }),
    }),
    updateTable: (table: string) => ({
      set: (updates: any) => ({
        where: (...args: any[]) => createQueryBuilder(),
        execute: async () => [],
      }),
    }),
    deleteFrom: (table: string) => ({
      where: (...args: any[]) => createQueryBuilder(),
      execute: async () => [],
    }),
    transaction: () => ({
      execute: async (callback: any) => {
        const placeholder = createPlaceholderAiDb();
        return callback(placeholder);
      },
    }),
  } as any;
  
  return placeholder;
}

// 延迟初始化：只在运行时访问时创建实例
// 使用 lazy initialization 确保只创建一个实例
let placeholderInstance: Kysely<AiDatabase> | null = null;

// 获取实际的数据库实例（用于运行时）
function getActualDbInstance(): Kysely<AiDatabase> {
  if (!aiDbInstance) {
    try {
      aiDbInstance = createAiDbInstance();
    } catch (error) {
      console.error('[AI DB] Failed to create database instance:', error);
      if (!placeholderInstance) {
        placeholderInstance = createPlaceholderAiDb();
      }
      return placeholderInstance;
    }
  }
  return aiDbInstance;
}

// 获取应该使用的数据库实例（占位符或真实实例）
function getDbInstance(): Kysely<AiDatabase> {
  const hasDbUrl = !!process.env.AI_DATABASE_URL;
  const isBuild = isBuildTime();
  const shouldUsePlaceholder = isBuild || !hasDbUrl;

  if (shouldUsePlaceholder) {
    // 构建时使用占位符
    if (isBuild) {
      if (!placeholderInstance) {
        placeholderInstance = createPlaceholderAiDb();
      }
      return placeholderInstance;
    }
    // 运行时缺少配置：记录警告但仍使用占位符（保持兼容性）
    // 注意：调用方（如 insertAiLog）应该检查环境变量
    console.warn('[AI DB] AI_DATABASE_URL not configured, using placeholder (operations will be no-ops)');
    if (!placeholderInstance) {
      placeholderInstance = createPlaceholderAiDb();
    }
    return placeholderInstance;
  }

  return getActualDbInstance();
}

export const aiDb = new Proxy({} as Kysely<AiDatabase>, {
  get(_target, prop) {
    const instance = getDbInstance();
    const value = instance[prop as keyof Kysely<AiDatabase>];
    
    // 对于 Kysely 的方法，直接返回，不需要绑定
    // Kysely 的方法会自动处理 this 上下文
    if (typeof value === 'function') {
      return (...args: any[]) => {
        // 确保每次调用时都获取最新的实例
        const currentInstance = getDbInstance();
        const method = currentInstance[prop as keyof Kysely<AiDatabase>];
        if (typeof method === 'function') {
          try {
            const result = (method as any).apply(currentInstance, args);
            // 如果是 Promise，添加错误处理日志
            if (result instanceof Promise) {
              return result.catch((err) => {
                console.error(`[AI DB] Method ${String(prop)} failed:`, err);
                throw err;
              });
            }
            return result;
          } catch (err) {
            console.error(`[AI DB] Method ${String(prop)} threw synchronously:`, err);
            throw err;
          }
        }
        return method;
      };
    }
    return value;
  }
});

// ------------------------------------------------------------
// 💡 说明
// - 所有时间字段均为 UTC 时间。
// - 字段命名遵循 snake_case。
// - API 输出时统一转换为 camelCase。
// - 使用 DIRECT 连接方式（端口 5432），确保连接稳定。
// ------------------------------------------------------------

// ============================================================
// AI 数据库连接池统计函数
// ============================================================

export type AiDbPoolStats = {
  total: number;
  idle: number;
  active: number;
  waiting: number;
  usageRate: number;
  status: "healthy" | "warning" | "critical";
};

// ------------------------------------------------------------
// AI 日志写入助手函数
// ------------------------------------------------------------

export interface AiLogEntry {
  userId: string | null;
  question: string;
  answer: string;
  from: string;
  locale: string | null;
  model: string | null;
  ragHits?: number | null;
  safetyFlag?: "ok" | "needs_human" | "blocked";
  costEst?: number | null;
  sources?: unknown;
  aiProvider?: string | null;
  cached?: boolean;
  contextTag?: string | null;
}

// 统一清洗文本字段，避免存储多余空白或 undefined
function cleanTextField(text: string | null | undefined): string {
  if (typeof text !== "string") return "";
  return text.trim();
}

// 统一处理 JSON/JSONB 入参，防止传入非 JSON 类型导致数据库错误
function normalizeJsonValue(value: unknown): object | unknown[] | null {
  if (value == null) return null;
  if (typeof value === "object") return value as object;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === "object" ? (parsed as object) : null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * 统一的 AI 日志写入函数
 * 严格按照数据库结构_AI_SERVICE.md 中的 ai_logs 表字段规范
 * 失败仅告警，不阻断业务流程
 */
export async function insertAiLog(entry: AiLogEntry): Promise<number | null> {
  // 检查环境变量配置
  if (!process.env.AI_DATABASE_URL) {
    console.warn("[AI-LOGS-INSERT] Skipped: AI_DATABASE_URL not configured", {
      from: entry.from,
      userId: entry.userId,
      questionLength: entry.question.length,
      answerLength: entry.answer.length,
    });
    throw new Error("AI_DATABASE_URL not configured");
  }

  console.log(`[AI-LOGS-INSERT] Starting insert for from: ${entry.from}, question: "${entry.question.substring(0, 30)}..."`);

  const cleanedQuestion = cleanTextField(entry.question);
  const cleanedAnswer = cleanTextField(entry.answer);
  const normalizedSources = normalizeJsonValue(entry.sources ?? null);

  const inserted = await aiDb
    .insertInto("ai_logs")
    .values({
      user_id: entry.userId,
      question: cleanedQuestion,
      answer: cleanedAnswer,
      from: entry.from,
      locale: entry.locale,
      model: entry.model,
      rag_hits: entry.ragHits ?? null,
      safety_flag: entry.safetyFlag ?? "ok",
      cost_est: entry.costEst ?? null,
      sources: normalizedSources,
      ai_provider: entry.aiProvider ?? null,
      cached: entry.cached ?? false,
      context_tag: entry.contextTag ?? null,
      created_at: new Date(),
    })
    .returning("id")
    .executeTakeFirst();

  const insertedId = inserted?.id != null ? Number(inserted.id) : null;

  console.log(`[AI-LOGS-INSERT] Successfully inserted ai_log for from: ${entry.from}`, {
    userId: entry.userId,
    questionLength: entry.question.length,
    answerLength: entry.answer.length,
    insertedId,
  });

  return insertedId;
}

export function getAiDbPoolStats(): AiDbPoolStats | null {
  if (!aiDbPool) {
    // 如果 Pool 还没有创建，尝试初始化数据库实例
    try {
      // 触发数据库实例创建（这会创建 Pool）
      const _ = aiDb;
      // 如果还是 null，说明可能是占位符或构建时
      if (!aiDbPool) {
        return null;
      }
    } catch (err) {
      console.error("[getAiDbPoolStats] Failed to initialize AI database:", err);
      return null;
    }
  }

  try {
    // pg Pool 对象的属性（使用私有属性或公共属性）
    // 注意：pg Pool 可能使用不同的属性名，这里尝试多种方式
    const poolAny = aiDbPool as any;
    
    // 尝试获取连接池统计信息
    // pg Pool 可能使用以下属性：
    // - totalCount: 总连接数
    // - idleCount: 空闲连接数  
    // - waitingCount: 等待连接的请求数
    // 或者使用私有属性：
    // - _clients: 客户端数组
    // - _idle: 空闲客户端数组
    // - _waiting: 等待队列
    
    let total = 0;
    let idle = 0;
    let waiting = 0;
    
    // 方法1: 尝试使用公共属性
    if (typeof poolAny.totalCount === 'number') {
      total = poolAny.totalCount;
      idle = poolAny.idleCount ?? 0;
      waiting = poolAny.waitingCount ?? 0;
    } 
    // 方法2: 尝试使用私有属性
    else if (Array.isArray(poolAny._clients)) {
      total = poolAny._clients.length;
      idle = Array.isArray(poolAny._idle) ? poolAny._idle.length : 0;
      waiting = Array.isArray(poolAny._waiting) ? poolAny._waiting.length : 0;
    }
    // 方法3: 如果都不可用，返回默认值
    else {
      // 无法获取实际统计，返回默认值
      console.warn("[getAiDbPoolStats] Unable to get pool statistics, using defaults");
      total = 0;
      idle = 0;
      waiting = 0;
    }
    
    const active = Math.max(0, total - idle);
    const maxConnections = poolAny.options?.max ?? 20;
    const usageRate = maxConnections > 0 ? Math.min(1, active / maxConnections) : 0;

    // 判断状态
    let status: "healthy" | "warning" | "critical" = "healthy";
    if (usageRate >= 0.9 || waiting > 10) {
      status = "critical";
    } else if (usageRate >= 0.7 || waiting > 0) {
      status = "warning";
    }

    return {
      total,
      idle,
      active,
      waiting,
      usageRate,
      status,
    };
  } catch (err) {
    console.error("[getAiDbPoolStats] Error getting pool stats:", err);
    return null;
  }
}

