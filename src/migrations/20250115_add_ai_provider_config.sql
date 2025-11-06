-- ============================================================
-- AI 服务提供商配置迁移脚本
-- 文件名: 20250115_add_ai_provider_config.sql
-- 说明: 在 ai_config 表中添加 aiProvider 配置项
-- 日期: 2025-01-15
-- ============================================================

BEGIN;

-- 插入 aiProvider 配置项（如果不存在）
INSERT INTO ai_config (key, value, description) VALUES
  ('aiProvider', 'online', 'AI服务提供商：online=在线AI（OpenAI），local=本地AI（Ollama）')
ON CONFLICT (key) DO NOTHING;

COMMIT;

