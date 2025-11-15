-- ============================================================
-- 强制修复函数 search_path 安全问题
-- 文件名: 20250122_force_fix_function_search_path.sql
-- 说明: 强制重新创建所有函数并设置固定的 search_path
-- 日期: 2025-01-22
-- 注意: 此脚本会强制重新创建所有函数，确保 search_path 正确设置
-- ============================================================

BEGIN;

-- ============================================================
-- 1. 修复 update_services_updated_at 函数
-- ============================================================
CREATE OR REPLACE FUNCTION update_services_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION update_services_updated_at IS '自动更新 services 表的 updated_at 字段。已修复 search_path 安全问题。';

-- ============================================================
-- 2. 修复 update_ad_content_stats 函数
-- ============================================================
CREATE OR REPLACE FUNCTION update_ad_content_stats()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- 更新广告内容的统计信息
  IF NEW.log_type = 'impression' THEN
    UPDATE ad_contents
    SET impression_count = impression_count + 1
    WHERE id = NEW.ad_content_id;
  ELSIF NEW.log_type = 'click' THEN
    UPDATE ad_contents
    SET click_count = click_count + 1
    WHERE id = NEW.ad_content_id;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION update_ad_content_stats IS '自动更新广告内容的统计信息。已修复 search_path 安全问题。';

-- ============================================================
-- 3. 修复 match_documents 函数（仅在 ai_vectors 表存在时）
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'ai_vectors'
  ) THEN
    -- 检查函数是否存在
    IF EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
      AND p.proname = 'match_documents'
    ) THEN
      -- 向量相似度检索函数（在 AI 数据库中）
      EXECUTE $func$
      CREATE OR REPLACE FUNCTION match_documents(
        query_embedding vector(1536),
        match_threshold float DEFAULT 0.75,
        match_count int DEFAULT 3
      )
      RETURNS TABLE (
        id bigint,
        doc_id varchar,
        content text,
        source_title text,
        source_url text,
        version varchar,
        similarity float
      )
      LANGUAGE sql 
      STABLE
      SECURITY DEFINER
      SET search_path = public
      AS $body$
        SELECT id, doc_id, content, source_title, source_url, version,
               1 - (embedding <=> query_embedding) AS similarity
        FROM ai_vectors
        WHERE 1 - (embedding <=> query_embedding) >= match_threshold
        ORDER BY similarity DESC
        LIMIT match_count;
      $body$;
      $func$;
      
      EXECUTE 'COMMENT ON FUNCTION match_documents IS ''根据查询向量检索最相似的文档片段。已修复 search_path 安全问题。''';
      
      RAISE NOTICE '✅ match_documents 函数已修复';
    END IF;
  ELSE
    RAISE NOTICE '⚠️  ai_vectors 表不存在，跳过 match_documents 函数修复';
  END IF;
END $$;

-- ============================================================
-- 4. 修复 update_ad_slots_updated_at 函数
-- ============================================================
CREATE OR REPLACE FUNCTION update_ad_slots_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION update_ad_slots_updated_at IS '自动更新 ad_slots 表的 updated_at 字段。已修复 search_path 安全问题。';

-- ============================================================
-- 5. 修复 update_ad_contents_updated_at 函数
-- ============================================================
CREATE OR REPLACE FUNCTION update_ad_contents_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION update_ad_contents_updated_at IS '自动更新 ad_contents 表的 updated_at 字段。已修复 search_path 安全问题。';

-- ============================================================
-- 6. 修复 update_vehicles_updated_at 函数
-- ============================================================
CREATE OR REPLACE FUNCTION update_vehicles_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION update_vehicles_updated_at IS '自动更新 vehicles 表的 updated_at 字段。已修复 search_path 安全问题。';

