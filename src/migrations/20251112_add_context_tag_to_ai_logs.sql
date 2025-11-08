-- ============================================================
-- ZALEM AI 服务 - 添加 context_tag 字段到 ai_logs 表
-- 文件名: 20251112_add_context_tag_to_ai_logs.sql
-- 说明: 为 ai_logs 表添加 context_tag 字段，支持多 context 分类（license/vehicle/service）
-- 日期: 2025-11-12
-- 数据库: ai_service (或 drivequiz，取决于配置)
-- ============================================================

BEGIN;

-- ============================================================
-- 1️⃣ 添加 context_tag 字段到 ai_logs 表
-- ============================================================
DO $$
BEGIN
  -- 首先检查表是否存在
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'ai_logs'
  ) THEN
    -- 检查字段是否已存在
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'ai_logs' AND column_name = 'context_tag'
    ) THEN
      ALTER TABLE ai_logs 
      ADD COLUMN context_tag VARCHAR(20) DEFAULT NULL;
      
      -- 添加检查约束
      ALTER TABLE ai_logs 
      ADD CONSTRAINT ai_logs_context_tag_check 
      CHECK (context_tag IS NULL OR context_tag IN ('license', 'vehicle', 'service', 'general'));
      
      -- 创建索引
      CREATE INDEX IF NOT EXISTS idx_ai_logs_context_tag ON ai_logs(context_tag);
      
      -- 创建复合索引：context_tag + created_at（用于按context统计）
      CREATE INDEX IF NOT EXISTS idx_ai_logs_context_tag_created_at 
      ON ai_logs(context_tag, created_at DESC);
    END IF;
  ELSE
    RAISE NOTICE '表 ai_logs 不存在，跳过添加 context_tag 字段';
  END IF;
END $$;

-- ============================================================
-- 2️⃣ 更新 ai_daily_summary 表添加 context_distribution 字段
-- ============================================================
DO $$
BEGIN
  -- 首先检查表是否存在
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'ai_daily_summary'
  ) THEN
    -- 检查字段是否已存在
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'ai_daily_summary' AND column_name = 'context_distribution'
    ) THEN
      ALTER TABLE ai_daily_summary 
      ADD COLUMN context_distribution JSONB DEFAULT '{}';
      
      -- 创建 GIN 索引（用于 JSONB 查询）
      CREATE INDEX IF NOT EXISTS idx_ai_daily_summary_context_distribution 
      ON ai_daily_summary USING GIN (context_distribution);
    END IF;
  ELSE
    RAISE NOTICE '表 ai_daily_summary 不存在，跳过添加 context_distribution 字段';
  END IF;
END $$;

COMMIT;

-- ============================================================
-- 验证查询
-- ============================================================
-- 检查字段是否添加成功：
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'ai_logs' AND column_name = 'context_tag';
--
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'ai_daily_summary' AND column_name = 'context_distribution';
--
-- 检查索引是否创建成功：
-- SELECT indexname FROM pg_indexes 
-- WHERE tablename = 'ai_logs' AND indexname LIKE '%context_tag%';

