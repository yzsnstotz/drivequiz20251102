-- ============================================================
-- 为所有表启用 RLS（Row Level Security）
-- 文件名: 20251111_add_rls_to_all_tables.sql
-- 说明: 
--   1. 为11个表启用行级安全（RLS）
--   2. 管理员专用表：仅 service_role 和 authenticated 用户可访问
--   3. 公开可读表：所有人可读，仅 service_role 可写
--   4. 性能优化：使用子查询避免每行重新评估
-- 日期: 2025-11-11
-- 参考: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
-- ============================================================

BEGIN;

-- ============================================================
-- 1. activations - 激活记录表（管理员专用）
-- ============================================================
ALTER TABLE activations ENABLE ROW LEVEL SECURITY;

-- 删除已存在的策略（如果存在）
DROP POLICY IF EXISTS activations_service_write ON activations;
DROP POLICY IF EXISTS activations_authenticated_read ON activations;

-- Service role 可写（通过应用层写入）
-- 或 postgres 用户（直接数据库连接）
-- 性能优化：使用 (select auth.role()) 和 (select current_user) 避免每行重新评估
CREATE POLICY activations_service_write ON activations
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
-- 或 postgres 用户（直接数据库连接）
CREATE POLICY activations_authenticated_read ON activations
  FOR SELECT
  USING (
    (select auth.role()) = 'authenticated' 
    OR (select current_user) = 'postgres'
  );

-- ============================================================
-- 2. activation_codes - 激活码表（管理员专用）
-- ============================================================
ALTER TABLE activation_codes ENABLE ROW LEVEL SECURITY;

-- 删除已存在的策略（如果存在）
DROP POLICY IF EXISTS activation_codes_service_write ON activation_codes;
DROP POLICY IF EXISTS activation_codes_authenticated_read ON activation_codes;

-- Service role 可写
CREATE POLICY activation_codes_service_write ON activation_codes
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
CREATE POLICY activation_codes_authenticated_read ON activation_codes
  FOR SELECT
  USING (
    (select auth.role()) = 'authenticated' 
    OR (select current_user) = 'postgres'
  );

-- ============================================================
-- 3. admins - 管理员表（管理员专用）
-- ============================================================
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- 删除已存在的策略（如果存在）
DROP POLICY IF EXISTS admins_service_write ON admins;
DROP POLICY IF EXISTS admins_authenticated_read ON admins;

-- Service role 可写
CREATE POLICY admins_service_write ON admins
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
CREATE POLICY admins_authenticated_read ON admins
  FOR SELECT
  USING (
    (select auth.role()) = 'authenticated' 
    OR (select current_user) = 'postgres'
  );

-- ============================================================
-- 4. operation_logs - 操作日志表（管理员专用）
-- ============================================================
ALTER TABLE operation_logs ENABLE ROW LEVEL SECURITY;

-- 删除已存在的策略（如果存在）
DROP POLICY IF EXISTS operation_logs_service_write ON operation_logs;
DROP POLICY IF EXISTS operation_logs_authenticated_read ON operation_logs;

-- Service role 可写
CREATE POLICY operation_logs_service_write ON operation_logs
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
CREATE POLICY operation_logs_authenticated_read ON operation_logs
  FOR SELECT
  USING (
    (select auth.role()) = 'authenticated' 
    OR (select current_user) = 'postgres'
  );

-- ============================================================
-- 5. users - 用户表（管理员专用）
-- ============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 删除已存在的策略（如果存在）
DROP POLICY IF EXISTS users_service_write ON users;
DROP POLICY IF EXISTS users_authenticated_read ON users;

-- Service role 可写
CREATE POLICY users_service_write ON users
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
CREATE POLICY users_authenticated_read ON users
  FOR SELECT
  USING (
    (select auth.role()) = 'authenticated' 
    OR (select current_user) = 'postgres'
  );

-- ============================================================
-- 6. user_behaviors - 用户行为表（管理员专用）
-- ============================================================
ALTER TABLE user_behaviors ENABLE ROW LEVEL SECURITY;

-- 删除已存在的策略（如果存在）
DROP POLICY IF EXISTS user_behaviors_service_write ON user_behaviors;
DROP POLICY IF EXISTS user_behaviors_authenticated_read ON user_behaviors;

