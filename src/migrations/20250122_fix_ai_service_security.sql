-- ============================================================
-- 修复 AI Service 数据库安全问题
-- 文件名: 20250122_fix_ai_service_security.sql
-- 说明: 
--   1. 为 ai_scene_config 表启用 RLS
--   2. 修复三个函数的 search_path 安全问题
--   3. 将 vector 扩展移动到 extensions schema（如果还在 public）
-- 日期: 2025-01-22
-- 数据库: AI Service 数据库
-- 参考: 
--   - https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public
--   - https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable
--   - https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public
-- ============================================================

BEGIN;

-- ============================================================
-- 一、为 ai_scene_config 表启用 RLS
-- ============================================================
DO $$
BEGIN
  -- 检查 ai_scene_config 表是否存在
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'ai_scene_config'
  ) THEN
    -- 启用 RLS
    ALTER TABLE ai_scene_config ENABLE ROW LEVEL SECURITY;
    
    -- 删除旧策略（如果存在）
    DROP POLICY IF EXISTS ai_scene_config_service_write ON ai_scene_config;
    DROP POLICY IF EXISTS ai_scene_config_authenticated_read ON ai_scene_config;
    
    -- Service role 可写
    CREATE POLICY ai_scene_config_service_write ON ai_scene_config
      FOR ALL
      USING (
        (select auth.role()) = 'service_role' 
        OR (select current_user) = 'postgres'
      )
      WITH CHECK (
        (select auth.role()) = 'service_role' 
        OR (select current_user) = 'postgres'
      );
    
    -- 已认证用户可读（通过应用层 API 验证管理员权限）
    CREATE POLICY ai_scene_config_authenticated_read ON ai_scene_config
      FOR SELECT
      USING (
        (select auth.role()) = 'authenticated' 
        OR (select current_user) = 'postgres'
      );
    
    RAISE NOTICE '✅ ai_scene_config 表已启用 RLS';
  ELSE
    RAISE NOTICE '⚠️  ai_scene_config 表不存在，跳过 RLS 设置';
  END IF;
END $$;

-- ============================================================
-- 二、修复函数 search_path 安全问题
-- ============================================================

-- ============================================================
-- 1. 修复 update_rag_operations_updated_at 函数
-- ============================================================
DO $$
BEGIN
  -- 检查函数是否存在
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'update_rag_operations_updated_at'
  ) THEN
    -- 重新创建函数并设置 search_path（使用动态 SQL 避免分隔符冲突）
    EXECUTE $func$
    CREATE OR REPLACE FUNCTION update_rag_operations_updated_at()
    RETURNS TRIGGER AS $body$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $body$ LANGUAGE plpgsql
    SET search_path = public, extensions;
    $func$;
    
    EXECUTE 'COMMENT ON FUNCTION update_rag_operations_updated_at IS ''自动更新 rag_operations 表的 updated_at 字段。已修复 search_path 安全问题。''';
    
    RAISE NOTICE '✅ update_rag_operations_updated_at 函数已修复';
  ELSE
    RAISE NOTICE '⚠️  update_rag_operations_updated_at 函数不存在，跳过修复';
  END IF;
END $$;

-- ============================================================
-- 2. 修复 update_rag_documents_updated_at 函数
-- ============================================================
DO $$
BEGIN
  -- 检查函数是否存在
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'update_rag_documents_updated_at'
  ) THEN
    -- 重新创建函数并设置 search_path（使用动态 SQL 避免分隔符冲突）
    EXECUTE $func$
    CREATE OR REPLACE FUNCTION update_rag_documents_updated_at()
    RETURNS TRIGGER AS $body$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $body$ LANGUAGE plpgsql
    SET search_path = public, extensions;
    $func$;
    
    EXECUTE 'COMMENT ON FUNCTION update_rag_documents_updated_at IS ''自动更新 rag_documents 表的 updated_at 字段。已修复 search_path 安全问题。''';
    
    RAISE NOTICE '✅ update_rag_documents_updated_at 函数已修复';
  ELSE
    RAISE NOTICE '⚠️  update_rag_documents_updated_at 函数不存在，跳过修复';
  END IF;
END $$;

-- ============================================================
-- 3. 修复 match_documents 函数（如果存在且 ai_vectors 表存在）
-- ============================================================
DO $$
DECLARE
  func_args text;
  vector_dim text;
  has_seed_url boolean;
