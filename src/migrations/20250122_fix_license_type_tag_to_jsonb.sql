-- ============================================================
-- 修复 license_type_tag 字段类型：从 TEXT[] 改为 JSONB
-- 文件名: 20250122_fix_license_type_tag_to_jsonb.sql
-- 说明: 
--   1. 将 license_type_tag 从 TEXT[] 改为 JSONB（支持数组格式）
--   2. 迁移现有数据：将 TEXT[] 数组转换为 JSONB 数组格式
--   3. 确保 topic_tags 保持为 TEXT[] 类型
-- 日期: 2025-01-22
-- 数据库: drivequiz
-- ============================================================

BEGIN;

-- ============================================================
-- 1️⃣ 备份现有数据（将 TEXT[] 转换为 JSONB）
-- ============================================================

-- 添加临时列用于存储 JSONB 格式的数据
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS license_type_tag_jsonb JSONB;

-- 将现有的 license_type_tag (TEXT[]) 迁移到 license_type_tag_jsonb (JSONB)
-- TEXT[] 数组可以直接转换为 JSONB 数组
UPDATE questions
SET license_type_tag_jsonb = CASE
  WHEN license_type_tag IS NULL THEN NULL
  WHEN array_length(license_type_tag, 1) IS NULL THEN NULL
  ELSE to_jsonb(license_type_tag)  -- 将 TEXT[] 转换为 JSONB 数组
END
WHERE license_type_tag_jsonb IS NULL;

-- ============================================================
-- 2️⃣ 替换 license_type_tag 字段
-- ============================================================

-- 删除旧的 license_type_tag 字段（TEXT[]）
ALTER TABLE questions 
DROP COLUMN IF EXISTS license_type_tag;

-- 将 license_type_tag_jsonb 重命名为 license_type_tag
ALTER TABLE questions 
RENAME COLUMN license_type_tag_jsonb TO license_type_tag;

-- ============================================================
-- 3️⃣ 重新创建索引
-- ============================================================

-- 删除旧索引（如果存在）
DROP INDEX IF EXISTS idx_questions_license_type_tag;

-- 使用 GIN 索引支持 JSONB 数组查询
CREATE INDEX IF NOT EXISTS idx_questions_license_type_tag ON questions USING GIN(license_type_tag);

-- ============================================================
-- 4️⃣ 更新注释
-- ============================================================

COMMENT ON COLUMN questions.license_type_tag IS '驾照类型标签数组（JSONB）：可包含多个值，如 ["ordinary", "medium"]。可选值：ordinary, semi_medium, medium, large, moped, motorcycle_std, motorcycle_large, ordinary_2, medium_2, large_2, trailer, large_special, foreign_exchange, reacquire, provisional_only, common_all';

-- ============================================================
-- 5️⃣ 确保 topic_tags 是 TEXT[] 类型（如果当前是 text，需要修改）
-- ============================================================

-- 检查 topic_tags 字段类型
DO $$
DECLARE
  current_type text;
BEGIN
  SELECT data_type INTO current_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'questions'
    AND column_name = 'topic_tags';
  
  -- 如果 topic_tags 是 text（单个文本），需要转换为 TEXT[]
  IF current_type = 'text' THEN
    -- 添加临时列
    ALTER TABLE questions 
    ADD COLUMN IF NOT EXISTS topic_tags_array TEXT[];
    
    -- 迁移数据：将单个文本转换为数组（如果为空则设为 NULL）
    UPDATE questions
    SET topic_tags_array = CASE
      WHEN topic_tags IS NULL THEN NULL
      WHEN trim(topic_tags) = '' THEN NULL
      ELSE ARRAY[trim(topic_tags)]  -- 将单个文本包装为数组
    END
    WHERE topic_tags_array IS NULL;
    
    -- 删除旧字段
    ALTER TABLE questions 
    DROP COLUMN IF EXISTS topic_tags;
    
    -- 重命名
    ALTER TABLE questions 
    RENAME COLUMN topic_tags_array TO topic_tags;
    
    -- 重新创建索引
    DROP INDEX IF EXISTS idx_questions_topic_tags;
    CREATE INDEX IF NOT EXISTS idx_questions_topic_tags ON questions USING GIN(topic_tags);
    
    RAISE NOTICE 'topic_tags 已从 text 转换为 TEXT[]';
  ELSIF current_type = 'ARRAY' THEN
    RAISE NOTICE 'topic_tags 已经是数组类型，无需修改';
  ELSE
    RAISE NOTICE 'topic_tags 类型: %', current_type;
  END IF;
END $$;

COMMIT;

-- ============================================================
-- 回滚脚本（DOWN）
-- ============================================================
-- BEGIN;
-- 
-- -- 恢复 license_type_tag 为 TEXT[]
-- ALTER TABLE questions 
-- ADD COLUMN IF NOT EXISTS license_type_tag_text_array TEXT[];
-- 
-- -- 从 JSONB 转换为 TEXT[]
-- UPDATE questions
-- SET license_type_tag_text_array = CASE
--   WHEN license_type_tag IS NULL THEN NULL
--   ELSE ARRAY(SELECT jsonb_array_elements_text(license_type_tag))
-- END
-- WHERE license_type_tag_text_array IS NULL;
-- 
-- -- 删除 JSONB 字段
-- ALTER TABLE questions 
-- DROP COLUMN IF EXISTS license_type_tag;
-- 
-- -- 重命名
-- ALTER TABLE questions 
-- RENAME COLUMN license_type_tag_text_array TO license_type_tag;
-- 
-- -- 重新创建索引
-- DROP INDEX IF EXISTS idx_questions_license_type_tag;
-- CREATE INDEX IF NOT EXISTS idx_questions_license_type_tag ON questions USING GIN(license_type_tag);
-- 
-- COMMIT;

