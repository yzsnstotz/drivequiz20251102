import { Kysely, PostgresDialect, Generated } from "kysely";
import { Pool } from "pg";

// ============================================================
// 数据库表结构定义
// ============================================================

/** rag_documents 表结构 */
interface RagDocumentsTable {
  id: Generated<number>;
  doc_id: string;
  title: string;
  url: string;
  content: string;
  content_hash: string;
  version: string;
  lang: string;
  source_id: string;
  doc_type: string | null;
  vectorization_status: "pending" | "processing" | "completed" | "failed";
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

/** rag_operations 表结构 */
interface RagOperationsTable {
  id: Generated<number>;
  operation_id: string;
  source_id: string;
  status: "pending" | "processing" | "success" | "failed";
  docs_count: number;
  failed_count: number;
  metadata: Record<string, unknown>; // JSONB
  created_at: Generated<Date>;
  completed_at: Date | null;
  updated_at: Generated<Date>;
}

/** rag_operation_documents 表结构 */
interface RagOperationDocumentsTable {
  id: Generated<number>;
  operation_id: string;
  doc_id: string | null;
  status: "success" | "failed";
  error_code: string | null;
  error_message: string | null;
  created_at: Generated<Date>;
}

/** rag_upload_history 表结构 */
interface RagUploadHistoryTable {
  id: Generated<number>;
  url: string;
  content_hash: string;
  version: string;
  title: string;
  source_id: string;
  lang: string;
  status: "pending" | "success" | "rejected" | "failed";
  rejection_reason: string | null;
  operation_id: string | null;
  doc_id: string | null;
  uploaded_at: Generated<Date>;
}

/** 数据库接口 */
export interface Database {
  rag_documents: RagDocumentsTable;
  rag_operations: RagOperationsTable;
  rag_operation_documents: RagOperationDocumentsTable;
  rag_upload_history: RagUploadHistoryTable;
}

// ============================================================
// 数据库连接配置
// ============================================================

/**
 * 获取数据库连接字符串
 */
function getConnectionString(): string {
  const connectionString =
    process.env.DRIVEQUIZ_DB_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL;

  if (!connectionString) {
    throw new Error(
      "Missing database connection string. Please set DRIVEQUIZ_DB_URL, DATABASE_URL, or POSTGRES_URL"
    );
  }

  return connectionString;
}

/**
 * 创建数据库实例
 */
export function createDbInstance(): Kysely<Database> {
  const connectionString = getConnectionString();

  // 检测是否需要 SSL 连接（Supabase 必须使用 SSL）
  const isSupabase =
    connectionString.includes("supabase.com") ||
    connectionString.includes("sslmode=require");

  const poolConfig: {
    connectionString: string;
    ssl?: boolean | { rejectUnauthorized: boolean };
    max?: number;
    min?: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
  } = {
    connectionString,
    max: 20,
    min: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };

  // Supabase 必须使用 SSL，但需要接受自签名证书
  if (isSupabase) {
    poolConfig.ssl = {
      rejectUnauthorized: false, // Supabase 使用自签名证书
    };
    
    // 设置环境变量以允许自签名证书（仅用于 Supabase）
    if (!process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }
  }

  const pool = new Pool(poolConfig);

  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool,
    }),
  });
}

/** 数据库实例（单例） */
let dbInstance: Kysely<Database> | null = null;

/**
 * 获取数据库实例（单例模式）
 */
export function getDb(): Kysely<Database> {
  if (!dbInstance) {
    dbInstance = createDbInstance();
  }
  return dbInstance;
}

