-- ============================================================
-- 创建 rag_operations 表
-- 功能: 记录批量上传任务（operationId、状态、统计信息）
-- 创建日期: 2025-11-07
-- ============================================================

CREATE TABLE IF NOT EXISTS rag_operations (
  id SERIAL PRIMARY KEY,
  operation_id VARCHAR(255) UNIQUE NOT NULL,
  source_id VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  docs_count INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_rag_operations_operation_id ON rag_operations(operation_id);
CREATE INDEX IF NOT EXISTS idx_rag_operations_source_id ON rag_operations(source_id);
CREATE INDEX IF NOT EXISTS idx_rag_operations_status ON rag_operations(status);
CREATE INDEX IF NOT EXISTS idx_rag_operations_created_at ON rag_operations(created_at);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_rag_operations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_rag_operations_updated_at
  BEFORE UPDATE ON rag_operations
  FOR EACH ROW
  EXECUTE FUNCTION update_rag_operations_updated_at();

