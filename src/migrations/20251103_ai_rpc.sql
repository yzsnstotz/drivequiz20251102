-- ============================================================
-- ZALEM AI 问答模块 RPC 函数迁移脚本
-- 文件名: 20251103_ai_rpc.sql
-- 说明: 创建 match_documents RPC 函数用于向量相似度检索
-- 日期: 2025-11-03
-- ============================================================

CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
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
LANGUAGE sql STABLE AS $$
  SELECT id, doc_id, content, source_title, source_url, version,
         1 - (embedding <=> query_embedding) AS similarity
  FROM ai_vectors
  WHERE 1 - (embedding <=> query_embedding) >= match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

