-- ============================================================
-- 修复多个 permissive 策略性能问题
-- 文件名: 20250122_fix_multiple_permissive_policies_performance.sql
-- 说明: 
--   1. 将 service_write 策略从 FOR ALL 改为单独的 INSERT, UPDATE, DELETE 策略
--   2. 避免与 SELECT 策略重叠，解决 multiple permissive policies 警告
--   3. 性能优化：每个操作类型只有一个策略，减少策略评估次数
-- 日期: 2025-01-22
-- 参考: https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies
-- ============================================================

BEGIN;

-- ============================================================
-- 1. ad_slots - 广告位表
-- ============================================================
DROP POLICY IF EXISTS ad_slots_service_write ON ad_slots;

CREATE POLICY ad_slots_service_write_insert ON ad_slots
  FOR INSERT
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY ad_slots_service_write_update ON ad_slots
  FOR UPDATE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY ad_slots_service_write_delete ON ad_slots
  FOR DELETE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

-- ============================================================
-- 2. ad_contents - 广告内容表
-- ============================================================
DROP POLICY IF EXISTS ad_contents_service_write ON ad_contents;

CREATE POLICY ad_contents_service_write_insert ON ad_contents
  FOR INSERT
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY ad_contents_service_write_update ON ad_contents
  FOR UPDATE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY ad_contents_service_write_delete ON ad_contents
  FOR DELETE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

-- ============================================================
-- 3. ad_logs - 广告日志表
-- ============================================================
DROP POLICY IF EXISTS ad_logs_service_write ON ad_logs;

CREATE POLICY ad_logs_service_write_insert ON ad_logs
  FOR INSERT
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY ad_logs_service_write_update ON ad_logs
  FOR UPDATE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY ad_logs_service_write_delete ON ad_logs
  FOR DELETE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

-- ============================================================
-- 4. ad_slots_config - 广告位配置表
-- ============================================================
DROP POLICY IF EXISTS ad_slots_config_service_write ON ad_slots_config;

CREATE POLICY ad_slots_config_service_write_insert ON ad_slots_config
  FOR INSERT
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY ad_slots_config_service_write_update ON ad_slots_config
  FOR UPDATE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY ad_slots_config_service_write_delete ON ad_slots_config
  FOR DELETE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

-- ============================================================
-- 5. batch_process_tasks - 批量处理任务表
-- ============================================================
DROP POLICY IF EXISTS batch_process_tasks_service_write ON batch_process_tasks;

CREATE POLICY batch_process_tasks_service_write_insert ON batch_process_tasks
  FOR INSERT
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY batch_process_tasks_service_write_update ON batch_process_tasks
  FOR UPDATE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY batch_process_tasks_service_write_delete ON batch_process_tasks
  FOR DELETE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

-- ============================================================
-- 6. languages - 语言表
-- ============================================================
DROP POLICY IF EXISTS languages_service_write ON languages;

CREATE POLICY languages_service_write_insert ON languages
  FOR INSERT
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY languages_service_write_update ON languages
  FOR UPDATE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY languages_service_write_delete ON languages
  FOR DELETE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

-- ============================================================
-- 7. question_ai_answer_pending_updates - 待更新题目AI回答表
-- ============================================================
DROP POLICY IF EXISTS question_ai_answer_pending_updates_service_write ON question_ai_answer_pending_updates;

CREATE POLICY question_ai_answer_pending_updates_service_write_insert ON question_ai_answer_pending_updates
  FOR INSERT
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY question_ai_answer_pending_updates_service_write_update ON question_ai_answer_pending_updates
  FOR UPDATE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY question_ai_answer_pending_updates_service_write_delete ON question_ai_answer_pending_updates
  FOR DELETE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

-- ============================================================
-- 8. question_ai_answers - 题目AI回答表
-- ============================================================
DROP POLICY IF EXISTS question_ai_answers_service_write ON question_ai_answers;

CREATE POLICY question_ai_answers_service_write_insert ON question_ai_answers
  FOR INSERT
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY question_ai_answers_service_write_update ON question_ai_answers
  FOR UPDATE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY question_ai_answers_service_write_delete ON question_ai_answers
  FOR DELETE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

-- ============================================================
-- 9. question_package_versions - 题目包版本表
-- ============================================================
DROP POLICY IF EXISTS question_package_versions_service_write ON question_package_versions;

