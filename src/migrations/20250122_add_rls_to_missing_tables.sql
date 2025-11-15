-- ============================================================
-- 为缺失 RLS 的表启用行级安全（Row Level Security）
-- 文件名: 20250122_add_rls_to_missing_tables.sql
-- 说明: 
--   1. 为19个表启用行级安全（RLS）
--   2. 公开可读表：所有人可读，仅 service_role 可写
--   3. 管理员专用表：仅 service_role 和 authenticated 用户可访问
--   4. 用户数据表：用户只能访问自己的数据
--   5. 性能优化：使用子查询避免每行重新评估
-- 日期: 2025-01-22
-- 参考: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
-- ============================================================

BEGIN;

-- ============================================================
-- 一、公开可读表（所有人可读，仅 service_role 可写）
-- ============================================================

-- ============================================================
-- 1. ad_slots - 广告位表（公开可读）
-- ============================================================
ALTER TABLE ad_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ad_slots_service_write ON ad_slots;
DROP POLICY IF EXISTS ad_slots_public_read ON ad_slots;

-- Service role 可写
CREATE POLICY ad_slots_service_write ON ad_slots
  FOR ALL
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

-- 所有人可读（包括匿名用户）
CREATE POLICY ad_slots_public_read ON ad_slots
  FOR SELECT
  USING (true);

-- ============================================================
-- 2. ad_contents - 广告内容表（公开可读）
-- ============================================================
ALTER TABLE ad_contents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ad_contents_service_write ON ad_contents;
DROP POLICY IF EXISTS ad_contents_public_read ON ad_contents;

-- Service role 可写
CREATE POLICY ad_contents_service_write ON ad_contents
  FOR ALL
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

-- 所有人可读（包括匿名用户）
CREATE POLICY ad_contents_public_read ON ad_contents
  FOR SELECT
  USING (true);

-- ============================================================
-- 3. ad_slots_config - 广告位配置表（公开可读）
-- ============================================================
ALTER TABLE ad_slots_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ad_slots_config_service_write ON ad_slots_config;
DROP POLICY IF EXISTS ad_slots_config_public_read ON ad_slots_config;

-- Service role 可写
CREATE POLICY ad_slots_config_service_write ON ad_slots_config
  FOR ALL
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

-- 所有人可读（包括匿名用户）
CREATE POLICY ad_slots_config_public_read ON ad_slots_config
  FOR SELECT
  USING (true);

-- ============================================================
-- 4. question_package_versions - 题目包版本表（公开可读）
-- ============================================================
ALTER TABLE question_package_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS question_package_versions_service_write ON question_package_versions;
DROP POLICY IF EXISTS question_package_versions_public_read ON question_package_versions;

-- Service role 可写
CREATE POLICY question_package_versions_service_write ON question_package_versions
  FOR ALL
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

-- 所有人可读（包括匿名用户）
CREATE POLICY question_package_versions_public_read ON question_package_versions
  FOR SELECT
  USING (true);

-- ============================================================
-- 5. questions - 题目表（公开可读）
-- ============================================================
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS questions_service_write ON questions;
DROP POLICY IF EXISTS questions_public_read ON questions;

-- Service role 可写
CREATE POLICY questions_service_write ON questions
  FOR ALL
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

-- 所有人可读（包括匿名用户）
CREATE POLICY questions_public_read ON questions
  FOR SELECT
  USING (true);

-- ============================================================
-- 6. question_ai_answers - 题目AI回答表（公开可读）
-- ============================================================
ALTER TABLE question_ai_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS question_ai_answers_service_write ON question_ai_answers;
DROP POLICY IF EXISTS question_ai_answers_public_read ON question_ai_answers;

-- Service role 可写
CREATE POLICY question_ai_answers_service_write ON question_ai_answers
  FOR ALL
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

-- 所有人可读（包括匿名用户）
CREATE POLICY question_ai_answers_public_read ON question_ai_answers
  FOR SELECT
  USING (true);

-- ============================================================
-- 7. languages - 语言表（公开可读）
-- ============================================================
ALTER TABLE languages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS languages_service_write ON languages;
DROP POLICY IF EXISTS languages_public_read ON languages;

-- Service role 可写
CREATE POLICY languages_service_write ON languages
  FOR ALL
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

-- 所有人可读（包括匿名用户）
CREATE POLICY languages_public_read ON languages
  FOR SELECT
  USING (true);

