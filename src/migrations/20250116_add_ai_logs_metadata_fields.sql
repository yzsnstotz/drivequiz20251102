-- ============================================================
-- 迁移脚本: 为 ai_logs 表添加元数据字段
-- 文件名: 20250116_add_ai_logs_metadata_fields.sql
-- 说明: 添加 from、ai_provider、cached 字段，用于标识来源、AI服务提供商和缓存状态
-- 日期: 2025-01-16
-- 数据库: ai_service (或 drivequiz，取决于配置)
-- ============================================================

BEGIN;

-- ============================================================
-- 1️⃣ 添加 from 字段（标识来源：study/question/chat等）
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'ai_logs'
  ) THEN
    -- 检查字段是否已存在
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'ai_logs' AND column_name = 'from'
    ) THEN
      ALTER TABLE ai_logs 
      ADD COLUMN "from" VARCHAR(20) DEFAULT NULL;
      
      -- 创建索引
      CREATE INDEX IF NOT EXISTS idx_ai_logs_from ON ai_logs("from");
      
      RAISE NOTICE '已添加 from 字段到 ai_logs 表';
    ELSE
      RAISE NOTICE 'from 字段已存在，跳过添加';
    END IF;
  ELSE
    RAISE NOTICE '表 ai_logs 不存在，跳过添加 from 字段';
  END IF;
END $$;

-- ============================================================
-- 2️⃣ 添加 ai_provider 字段（标识AI服务提供商）
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'ai_logs'
  ) THEN
    -- 检查字段是否已存在
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'ai_logs' AND column_name = 'ai_provider'
    ) THEN
      ALTER TABLE ai_logs 
      ADD COLUMN ai_provider VARCHAR(32) DEFAULT NULL;
      
      -- 创建索引
      CREATE INDEX IF NOT EXISTS idx_ai_logs_ai_provider ON ai_logs(ai_provider);
      
      RAISE NOTICE '已添加 ai_provider 字段到 ai_logs 表';
    ELSE
      RAISE NOTICE 'ai_provider 字段已存在，跳过添加';
    END IF;
  ELSE
    RAISE NOTICE '表 ai_logs 不存在，跳过添加 ai_provider 字段';
  END IF;
END $$;

-- ============================================================
-- 3️⃣ 添加 cached 字段（标识是否是缓存）
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'ai_logs'
  ) THEN
    -- 检查字段是否已存在
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'ai_logs' AND column_name = 'cached'
    ) THEN
      ALTER TABLE ai_logs 
      ADD COLUMN cached BOOLEAN DEFAULT FALSE;
      
      -- 创建索引
      CREATE INDEX IF NOT EXISTS idx_ai_logs_cached ON ai_logs(cached);
      
      RAISE NOTICE '已添加 cached 字段到 ai_logs 表';
    ELSE
      RAISE NOTICE 'cached 字段已存在，跳过添加';
    END IF;
  ELSE
    RAISE NOTICE '表 ai_logs 不存在，跳过添加 cached 字段';
  END IF;
END $$;

-- ============================================================
-- 4️⃣ 添加 cache_source 字段（标识缓存来源：json/database）
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'ai_logs'
  ) THEN
    -- 检查字段是否已存在
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'ai_logs' AND column_name = 'cache_source'
    ) THEN
      ALTER TABLE ai_logs 
      ADD COLUMN cache_source VARCHAR(20) DEFAULT NULL;
      
      -- 添加检查约束
      ALTER TABLE ai_logs 
      ADD CONSTRAINT ai_logs_cache_source_check 
      CHECK (cache_source IS NULL OR cache_source IN ('json', 'database'));
      
      -- 创建索引
      CREATE INDEX IF NOT EXISTS idx_ai_logs_cache_source ON ai_logs(cache_source);
      
      RAISE NOTICE '已添加 cache_source 字段到 ai_logs 表';
    ELSE
      RAISE NOTICE 'cache_source 字段已存在，跳过添加';
    END IF;
  ELSE
    RAISE NOTICE '表 ai_logs 不存在，跳过添加 cache_source 字段';
  END IF;
END $$;

COMMIT;

-- ============================================================
-- 验证查询
-- ============================================================
-- 检查字段是否添加成功：
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'ai_logs' AND column_name IN ('from', 'ai_provider', 'cached', 'cache_source');
--
-- 检查索引是否创建成功：
-- SELECT indexname FROM pg_indexes 
-- WHERE tablename = 'ai_logs' AND indexname LIKE '%from%' OR indexname LIKE '%ai_provider%' OR indexname LIKE '%cached%' OR indexname LIKE '%cache_source%';

