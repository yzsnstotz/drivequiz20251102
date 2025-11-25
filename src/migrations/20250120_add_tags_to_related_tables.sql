-- ============================================================
-- 为相关题目表添加标签字段（category, stage_tag, topic_tags）
-- 文件名: 20250120_add_tags_to_related_tables.sql
-- 说明: 
--   为以下表添加标签字段，以便按标签筛选和查询：
--   1. question_ai_answers - AI回答表
--   2. question_translations - 题目翻译表
--   3. question_polish_reviews - 润色建议表
--   4. question_polish_history - 润色历史表
--   这些字段从 questions 表冗余存储，提高查询性能
-- 日期: 2025-01-20
-- 数据库: drivequiz
-- ============================================================

BEGIN;

-- ============================================================
-- 1️⃣ question_ai_answers - 添加标签字段
-- ============================================================

-- 添加字段
ALTER TABLE question_ai_answers 
ADD COLUMN IF NOT EXISTS category VARCHAR(50);

ALTER TABLE question_ai_answers 
ADD COLUMN IF NOT EXISTS stage_tag VARCHAR(20);

ALTER TABLE question_ai_answers 
ADD COLUMN IF NOT EXISTS topic_tags TEXT[];

-- 从 questions 表同步标签数据
UPDATE question_ai_answers qaa
SET 
  category = q.category,
  stage_tag = q.stage_tag,
  topic_tags = q.topic_tags
FROM questions q
WHERE qaa.question_hash = q.content_hash
  AND (qaa.category IS NULL OR qaa.stage_tag IS NULL OR qaa.topic_tags IS NULL);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_question_ai_answers_category ON question_ai_answers(category);
CREATE INDEX IF NOT EXISTS idx_question_ai_answers_stage_tag ON question_ai_answers(stage_tag);
CREATE INDEX IF NOT EXISTS idx_question_ai_answers_topic_tags ON question_ai_answers USING GIN(topic_tags);

-- 添加注释
COMMENT ON COLUMN question_ai_answers.category IS '题目分类（冗余字段，从questions表同步）';
COMMENT ON COLUMN question_ai_answers.stage_tag IS '阶段标签：both/provisional/regular（冗余字段，从questions表同步）';
COMMENT ON COLUMN question_ai_answers.topic_tags IS '主题标签数组（冗余字段，从questions表同步）';

-- ============================================================
-- 2️⃣ question_translations - 添加标签字段
-- ============================================================

-- 添加字段
ALTER TABLE question_translations 
ADD COLUMN IF NOT EXISTS category VARCHAR(50);

ALTER TABLE question_translations 
ADD COLUMN IF NOT EXISTS stage_tag VARCHAR(20);

ALTER TABLE question_translations 
ADD COLUMN IF NOT EXISTS topic_tags TEXT[];

-- 从 questions 表同步标签数据
UPDATE question_translations qt
SET 
  category = q.category,
  stage_tag = q.stage_tag,
  topic_tags = q.topic_tags
FROM questions q
WHERE qt.content_hash = q.content_hash
  AND (qt.category IS NULL OR qt.stage_tag IS NULL OR qt.topic_tags IS NULL);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_question_translations_category ON question_translations(category);
CREATE INDEX IF NOT EXISTS idx_question_translations_stage_tag ON question_translations(stage_tag);
CREATE INDEX IF NOT EXISTS idx_question_translations_topic_tags ON question_translations USING GIN(topic_tags);

-- 添加注释
COMMENT ON COLUMN question_translations.category IS '题目分类（冗余字段，从questions表同步）';
COMMENT ON COLUMN question_translations.stage_tag IS '阶段标签：both/provisional/regular（冗余字段，从questions表同步）';
COMMENT ON COLUMN question_translations.topic_tags IS '主题标签数组（冗余字段，从questions表同步）';

-- ============================================================
-- 3️⃣ question_polish_reviews - 添加标签字段
-- ============================================================

-- 添加字段
ALTER TABLE question_polish_reviews 
ADD COLUMN IF NOT EXISTS category VARCHAR(50);

ALTER TABLE question_polish_reviews 
ADD COLUMN IF NOT EXISTS stage_tag VARCHAR(20);

ALTER TABLE question_polish_reviews 
ADD COLUMN IF NOT EXISTS topic_tags TEXT[];

