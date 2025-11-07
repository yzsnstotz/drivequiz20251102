-- ============================================================
-- ZALEM AI 模块：从 OpenAI (1536维) 迁移到 Ollama (768维)
-- 文件名: 20250115_migrate_to_ollama_768d.sql
-- 说明: 将 ai_vectors 表的 embedding 列从 vector(1536) 改为 vector(768)
--       并更新 match_documents 函数参数
-- 日期: 2025-01-15
-- ⚠️ 警告: 此迁移会删除现有向量数据并重建索引
-- ============================================================

BEGIN;

-- ============================================================
-- 步骤1: 检查并备份现有数据（可选）
-- ============================================================
-- 注意: 如果 ai_vectors 表中有重要数据，请先备份
-- 此迁移会删除所有现有向量数据

-- ============================================================
-- 步骤2: 删除旧的向量索引
-- ============================================================
DROP INDEX IF EXISTS idx_ai_vectors_embedding;

-- ============================================================
-- 步骤3: 删除现有向量数据（因为维度不匹配无法直接转换）
-- ============================================================
-- 注意: 如果需要保留数据，请先导出，然后重新生成 768 维向量
-- 这里直接清空表（因为向量维度不兼容）
TRUNCATE TABLE ai_vectors;

-- ============================================================
-- 步骤4: 修改 embedding 列类型从 vector(1536) 改为 vector(768)
-- ============================================================
-- 注意: PostgreSQL 不允许直接修改 vector 类型的维度
-- 需要先删除列，再重新创建
ALTER TABLE ai_vectors DROP COLUMN IF EXISTS embedding;
ALTER TABLE ai_vectors ADD COLUMN embedding vector(768);

-- ============================================================
-- 步骤5: 重建向量索引（ivfflat，768维）
-- ============================================================
-- 创建新的 ivfflat 索引（使用 cosine 距离）
CREATE INDEX idx_ai_vectors_embedding ON ai_vectors 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================
-- 步骤6: 更新 match_documents 函数参数从 vector(1536) 改为 vector(768)
-- ============================================================
DROP FUNCTION IF EXISTS match_documents(vector, float, int);

CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.75,
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
    1 - (ai_vectors.embedding <=> query_embedding) AS similarity
  FROM ai_vectors
  WHERE 
    (1 - (ai_vectors.embedding <=> query_embedding)) > match_threshold
  ORDER BY 
    ai_vectors.embedding <=> query_embedding ASC
  LIMIT match_count;
$$;

-- 添加函数注释
COMMENT ON FUNCTION match_documents IS '根据查询向量检索最相似的文档片段（768维），返回相似度大于阈值的记录';

COMMIT;

-- ============================================================
-- 验证迁移结果
-- ============================================================
-- 执行以下 SQL 验证迁移是否成功：
-- 
-- 1. 检查表结构
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'ai_vectors' AND column_name = 'embedding';
-- -- 预期结果: vector(768)
--
-- 2. 检查函数参数
-- SELECT pg_get_function_arguments(oid) 
-- FROM pg_proc 
-- WHERE proname = 'match_documents';
-- -- 预期结果: query_embedding vector(768), match_threshold double precision, match_count integer
--
-- 3. 检查索引
-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE tablename = 'ai_vectors' AND indexname = 'idx_ai_vectors_embedding';
-- -- 预期结果: 包含 vector(768) 和 ivfflat

-- ============================================================
-- 回滚指令（如需撤销）
-- ============================================================
-- 注意: 回滚会丢失所有向量数据
-- 
-- BEGIN;
-- DROP INDEX IF EXISTS idx_ai_vectors_embedding;
-- TRUNCATE TABLE ai_vectors;
-- ALTER TABLE ai_vectors DROP COLUMN IF EXISTS embedding;
-- ALTER TABLE ai_vectors ADD COLUMN embedding vector(1536);
-- CREATE INDEX idx_ai_vectors_embedding ON ai_vectors 
--   USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
-- DROP FUNCTION IF EXISTS match_documents(vector, float, int);
-- -- 重新创建 1536 维的 match_documents 函数（参考原始脚本）
-- COMMIT;

