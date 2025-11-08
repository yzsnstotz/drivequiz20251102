-- ============================================================
-- ZALEM 前台系统 - 商家广告位功能迁移脚本
-- 文件名: 20250116_add_merchant_ad_slot.sql
-- 说明: 为merchants表添加广告位字段（ad_slot）
-- 日期: 2025-01-16
-- 数据库: drivequiz
-- ============================================================

BEGIN;

-- ============================================================
-- 为merchants表添加广告位字段
-- ============================================================

-- 添加广告位字段
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'merchants' AND column_name = 'ad_slot'
  ) THEN
    ALTER TABLE merchants 
    ADD COLUMN ad_slot VARCHAR(50);
  END IF;
END $$;

-- 创建索引以优化查询
CREATE INDEX IF NOT EXISTS idx_merchants_ad_slot 
ON merchants(ad_slot) 
WHERE ad_slot IS NOT NULL;

COMMIT;

-- ============================================================
-- 验证查询
-- ============================================================
-- 检查字段是否添加成功：
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'merchants' 
-- AND column_name = 'ad_slot';
--
-- 检查索引是否创建成功：
-- SELECT indexname FROM pg_indexes 
-- WHERE tablename = 'merchants' 
-- AND indexname LIKE '%ad_slot%';

