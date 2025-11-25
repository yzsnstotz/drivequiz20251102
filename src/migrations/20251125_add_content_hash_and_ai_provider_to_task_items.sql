-- ============================================================
-- 为 question_processing_task_items 表添加 content_hash 和 aiProvider 字段
-- 文件名: 20251125_add_content_hash_and_ai_provider_to_task_items.sql
-- 说明: 
--   1. 添加 content_hash 字段，记录题目的 content_hash
--   2. 添加 ai_provider 字段，记录每个任务所使用的 AI provider
--   3. 修改 status 字段类型，添加 "partially_succeeded" 状态
-- 日期: 2025-11-25
-- 数据库: 主程序数据库（drivequiz）
-- ============================================================

BEGIN;

-- 1. 添加 content_hash 字段
ALTER TABLE question_processing_task_items
ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64);

-- 添加索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_question_processing_task_items_content_hash 
ON question_processing_task_items(content_hash);

-- 添加注释
COMMENT ON COLUMN question_processing_task_items.content_hash IS '题目的 content_hash，用于关联题目';

-- 2. 添加 ai_provider 字段
ALTER TABLE question_processing_task_items
ADD COLUMN IF NOT EXISTS ai_provider VARCHAR(50);

-- 添加索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_question_processing_task_items_ai_provider 
ON question_processing_task_items(ai_provider);

-- 添加注释
COMMENT ON COLUMN question_processing_task_items.ai_provider IS 'AI 服务提供商（如 openai, openrouter, gemini, local 等）';

-- 3. 修改 status 字段类型，添加 "partially_succeeded" 状态
-- 注意：PostgreSQL 的 CHECK 约束需要先删除旧的约束，然后添加新的约束
-- 首先检查是否存在旧的约束
DO $$
BEGIN
  -- 删除旧的 status 约束（如果存在）
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'question_processing_task_items_status_check'
  ) THEN
    ALTER TABLE question_processing_task_items 
    DROP CONSTRAINT question_processing_task_items_status_check;
  END IF;
  
  -- 添加新的 status 约束，包含 "partially_succeeded"
  ALTER TABLE question_processing_task_items
  ADD CONSTRAINT question_processing_task_items_status_check 
  CHECK (status IN ('pending', 'processing', 'succeeded', 'partially_succeeded', 'failed', 'skipped'));
END $$;

-- 添加注释
COMMENT ON COLUMN question_processing_task_items.status IS '任务状态：pending(待处理), processing(处理中), succeeded(成功), partially_succeeded(部分成功), failed(失败), skipped(跳过)';

COMMIT;