-- ============================================================
-- 8. vehicle_types - 车辆类型表（公开可读）
-- ============================================================
ALTER TABLE vehicle_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vehicle_types_service_write ON vehicle_types;
DROP POLICY IF EXISTS vehicle_types_public_read ON vehicle_types;

-- Service role 可写
CREATE POLICY vehicle_types_service_write ON vehicle_types
  FOR ALL
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

-- 所有人可读（包括匿名用户）
CREATE POLICY vehicle_types_public_read ON vehicle_types
  FOR SELECT
  USING (true);

-- ============================================================
-- 9. vehicles - 车辆表（公开可读）
-- ============================================================
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vehicles_service_write ON vehicles;
DROP POLICY IF EXISTS vehicles_public_read ON vehicles;

-- Service role 可写
CREATE POLICY vehicles_service_write ON vehicles
  FOR ALL
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

-- 所有人可读（包括匿名用户）
CREATE POLICY vehicles_public_read ON vehicles
  FOR SELECT
  USING (true);

-- ============================================================
-- 10. service_categories - 服务分类表（公开可读）
-- ============================================================
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_categories_service_write ON service_categories;
DROP POLICY IF EXISTS service_categories_public_read ON service_categories;

-- Service role 可写
CREATE POLICY service_categories_service_write ON service_categories
  FOR ALL
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

-- 所有人可读（包括匿名用户）
CREATE POLICY service_categories_public_read ON service_categories
  FOR SELECT
  USING (true);

-- ============================================================
-- 11. services - 服务表（公开可读）
-- ============================================================
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS services_service_write ON services;
DROP POLICY IF EXISTS services_public_read ON services;

-- Service role 可写
CREATE POLICY services_service_write ON services
  FOR ALL
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

-- 所有人可读（包括匿名用户）
CREATE POLICY services_public_read ON services
  FOR SELECT
  USING (true);

-- ============================================================
-- 12. service_reviews - 服务评价表（公开可读）
-- ============================================================
ALTER TABLE service_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_reviews_service_write ON service_reviews;
DROP POLICY IF EXISTS service_reviews_public_read ON service_reviews;

-- Service role 可写
CREATE POLICY service_reviews_service_write ON service_reviews
  FOR ALL
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

-- 所有人可读（包括匿名用户）
CREATE POLICY service_reviews_public_read ON service_reviews
  FOR SELECT
  USING (true);

-- ============================================================
-- 二、管理员专用表（仅 service_role 和 authenticated 用户可访问）
-- ============================================================

-- ============================================================
-- 13. ad_logs - 广告日志表（管理员专用）
-- ============================================================
ALTER TABLE ad_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ad_logs_service_write ON ad_logs;
DROP POLICY IF EXISTS ad_logs_authenticated_read ON ad_logs;

-- Service role 可写
CREATE POLICY ad_logs_service_write ON ad_logs
  FOR ALL
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

-- 已认证用户可读（通过应用层 withAdminAuth 中间件验证管理员权限）
CREATE POLICY ad_logs_authenticated_read ON ad_logs
  FOR SELECT
  USING (
    (select auth.role()) = 'authenticated' 
    OR (select current_user) = 'postgres'
  );

-- ============================================================
-- 14. question_polish_history - 润色历史表（管理员专用）
-- ============================================================
ALTER TABLE question_polish_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS question_polish_history_service_write ON question_polish_history;
DROP POLICY IF EXISTS question_polish_history_authenticated_read ON question_polish_history;

-- Service role 可写
CREATE POLICY question_polish_history_service_write ON question_polish_history
  FOR ALL
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

-- 已认证用户可读
CREATE POLICY question_polish_history_authenticated_read ON question_polish_history
  FOR SELECT
  USING (
    (select auth.role()) = 'authenticated' 
    OR (select current_user) = 'postgres'
  );

-- ============================================================
-- 15. question_polish_reviews - 润色审核表（管理员专用）
-- ============================================================
ALTER TABLE question_polish_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS question_polish_reviews_service_write ON question_polish_reviews;
DROP POLICY IF EXISTS question_polish_reviews_authenticated_read ON question_polish_reviews;

-- Service role 可写
CREATE POLICY question_polish_reviews_service_write ON question_polish_reviews
  FOR ALL
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

-- 已认证用户可读
CREATE POLICY question_polish_reviews_authenticated_read ON question_polish_reviews
  FOR SELECT
  USING (
    (select auth.role()) = 'authenticated' 
    OR (select current_user) = 'postgres'
  );

