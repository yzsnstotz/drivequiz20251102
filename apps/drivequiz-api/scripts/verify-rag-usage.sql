-- ============================================================
-- RAG 使用情况验证脚本
-- 用途：快速验证 AI 是否调用了 RAG
-- ============================================================

-- 1. 查看最近的问答记录（检查 rag_hits）
SELECT 
  id,
  LEFT(question, 60) as question_preview,
  rag_hits,
  model,
  created_at
FROM ai_logs
ORDER BY created_at DESC
LIMIT 20;

-- 2. 统计 RAG 调用率（最近 24 小时）
SELECT 
  COUNT(*) as total_queries,
  COUNT(CASE WHEN rag_hits > 0 THEN 1 END) as rag_used_count,
  COUNT(CASE WHEN rag_hits = 0 THEN 1 END) as rag_not_used_count,
  ROUND(COUNT(CASE WHEN rag_hits > 0 THEN 1 END) * 100.0 / COUNT(*), 2) as rag_usage_rate_percent
FROM ai_logs
WHERE created_at >= NOW() - INTERVAL '24 hours';

-- 3. 按小时统计 RAG 使用情况（最近 24 小时）
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as total_queries,
  COUNT(CASE WHEN rag_hits > 0 THEN 1 END) as rag_used,
  ROUND(COUNT(CASE WHEN rag_hits > 0 THEN 1 END) * 100.0 / COUNT(*), 2) as rag_rate_percent
FROM ai_logs
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;

-- 4. RAG 命中数分布（最近 7 天）
SELECT 
  rag_hits,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM ai_logs
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY rag_hits
ORDER BY rag_hits;

-- 5. 每日 RAG 统计（最近 30 天）
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_queries,
  COUNT(CASE WHEN rag_hits > 0 THEN 1 END) as rag_used,
  ROUND(COUNT(CASE WHEN rag_hits > 0 THEN 1 END) * 100.0 / COUNT(*), 2) as rag_rate_percent,
  AVG(rag_hits) as avg_rag_hits
FROM ai_logs
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- 6. 查看没有使用 RAG 的查询（最近 24 小时）
SELECT 
  id,
  question,
  answer,
  model,
  created_at
FROM ai_logs
WHERE rag_hits = 0
  AND created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 20;

-- 7. 验证 RAG 数据源是否存在
SELECT 
  COUNT(*) as total_vectors,
  COUNT(DISTINCT doc_id) as unique_docs,
  COUNT(DISTINCT version) as versions,
  MAX(updated_at) as last_updated
FROM ai_vectors;

-- 8. 查看最近的向量数据示例
SELECT 
  doc_id,
  LEFT(content, 100) as content_preview,
  source_title,
  source_url,
  updated_at
FROM ai_vectors
ORDER BY updated_at DESC
LIMIT 10;

