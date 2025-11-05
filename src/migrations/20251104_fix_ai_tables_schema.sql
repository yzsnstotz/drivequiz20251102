-- ============================================================
-- 修复 AI 表结构以匹配路由代码
-- 文件名: 20251104_fix_ai_tables_schema.sql
-- 说明: 添加缺失的字段以匹配 API 路由代码
-- 日期: 2025-11-04
-- ============================================================

BEGIN;

-- ============================================================
-- 1. 修复 ai_filters 表 - 添加 updated_at 字段和唯一索引
-- ============================================================
ALTER TABLE ai_filters 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 更新现有记录的 updated_at
UPDATE ai_filters 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- 创建唯一索引（如果不存在）- 用于 ON CONFLICT
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_filters_type_unique ON ai_filters(type);

-- ============================================================
-- 2. 修复 ai_rag_docs 表 - 添加缺失字段
-- ============================================================
ALTER TABLE ai_rag_docs 
ADD COLUMN IF NOT EXISTS lang VARCHAR(8),
ADD COLUMN IF NOT EXISTS tags JSONB,
ADD COLUMN IF NOT EXISTS status VARCHAR(16) DEFAULT 'ready',
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 更新现有记录的 updated_at
UPDATE ai_rag_docs 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_ai_rag_docs_lang ON ai_rag_docs (lang);
CREATE INDEX IF NOT EXISTS idx_ai_rag_docs_status ON ai_rag_docs (status);

-- ============================================================
-- 3. 修复 ai_logs 表 - 添加 language 字段
-- 注意: 路由代码查询 language 字段，但表中可能只有 locale
-- 添加 language 字段并同步 locale 数据
-- ============================================================
ALTER TABLE ai_logs 
ADD COLUMN IF NOT EXISTS language VARCHAR(8);

-- 同步 locale 到 language（如果存在数据且 language 为空）
UPDATE ai_logs 
SET language = locale 
WHERE language IS NULL AND locale IS NOT NULL;

-- 如果表中有 locale 但没有 language，创建索引
CREATE INDEX IF NOT EXISTS idx_ai_logs_language ON ai_logs (language);

COMMIT;

