-- ============================================================
-- 创建 rag_upload_history 表
-- 功能: 记录所有 Datapull 上传的历史记录（包括成功和失败的）
-- 创建日期: 2025-11-08
-- ============================================================

CREATE TABLE IF NOT EXISTS rag_upload_history (
  id SERIAL PRIMARY KEY,
  url VARCHAR(1000) NOT NULL,
  content_hash VARCHAR(64) NOT NULL,
  version VARCHAR(50) NOT NULL,
  title VARCHAR(500) NOT NULL,
  source_id VARCHAR(100) NOT NULL,
  lang VARCHAR(10) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, success, rejected, failed
  rejection_reason VARCHAR(255), -- 如果被拒绝，记录原因
  operation_id VARCHAR(255), -- 关联的操作ID
  doc_id VARCHAR(255), -- 如果成功，关联的文档ID
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- 唯一约束：防止重复上传（基于 url, content_hash, version）
  CONSTRAINT unique_upload_history UNIQUE (url, content_hash, version)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_rag_upload_history_url ON rag_upload_history(url);
CREATE INDEX IF NOT EXISTS idx_rag_upload_history_content_hash ON rag_upload_history(content_hash);
CREATE INDEX IF NOT EXISTS idx_rag_upload_history_version ON rag_upload_history(version);
CREATE INDEX IF NOT EXISTS idx_rag_upload_history_source_id ON rag_upload_history(source_id);
CREATE INDEX IF NOT EXISTS idx_rag_upload_history_status ON rag_upload_history(status);
CREATE INDEX IF NOT EXISTS idx_rag_upload_history_uploaded_at ON rag_upload_history(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_rag_upload_history_operation_id ON rag_upload_history(operation_id);

-- 创建复合索引用于快速查询重复记录
CREATE INDEX IF NOT EXISTS idx_rag_upload_history_unique_check ON rag_upload_history(url, content_hash, version);

