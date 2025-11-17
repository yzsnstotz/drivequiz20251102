-- ============================================================
-- 添加 license_type_tag 字段到 questions 表
-- 文件名: 20250122_add_license_type_tag.sql
-- 说明: 为 questions 表添加 license_type_tag 字段（单个值），用于存储题目的驾照类型标签
--       与 license_types（数组）不同，license_type_tag 是单个值，表示题目最适合的驾照类型
-- 日期: 2025-01-22
-- 数据库: drivequiz
-- ============================================================

BEGIN;

-- ============================================================
-- 1️⃣ 添加 license_type_tag 字段
-- ============================================================

ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS license_type_tag VARCHAR(50);

-- ============================================================
-- 2️⃣ 创建索引
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_questions_license_type_tag ON questions(license_type_tag);

-- ============================================================
-- 3️⃣ 添加注释
-- ============================================================

COMMENT ON COLUMN questions.license_type_tag IS '驾照类型标签（单个值）：ordinary, semi_medium, medium, large, moped, motorcycle_std, motorcycle_large, ordinary_2, medium_2, large_2, trailer, large_special, foreign_exchange, reacquire, provisional_only, common_all';

COMMIT;

-- ============================================================
-- 回滚脚本（DOWN）
-- ============================================================
-- BEGIN;
-- DROP INDEX IF EXISTS idx_questions_license_type_tag;
-- ALTER TABLE questions DROP COLUMN IF EXISTS license_type_tag;
-- COMMIT;

