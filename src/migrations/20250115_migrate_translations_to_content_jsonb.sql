-- ============================================================
-- 将 question_translations 表的数据迁移到 questions.content JSONB
-- 日期: 2025-01-15
-- 说明: 移除 question_translations 表，将所有翻译数据迁移到 questions.content JSONB 字段
-- ============================================================

BEGIN;

-- 1. 将 question_translations 表中的翻译数据迁移到 questions.content JSONB
-- 对于每个翻译记录，更新对应题目的 content 和 explanation JSONB 字段

DO $$
DECLARE
  trans RECORD;
  current_content JSONB;
  current_explanation JSONB;
  updated_content JSONB;
  updated_explanation JSONB;
BEGIN
  FOR trans IN 
    SELECT 
      qt.content_hash,
      qt.locale,
      qt.content,
      qt.explanation,
      q.id as question_id,
      q.content as q_content,
      q.explanation as q_explanation
    FROM question_translations qt
    INNER JOIN questions q ON q.content_hash = qt.content_hash
    ORDER BY qt.content_hash, qt.locale
  LOOP
    -- 处理 content 字段
    IF trans.q_content IS NULL THEN
      updated_content := jsonb_build_object(trans.locale, trans.content);
    ELSIF jsonb_typeof(trans.q_content) = 'object' THEN
      updated_content := trans.q_content || jsonb_build_object(trans.locale, trans.content);
    ELSE
      -- 如果原本是字符串，转换为 JSONB 对象
      updated_content := jsonb_build_object('zh', trans.q_content::text, trans.locale, trans.content);
    END IF;

    -- 处理 explanation 字段
    IF trans.explanation IS NOT NULL THEN
      IF trans.q_explanation IS NULL THEN
        updated_explanation := jsonb_build_object(trans.locale, trans.explanation);
      ELSIF jsonb_typeof(trans.q_explanation) = 'object' THEN
        updated_explanation := trans.q_explanation || jsonb_build_object(trans.locale, trans.explanation);
      ELSE
        -- 如果原本是字符串，转换为 JSONB 对象
        updated_explanation := jsonb_build_object('zh', trans.q_explanation::text, trans.locale, trans.explanation);
      END IF;
    ELSE
      updated_explanation := trans.q_explanation;
    END IF;

    -- 更新题目
    UPDATE questions
    SET 
      content = updated_content,
      explanation = COALESCE(updated_explanation, explanation),
      updated_at = NOW()
    WHERE id = trans.question_id;

    RAISE NOTICE 'Migrated translation: question_id=%, locale=%, content_hash=%', 
      trans.question_id, trans.locale, trans.content_hash;
  END LOOP;

  RAISE NOTICE 'Migration completed: All translations migrated to questions.content JSONB';
END $$;

-- 2. 验证迁移结果（可选，用于检查）
-- SELECT 
--   q.id,
--   q.content_hash,
--   jsonb_object_keys(q.content) as available_languages,
--   (SELECT COUNT(*) FROM question_translations qt WHERE qt.content_hash = q.content_hash) as old_translation_count
-- FROM questions q
-- WHERE jsonb_typeof(q.content) = 'object'
-- ORDER BY q.id
-- LIMIT 10;

-- 3. 注意：不删除 question_translations 表，保留作为备份
-- 如果需要删除，可以执行：
-- DROP TABLE IF EXISTS question_translations CASCADE;

COMMIT;