CREATE POLICY question_package_versions_service_write_insert ON question_package_versions
  FOR INSERT
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY question_package_versions_service_write_update ON question_package_versions
  FOR UPDATE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY question_package_versions_service_write_delete ON question_package_versions
  FOR DELETE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

-- ============================================================
-- 10. question_polish_history - 润色历史表
-- ============================================================
DROP POLICY IF EXISTS question_polish_history_service_write ON question_polish_history;

CREATE POLICY question_polish_history_service_write_insert ON question_polish_history
  FOR INSERT
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY question_polish_history_service_write_update ON question_polish_history
  FOR UPDATE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY question_polish_history_service_write_delete ON question_polish_history
  FOR DELETE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

-- ============================================================
-- 11. question_polish_reviews - 润色审核表
-- ============================================================
DROP POLICY IF EXISTS question_polish_reviews_service_write ON question_polish_reviews;

CREATE POLICY question_polish_reviews_service_write_insert ON question_polish_reviews
  FOR INSERT
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY question_polish_reviews_service_write_update ON question_polish_reviews
  FOR UPDATE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY question_polish_reviews_service_write_delete ON question_polish_reviews
  FOR DELETE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

-- ============================================================
-- 12. questions - 题目表
-- ============================================================
DROP POLICY IF EXISTS questions_service_write ON questions;

CREATE POLICY questions_service_write_insert ON questions
  FOR INSERT
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY questions_service_write_update ON questions
  FOR UPDATE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY questions_service_write_delete ON questions
  FOR DELETE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

-- ============================================================
-- 13. service_categories - 服务分类表
-- ============================================================
DROP POLICY IF EXISTS service_categories_service_write ON service_categories;

CREATE POLICY service_categories_service_write_insert ON service_categories
  FOR INSERT
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY service_categories_service_write_update ON service_categories
  FOR UPDATE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY service_categories_service_write_delete ON service_categories
  FOR DELETE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

-- ============================================================
-- 14. service_reviews - 服务评价表
-- ============================================================
DROP POLICY IF EXISTS service_reviews_service_write ON service_reviews;

CREATE POLICY service_reviews_service_write_insert ON service_reviews
  FOR INSERT
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY service_reviews_service_write_update ON service_reviews
  FOR UPDATE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY service_reviews_service_write_delete ON service_reviews
  FOR DELETE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

-- ============================================================
-- 15. services - 服务表
-- ============================================================
DROP POLICY IF EXISTS services_service_write ON services;

CREATE POLICY services_service_write_insert ON services
  FOR INSERT
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY services_service_write_update ON services
  FOR UPDATE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY services_service_write_delete ON services
  FOR DELETE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

-- ============================================================
-- 16. user_interests - 用户兴趣表
-- ============================================================
DROP POLICY IF EXISTS user_interests_service_write ON user_interests;

CREATE POLICY user_interests_service_write_insert ON user_interests
  FOR INSERT
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY user_interests_service_write_update ON user_interests
  FOR UPDATE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY user_interests_service_write_delete ON user_interests
  FOR DELETE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

-- ============================================================
-- 17. user_profiles - 用户画像表
-- ============================================================
DROP POLICY IF EXISTS user_profiles_service_write ON user_profiles;

CREATE POLICY user_profiles_service_write_insert ON user_profiles
  FOR INSERT
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY user_profiles_service_write_update ON user_profiles
  FOR UPDATE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY user_profiles_service_write_delete ON user_profiles
  FOR DELETE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

-- ============================================================
-- 18. vehicle_types - 车辆类型表
-- ============================================================
DROP POLICY IF EXISTS vehicle_types_service_write ON vehicle_types;

CREATE POLICY vehicle_types_service_write_insert ON vehicle_types
  FOR INSERT
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY vehicle_types_service_write_update ON vehicle_types
  FOR UPDATE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY vehicle_types_service_write_delete ON vehicle_types
  FOR DELETE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

-- ============================================================
-- 19. vehicles - 车辆表
-- ============================================================
DROP POLICY IF EXISTS vehicles_service_write ON vehicles;

CREATE POLICY vehicles_service_write_insert ON vehicles
  FOR INSERT
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY vehicles_service_write_update ON vehicles
  FOR UPDATE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY vehicles_service_write_delete ON vehicles
  FOR DELETE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

COMMIT;

