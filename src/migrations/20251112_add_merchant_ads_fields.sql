-- ============================================================
-- ZALEM 前台系统 - 商家广告功能迁移脚本
-- 文件名: 20251112_add_merchant_ads_fields.sql
-- 说明: 为merchants表添加广告相关字段（开始时间、结束时间）
-- 日期: 2025-11-12
-- 数据库: drivequiz
-- ============================================================

BEGIN;

-- ============================================================
-- 为merchants表添加广告字段
-- ============================================================

-- 添加广告开始时间字段
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'merchants' AND column_name = 'ad_start_date'
  ) THEN
    ALTER TABLE merchants 
    ADD COLUMN ad_start_date TIMESTAMP;
  END IF;
END $$;

-- 添加广告结束时间字段
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'merchants' AND column_name = 'ad_end_date'
  ) THEN
    ALTER TABLE merchants 
    ADD COLUMN ad_end_date TIMESTAMP;
  END IF;
END $$;

-- 创建索引以优化查询
CREATE INDEX IF NOT EXISTS idx_merchants_ad_dates 
ON merchants(ad_start_date, ad_end_date) 
WHERE ad_start_date IS NOT NULL AND ad_end_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_merchants_category_ad 
ON merchants(category, ad_start_date, ad_end_date) 
WHERE category IS NOT NULL AND ad_start_date IS NOT NULL AND ad_end_date IS NOT NULL;

COMMIT;

-- ============================================================
-- 验证查询
-- ============================================================
-- 检查字段是否添加成功：
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'merchants' 
-- AND column_name IN ('ad_start_date', 'ad_end_date');
--
-- 检查索引是否创建成功：
-- SELECT indexname FROM pg_indexes 
-- WHERE tablename = 'merchants' 
-- AND indexname LIKE '%ad%';

