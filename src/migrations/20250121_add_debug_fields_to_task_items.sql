-- ============================================================
-- 为 question_processing_task_items 表添加调试字段
-- 文件名: 20250121_add_debug_fields_to_task_items.sql
-- 说明: 添加字段来存储 AI 请求、响应和处理后的数据，方便调试
-- 日期: 2025-01-21
-- 数据库: 主程序数据库（drivequiz）
-- ============================================================

BEGIN;

-- 添加调试字段
ALTER TABLE question_processing_task_items
ADD COLUMN IF NOT EXISTS ai_request JSONB,         -- AI 请求体（完整内容）
ADD COLUMN IF NOT EXISTS ai_response JSONB,        -- AI 响应（完整内容）
ADD COLUMN IF NOT EXISTS processed_data JSONB;     -- 处理后要入库的数据

-- 添加注释
COMMENT ON COLUMN question_processing_task_items.ai_request IS 'AI 请求体（完整内容），用于调试';
COMMENT ON COLUMN question_processing_task_items.ai_response IS 'AI 响应（完整内容），用于调试';
COMMENT ON COLUMN question_processing_task_items.processed_data IS '处理后要入库的数据（content, explanation等），用于调试';

COMMIT;

