-- ============================================================
-- 修复函数 search_path 安全问题（AI 数据库专用）
-- 文件名: 20251111_fix_function_search_path.sql
-- 说明: 修复 match_documents 和 ai_filters_audit_trigger 函数的 search_path 安全问题
-- 重要: 此脚本必须在 AI 数据库中执行（包含 ai_vectors 表的数据库）
-- 数据库 ID: cgpmpfnjzlzbquakmmrj
-- 日期: 2025-11-11
-- ============================================================

BEGIN;

-- ============================================================
-- 1. 修复 match_documents 函数（仅当 ai_vectors 表存在时）
-- ============================================================
-- 问题: 函数具有可变的角色搜索路径，可能导致 SQL 注入攻击
-- 修复: 设置 SECURITY DEFINER 和固定的 search_path
DO $$
BEGIN
  -- 检查 ai_vectors 表是否存在
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'ai_vectors'
  ) THEN
    -- 创建或替换函数
    EXECUTE $func$
    CREATE OR REPLACE FUNCTION match_documents(
      query_embedding vector(1536),
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
    SET search_path = public
    AS $body$
      SELECT id, doc_id, content, source_title, source_url, version,
             1 - (embedding <=> query_embedding) AS similarity
      FROM ai_vectors
      WHERE 1 - (embedding <=> query_embedding) >= match_threshold
      ORDER BY similarity DESC
      LIMIT match_count;
    $body$;
    $func$;
    
    -- 添加函数注释
    EXECUTE 'COMMENT ON FUNCTION match_documents IS ''根据查询向量检索最相似的文档片段，返回相似度大于阈值的记录。已修复 search_path 安全问题。''';
    
    RAISE NOTICE '✅ match_documents 函数已修复';
  ELSE
    RAISE NOTICE '⚠️  ai_vectors 表不存在，跳过 match_documents 函数修复';
  END IF;
END $$;

-- ============================================================
-- 2. 修复 ai_filters_audit_trigger 函数（仅当 ai_filters_history 表存在时）
-- ============================================================
-- 问题: 函数具有可变的角色搜索路径，可能导致 SQL 注入攻击
-- 修复: 设置 SECURITY DEFINER 和固定的 search_path
DO $$
BEGIN
  -- 检查 ai_filters_history 表是否存在
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'ai_filters_history'
  ) THEN
    -- 创建或替换函数
    EXECUTE $func$
    CREATE OR REPLACE FUNCTION ai_filters_audit_trigger()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $body$
    BEGIN
      INSERT INTO ai_filters_history (
        filter_id,
        type,
        pattern,
        status,
        changed_by,
        changed_at,
        action
      ) VALUES (
        NEW.id,
        NEW.type,
        NEW.pattern,
        NEW.status,
        NEW.changed_by,
        NEW.changed_at,
        CASE 
          WHEN TG_OP = 'INSERT' THEN 'create'
          WHEN OLD.status != NEW.status THEN 'status_change'
          ELSE 'update'
        END
      );
      RETURN NEW;
    END;
    $body$;
    $func$;
    
    -- 添加函数注释
    EXECUTE 'COMMENT ON FUNCTION ai_filters_audit_trigger IS ''自动记录 ai_filters 表变更历史的触发器函数。已修复 search_path 安全问题。''';
    
    RAISE NOTICE '✅ ai_filters_audit_trigger 函数已修复';
  ELSE
    RAISE NOTICE '⚠️  ai_filters_history 表不存在，跳过 ai_filters_audit_trigger 函数修复';
  END IF;
END $$;

COMMIT;

-- ============================================================
-- 验证修复
-- ============================================================
-- 执行以下查询验证函数 search_path 是否已修复：
-- SELECT proname, prosecdef, proconfig
-- FROM pg_proc
-- WHERE proname IN ('match_documents', 'ai_filters_audit_trigger');

