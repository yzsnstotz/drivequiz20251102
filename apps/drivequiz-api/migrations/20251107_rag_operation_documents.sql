-- ============================================================
-- 创建 rag_operation_documents 表
-- 功能: 映射 operation ↔ documents，保存每个文档上传结果及错误
-- 创建日期: 2025-11-07
-- ============================================================

CREATE TABLE IF NOT EXISTS rag_operation_documents (
  id SERIAL PRIMARY KEY,
  operation_id VARCHAR(255) NOT NULL,
  doc_id VARCHAR(255),
  status VARCHAR(50) NOT NULL,
  error_code VARCHAR(100),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- 外键约束（可选，如果 doc_id 存在则必须对应有效的文档）
  CONSTRAINT fk_rag_operation_documents_operation
    FOREIGN KEY (operation_id)
    REFERENCES rag_operations(operation_id)
    ON DELETE CASCADE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_rag_operation_documents_operation_id ON rag_operation_documents(operation_id);
CREATE INDEX IF NOT EXISTS idx_rag_operation_documents_doc_id ON rag_operation_documents(doc_id);
CREATE INDEX IF NOT EXISTS idx_rag_operation_documents_status ON rag_operation_documents(status);

