-- ============================================================
-- 优化 ai_config 和 ai_filters_history 表的 RLS 策略性能
-- 文件名: 20251111_optimize_ai_config_rls_performance.sql
-- 说明: 
--   1. 性能优化：将 auth.role() 和 current_user 改为子查询，避免每行重新评估
--   2. 策略优化：移除冗余的 anon_deny 策略，简化策略结构
-- 日期: 2025-11-11
-- 参考: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
-- ============================================================

BEGIN;

-- ============================================================
-- 1. ai_config 表 - AI 配置表
-- ============================================================

-- 删除已存在的策略
DROP POLICY IF EXISTS ai_config_service_write ON ai_config;
DROP POLICY IF EXISTS ai_config_authenticated_read ON ai_config;
DROP POLICY IF EXISTS ai_config_anon_deny ON ai_config;

-- Service role 可写（AI-Service 使用 SUPABASE_SERVICE_KEY）
-- 或 postgres 用户（直接数据库连接）
-- 性能优化：使用 (select auth.role()) 和 (select current_user) 避免每行重新评估
CREATE POLICY ai_config_service_write ON ai_config
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
-- 性能优化：使用 (select auth.role()) 和 (select current_user) 避免每行重新评估
CREATE POLICY ai_config_authenticated_read ON ai_config
  FOR SELECT
  USING (
    (select auth.role()) = 'authenticated' 
    OR (select current_user) = 'postgres'
  );

-- 注意：不再创建 anon_deny 策略，因为：
-- 1. RLS 默认是 deny all，不需要显式的 deny 策略
-- 2. 移除冗余策略可以避免策略冲突警告
-- 3. 如果用户不是 service_role、authenticated 或 postgres，RLS 会自动拒绝访问

-- ============================================================
-- 2. ai_filters_history 表 - 过滤器历史审计表
-- ============================================================

-- 删除已存在的策略
DROP POLICY IF EXISTS ai_filters_history_service_write ON ai_filters_history;
DROP POLICY IF EXISTS ai_filters_history_authenticated_read ON ai_filters_history;
DROP POLICY IF EXISTS ai_filters_history_anon_deny ON ai_filters_history;

-- Service role 可写（通过触发器自动写入）
-- 或 postgres 用户（直接数据库连接）
-- 性能优化：使用 (select auth.role()) 和 (select current_user) 避免每行重新评估
CREATE POLICY ai_filters_history_service_write ON ai_filters_history
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
-- 性能优化：使用 (select auth.role()) 和 (select current_user) 避免每行重新评估
CREATE POLICY ai_filters_history_authenticated_read ON ai_filters_history
  FOR SELECT
  USING (
    (select auth.role()) = 'authenticated' 
    OR (select current_user) = 'postgres'
  );

-- 注意：不再创建 anon_deny 策略，原因同上

COMMIT;

-- ============================================================
-- 验证优化
-- ============================================================
-- 执行以下查询验证 RLS 策略是否已优化：
-- 
-- 1. 检查策略是否已创建（应该只有 2 个策略，没有 anon_deny）：
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE tablename IN ('ai_config', 'ai_filters_history')
-- ORDER BY tablename, policyname;
--
-- 2. 检查策略定义是否使用了子查询（性能优化）：
-- SELECT 
--   tablename,
--   policyname,
--   qual,
--   with_check
-- FROM pg_policies
-- WHERE tablename IN ('ai_config', 'ai_filters_history')
--   AND (qual LIKE '%select auth.role()%' OR with_check LIKE '%select auth.role()%');
--
-- 3. 验证 RLS 是否已启用：
-- SELECT tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' 
-- AND tablename IN ('ai_config', 'ai_filters_history');

