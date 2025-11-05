-- ============================================================
-- 将 vector 扩展从 public schema 迁移到 extensions schema
-- 文件名: 20251111_move_vector_extension.sql
-- 说明: 修复 "Extension in Public" 安全警告（可选修复）
-- 日期: 2025-11-11
-- 参考: https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public
-- 
-- ⚠️  注意: 这是可选修复，优先级较低
-- ⚠️  迁移前请确保：
--   1. 备份数据库
--   2. 在测试环境先验证
--   3. 确认所有使用 vector 类型的表和函数正常工作
-- ============================================================

BEGIN;

-- ============================================================
-- 1. 创建 extensions schema（如果不存在）
-- ============================================================
CREATE SCHEMA IF NOT EXISTS extensions;

-- 授予必要权限
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- ============================================================
-- 2. 检查 vector 扩展当前位置
-- ============================================================
DO $$
DECLARE
  current_schema text;
BEGIN
  SELECT nspname INTO current_schema
  FROM pg_extension e
  JOIN pg_namespace n ON e.extnamespace = n.oid
  WHERE extname = 'vector';
  
  IF current_schema IS NULL THEN
    RAISE EXCEPTION 'vector 扩展未安装';
  ELSIF current_schema = 'extensions' THEN
    RAISE NOTICE '✅ vector 扩展已在 extensions schema，无需迁移';
  ELSIF current_schema = 'public' THEN
    RAISE NOTICE '🔄 开始迁移 vector 扩展从 public 到 extensions schema...';
    
    -- 迁移扩展
    ALTER EXTENSION vector SET SCHEMA extensions;
    
    RAISE NOTICE '✅ vector 扩展已迁移到 extensions schema';
  ELSE
    RAISE WARNING '⚠️  vector 扩展在 % schema，当前脚本仅支持从 public 迁移', current_schema;
  END IF;
END $$;

-- ============================================================
-- 3. 更新数据库 search_path 以包含 extensions schema
-- ============================================================
-- 注意: 这将影响整个数据库的默认 search_path
-- 如果只想影响特定用户，可以使用：
-- ALTER ROLE <role_name> SET search_path = public, extensions;
DO $$
BEGIN
  -- 获取当前 search_path
  DECLARE
    current_path text;
    new_path text;
  BEGIN
    SELECT current_setting('search_path') INTO current_path;
    
    -- 如果 search_path 中不包含 extensions，则添加
    IF current_path !~ 'extensions' THEN
      new_path := current_path || ', extensions';
      EXECUTE format('ALTER DATABASE %I SET search_path = %s', current_database(), new_path);
      RAISE NOTICE '✅ 已更新数据库 search_path: %', new_path;
    ELSE
      RAISE NOTICE '✅ search_path 已包含 extensions schema';
    END IF;
  END;
END $$;

-- ============================================================
-- 4. 验证迁移结果
-- ============================================================
DO $$
DECLARE
  extension_schema text;
BEGIN
  SELECT nspname INTO extension_schema
  FROM pg_extension e
  JOIN pg_namespace n ON e.extnamespace = n.oid
  WHERE extname = 'vector';
  
  IF extension_schema = 'extensions' THEN
    RAISE NOTICE '✅ 验证通过: vector 扩展已在 extensions schema';
  ELSE
    RAISE WARNING '⚠️  验证失败: vector 扩展仍在 % schema', extension_schema;
  END IF;
END $$;

COMMIT;

-- ============================================================
-- 验证查询
-- ============================================================
-- 执行以下查询验证迁移结果：
-- 
-- SELECT 
--   extname AS extension_name,
--   nspname AS schema_name
-- FROM pg_extension e
-- JOIN pg_namespace n ON e.extnamespace = n.oid
-- WHERE extname = 'vector';
--
-- 期望结果: schema_name 应该是 'extensions'
--
-- 验证 vector 类型是否仍然可用：
-- SELECT 'test'::extensions.vector(3);
-- 或（如果 search_path 已包含 extensions）：
-- SELECT 'test'::vector(3);

