-- ============================================================
-- 创建 rag_documents 表
-- 功能: 存储上传的 RAG 文档与元数据
-- 创建日期: 2025-11-07
-- ============================================================

CREATE TABLE IF NOT EXISTS rag_documents (
  id SERIAL PRIMARY KEY,
  doc_id VARCHAR(255) UNIQUE NOT NULL,
  title VARCHAR(500) NOT NULL,
  url VARCHAR(1000) NOT NULL,
  content TEXT NOT NULL,
  content_hash VARCHAR(64) NOT NULL,
  version VARCHAR(50) NOT NULL,
  lang VARCHAR(10) NOT NULL,
  source_id VARCHAR(100) NOT NULL,
  doc_type VARCHAR(50),
  vectorization_status VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- 唯一约束：防止重复文档
  CONSTRAINT unique_document UNIQUE (url, content_hash, version)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_rag_documents_doc_id ON rag_documents(doc_id);
CREATE INDEX IF NOT EXISTS idx_rag_documents_source_id ON rag_documents(source_id);
CREATE INDEX IF NOT EXISTS idx_rag_documents_content_hash ON rag_documents(content_hash);
CREATE INDEX IF NOT EXISTS idx_rag_documents_vectorization_status ON rag_documents(vectorization_status);
CREATE INDEX IF NOT EXISTS idx_rag_documents_created_at ON rag_documents(created_at);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_rag_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_rag_documents_updated_at
  BEFORE UPDATE ON rag_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_rag_documents_updated_at();

