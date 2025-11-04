-- ============================================================
-- 为 ai_logs 表添加 sources 字段
-- 文件名: 20251105_add_sources_to_ai_logs.sql
-- 说明: 添加 JSONB 字段用于存储来源信息
-- 日期: 2025-11-05
-- ============================================================

BEGIN;

-- 添加 sources 字段（JSONB 类型，用于存储来源信息数组）
ALTER TABLE ai_logs 
ADD COLUMN IF NOT EXISTS sources JSONB DEFAULT '[]'::jsonb;

-- 创建索引以支持 JSONB 查询（可选）
CREATE INDEX IF NOT EXISTS idx_ai_logs_sources ON ai_logs USING gin (sources);

COMMIT;

