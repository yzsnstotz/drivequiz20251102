-- ============================================================
-- 修复 ai_scene_config 表多个 permissive 策略性能问题
-- 文件名: 20250122_fix_ai_scene_config_multiple_policies.sql
-- 说明: 
--   1. 将 service_write 策略从 FOR ALL 改为单独的 INSERT, UPDATE, DELETE 策略
--   2. 合并 SELECT 策略，避免与 service_write 策略重叠
--   3. 性能优化：每个操作类型只有一个策略，减少策略评估次数
-- 日期: 2025-01-22
-- 参考: https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies
-- ============================================================

BEGIN;

-- ============================================================
-- ai_scene_config - AI 场景配置表
-- ============================================================

DO $$
BEGIN
  -- 检查 ai_scene_config 表是否存在
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'ai_scene_config'
  ) THEN
    -- 删除旧的策略（如果存在）
    DROP POLICY IF EXISTS ai_scene_config_service_write ON ai_scene_config;
    DROP POLICY IF EXISTS ai_scene_config_authenticated_read ON ai_scene_config;
    
    -- 创建统一的 SELECT 策略（合并 service_role、authenticated 和 postgres）
    -- 性能优化：使用 (select auth.role()) 和 (select current_user) 避免每行重新评估
    CREATE POLICY ai_scene_config_select ON ai_scene_config
      FOR SELECT
      USING (
        (select auth.role()) = 'service_role'
        OR (select auth.role()) = 'authenticated'
        OR (select current_user) = 'postgres'
      );
    
    -- Service role 和 postgres 可插入
    CREATE POLICY ai_scene_config_service_write_insert ON ai_scene_config
      FOR INSERT
      WITH CHECK (
        (select auth.role()) = 'service_role' 
        OR (select current_user) = 'postgres'
      );
    
    -- Service role 和 postgres 可更新
    CREATE POLICY ai_scene_config_service_write_update ON ai_scene_config
      FOR UPDATE
      USING (
        (select auth.role()) = 'service_role' 
        OR (select current_user) = 'postgres'
      )
      WITH CHECK (
        (select auth.role()) = 'service_role' 
        OR (select current_user) = 'postgres'
      );
    
    -- Service role 和 postgres 可删除
    CREATE POLICY ai_scene_config_service_write_delete ON ai_scene_config
      FOR DELETE
      USING (
        (select auth.role()) = 'service_role' 
        OR (select current_user) = 'postgres'
      );
    
    RAISE NOTICE '✅ ai_scene_config 表策略已优化，已解决多个 permissive 策略问题';
  ELSE
    RAISE NOTICE '⚠️  ai_scene_config 表不存在，跳过策略优化';
  END IF;
END $$;

COMMIT;

