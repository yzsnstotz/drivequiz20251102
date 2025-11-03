-- ============================================================
-- ZALEM AI 问答模块核心表迁移脚本
-- 文件名: 20251103_ai_core.sql
-- 说明: 首次/幂等可执行；确保 pgvector 可用
-- 日期: 2025-11-03
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

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
CREATE INDEX IF NOT EXISTS idx_ai_logs_created_at ON ai_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_logs_user_id  ON ai_logs (user_id);

CREATE TABLE IF NOT EXISTS ai_filters (
  id BIGSERIAL PRIMARY KEY,
  type VARCHAR(32) NOT NULL,      -- not-driving / sensitive
  pattern TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_rag_docs (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT,
  version VARCHAR(32),
  chunks INTEGER DEFAULT 0,
  uploaded_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_rag_docs_created_at ON ai_rag_docs (created_at DESC);

CREATE TABLE IF NOT EXISTS ai_daily_summary (
  date DATE PRIMARY KEY,
  total_calls INTEGER,
  avg_cost NUMERIC(10,4),
  cache_hit_rate NUMERIC(4,2),
  rag_hit_rate NUMERIC(4,2),
  top_questions JSONB,
  new_topics JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

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
CREATE INDEX IF NOT EXISTS idx_ai_vectors_doc_id    ON ai_vectors (doc_id);
CREATE INDEX IF NOT EXISTS idx_ai_vectors_version   ON ai_vectors (version);
DROP INDEX IF EXISTS idx_ai_vectors_embedding;
CREATE INDEX idx_ai_vectors_embedding ON ai_vectors USING ivfflat (embedding vector_cosine_ops);