-- ============================================================
-- 7. 修复 update_service_rating 函数
-- ============================================================
CREATE OR REPLACE FUNCTION update_service_rating()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- 更新服务的平均评分和评分数量
  UPDATE services
  SET 
    rating_avg = (
      SELECT AVG(rating)::NUMERIC(3,2)
      FROM service_reviews
      WHERE service_id = COALESCE(NEW.service_id, OLD.service_id)
        AND status = 'active'
    ),
    rating_count = (
      SELECT COUNT(*)
      FROM service_reviews
      WHERE service_id = COALESCE(NEW.service_id, OLD.service_id)
        AND status = 'active'
    )
  WHERE id = COALESCE(NEW.service_id, OLD.service_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION update_service_rating IS '自动更新服务的平均评分和评分数量。已修复 search_path 安全问题。';

-- ============================================================
-- 8. 修复 update_service_reviews_updated_at 函数
-- ============================================================
CREATE OR REPLACE FUNCTION update_service_reviews_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION update_service_reviews_updated_at IS '自动更新 service_reviews 表的 updated_at 字段。已修复 search_path 安全问题。';

-- ============================================================
-- 9. 修复 update_question_package_versions_updated_at 函数
-- ============================================================
CREATE OR REPLACE FUNCTION update_question_package_versions_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION update_question_package_versions_updated_at IS '自动更新 question_package_versions 表的 updated_at 字段。已修复 search_path 安全问题。';

-- ============================================================
-- 10. 修复 update_question_ai_answers_updated_at 函数
-- ============================================================
CREATE OR REPLACE FUNCTION update_question_ai_answers_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION update_question_ai_answers_updated_at IS '自动更新 question_ai_answers 表的 updated_at 字段。已修复 search_path 安全问题。';

-- ============================================================
-- 11. 修复 sync_question_tags 函数（移除 question_translations 引用）
-- ============================================================
CREATE OR REPLACE FUNCTION sync_question_tags()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- 同步到 question_ai_answers
  UPDATE question_ai_answers
  SET 
    category = NEW.category,
    stage_tag = NEW.stage_tag,
    topic_tags = NEW.topic_tags
  WHERE question_hash = NEW.content_hash;

  -- 同步到 question_polish_reviews（如果表存在）
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'question_polish_reviews') THEN
    UPDATE question_polish_reviews
    SET 
      category = NEW.category,
      stage_tag = NEW.stage_tag,
      topic_tags = NEW.topic_tags
    WHERE content_hash = NEW.content_hash;
  END IF;

  -- 同步到 question_polish_history（如果表存在）
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'question_polish_history') THEN
    UPDATE question_polish_history
    SET 
      category = NEW.category,
      stage_tag = NEW.stage_tag,
      topic_tags = NEW.topic_tags
    WHERE content_hash = NEW.content_hash;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION sync_question_tags IS '当 questions 表的标签字段更新时，自动同步到相关表。已修复 search_path 安全问题。';

-- ============================================================
-- 12. 修复 sync_question_tags_on_insert 函数（移除 question_translations 引用）
-- ============================================================
CREATE OR REPLACE FUNCTION sync_question_tags_on_insert()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- 同步到 question_ai_answers（如果已存在）
  UPDATE question_ai_answers
  SET 
    category = NEW.category,
    stage_tag = NEW.stage_tag,
    topic_tags = NEW.topic_tags
  WHERE question_hash = NEW.content_hash;

  -- 同步到 question_polish_reviews（如果表存在且记录已存在）
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'question_polish_reviews') THEN
    UPDATE question_polish_reviews
    SET 
      category = NEW.category,
      stage_tag = NEW.stage_tag,
      topic_tags = NEW.topic_tags
    WHERE content_hash = NEW.content_hash;
  END IF;

  -- 同步到 question_polish_history（如果表存在且记录已存在）
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'question_polish_history') THEN
    UPDATE question_polish_history
    SET 
      category = NEW.category,
      stage_tag = NEW.stage_tag,
      topic_tags = NEW.topic_tags
    WHERE content_hash = NEW.content_hash;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION sync_question_tags_on_insert IS '当插入新题目时，如果相关表已有记录，同步标签。已修复 search_path 安全问题。';

-- ============================================================
-- 13. 修复 update_questions_updated_at 函数
-- ============================================================
CREATE OR REPLACE FUNCTION update_questions_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION update_questions_updated_at IS '自动更新 questions 表的 updated_at 字段。已修复 search_path 安全问题。';

-- ============================================================
-- 14. 修复 update_user_profiles_updated_at 函数
-- ============================================================
CREATE OR REPLACE FUNCTION update_user_profiles_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION update_user_profiles_updated_at IS '自动更新 user_profiles 表的 updated_at 字段。已修复 search_path 安全问题。';

-- ============================================================
-- 15. 修复 update_user_interests_updated_at 函数
-- ============================================================
CREATE OR REPLACE FUNCTION update_user_interests_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION update_user_interests_updated_at IS '自动更新 user_interests 表的 updated_at 字段。已修复 search_path 安全问题。';

COMMIT;

-- ============================================================
-- 验证修复
-- ============================================================
-- 执行以下查询验证函数 search_path 是否已修复：
-- 
-- SELECT 
--   proname AS function_name,
--   prosecdef AS is_security_definer,
--   proconfig AS search_path_config,
--   CASE 
--     WHEN proconfig::text LIKE '%search_path=public%' THEN '✅ 已修复'
--     WHEN proconfig IS NULL AND prosecdef = false THEN '⚠️  非 SECURITY DEFINER，无需 search_path'
--     ELSE '❌ 未修复'
--   END AS status
-- FROM pg_proc
-- WHERE proname IN (
--   'update_services_updated_at',
--   'update_ad_content_stats',
--   'match_documents',
--   'update_ad_slots_updated_at',
--   'update_ad_contents_updated_at',
--   'update_vehicles_updated_at',
--   'update_service_rating',
--   'update_service_reviews_updated_at',
--   'update_question_package_versions_updated_at',
--   'update_question_ai_answers_updated_at',
--   'sync_question_tags',
--   'sync_question_tags_on_insert',
--   'update_questions_updated_at',
--   'update_user_profiles_updated_at',
--   'update_user_interests_updated_at'
-- )
-- ORDER BY proname;
--
-- 期望结果: 所有函数的 proconfig 应该包含 'search_path=public'

