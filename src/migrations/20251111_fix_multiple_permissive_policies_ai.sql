-- ============================================================
-- 修复 AI 数据库多个 permissive 策略冲突问题
-- 文件名: 20251111_fix_multiple_permissive_policies_ai.sql
-- 说明: 
--   1. 将 AI 数据库中的 service_write 策略从 FOR ALL 改为单独的 INSERT, UPDATE, DELETE 策略
--   2. 避免与 SELECT 策略重叠，解决 multiple permissive policies 警告
--   3. 性能优化：每个操作类型只有一个策略，减少策略评估次数
-- 日期: 2025-11-11
-- 数据库: ZALEM AI Service 数据库（AI 数据库）
-- 参考: https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies
-- ============================================================

BEGIN;

-- ============================================================
-- 1. ai_config - AI 配置表
-- ============================================================

-- 删除旧的 service_write 策略（FOR ALL）
DROP POLICY IF EXISTS ai_config_service_write ON ai_config;

-- 创建单独的写操作策略（不包含 SELECT）
CREATE POLICY ai_config_service_write_insert ON ai_config
  FOR INSERT
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY ai_config_service_write_update ON ai_config
  FOR UPDATE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY ai_config_service_write_delete ON ai_config
  FOR DELETE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

-- ============================================================
-- 2. ai_filters_history - AI 过滤器历史表
-- ============================================================

DROP POLICY IF EXISTS ai_filters_history_service_write ON ai_filters_history;

CREATE POLICY ai_filters_history_service_write_insert ON ai_filters_history
  FOR INSERT
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY ai_filters_history_service_write_update ON ai_filters_history
  FOR UPDATE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY ai_filters_history_service_write_delete ON ai_filters_history
  FOR DELETE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

COMMIT;

-- ============================================================
-- 验证修复结果
-- ============================================================
-- 执行以下查询验证策略是否已正确更新：
-- 
-- SELECT 
--   tablename,
--   policyname,
--   cmd,
--   CASE 
--     WHEN cmd = 'SELECT' THEN '✅ SELECT 策略（独立）'
--     WHEN cmd = 'ALL' THEN '⚠️  ALL 策略（需要修复）'
--     WHEN cmd IN ('INSERT', 'UPDATE', 'DELETE') THEN '✅ 写操作策略（已修复）'
--     ELSE cmd
--   END AS status
-- FROM pg_policies
-- WHERE tablename IN (
--   'ai_config',
--   'ai_filters_history'
-- )
-- ORDER BY tablename, cmd, policyname;
--
-- 执行以下查询检查是否还有 multiple permissive policies（应该没有结果）：
--
-- SELECT 
--   tablename,
--   cmd,
--   COUNT(*) as policy_count,
--   array_agg(policyname ORDER BY policyname) as policy_names
-- FROM pg_policies
-- WHERE tablename IN (
--   'ai_config',
--   'ai_filters_history'
-- )
-- GROUP BY tablename, cmd
-- HAVING COUNT(*) > 1
-- ORDER BY tablename, cmd;
--
-- 如果修复成功，应该没有结果返回（每个表每个操作类型只有一个策略）