-- Service role 可写
CREATE POLICY user_behaviors_service_write ON user_behaviors
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
CREATE POLICY user_behaviors_authenticated_read ON user_behaviors
  FOR SELECT
  USING (
    (select auth.role()) = 'authenticated' 
    OR (select current_user) = 'postgres'
  );

-- ============================================================
-- 7. merchants - 商户表（公开可读）
-- ============================================================
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;

-- 删除已存在的策略（如果存在）
DROP POLICY IF EXISTS merchants_service_write ON merchants;
DROP POLICY IF EXISTS merchants_public_read ON merchants;

-- Service role 可写
CREATE POLICY merchants_service_write ON merchants
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
CREATE POLICY merchants_public_read ON merchants
  FOR SELECT
  USING (true);

-- ============================================================
-- 8. merchant_categories - 商户类别表（公开可读）
-- ============================================================
ALTER TABLE merchant_categories ENABLE ROW LEVEL SECURITY;

-- 删除已存在的策略（如果存在）
DROP POLICY IF EXISTS merchant_categories_service_write ON merchant_categories;
DROP POLICY IF EXISTS merchant_categories_public_read ON merchant_categories;

-- Service role 可写
CREATE POLICY merchant_categories_service_write ON merchant_categories
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
CREATE POLICY merchant_categories_public_read ON merchant_categories
  FOR SELECT
  USING (true);

-- ============================================================
-- 9. videos - 视频表（公开可读）
-- ============================================================
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

-- 删除已存在的策略（如果存在）
DROP POLICY IF EXISTS videos_service_write ON videos;
DROP POLICY IF EXISTS videos_public_read ON videos;

-- Service role 可写
CREATE POLICY videos_service_write ON videos
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
CREATE POLICY videos_public_read ON videos
  FOR SELECT
  USING (true);

-- ============================================================
-- 10. contact_info - 联系信息表（公开可读）
-- ============================================================
ALTER TABLE contact_info ENABLE ROW LEVEL SECURITY;

-- 删除已存在的策略（如果存在）
DROP POLICY IF EXISTS contact_info_service_write ON contact_info;
DROP POLICY IF EXISTS contact_info_public_read ON contact_info;

-- Service role 可写
CREATE POLICY contact_info_service_write ON contact_info
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
CREATE POLICY contact_info_public_read ON contact_info
  FOR SELECT
  USING (true);

-- ============================================================
-- 11. terms_of_service - 服务条款表（公开可读）
-- ============================================================
ALTER TABLE terms_of_service ENABLE ROW LEVEL SECURITY;

-- 删除已存在的策略（如果存在）
DROP POLICY IF EXISTS terms_of_service_service_write ON terms_of_service;
DROP POLICY IF EXISTS terms_of_service_public_read ON terms_of_service;

-- Service role 可写
CREATE POLICY terms_of_service_service_write ON terms_of_service
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
CREATE POLICY terms_of_service_public_read ON terms_of_service
  FOR SELECT
  USING (true);

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
--   'activations',
--   'activation_codes',
--   'admins',
--   'operation_logs',
--   'users',
--   'user_behaviors',
--   'merchants',
--   'merchant_categories',
--   'videos',
--   'contact_info',
--   'terms_of_service'
-- );
--
-- 执行以下查询验证策略是否已创建：
-- 
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE tablename IN (
--   'activations',
--   'activation_codes',
--   'admins',
--   'operation_logs',
--   'users',
--   'user_behaviors',
--   'merchants',
--   'merchant_categories',
--   'videos',
--   'contact_info',
--   'terms_of_service'
-- )
-- ORDER BY tablename, policyname;
--
-- 验证策略定义是否使用了子查询（性能优化）：
-- 
-- SELECT 
--   tablename,
--   policyname,
--   qual,
--   with_check
-- FROM pg_policies
-- WHERE tablename IN (
--   'activations',
--   'activation_codes',
--   'admins',
--   'operation_logs',
--   'users',
--   'user_behaviors',
--   'merchants',
--   'merchant_categories',
--   'videos',
--   'contact_info',
--   'terms_of_service'
-- )
-- AND (qual LIKE '%select auth.role()%' OR with_check LIKE '%select auth.role()%');

