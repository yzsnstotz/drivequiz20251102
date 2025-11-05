-- ============================================================
-- 为 ai_config 和 ai_filters_history 表添加 RLS 策略
-- 文件名: 20251111_add_ai_config_rls.sql
-- 说明: 为 ai_config 和 ai_filters_history 表启用行级安全（RLS）
-- 日期: 2025-11-11
-- ============================================================

BEGIN;

-- ============================================================
-- 1. ai_config 表 - AI 配置表
-- ============================================================
ALTER TABLE ai_config ENABLE ROW LEVEL SECURITY;

-- 删除已存在的策略（如果存在）
DROP POLICY IF EXISTS ai_config_service_write ON ai_config;
DROP POLICY IF EXISTS ai_config_admin_read ON ai_config;
DROP POLICY IF EXISTS ai_config_authenticated_read ON ai_config;
DROP POLICY IF EXISTS ai_config_anon_deny ON ai_config;

-- Service role 可写（AI-Service 使用 SUPABASE_SERVICE_KEY）
-- 或 postgres 用户（直接数据库连接）
CREATE POLICY ai_config_service_write ON ai_config
  FOR ALL
  USING (
    auth.role() = 'service_role' 
    OR current_user = 'postgres'
  )
  WITH CHECK (
    auth.role() = 'service_role' 
    OR current_user = 'postgres'
  );

-- 已认证用户可读（通过应用层 withAdminAuth 中间件验证管理员权限）
-- 或 postgres 用户（直接数据库连接）
CREATE POLICY ai_config_authenticated_read ON ai_config
  FOR SELECT
  USING (
    auth.role() = 'authenticated' 
    OR current_user = 'postgres'
  );

-- 匿名用户拒绝
CREATE POLICY ai_config_anon_deny ON ai_config
  FOR ALL
  USING (false);

-- ============================================================
-- 2. ai_filters_history 表 - 过滤器历史审计表
-- ============================================================
ALTER TABLE ai_filters_history ENABLE ROW LEVEL SECURITY;

-- 删除已存在的策略（如果存在）
DROP POLICY IF EXISTS ai_filters_history_service_write ON ai_filters_history;
DROP POLICY IF EXISTS ai_filters_history_admin_read ON ai_filters_history;
DROP POLICY IF EXISTS ai_filters_history_authenticated_read ON ai_filters_history;
DROP POLICY IF EXISTS ai_filters_history_anon_deny ON ai_filters_history;

-- Service role 可写（通过触发器自动写入）
-- 或 postgres 用户（直接数据库连接）
CREATE POLICY ai_filters_history_service_write ON ai_filters_history
  FOR ALL
  USING (
    auth.role() = 'service_role' 
    OR current_user = 'postgres'
  )
  WITH CHECK (
    auth.role() = 'service_role' 
    OR current_user = 'postgres'
  );

-- 已认证用户可读（通过应用层 withAdminAuth 中间件验证管理员权限）
-- 或 postgres 用户（直接数据库连接）
CREATE POLICY ai_filters_history_authenticated_read ON ai_filters_history
  FOR SELECT
  USING (
    auth.role() = 'authenticated' 
    OR current_user = 'postgres'
  );

-- 匿名用户拒绝
CREATE POLICY ai_filters_history_anon_deny ON ai_filters_history
  FOR ALL
  USING (false);

COMMIT;

-- ============================================================
-- 验证修复
-- ============================================================
-- 执行以下查询验证 RLS 是否已启用：
-- SELECT tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' 
-- AND tablename IN ('ai_config', 'ai_filters_history');
--
-- 执行以下查询验证策略是否已创建：
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE tablename IN ('ai_config', 'ai_filters_history');

