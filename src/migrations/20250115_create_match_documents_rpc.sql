-- ============================================================
-- ZALEM AI 问答模块 RPC 函数迁移脚本
-- 文件名: 20250115_create_match_documents_rpc.sql
-- 说明: 创建 match_documents RPC 函数用于向量相似度检索
-- 日期: 2025-01-15
-- ============================================================

-- 注意: 此函数需要 pgvector 扩展支持
-- 如果 pgvector 扩展未启用，执行此脚本会报错

BEGIN;

-- 确保 pgvector 扩展已启用
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- match_documents - 向量相似度检索函数
-- ============================================================
-- 功能: 根据查询向量和相似度阈值，返回最相似的文档片段
-- 参数:
--   - query_embedding: vector(1536) - 查询向量
--   - match_threshold: float - 相似度阈值 (0.0-1.0)
--   - match_count: int - 返回结果数量上限
-- 返回: 表结构包含 id, doc_id, content, source_title, source_url, version, similarity
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
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
AS $$
  SELECT 
    ai_vectors.id,
    ai_vectors.doc_id,
    ai_vectors.content,
    ai_vectors.source_title,
    ai_vectors.source_url,
    ai_vectors.version,
    -- 计算余弦相似度: 1 - (embedding <=> query_embedding)
    -- <=> 是 pgvector 的余弦距离操作符
    -- 距离越小相似度越高，所以用 1 - 距离得到相似度
    1 - (ai_vectors.embedding <=> query_embedding) AS similarity
  FROM ai_vectors
  WHERE 
    -- 筛选相似度大于阈值的记录
    -- 注意: embedding <=> query_embedding 返回距离，距离越小越相似
    -- 所以条件应该写为: 1 - (embedding <=> query_embedding) > match_threshold
    -- 或者: embedding <=> query_embedding < (1 - match_threshold)
    (1 - (ai_vectors.embedding <=> query_embedding)) > match_threshold
  ORDER BY 
    -- 按相似度降序排列（距离越小越相似）
    ai_vectors.embedding <=> query_embedding ASC
  LIMIT match_count;
$$;

-- 添加函数注释
COMMENT ON FUNCTION match_documents IS '根据查询向量检索最相似的文档片段，返回相似度大于阈值的记录';

COMMIT;

-- ============================================================
-- 回滚指令（如需撤销）
-- ============================================================
-- DROP FUNCTION IF EXISTS match_documents(vector, float, int);

