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
}

// ------------------------------------------------------------
// 数据库连接配置
// 使用 AI_DATABASE_URL 环境变量，DIRECT 连接方式（端口 5432）
// ------------------------------------------------------------

let aiDbInstance: Kysely<AiDatabase> | null = null;

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

function createAiDbInstance(): Kysely<AiDatabase> {
  const connectionString = getAiConnectionString();

  const isPlaceholder = connectionString === 'postgresql://placeholder:placeholder@placeholder:5432/placeholder';
  
  if (isPlaceholder) {
    return createPlaceholderAiDb();
  }

  // 检测是否需要SSL连接（Supabase必须使用SSL）
  const isSupabase = connectionString && (
    connectionString.includes('supabase.com') || 
    connectionString.includes('supabase.co') ||
    connectionString.includes('sslmode=require')
  );

  // 创建 Pool 配置对象
  const poolConfig: {
    connectionString: string;
    ssl?: { rejectUnauthorized: boolean };
  } = {
    connectionString,
  };

  // Supabase 必须使用 SSL，但证书链可能有自签名证书
  if (isSupabase) {
    poolConfig.ssl = {
      rejectUnauthorized: false,
    };
  }

  // 创建 Pool 实例并传递给 PostgresDialect
  const pool = new Pool(poolConfig);
  
  // 只在开发环境中设置 NODE_TLS_REJECT_UNAUTHORIZED（生产环境不应禁用证书验证）
  try {
    if ((process.env.NODE_ENV === 'development' || !process.env.VERCEL) && !process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
      console.log('[AI DB] ⚠️  Set NODE_TLS_REJECT_UNAUTHORIZED=0 for Supabase SSL (development only)');
    } else if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
      console.log('[AI DB] ℹ️  Using SSL with rejectUnauthorized: false (production mode, not setting NODE_TLS_REJECT_UNAUTHORIZED)');
    }
  } catch (e) {
    console.error('[AI DB] Failed to set NODE_TLS_REJECT_UNAUTHORIZED:', e);
  }

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

