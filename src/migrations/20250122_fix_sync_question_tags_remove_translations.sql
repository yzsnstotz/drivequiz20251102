-- ============================================================
-- 修复 sync_question_tags 函数，移除对 question_translations 表的引用
-- 文件名: 20250122_fix_sync_question_tags_remove_translations.sql
-- 说明: question_translations 表已被删除，需要从触发器函数中移除相关代码
-- 日期: 2025-01-22
-- ============================================================

BEGIN;

-- ============================================================
-- 修复 sync_question_tags 函数（移除 question_translations）
-- ============================================================
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
$$ LANGUAGE plpgsql
SET search_path = public;

COMMENT ON FUNCTION sync_question_tags IS '当 questions 表的标签字段更新时，自动同步到相关表（已移除 question_translations 表引用）。';

-- ============================================================
-- 修复 sync_question_tags_on_insert 函数（移除 question_translations）
-- ============================================================
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
$$ LANGUAGE plpgsql
SET search_path = public;

COMMENT ON FUNCTION sync_question_tags_on_insert IS '当插入新题目时，如果相关表已有记录，同步标签（已移除 question_translations 表引用）。';

COMMIT;

