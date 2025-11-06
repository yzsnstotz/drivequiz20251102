-- ============================================================
-- 修复多个 permissive 策略冲突问题
-- 文件名: 20251111_fix_multiple_permissive_policies.sql
-- 说明: 
--   1. 将 service_write 策略从 FOR ALL 改为单独的 INSERT, UPDATE, DELETE 策略
--   2. 避免与 SELECT 策略重叠，解决 multiple permissive policies 警告
--   3. 性能优化：每个操作类型只有一个策略，减少策略评估次数
-- 日期: 2025-11-11
-- 参考: https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies
-- ============================================================

BEGIN;

-- ============================================================
-- 辅助函数：为每个表创建写操作策略（INSERT, UPDATE, DELETE）
-- ============================================================

-- 创建写操作策略的函数（用于复用）
-- 注意：PostgreSQL 不支持在策略中直接使用函数，所以我们需要为每个表单独创建

-- ============================================================
-- 1. activation_codes - 激活码表
-- ============================================================

-- 删除旧的 service_write 策略（FOR ALL）
DROP POLICY IF EXISTS activation_codes_service_write ON activation_codes;

-- 创建单独的写操作策略（不包含 SELECT）
CREATE POLICY activation_codes_service_write_insert ON activation_codes
  FOR INSERT
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY activation_codes_service_write_update ON activation_codes
  FOR UPDATE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY activation_codes_service_write_delete ON activation_codes
  FOR DELETE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

-- ============================================================
-- 2. activations - 激活记录表
-- ============================================================

DROP POLICY IF EXISTS activations_service_write ON activations;

CREATE POLICY activations_service_write_insert ON activations
  FOR INSERT
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY activations_service_write_update ON activations
  FOR UPDATE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY activations_service_write_delete ON activations
  FOR DELETE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

-- ============================================================
-- 3. admins - 管理员表
-- ============================================================

DROP POLICY IF EXISTS admins_service_write ON admins;

CREATE POLICY admins_service_write_insert ON admins
  FOR INSERT
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY admins_service_write_update ON admins
  FOR UPDATE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY admins_service_write_delete ON admins
  FOR DELETE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

-- ============================================================
-- 4. contact_info - 联系信息表
-- ============================================================

DROP POLICY IF EXISTS contact_info_service_write ON contact_info;

CREATE POLICY contact_info_service_write_insert ON contact_info
  FOR INSERT
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY contact_info_service_write_update ON contact_info
  FOR UPDATE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY contact_info_service_write_delete ON contact_info
  FOR DELETE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

-- ============================================================
-- 5. merchant_categories - 商户类别表
-- ============================================================

DROP POLICY IF EXISTS merchant_categories_service_write ON merchant_categories;

CREATE POLICY merchant_categories_service_write_insert ON merchant_categories
  FOR INSERT
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY merchant_categories_service_write_update ON merchant_categories
  FOR UPDATE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY merchant_categories_service_write_delete ON merchant_categories
  FOR DELETE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

-- ============================================================
-- 6. merchants - 商户表
-- ============================================================

DROP POLICY IF EXISTS merchants_service_write ON merchants;

CREATE POLICY merchants_service_write_insert ON merchants
  FOR INSERT
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY merchants_service_write_update ON merchants
  FOR UPDATE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY merchants_service_write_delete ON merchants
  FOR DELETE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

-- ============================================================
-- 7. operation_logs - 操作日志表
-- ============================================================

DROP POLICY IF EXISTS operation_logs_service_write ON operation_logs;

CREATE POLICY operation_logs_service_write_insert ON operation_logs
  FOR INSERT
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY operation_logs_service_write_update ON operation_logs
  FOR UPDATE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY operation_logs_service_write_delete ON operation_logs
  FOR DELETE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

-- ============================================================
-- 8. terms_of_service - 服务条款表
-- ============================================================

DROP POLICY IF EXISTS terms_of_service_service_write ON terms_of_service;

CREATE POLICY terms_of_service_service_write_insert ON terms_of_service
  FOR INSERT
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY terms_of_service_service_write_update ON terms_of_service
  FOR UPDATE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY terms_of_service_service_write_delete ON terms_of_service
  FOR DELETE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

-- ============================================================
-- 9. user_behaviors - 用户行为表
-- ============================================================

DROP POLICY IF EXISTS user_behaviors_service_write ON user_behaviors;

CREATE POLICY user_behaviors_service_write_insert ON user_behaviors
  FOR INSERT
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY user_behaviors_service_write_update ON user_behaviors
  FOR UPDATE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY user_behaviors_service_write_delete ON user_behaviors
  FOR DELETE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

-- ============================================================
-- 10. users - 用户表
-- ============================================================

DROP POLICY IF EXISTS users_service_write ON users;

CREATE POLICY users_service_write_insert ON users
  FOR INSERT
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY users_service_write_update ON users
  FOR UPDATE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY users_service_write_delete ON users
  FOR DELETE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

-- ============================================================
-- 11. videos - 视频表
-- ============================================================

DROP POLICY IF EXISTS videos_service_write ON videos;

CREATE POLICY videos_service_write_insert ON videos
  FOR INSERT
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY videos_service_write_update ON videos
  FOR UPDATE
  USING (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  )
  WITH CHECK (
    (select auth.role()) = 'service_role' 
    OR (select current_user) = 'postgres'
  );

CREATE POLICY videos_service_write_delete ON videos
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
--   'activation_codes',
--   'activations',
--   'admins',
--   'contact_info',
--   'merchant_categories',
--   'merchants',
--   'operation_logs',
--   'terms_of_service',
--   'user_behaviors',
--   'users',
--   'videos'
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
--   'activation_codes',
--   'activations',
--   'admins',
--   'contact_info',
--   'merchant_categories',
--   'merchants',
--   'operation_logs',
--   'terms_of_service',
--   'user_behaviors',
--   'users',
--   'videos'
-- )
-- GROUP BY tablename, cmd
-- HAVING COUNT(*) > 1
-- ORDER BY tablename, cmd;
--
-- 如果修复成功，应该没有结果返回（每个表每个操作类型只有一个策略）
