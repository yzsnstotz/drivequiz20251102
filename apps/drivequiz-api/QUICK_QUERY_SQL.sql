-- 快速查询 Datapull 上传的分片 SQL 脚本

-- 1. 查看所有操作记录（最近10条）
SELECT 
  operation_id,
  source_id,
  status,
  docs_count,
  failed_count,
  created_at,
  completed_at,
  metadata
FROM rag_operations
ORDER BY created_at DESC
LIMIT 10;

-- 2. 查看所有文档（最近20条）
SELECT 
  doc_id,
  title,
  url,
  version,
  lang,
  source_id,
  vectorization_status,
  LEFT(content, 100) as content_preview,
  content_hash,
  created_at
FROM rag_documents
ORDER BY created_at DESC
LIMIT 20;

-- 3. 查看特定操作的所有文档
-- 替换 'op_xxx' 为实际的操作ID
SELECT 
  d.doc_id,
  d.title,
  d.url,
  d.version,
  d.lang,
  d.source_id,
  d.vectorization_status,
  LEFT(d.content, 200) as content_preview,
  od.status as upload_status,
  od.error_code,
  od.error_message,
  od.created_at as uploaded_at
FROM rag_operation_documents od
LEFT JOIN rag_documents d ON od.doc_id = d.doc_id
WHERE od.operation_id = 'op_xxx'  -- 替换为实际的操作ID
ORDER BY od.created_at;

-- 4. 按来源ID查询文档
-- 替换 'your_source_id' 为实际的来源ID
SELECT 
  doc_id,
  title,
  url,
  version,
  lang,
  vectorization_status,
  LEFT(content, 200) as content_preview,
  created_at
FROM rag_documents
WHERE source_id = 'your_source_id'  -- 替换为实际的来源ID
ORDER BY created_at DESC;

-- 5. 统计信息
SELECT 
  source_id,
  COUNT(*) as total_docs,
  COUNT(CASE WHEN vectorization_status = 'completed' THEN 1 END) as vectorized,
  COUNT(CASE WHEN vectorization_status = 'pending' THEN 1 END) as pending,
  COUNT(CASE WHEN vectorization_status = 'processing' THEN 1 END) as processing,
  COUNT(CASE WHEN vectorization_status = 'failed' THEN 1 END) as failed
FROM rag_documents
GROUP BY source_id
ORDER BY total_docs DESC;

-- 6. 查看今天上传的文档
SELECT 
  doc_id,
  title,
  url,
  source_id,
  vectorization_status,
  created_at
FROM rag_documents
WHERE created_at >= CURRENT_DATE
ORDER BY created_at DESC;

-- 7. 查看失败的文档
SELECT 
  d.doc_id,
  d.title,
  d.url,
  od.error_code,
  od.error_message,
  od.created_at
FROM rag_operation_documents od
LEFT JOIN rag_documents d ON od.doc_id = d.doc_id
WHERE od.status = 'failed'
ORDER BY od.created_at DESC
LIMIT 20;

-- 8. 查看未向量化的文档
SELECT 
  doc_id,
  title,
  url,
  source_id,
  vectorization_status,
  created_at
FROM rag_documents
WHERE vectorization_status IN ('pending', 'processing')
ORDER BY created_at DESC
LIMIT 20;

