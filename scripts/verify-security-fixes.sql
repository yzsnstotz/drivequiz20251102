-- ============================================================
-- 验证安全修复脚本
-- 文件名: verify-security-fixes.sql
-- 说明: 验证所有安全修复是否已正确应用
-- 日期: 2025-11-11
-- ============================================================

-- ============================================================
-- 1. 验证 match_documents 函数的 search_path
-- ============================================================
SELECT 
  'match_documents search_path' AS check_name,
  proname AS function_name,
  prosecdef AS is_security_definer,
  proconfig AS config,
  CASE 
    WHEN proconfig::text LIKE '%search_path=public%' THEN '✅ 已修复'
    ELSE '❌ 未修复'
  END AS status
FROM pg_proc
WHERE proname = 'match_documents';

-- ============================================================
-- 2. 验证其他函数的 search_path
-- ============================================================
SELECT 
  'Other functions search_path' AS check_name,
  proname AS function_name,
  prosecdef AS is_security_definer,
  proconfig AS config,
  CASE 
    WHEN proconfig::text LIKE '%search_path=public%' OR proconfig IS NULL THEN 
      CASE 
        WHEN proconfig IS NULL AND prosecdef = false THEN '⚠️  非 SECURITY DEFINER，无需 search_path'
        WHEN proconfig::text LIKE '%search_path=public%' THEN '✅ 已修复'
        ELSE '❌ 未修复'
      END
    ELSE '❌ 未修复'
  END AS status
FROM pg_proc
WHERE proname IN ('update_users_updated_at', 'update_user_last_login', 'ai_filters_audit_trigger')
ORDER BY proname;

-- ============================================================
-- 3. 检查 vector 扩展位置
-- ============================================================
SELECT 
  'vector extension location' AS check_name,
  extname AS extension_name,
  nspname AS schema_name,
  CASE 
    WHEN nspname = 'public' THEN '⚠️  在 public schema（建议迁移到 extensions schema）'
    WHEN nspname = 'extensions' THEN '✅ 已在 extensions schema'
    ELSE '⚠️  在 ' || nspname || ' schema'
  END AS status
FROM pg_extension e
JOIN pg_namespace n ON e.extnamespace = n.oid
WHERE extname = 'vector';

-- ============================================================
-- 4. 详细函数状态报告
-- ============================================================
SELECT 
  'Detailed Function Status' AS report_type,
  proname AS function_name,
  prosecdef AS is_security_definer,
  CASE 
    WHEN proconfig::text LIKE '%search_path=public%' THEN '✅ 已修复'
    WHEN proconfig IS NULL AND prosecdef = false THEN '⚠️  非 SECURITY DEFINER，无需 search_path'
    ELSE '❌ 未修复'
  END AS status,
  proconfig AS config
FROM pg_proc
WHERE proname IN ('match_documents', 'update_users_updated_at', 'update_user_last_login', 'ai_filters_audit_trigger')
ORDER BY 
  CASE 
    WHEN proname = 'match_documents' THEN 1
    WHEN proname = 'ai_filters_audit_trigger' THEN 2
    WHEN proname = 'update_users_updated_at' THEN 3
    WHEN proname = 'update_user_last_login' THEN 4
  END;

-- ============================================================
-- 5. 总结报告
-- ============================================================
SELECT 
  'Security Fixes Summary' AS report_type,
  COUNT(*) FILTER (WHERE proname = 'match_documents' AND proconfig::text LIKE '%search_path=public%') AS match_documents_fixed,
  COUNT(*) FILTER (WHERE proname = 'ai_filters_audit_trigger' AND proconfig::text LIKE '%search_path=public%') AS ai_filters_audit_trigger_fixed,
  COUNT(*) FILTER (WHERE proname IN ('update_users_updated_at', 'update_user_last_login') AND proconfig::text LIKE '%search_path=public%') AS other_functions_fixed,
  COUNT(*) FILTER (WHERE proname IN ('match_documents', 'update_users_updated_at', 'update_user_last_login', 'ai_filters_audit_trigger') AND proconfig::text LIKE '%search_path=public%') AS total_fixed
FROM pg_proc
WHERE proname IN ('match_documents', 'update_users_updated_at', 'update_user_last_login', 'ai_filters_audit_trigger');