-- 从 questions 表同步标签数据
UPDATE question_polish_reviews qpr
SET 
  category = q.category,
  stage_tag = q.stage_tag,
  topic_tags = q.topic_tags
FROM questions q
WHERE qpr.content_hash = q.content_hash
  AND (qpr.category IS NULL OR qpr.stage_tag IS NULL OR qpr.topic_tags IS NULL);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_question_polish_reviews_category ON question_polish_reviews(category);
CREATE INDEX IF NOT EXISTS idx_question_polish_reviews_stage_tag ON question_polish_reviews(stage_tag);
CREATE INDEX IF NOT EXISTS idx_question_polish_reviews_topic_tags ON question_polish_reviews USING GIN(topic_tags);

-- 添加注释
COMMENT ON COLUMN question_polish_reviews.category IS '题目分类（冗余字段，从questions表同步）';
COMMENT ON COLUMN question_polish_reviews.stage_tag IS '阶段标签：both/provisional/regular（冗余字段，从questions表同步）';
COMMENT ON COLUMN question_polish_reviews.topic_tags IS '主题标签数组（冗余字段，从questions表同步）';

-- ============================================================
-- 4️⃣ question_polish_history - 添加标签字段
-- ============================================================

-- 添加字段
ALTER TABLE question_polish_history 
ADD COLUMN IF NOT EXISTS category VARCHAR(50);

ALTER TABLE question_polish_history 
ADD COLUMN IF NOT EXISTS stage_tag VARCHAR(20);

ALTER TABLE question_polish_history 
ADD COLUMN IF NOT EXISTS topic_tags TEXT[];

-- 从 questions 表同步标签数据
UPDATE question_polish_history qph
SET 
  category = q.category,
  stage_tag = q.stage_tag,
  topic_tags = q.topic_tags
FROM questions q
WHERE qph.content_hash = q.content_hash
  AND (qph.category IS NULL OR qph.stage_tag IS NULL OR qph.topic_tags IS NULL);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_question_polish_history_category ON question_polish_history(category);
CREATE INDEX IF NOT EXISTS idx_question_polish_history_stage_tag ON question_polish_history(stage_tag);
CREATE INDEX IF NOT EXISTS idx_question_polish_history_topic_tags ON question_polish_history USING GIN(topic_tags);

-- 添加注释
COMMENT ON COLUMN question_polish_history.category IS '题目分类（冗余字段，从questions表同步）';
COMMENT ON COLUMN question_polish_history.stage_tag IS '阶段标签：both/provisional/regular（冗余字段，从questions表同步）';
COMMENT ON COLUMN question_polish_history.topic_tags IS '主题标签数组（冗余字段，从questions表同步）';

-- ============================================================
-- 5️⃣ 创建触发器函数：自动同步标签字段
-- ============================================================

-- 当 questions 表的标签字段更新时，自动同步到相关表
CREATE OR REPLACE FUNCTION sync_question_tags()
RETURNS TRIGGER AS $$
BEGIN
  -- 同步到 question_ai_answers
  UPDATE question_ai_answers
  SET 
    category = NEW.category,
    stage_tag = NEW.stage_tag,
    topic_tags = NEW.topic_tags
  WHERE question_hash = NEW.content_hash;

  -- 同步到 question_translations
  UPDATE question_translations
  SET 
    category = NEW.category,
    stage_tag = NEW.stage_tag,
    topic_tags = NEW.topic_tags
  WHERE content_hash = NEW.content_hash;

  -- 同步到 question_polish_reviews
  UPDATE question_polish_reviews
  SET 
    category = NEW.category,
    stage_tag = NEW.stage_tag,
    topic_tags = NEW.topic_tags
  WHERE content_hash = NEW.content_hash;

  -- 同步到 question_polish_history
  UPDATE question_polish_history
  SET 
    category = NEW.category,
    stage_tag = NEW.stage_tag,
    topic_tags = NEW.topic_tags
  WHERE content_hash = NEW.content_hash;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS trigger_sync_question_tags ON questions;
CREATE TRIGGER trigger_sync_question_tags
  AFTER UPDATE OF category, stage_tag, topic_tags ON questions
  FOR EACH ROW
  WHEN (
    OLD.category IS DISTINCT FROM NEW.category OR
    OLD.stage_tag IS DISTINCT FROM NEW.stage_tag OR
    OLD.topic_tags IS DISTINCT FROM NEW.topic_tags
  )
  EXECUTE FUNCTION sync_question_tags();

