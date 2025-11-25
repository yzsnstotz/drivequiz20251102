-- ============================================================
-- 修复重复索引问题
-- 文件名: 20250122_fix_duplicate_indexes.sql
-- 说明: 删除重复的索引，保留更合适的索引名称
-- 日期: 2025-01-22
-- 参考: https://supabase.com/docs/guides/database/database-linter?lint=0009_duplicate_index
-- ============================================================

BEGIN;

-- ============================================================
-- 1. question_ai_answer_pending_updates 表
-- 删除: idx_pending_updates_package
-- 保留: idx_pending_updates_package_name (更明确的名称)
-- ============================================================
DROP INDEX IF EXISTS idx_pending_updates_package;

-- ============================================================
-- 2. question_ai_answers 表
-- 删除: idx_question_ai_answers_hash
-- 保留: idx_question_ai_answers_question_hash (更明确的名称)
-- ============================================================
DROP INDEX IF EXISTS idx_question_ai_answers_hash;

-- ============================================================
-- 3. question_ai_answers 表 - 唯一索引
-- 删除: idx_question_ai_answers_hash_locale_unique
-- 保留: question_ai_answers_question_hash_locale_key (约束名称，更标准)
-- ============================================================
-- 注意: 如果这是唯一约束，需要先删除约束再删除索引
DO $$
BEGIN
  -- 检查是否存在唯一约束
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'question_ai_answers_question_hash_locale_key'
  ) THEN
    -- 如果存在约束，删除重复的唯一索引
    DROP INDEX IF EXISTS idx_question_ai_answers_hash_locale_unique;
  ELSE
    -- 如果不存在约束，保留唯一索引
    -- 但需要检查是否有重复
    IF EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE tablename = 'question_ai_answers' 
      AND indexname = 'idx_question_ai_answers_hash_locale_unique'
    ) THEN
      -- 如果两个索引都存在，删除名称较长的
      DROP INDEX IF EXISTS idx_question_ai_answers_hash_locale_unique;
    END IF;
  END IF;
END $$;

-- ============================================================
-- 4. question_package_versions 表
-- 删除: idx_package_versions_created_at
-- 保留: idx_question_package_versions_created_at (更明确的名称)
-- ============================================================
DROP INDEX IF EXISTS idx_package_versions_created_at;

-- ============================================================
-- 5. question_package_versions 表
-- 删除: idx_package_versions_package_name
-- 保留: idx_question_package_versions_name (更明确的名称)
-- ============================================================
DROP INDEX IF EXISTS idx_package_versions_package_name;

-- ============================================================
-- 6. questions 表 - 唯一索引
-- 删除: idx_questions_content_hash_unique
-- 保留: questions_content_hash_key (约束名称，更标准)
-- ============================================================
-- 注意: 如果这是唯一约束，需要先删除约束再删除索引
DO $$
BEGIN
  -- 检查是否存在唯一约束
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'questions_content_hash_key'
  ) THEN
    -- 如果存在约束，删除重复的唯一索引
    DROP INDEX IF EXISTS idx_questions_content_hash_unique;
  ELSE
    -- 如果不存在约束，保留唯一索引
    -- 但需要检查是否有重复
    IF EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE tablename = 'questions' 
      AND indexname = 'idx_questions_content_hash_unique'
    ) THEN
      -- 如果两个索引都存在，删除名称较长的
      DROP INDEX IF EXISTS idx_questions_content_hash_unique;
    END IF;
  END IF;
END $$;

COMMIT;

-- ============================================================
-- 验证修复
-- ============================================================
-- 执行以下查询验证重复索引是否已删除：
-- 
-- SELECT 
--   schemaname,
--   tablename,
--   indexname,
--   indexdef
-- FROM pg_indexes
-- WHERE tablename IN (
--   'question_ai_answer_pending_updates',
--   'question_ai_answers',
--   'question_package_versions',
--   'questions'
-- )
-- ORDER BY tablename, indexname;
--
-- 检查是否还有重复索引：
-- 
-- SELECT 
--   tablename,
--   array_agg(indexname ORDER BY indexname) AS indexes,
--   COUNT(*) AS index_count
-- FROM pg_indexes
-- WHERE tablename IN (
--   'question_ai_answer_pending_updates',
--   'question_ai_answers',
--   'question_package_versions',
--   'questions'
-- )
-- GROUP BY tablename, indexdef
-- HAVING COUNT(*) > 1;

