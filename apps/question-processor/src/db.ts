import { Kysely, PostgresDialect, Generated, Selectable, Insertable } from "kysely";
import { Pool, PoolConfig } from "pg";

interface QuestionTable {
  id: Generated<number>;
  content_hash: string;
  type: "single" | "multiple" | "truefalse";
  content: {
    zh: string;
    en?: string;
    ja?: string;
    [key: string]: string | undefined; // 支持其他语言
  }; // JSONB - 多语言内容对象
  options: any | null;
  correct_answer: any | null;
  image: string | null;
  explanation: {
    zh: string;
    en?: string;
    ja?: string;
    [key: string]: string | undefined; // 支持其他语言
  } | null; // JSONB - 多语言解析对象
  license_types: string[] | null; // 兼容旧字段（数组）
  license_type_tag: string[] | null; // 驾照类型标签（数组，可包含多个值）
  category: string | null; // 题目分类（如 "12"）
  stage_tag: "both" | "provisional" | "regular" | null; // 阶段标签（兼容旧值，新值应为 "provisional" | "full" | "both"）
  topic_tags: string[] | null; // 主题标签数组（如 ['traffic_sign']）
  version: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

interface LanguageTable {
  id: Generated<number>;
  locale: string;
  name: string;
  enabled: boolean;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

interface QuestionTranslationsTable {
  id: Generated<number>;
  content_hash: string;
  locale: string;
  content: string;
  options: any | null;
  explanation: string | null;
  image: string | null;
  source: string | null;
  created_by: string | null;
  category: string | null; // 题目分类（冗余字段，从questions表同步）
  stage_tag: "both" | "provisional" | "regular" | null; // 阶段标签（冗余字段）
  topic_tags: string[] | null; // 主题标签数组（冗余字段）
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

interface QuestionPolishReviewsTable {
  id: Generated<number>;
  content_hash: string;
  locale: string;
  proposed_content: string;
  proposed_options: any | null;
  proposed_explanation: string | null;
  status: "pending" | "approved" | "rejected";
  notes: string | null;
  created_by: string | null;
  reviewed_by: string | null;
  category: string | null; // 题目分类（冗余字段，从questions表同步）
  stage_tag: "both" | "provisional" | "regular" | null; // 阶段标签（冗余字段）
  topic_tags: string[] | null; // 主题标签数组（冗余字段）
  created_at: Generated<Date>;
  reviewed_at: Date | null;
  updated_at: Generated<Date>;
}

interface QuestionPolishHistoryTable {
  id: Generated<number>;
  content_hash: string;
  locale: string;
  old_content: string | null;
  old_options: any | null;
  old_explanation: string | null;
  new_content: string;
  new_options: any | null;
  new_explanation: string | null;
  approved_by: string | null;
  category: string | null; // 题目分类（冗余字段，从questions表同步）
  stage_tag: "both" | "provisional" | "regular" | null; // 阶段标签（冗余字段）
  topic_tags: string[] | null; // 主题标签数组（冗余字段）
  approved_at: Generated<Date>;
  created_at: Generated<Date>;
}

interface QuestionAiAnswerTable {
  id: Generated<number>;
  question_hash: string;
  locale: string;
  answer: string;
  sources: any | null;
  model: string | null;
  created_by: string | null;
  view_count: number;
  category: string | null; // 题目分类（冗余字段，从questions表同步）
  stage_tag: "both" | "provisional" | "regular" | null; // 阶段标签（冗余字段）
  topic_tags: string[] | null; // 主题标签数组（冗余字段）
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

interface BatchProcessTasksTable {
  id: Generated<number>;
  task_id: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  operations: string[];
  question_ids: number[] | null;
  translate_options: any | null;
  polish_options: any | null;
  batch_size: number;
  continue_on_error: boolean;
  total_questions: number;
  processed_count: number;
  succeeded_count: number;
  failed_count: number;
  current_batch: number;
  errors: any | null;
  details: any | null;
  created_by: string | null;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

interface Database {
  questions: QuestionTable;
  languages: LanguageTable;
  question_translations: QuestionTranslationsTable;
  question_polish_reviews: QuestionPolishReviewsTable;
  question_polish_history: QuestionPolishHistoryTable;
  question_ai_answers: QuestionAiAnswerTable;
  batch_process_tasks: BatchProcessTasksTable;
}

export type DB = Kysely<Database>;

function getConnectionString(): string {
  const url =
    process.env.QUESTION_PROCESSOR_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL;
  if (!url) {
    const error = "Missing database connection string. Please set QUESTION_PROCESSOR_DATABASE_URL, DATABASE_URL, or POSTGRES_URL environment variable.";
    console.error("[Question Processor DB] ❌", error);
    throw new Error(error);
  }
  
  // 记录连接字符串（隐藏密码）
  const maskedUrl = url.replace(/:([^:@]+)@/, ':***@');
  console.log("[Question Processor DB] ✅ Using connection:", maskedUrl.substring(0, 80) + '...');
  
  return url;
}

export function createDb(): DB {
  const connectionString = getConnectionString();
  
  // 检测是否需要 SSL 连接（Supabase 必须使用 SSL）
  const isSupabase = connectionString.includes('supabase.com');
  
  const poolConfig: PoolConfig = {
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };
  
  // Supabase 必须使用 SSL
  if (isSupabase) {
    poolConfig.ssl = {
      rejectUnauthorized: false, // Supabase 可能需要这个设置
    };
    console.log("[Question Processor DB] ✅ SSL enabled for Supabase connection");
  } else {
    console.log("[Question Processor DB] ℹ️  SSL not enabled (not Supabase connection)");
  }
  
  const pool = new Pool(poolConfig);
  
  // 添加连接错误监听
  pool.on('error', (err) => {
    console.error("[Question Processor DB] ❌ Pool error:", err.message);
  });
  
  // 添加连接成功监听
  pool.on('connect', () => {
    console.log("[Question Processor DB] ✅ New client connected");
  });
  
  const dialect = new PostgresDialect({ pool });
  const db = new Kysely<Database>({ dialect });
  
  console.log("[Question Processor DB] ✅ Database instance created");
  
  return db;
}

export type QuestionRow = Selectable<QuestionTable>;
export type QuestionTranslationRow = Selectable<QuestionTranslationsTable>;
export type InsertQuestionTranslation = Insertable<QuestionTranslationsTable>;
export type InsertPolishReview = Insertable<QuestionPolishReviewsTable>;
export type PolishReviewRow = Selectable<QuestionPolishReviewsTable>;
export type BatchProcessTaskRow = Selectable<BatchProcessTasksTable>;
export type InsertBatchProcessTask = Insertable<BatchProcessTasksTable>;