-- 当插入新题目时，如果相关表已有记录，同步标签
CREATE OR REPLACE FUNCTION sync_question_tags_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- 同步到 question_ai_answers（如果已存在）
  UPDATE question_ai_answers
  SET 
    category = NEW.category,
    stage_tag = NEW.stage_tag,
    topic_tags = NEW.topic_tags
  WHERE question_hash = NEW.content_hash;

  -- 同步到 question_translations（如果已存在）
  UPDATE question_translations
  SET 
    category = NEW.category,
    stage_tag = NEW.stage_tag,
    topic_tags = NEW.topic_tags
  WHERE content_hash = NEW.content_hash;

  -- 同步到 question_polish_reviews（如果已存在）
  UPDATE question_polish_reviews
  SET 
    category = NEW.category,
    stage_tag = NEW.stage_tag,
    topic_tags = NEW.topic_tags
  WHERE content_hash = NEW.content_hash;

  -- 同步到 question_polish_history（如果已存在）
  UPDATE question_polish_history
  SET 
    category = NEW.category,
    stage_tag = NEW.stage_tag,
    topic_tags = NEW.topic_tags
  WHERE content_hash = NEW.content_hash;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建插入触发器
DROP TRIGGER IF EXISTS trigger_sync_question_tags_on_insert ON questions;
CREATE TRIGGER trigger_sync_question_tags_on_insert
  AFTER INSERT ON questions
  FOR EACH ROW
  EXECUTE FUNCTION sync_question_tags_on_insert();

COMMIT;

-- ============================================================
-- 回滚脚本（DOWN）
-- ============================================================
-- 如果需要回滚，执行以下SQL：
-- BEGIN;
-- 
-- -- 删除触发器
-- DROP TRIGGER IF EXISTS trigger_sync_question_tags ON questions;
-- DROP TRIGGER IF EXISTS trigger_sync_question_tags_on_insert ON questions;
-- DROP FUNCTION IF EXISTS sync_question_tags();
-- DROP FUNCTION IF EXISTS sync_question_tags_on_insert();
-- 
-- -- 删除索引
-- DROP INDEX IF EXISTS idx_question_ai_answers_category;
-- DROP INDEX IF EXISTS idx_question_ai_answers_stage_tag;
-- DROP INDEX IF EXISTS idx_question_ai_answers_topic_tags;
-- DROP INDEX IF EXISTS idx_question_translations_category;
-- DROP INDEX IF EXISTS idx_question_translations_stage_tag;
-- DROP INDEX IF EXISTS idx_question_translations_topic_tags;
-- DROP INDEX IF EXISTS idx_question_polish_reviews_category;
-- DROP INDEX IF EXISTS idx_question_polish_reviews_stage_tag;
-- DROP INDEX IF EXISTS idx_question_polish_reviews_topic_tags;
-- DROP INDEX IF EXISTS idx_question_polish_history_category;
-- DROP INDEX IF EXISTS idx_question_polish_history_stage_tag;
-- DROP INDEX IF EXISTS idx_question_polish_history_topic_tags;
-- 
-- -- 删除字段
-- ALTER TABLE question_ai_answers 
-- DROP COLUMN IF EXISTS category;
-- ALTER TABLE question_ai_answers 
-- DROP COLUMN IF EXISTS stage_tag;
-- ALTER TABLE question_ai_answers 
-- DROP COLUMN IF EXISTS topic_tags;
-- 
-- ALTER TABLE question_translations 
-- DROP COLUMN IF EXISTS category;
-- ALTER TABLE question_translations 
-- DROP COLUMN IF EXISTS stage_tag;
-- ALTER TABLE question_translations 
-- DROP COLUMN IF EXISTS topic_tags;
-- 
-- ALTER TABLE question_polish_reviews 
-- DROP COLUMN IF EXISTS category;
-- ALTER TABLE question_polish_reviews 
-- DROP COLUMN IF EXISTS stage_tag;
-- ALTER TABLE question_polish_reviews 
-- DROP COLUMN IF EXISTS topic_tags;
-- 
-- ALTER TABLE question_polish_history 
-- DROP COLUMN IF EXISTS category;
-- ALTER TABLE question_polish_history 
-- DROP COLUMN IF EXISTS stage_tag;
-- ALTER TABLE question_polish_history 
-- DROP COLUMN IF EXISTS topic_tags;
-- 
-- COMMIT;

