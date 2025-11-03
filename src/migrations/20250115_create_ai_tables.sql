-- ============================================================
-- ZALEM AI 问答模块数据库迁移脚本
-- 文件名: 20250115_create_ai_tables.sql
-- 说明: 创建 AI 问答模块所需的 5 个数据表
-- 日期: 2025-01-15
-- ============================================================

BEGIN;

-- ============================================================
-- 1️⃣ ai_logs - 问答日志表
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  question TEXT NOT NULL,
  answer TEXT,
  locale VARCHAR(8) DEFAULT 'ja',
  model VARCHAR(32),
  rag_hits INTEGER DEFAULT 0,
  cost_est NUMERIC(10,4),
  safety_flag VARCHAR(16) DEFAULT 'ok',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_logs_created_at ON ai_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_logs_user_id ON ai_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_logs_model ON ai_logs(model);

-- ============================================================
-- 2️⃣ ai_filters - 禁答关键词规则表
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_filters (
  id BIGSERIAL PRIMARY KEY,
  type VARCHAR(32) NOT NULL,       -- not-driving / sensitive
  pattern TEXT NOT NULL,           -- 正则表达式
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_filters_type ON ai_filters(type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_filters_type_unique ON ai_filters(type);

-- ============================================================
-- 3️⃣ ai_rag_docs - RAG 文档元数据表
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_rag_docs (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT,
  version VARCHAR(32),
  chunks INTEGER DEFAULT 0,
  uploaded_by UUID,
  lang VARCHAR(8),
  tags TEXT[],
  status VARCHAR(32) DEFAULT 'ready',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_rag_docs_created_at ON ai_rag_docs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_rag_docs_status ON ai_rag_docs(status);
CREATE INDEX IF NOT EXISTS idx_ai_rag_docs_lang ON ai_rag_docs(lang);

-- ============================================================
-- 4️⃣ ai_daily_summary - 每日汇总统计表
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_daily_summary (
  date DATE PRIMARY KEY,
  total_calls INTEGER,
  avg_cost NUMERIC(10,4),
  cache_hit_rate NUMERIC(4,2),
  rag_hit_rate NUMERIC(4,2),
  top_questions JSONB,
  new_topics JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_daily_summary_date ON ai_daily_summary(date DESC);

-- ============================================================
-- 5️⃣ ai_vectors - 向量存储表（需 Supabase pgvector 支持）
-- ============================================================
-- 注意: 此表需要 Supabase 支持 pgvector 扩展
-- 如果 Supabase 不支持，可以先创建表结构，稍后手动启用扩展

-- 先尝试启用 pgvector 扩展（如果不存在会报错，但不影响后续表创建）
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pgvector extension not available, continuing without it. Table structure will be created but vector operations will not work until extension is enabled.';
END $$;

CREATE TABLE IF NOT EXISTS ai_vectors (
  id BIGSERIAL PRIMARY KEY,
  doc_id VARCHAR(64),
  content TEXT,
  embedding vector(1536),
  source_title TEXT,
  source_url TEXT,
  version VARCHAR(32),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 创建向量索引（仅在 pgvector 扩展可用时创建）
DO $$
BEGIN
  -- 尝试创建 ivfflat 索引（如果向量列已存在且扩展可用）
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    -- 删除可能存在的旧索引
    DROP INDEX IF EXISTS idx_ai_vectors_embedding;
    -- 创建新的 ivfflat 索引（使用 cosine 距离）
    CREATE INDEX IF NOT EXISTS idx_ai_vectors_embedding ON ai_vectors 
      USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
    RAISE NOTICE 'Created ivfflat index on ai_vectors.embedding';
  ELSE
    RAISE NOTICE 'pgvector extension not available, skipping index creation.';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not create vector index: %. Index will need to be created manually after enabling pgvector extension.', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS idx_ai_vectors_doc_id ON ai_vectors(doc_id);
CREATE INDEX IF NOT EXISTS idx_ai_vectors_version ON ai_vectors(version);

COMMIT;

-- ============================================================
-- 回滚指令（如需撤销）
-- ============================================================
-- DROP INDEX IF EXISTS idx_ai_vectors_embedding;
-- DROP INDEX IF EXISTS idx_ai_vectors_doc_id;
-- DROP INDEX IF EXISTS idx_ai_vectors_version;
-- DROP INDEX IF EXISTS idx_ai_daily_summary_date;
-- DROP INDEX IF EXISTS idx_ai_rag_docs_lang;
-- DROP INDEX IF EXISTS idx_ai_rag_docs_status;
-- DROP INDEX IF EXISTS idx_ai_rag_docs_created_at;
-- DROP INDEX IF EXISTS idx_ai_filters_type_unique;
-- DROP INDEX IF EXISTS idx_ai_filters_type;
-- DROP INDEX IF EXISTS idx_ai_logs_model;
-- DROP INDEX IF EXISTS idx_ai_logs_user_id;
-- DROP INDEX IF EXISTS idx_ai_logs_created_at;
-- DROP TABLE IF EXISTS ai_vectors;
-- DROP TABLE IF EXISTS ai_daily_summary;
-- DROP TABLE IF EXISTS ai_rag_docs;
-- DROP TABLE IF EXISTS ai_filters;
-- DROP TABLE IF EXISTS ai_logs;

