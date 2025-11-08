-- ============================================================
-- 添加种子URL过滤功能到 match_documents 函数
-- 文件名: 20251108_add_seed_url_filter.sql
-- 说明: 为 match_documents 函数添加可选的种子URL过滤参数
-- 日期: 2025-11-08
-- ============================================================
-- 问题: 当前 match_documents 函数只根据向量相似度检索，没有基于URL的过滤
-- 修复: 添加可选的 seed_url 参数，支持基于种子URL过滤子页面
-- ============================================================

BEGIN;

-- ============================================================
-- 更新 match_documents 函数，添加种子URL过滤
-- ============================================================
-- 功能: 根据查询向量和相似度阈值，返回最相似的文档片段
-- 新增: 支持可选的 seed_url 参数，只返回该种子URL下的子页面
-- 参数:
--   - query_embedding: vector(1536) - 查询向量
--   - match_threshold: float - 相似度阈值 (0.0-1.0)
--   - match_count: int - 返回结果数量上限
--   - seed_url: text (可选) - 种子URL，只返回该URL下的子页面
-- 返回: 表结构包含 id, doc_id, content, source_title, source_url, version, similarity
DO $$
BEGIN
  -- 检查 ai_vectors 表是否存在
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'ai_vectors'
  ) THEN
    -- 创建或替换函数（支持种子URL过滤）
    EXECUTE $func$
    CREATE OR REPLACE FUNCTION match_documents(
      query_embedding vector(1536),
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
    SET search_path = public
    AS $body$
      SELECT id, doc_id, content, source_title, source_url, version,
             1 - (embedding <=> query_embedding) AS similarity
      FROM ai_vectors
      WHERE 
        -- 相似度过滤
        1 - (embedding <=> query_embedding) >= match_threshold
        -- 种子URL过滤：如果提供了 seed_url，只返回该URL下的子页面
        -- 子页面判断：source_url 以 seed_url 开头（支持路径匹配）
        AND (
          seed_url IS NULL 
          OR source_url IS NULL
          OR source_url LIKE seed_url || '%'
          OR source_url = seed_url
        )
      ORDER BY similarity DESC
      LIMIT match_count;
    $body$;
    $func$;
    
    -- 添加函数注释
    EXECUTE 'COMMENT ON FUNCTION match_documents IS ''根据查询向量检索最相似的文档片段，返回相似度大于阈值的记录。支持可选的种子URL过滤，只返回该URL下的子页面。''';
    
    RAISE NOTICE '✅ match_documents 函数已更新，支持种子URL过滤';
  ELSE
    RAISE NOTICE '⚠️  ai_vectors 表不存在，跳过 match_documents 函数更新';
  END IF;
END $$;

COMMIT;

-- ============================================================
-- 使用示例
-- ============================================================
-- 1. 不使用种子URL过滤（原有行为）：
--    SELECT * FROM match_documents(query_embedding, 0.75, 3, NULL);
--
-- 2. 使用种子URL过滤，只返回该URL下的子页面：
--    SELECT * FROM match_documents(query_embedding, 0.75, 3, 'https://example.com/docs/');
--
-- 3. 匹配规则：
--    - seed_url = 'https://example.com/docs/'
--    - 会匹配: 'https://example.com/docs/page1'
--    - 会匹配: 'https://example.com/docs/page2'
--    - 不会匹配: 'https://example.com/other/page'
--    - 不会匹配: 'https://other.com/docs/page'
-- ============================================================

