-- ============================================================
-- ZALEM AI 问答模块 RLS 策略迁移脚本
-- 文件名: 20251103_ai_rls.sql
-- 说明: 启用行级安全策略，仅 service role 可写，管理员可读
-- 日期: 2025-11-03
-- ============================================================

-- ============================================================
-- ai_logs - 问答日志表
-- ============================================================
ALTER TABLE ai_logs ENABLE ROW LEVEL SECURITY;

-- Service role 可写（AI-Service 使用 SUPABASE_SERVICE_KEY）
CREATE POLICY IF NOT EXISTS ai_logs_service_write ON ai_logs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 管理员可读（通过 JWT 验证角色为 admin）
CREATE POLICY IF NOT EXISTS ai_logs_admin_read ON ai_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid()
      AND admins.role = 'admin'
    )
  );

-- 匿名用户拒绝
CREATE POLICY IF NOT EXISTS ai_logs_anon_deny ON ai_logs
  FOR ALL
  USING (false);

-- ============================================================
-- ai_filters - 禁答关键词规则表
-- ============================================================
ALTER TABLE ai_filters ENABLE ROW LEVEL SECURITY;

-- Service role 可写
CREATE POLICY IF NOT EXISTS ai_filters_service_write ON ai_filters
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 管理员可读
CREATE POLICY IF NOT EXISTS ai_filters_admin_read ON ai_filters
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid()
      AND admins.role = 'admin'
    )
  );

-- ============================================================
-- ai_rag_docs - RAG 文档元数据表
-- ============================================================
ALTER TABLE ai_rag_docs ENABLE ROW LEVEL SECURITY;

-- Service role 可写
CREATE POLICY IF NOT EXISTS ai_rag_docs_service_write ON ai_rag_docs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 管理员可读
CREATE POLICY IF NOT EXISTS ai_rag_docs_admin_read ON ai_rag_docs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid()
      AND admins.role = 'admin'
    )
  );

-- ============================================================
-- ai_vectors - 向量存储表
-- ============================================================
ALTER TABLE ai_vectors ENABLE ROW LEVEL SECURITY;

-- Service role 可写
CREATE POLICY IF NOT EXISTS ai_vectors_service_write ON ai_vectors
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 管理员可读
CREATE POLICY IF NOT EXISTS ai_vectors_admin_read ON ai_vectors
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid()
      AND admins.role = 'admin'
    )
  );

-- ============================================================
-- ai_daily_summary - 每日汇总统计表
-- ============================================================
ALTER TABLE ai_daily_summary ENABLE ROW LEVEL SECURITY;

-- Service role 可写
CREATE POLICY IF NOT EXISTS ai_daily_summary_service_write ON ai_daily_summary
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 管理员可读
CREATE POLICY IF NOT EXISTS ai_daily_summary_admin_read ON ai_daily_summary
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid()
      AND admins.role = 'admin'
    )
  );

