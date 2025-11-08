-- ============================================================
-- ZALEM 前台系统 - 题目集表迁移脚本（添加license_type字段）
-- 文件名: 20251112_alter_exam_sets_add_license_type.sql
-- 说明: 为exam_sets表添加license_type字段，支持多驾照类型
-- 日期: 2025-11-12
-- 数据库: drivequiz
-- ============================================================

BEGIN;

-- ============================================================
-- 1️⃣ 如果exam_sets表不存在，先创建表
-- ============================================================
CREATE TABLE IF NOT EXISTS exam_sets (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  total_questions INTEGER DEFAULT 0,
  license_type VARCHAR(50) DEFAULT 'provisional',
  status VARCHAR(20) DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2️⃣ 添加license_type字段（如果不存在）
-- ============================================================
DO $$
BEGIN
  -- 检查license_type字段是否存在
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'exam_sets' 
    AND column_name = 'license_type'
  ) THEN
    -- 添加license_type字段
    ALTER TABLE exam_sets 
    ADD COLUMN license_type VARCHAR(50) DEFAULT 'provisional';
    
    -- 添加CHECK约束
    ALTER TABLE exam_sets
    ADD CONSTRAINT exam_sets_license_type_check 
    CHECK (license_type IN ('provisional', 'regular', '学科講習', 'gaikoku', 'nishu', 'reacquire'));
  END IF;
END $$;

-- ============================================================
-- 3️⃣ 创建索引（如果不存在）
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_exam_sets_license_type ON exam_sets(license_type);
CREATE INDEX IF NOT EXISTS idx_exam_sets_status ON exam_sets(status);
CREATE INDEX IF NOT EXISTS idx_exam_sets_created_at ON exam_sets(created_at DESC);

-- ============================================================
-- 4️⃣ 更新现有数据的license_type（兼容旧数据）
-- ============================================================
-- 如果现有数据没有license_type，根据title推断
DO $$
BEGIN
  UPDATE exam_sets
  SET license_type = CASE
    WHEN title LIKE '%仮免%' OR title LIKE '%provisional%' THEN 'provisional'
    WHEN title LIKE '%免许%' OR title LIKE '%regular%' OR title LIKE '%本免%' THEN 'regular'
    WHEN title LIKE '%学科講習%' OR title LIKE '%学科%' THEN '学科講習'
    ELSE 'provisional'
  END
  WHERE license_type IS NULL OR license_type = '';
END $$;

COMMIT;

-- ============================================================
-- 回滚脚本（DOWN）
-- ============================================================
-- 如果需要回滚，执行以下SQL：
-- BEGIN;
-- ALTER TABLE exam_sets DROP COLUMN IF EXISTS license_type;
-- DROP INDEX IF EXISTS idx_exam_sets_license_type;
-- COMMIT;

