-- ============================================================
-- AI 配置中心迁移脚本
-- 文件名: 20251108_create_ai_config.sql
-- 说明: 创建 ai_config 表用于存储 AI 运营参数
-- 日期: 2025-11-08
-- ============================================================

BEGIN;

-- ============================================================
-- 创建 ai_config 表
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_config (
  id SERIAL PRIMARY KEY,
  key VARCHAR(64) NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  updated_by INTEGER,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_ai_config_key ON ai_config(key);
CREATE INDEX IF NOT EXISTS idx_ai_config_updated_at ON ai_config(updated_at DESC);

-- 如果 admins 表存在，添加外键约束
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admins') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'ai_config_updated_by_fkey'
    ) THEN
      ALTER TABLE ai_config 
      ADD CONSTRAINT ai_config_updated_by_fkey 
      FOREIGN KEY (updated_by) REFERENCES admins(id);
    END IF;
  END IF;
END $$;

-- 插入默认配置值
INSERT INTO ai_config (key, value, description) VALUES
  ('dailyAskLimit', '10', '每用户每日提问限制'),
  ('answerCharLimit', '300', '回答字符限制'),
  ('model', 'gpt-4o-mini', 'AI 模型名称'),
  ('cacheTtl', '86400', '缓存 TTL（秒），默认 24 小时'),
  ('costAlertUsdThreshold', '10.00', '成本警告阈值（USD）')
ON CONFLICT (key) DO NOTHING;

COMMIT;

