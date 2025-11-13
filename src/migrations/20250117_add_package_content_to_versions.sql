-- ============================================================
-- 迁移脚本: 为 question_package_versions 表添加 package_content 字段
-- 文件名: 20250117_add_package_content_to_versions.sql
-- 说明: 添加 JSONB 字段存储历史版本的完整JSON包内容
-- 日期: 2025-01-17
-- 数据库: drivequiz
-- ============================================================

BEGIN;

-- ============================================================
-- 添加 package_content 字段（JSONB类型，存储完整的JSON包内容）
-- ============================================================
ALTER TABLE question_package_versions 
ADD COLUMN IF NOT EXISTS package_content JSONB;

-- 添加注释
COMMENT ON COLUMN question_package_versions.package_content IS '存储该版本完整的JSON包内容（包括questions和aiAnswers）';

-- 创建GIN索引以提高JSONB查询性能（可选，如果经常需要查询JSON内容）
CREATE INDEX IF NOT EXISTS idx_package_versions_content_gin 
ON question_package_versions USING GIN (package_content);

COMMIT;

-- ============================================================
-- 回滚脚本（如果需要回滚）
-- ============================================================
-- BEGIN;
-- DROP INDEX IF EXISTS idx_package_versions_content_gin;
-- ALTER TABLE question_package_versions DROP COLUMN IF EXISTS package_content;
-- COMMIT;