BEGIN
  -- 检查 ai_vectors 表是否存在
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'ai_vectors'
  ) THEN
    -- 检查函数是否存在并获取参数信息
    SELECT pg_get_function_arguments(p.oid) INTO func_args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'match_documents'
    LIMIT 1;
    
    IF func_args IS NULL THEN
      RAISE NOTICE '⚠️  match_documents 函数不存在，跳过修复';
    ELSE
      -- 检测向量维度（1536 或 768）
      IF func_args LIKE '%vector(1536)%' THEN
        vector_dim := '1536';
      ELSIF func_args LIKE '%vector(768)%' THEN
        vector_dim := '768';
      ELSE
        -- 默认使用 1536 维
        vector_dim := '1536';
        RAISE NOTICE '⚠️  无法确定向量维度，默认使用 1536 维';
      END IF;
      
      -- 检测是否有 seed_url 参数（直接检查参数中是否包含 seed_url 关键字）
      has_seed_url := func_args LIKE '%seed_url%';
      
      -- 根据检测到的参数创建函数
      IF has_seed_url THEN
        -- 带 seed_url 参数的版本
        EXECUTE format($func$
        CREATE OR REPLACE FUNCTION match_documents(
          query_embedding vector(%s),
          match_threshold float DEFAULT 0.75,
          match_count int DEFAULT 3,
          seed_url text DEFAULT NULL
        )
        RETURNS TABLE (
          id bigint,
          doc_id varchar,
          content text,
          source_title text,
          source_url text,
          version varchar,
          similarity float
        )
        LANGUAGE sql STABLE
        SECURITY DEFINER
        SET search_path = public, extensions
        AS $body$
          SELECT id, doc_id, content, source_title, source_url, version,
                 1 - (embedding <=> query_embedding) AS similarity
          FROM ai_vectors
          WHERE 1 - (embedding <=> query_embedding) >= match_threshold
            AND (seed_url IS NULL OR source_url IS NULL OR source_url LIKE seed_url || '%%' OR source_url = seed_url)
          ORDER BY similarity DESC
          LIMIT match_count;
        $body$;
        $func$, vector_dim);
        
        EXECUTE format('COMMENT ON FUNCTION match_documents(vector(%s), float, int, text) IS ''根据查询向量检索最相似的文档片段，返回相似度大于阈值的记录。支持可选的种子URL过滤。已修复 search_path 安全问题。''', vector_dim);
        
        RAISE NOTICE '✅ match_documents 函数已修复（%s维版本，带 seed_url 参数）', vector_dim;
      ELSE
        -- 不带 seed_url 参数的版本（保持向后兼容）
        EXECUTE format($func$
        CREATE OR REPLACE FUNCTION match_documents(
          query_embedding vector(%s),
          match_threshold float DEFAULT 0.75,
          match_count int DEFAULT 3
        )
        RETURNS TABLE (
          id bigint,
          doc_id varchar,
          content text,
          source_title text,
          source_url text,
          version varchar,
          similarity float
        )
        LANGUAGE sql STABLE
        SECURITY DEFINER
        SET search_path = public, extensions
        AS $body$
          SELECT id, doc_id, content, source_title, source_url, version,
                 1 - (embedding <=> query_embedding) AS similarity
          FROM ai_vectors
          WHERE 1 - (embedding <=> query_embedding) >= match_threshold
          ORDER BY similarity DESC
          LIMIT match_count;
        $body$;
        $func$, vector_dim);
        
        EXECUTE format('COMMENT ON FUNCTION match_documents(vector(%s), float, int) IS ''根据查询向量检索最相似的文档片段，返回相似度大于阈值的记录。已修复 search_path 安全问题。''', vector_dim);
        
        RAISE NOTICE '✅ match_documents 函数已修复（%s维版本）', vector_dim;
      END IF;
    END IF;
  ELSE
    RAISE NOTICE '⚠️  ai_vectors 表不存在，跳过 match_documents 函数修复';
  END IF;
END $$;

-- ============================================================
-- 三、将 vector 扩展移动到 extensions schema（如果还在 public）
-- ============================================================
DO $$
DECLARE
  current_schema text;
BEGIN
  -- 检查 vector 扩展是否存在
  SELECT nspname INTO current_schema
  FROM pg_extension e
  JOIN pg_namespace n ON e.extnamespace = n.oid
  WHERE extname = 'vector';
  
  IF current_schema IS NULL THEN
    RAISE NOTICE '⚠️  vector 扩展未安装，跳过迁移';
  ELSIF current_schema = 'extensions' THEN
    RAISE NOTICE '✅ vector 扩展已在 extensions schema，无需迁移';
  ELSIF current_schema = 'public' THEN
    RAISE NOTICE '🔄 开始迁移 vector 扩展从 public 到 extensions schema...';
    
    -- 创建 extensions schema（如果不存在）
    CREATE SCHEMA IF NOT EXISTS extensions;
    
    -- 授予必要权限
    GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
    
    -- 迁移扩展
    ALTER EXTENSION vector SET SCHEMA extensions;
    
    -- 更新数据库 search_path（如果尚未包含 extensions）
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
    
    RAISE NOTICE '✅ vector 扩展已迁移到 extensions schema';
  ELSE
    RAISE WARNING '⚠️  vector 扩展在 % schema，当前脚本仅支持从 public 迁移', current_schema;
  END IF;
END $$;

COMMIT;

-- ============================================================
-- 验证修复
-- ============================================================
-- 执行以下查询验证修复结果：
-- 
-- 1. 验证 ai_scene_config 表的 RLS 是否已启用：
-- SELECT tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' 
-- AND tablename = 'ai_scene_config';
--
-- 2. 验证函数 search_path 是否已修复：
-- SELECT 
--   proname AS function_name,
--   prosecdef AS is_security_definer,
--   proconfig AS search_path_config
-- FROM pg_proc
-- WHERE proname IN (
--   'update_rag_operations_updated_at',
--   'update_rag_documents_updated_at',
--   'match_documents'
-- )
-- ORDER BY proname;
--
-- 期望结果: 所有函数的 proconfig 应该包含 'search_path=public'
--
-- 3. 验证 vector 扩展是否已迁移：
-- SELECT 
--   extname AS extension_name,
--   nspname AS schema_name
-- FROM pg_extension e
-- JOIN pg_namespace n ON e.extnamespace = n.oid
-- WHERE extname = 'vector';
--
-- 期望结果: schema_name 应该是 'extensions'

