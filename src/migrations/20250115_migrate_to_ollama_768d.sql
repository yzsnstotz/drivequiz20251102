-- ============================================================
-- 迁移向量维度：从 1536（OpenAI）到 768（Ollama nomic-embed-text）
-- 文件名: 20250115_migrate_to_ollama_768d.sql
-- 说明: 将 ai_vectors 表和 match_documents 函数改为 768 维
-- 日期: 2025-01-15
-- 前提: 数据库为空或可以安全迁移
-- ============================================================

BEGIN;

-- ============================================================
-- 1. 删除旧的向量索引（如果存在）
-- ============================================================
DROP INDEX IF EXISTS idx_ai_vectors_embedding;

-- ============================================================
-- 2. 删除旧表（如果数据库为空，可以直接删除重建）
-- ============================================================
-- 注意：如果表中已有数据，需要先备份或迁移
-- 这里假设数据库为空，直接删除重建

DROP TABLE IF EXISTS ai_vectors CASCADE;

-- ============================================================
-- 3. 重建 ai_vectors 表（使用 768 维）
-- ============================================================
CREATE TABLE ai_vectors (
  id BIGSERIAL PRIMARY KEY,
  doc_id VARCHAR(64),
  content TEXT,
  embedding vector(768),  -- 改为 768 维（Ollama nomic-embed-text）
  source_title TEXT,
  source_url TEXT,
  version VARCHAR(32),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 4. 创建索引
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_ai_vectors_doc_id ON ai_vectors (doc_id);
CREATE INDEX IF NOT EXISTS idx_ai_vectors_version ON ai_vectors (version);

-- 创建向量索引（使用 ivfflat，适合 768 维）
CREATE INDEX idx_ai_vectors_embedding ON ai_vectors 
  USING ivfflat (embedding vector_cosine_ops) 
  WITH (lists = 100);

-- ============================================================
-- 5. 更新 match_documents 函数（使用 768 维）
-- ============================================================
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(768),  -- 改为 768 维
  match_threshold float DEFAULT 0.75,
  match_count int DEFAULT 3
)
RETURNS TABLE (
  id bigint,
  doc_id varchar,
  content text,
  source_title text,
  source_url text,
  version varchar,
  similarity float
)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, doc_id, content, source_title, source_url, version,
         1 - (embedding <=> query_embedding) AS similarity
  FROM ai_vectors
  WHERE 1 - (embedding <=> query_embedding) >= match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

-- 添加函数注释
COMMENT ON FUNCTION match_documents IS '根据查询向量（768维）检索最相似的文档片段，返回相似度大于阈值的记录。适配 Ollama nomic-embed-text 模型。';

COMMIT;

-- ============================================================
-- 验证脚本（可选）
-- ============================================================
-- 检查表结构：
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'ai_vectors' AND column_name = 'embedding';
-- 
-- 结果应该是: vector(768)

-- 检查函数参数：
-- SELECT pg_get_function_arguments(oid) 
-- FROM pg_proc 
-- WHERE proname = 'match_documents';
-- 
-- 结果应该是: query_embedding vector(768), match_threshold double precision DEFAULT 0.75, match_count integer DEFAULT 3

