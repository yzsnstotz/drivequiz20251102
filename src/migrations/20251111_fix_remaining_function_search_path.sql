-- ============================================================
-- 修复主数据库中函数的 search_path 安全问题
-- 文件名: 20251111_fix_remaining_function_search_path.sql
-- 说明: 
--   1. 修复 update_users_updated_at 函数的 search_path
--   2. 修复 update_user_last_login 函数的 search_path
-- 注意: match_documents 函数在 AI 数据库中，需要使用单独的迁移脚本修复
-- 日期: 2025-11-11
-- 参考: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable
-- ============================================================

BEGIN;

-- ============================================================
-- 1. 修复 update_users_updated_at 函数
-- ============================================================
-- 问题: 函数具有可变的角色搜索路径，可能导致 SQL 注入攻击
-- 修复: 设置固定的 search_path
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- 添加函数注释
COMMENT ON FUNCTION update_users_updated_at IS '自动更新 users 表的 updated_at 字段。已修复 search_path 安全问题。';

-- ============================================================
-- 2. 修复 update_user_last_login 函数
-- ============================================================
-- 问题: 函数具有可变的角色搜索路径，可能导致 SQL 注入攻击
-- 修复: 设置固定的 search_path
CREATE OR REPLACE FUNCTION update_user_last_login()
RETURNS TRIGGER AS $$
BEGIN
  -- 当记录登录行为时，更新 users 表的 last_login_at
  IF NEW.behavior_type = 'login' THEN
    UPDATE users 
    SET last_login_at = NEW.created_at 
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- 添加函数注释
COMMENT ON FUNCTION update_user_last_login IS '当记录登录行为时，自动更新 users 表的 last_login_at 字段。已修复 search_path 安全问题。';

COMMIT;

-- ============================================================
-- 验证修复
-- ============================================================
-- 执行以下查询验证函数 search_path 是否已修复：
-- 
-- SELECT 
--   proname AS function_name,
--   prosecdef AS is_security_definer,
--   proconfig AS config
-- FROM pg_proc
-- WHERE proname IN ('update_users_updated_at', 'update_user_last_login');
--
-- 期望结果：
-- - update_users_updated_at: config 包含 search_path=public
-- - update_user_last_login: config 包含 search_path=public
--
-- 或者使用更详细的查询：
-- 
-- SELECT 
--   p.proname AS function_name,
--   p.prosecdef AS is_security_definer,
--   pg_get_functiondef(p.oid) AS function_definition
-- FROM pg_proc p
-- WHERE p.proname IN ('update_users_updated_at', 'update_user_last_login');

