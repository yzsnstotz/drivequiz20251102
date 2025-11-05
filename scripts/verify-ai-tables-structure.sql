-- ============================================================
-- 验证 AI 相关表结构的 SQL 脚本
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================================

-- 1. 检查所有表是否存在
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_name IN ('ai_config', 'ai_logs', 'ai_filters', 'ai_filters_history', 'ai_rag_docs', 'ai_daily_summary', 'ai_vectors')
ORDER BY table_name;

-- 2. 检查 ai_logs 表的字段（包括 sources）
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'ai_logs'
ORDER BY ordinal_position;

-- 3. 检查 ai_filters 表的字段（包括 status, changed_by, changed_at）
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'ai_filters'
ORDER BY ordinal_position;

-- 4. 检查 ai_rag_docs 表的字段（包括 lang, tags, status, updated_at）
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'ai_rag_docs'
ORDER BY ordinal_position;

-- 5. 检查 ai_config 表的字段
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'ai_config'
ORDER BY ordinal_position;

-- 6. 检查 pgvector 扩展是否已启用
SELECT 
  extname,
  extversion
FROM pg_extension
WHERE extname = 'vector';

-- 7. 检查 ai_vectors 表的 embedding 字段类型
SELECT 
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'ai_vectors'
  AND column_name = 'embedding';

