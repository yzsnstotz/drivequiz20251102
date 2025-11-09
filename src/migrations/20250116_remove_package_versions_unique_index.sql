-- ============================================================
-- 迁移脚本: 移除 question_package_versions 表的唯一索引
-- 文件名: 20250116_remove_package_versions_unique_index.sql
-- 说明: 移除 package_name 的唯一索引，以支持保存历史版本
-- 日期: 2025-01-16
-- 数据库: drivequiz
-- ============================================================

BEGIN;

-- ============================================================
-- 移除唯一索引和唯一约束，以支持保存历史版本
-- ============================================================

-- 删除唯一索引 idx_package_versions_package_name_unique
DROP INDEX IF EXISTS idx_package_versions_package_name_unique;

-- 删除唯一约束 question_package_versions_package_name_key（PostgreSQL自动创建的约束）
ALTER TABLE question_package_versions DROP CONSTRAINT IF EXISTS question_package_versions_package_name_key;

-- 验证索引和约束已删除
DO $$
BEGIN
  -- 检查唯一索引
  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'question_package_versions'
      AND indexname = 'idx_package_versions_package_name_unique'
  ) THEN
    RAISE EXCEPTION '唯一索引 idx_package_versions_package_name_unique 仍然存在';
  END IF;
  
  -- 检查唯一约束
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'question_package_versions_package_name_key'
      AND conrelid = 'question_package_versions'::regclass
  ) THEN
    RAISE EXCEPTION '唯一约束 question_package_versions_package_name_key 仍然存在';
  END IF;
  
  RAISE NOTICE '唯一索引和唯一约束已成功删除';
END $$;

COMMIT;

-- ============================================================
-- 回滚脚本（如果需要回滚）
-- ============================================================
-- BEGIN;
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_package_versions_package_name_unique 
--   ON question_package_versions(package_name);
-- COMMIT;