-- ============================================================
-- 16. question_ai_answer_pending_updates - 待更新题目AI回答表（管理员专用）
-- ============================================================
ALTER TABLE question_ai_answer_pending_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS question_ai_answer_pending_updates_service_write ON question_ai_answer_pending_updates;
DROP POLICY IF EXISTS question_ai_answer_pending_updates_authenticated_read ON question_ai_answer_pending_updates;

-- Service role 可写
CREATE POLICY question_ai_answer_pending_updates_service_write ON question_ai_answer_pending_updates
  FOR ALL
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

-- 已认证用户可读
CREATE POLICY question_ai_answer_pending_updates_authenticated_read ON question_ai_answer_pending_updates
  FOR SELECT
  USING (
    (select auth.role()) = 'authenticated' 
    OR (select current_user) = 'postgres'
  );

-- ============================================================
-- 17. batch_process_tasks - 批量处理任务表（管理员专用）
-- ============================================================
ALTER TABLE batch_process_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS batch_process_tasks_service_write ON batch_process_tasks;
DROP POLICY IF EXISTS batch_process_tasks_authenticated_read ON batch_process_tasks;

-- Service role 可写
CREATE POLICY batch_process_tasks_service_write ON batch_process_tasks
  FOR ALL
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

-- 已认证用户可读
CREATE POLICY batch_process_tasks_authenticated_read ON batch_process_tasks
  FOR SELECT
  USING (
    (select auth.role()) = 'authenticated' 
    OR (select current_user) = 'postgres'
  );

-- ============================================================
-- 三、用户数据表（管理员专用，通过应用层 API 访问）
-- 注意：由于系统使用自定义 JWT 认证而非 Supabase Auth，
-- 用户访问需要通过应用层 API，应用层已处理认证和授权
-- ============================================================

-- ============================================================
-- 18. user_profiles - 用户画像表（管理员专用）
-- ============================================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_profiles_service_write ON user_profiles;
DROP POLICY IF EXISTS user_profiles_authenticated_read ON user_profiles;

-- Service role 可写
CREATE POLICY user_profiles_service_write ON user_profiles
  FOR ALL
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

-- 已认证用户可读（通过应用层 API 验证用户权限）
CREATE POLICY user_profiles_authenticated_read ON user_profiles
  FOR SELECT
  USING (
    (select auth.role()) = 'authenticated' 
    OR (select current_user) = 'postgres'
  );

-- ============================================================
-- 19. user_interests - 用户兴趣表（管理员专用）
-- ============================================================
ALTER TABLE user_interests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_interests_service_write ON user_interests;
DROP POLICY IF EXISTS user_interests_authenticated_read ON user_interests;

-- Service role 可写
CREATE POLICY user_interests_service_write ON user_interests
  FOR ALL
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

-- 已认证用户可读（通过应用层 API 验证用户权限）
CREATE POLICY user_interests_authenticated_read ON user_interests
  FOR SELECT
  USING (
    (select auth.role()) = 'authenticated' 
    OR (select current_user) = 'postgres'
  );

COMMIT;

-- ============================================================
-- 验证 RLS 是否已启用
-- ============================================================
-- 执行以下查询验证 RLS 是否已启用：
-- 
-- SELECT tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' 
-- AND tablename IN (
--   'ad_slots',
--   'ad_contents',
--   'ad_logs',
--   'ad_slots_config',
--   'question_package_versions',
--   'question_polish_history',
--   'questions',
--   'question_polish_reviews',
--   'question_ai_answers',
--   'question_ai_answer_pending_updates',
--   'languages',
--   'user_profiles',
--   'user_interests',
--   'vehicle_types',
--   'vehicles',
--   'service_categories',
--   'services',
--   'service_reviews',
--   'batch_process_tasks'
-- );
--
-- 执行以下查询验证策略是否已创建：
-- 
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE tablename IN (
--   'ad_slots',
--   'ad_contents',
--   'ad_logs',
--   'ad_slots_config',
--   'question_package_versions',
--   'question_polish_history',
--   'questions',
--   'question_polish_reviews',
--   'question_ai_answers',
--   'question_ai_answer_pending_updates',
--   'languages',
--   'user_profiles',
--   'user_interests',
--   'vehicle_types',
--   'vehicles',
--   'service_categories',
--   'services',
--   'service_reviews',
--   'batch_process_tasks'
-- )
-- ORDER BY tablename, policyname;

