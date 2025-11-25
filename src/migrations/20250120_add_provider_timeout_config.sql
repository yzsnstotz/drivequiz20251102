-- ============================================================
-- AI Provider 超时配置迁移脚本
-- 文件名: 20250120_add_provider_timeout_config.sql
-- 说明: 为每个 AI Provider 添加可配置的超时设置
-- 日期: 2025-01-20
-- ============================================================

BEGIN;

-- ============================================================
-- 插入默认超时配置（单位：毫秒）
-- ============================================================
INSERT INTO ai_config (key, value, description) VALUES
  ('timeout_openai', '30000', 'OpenAI (通过 Render) 超时时间（毫秒），默认 30 秒'),
  ('timeout_openai_direct', '30000', 'OpenAI (直连) 超时时间（毫秒），默认 30 秒'),
  ('timeout_openrouter', '30000', 'OpenRouter (通过 Render) 超时时间（毫秒），默认 30 秒'),
  ('timeout_openrouter_direct', '30000', 'OpenRouter (直连) 超时时间（毫秒），默认 30 秒'),
  ('timeout_gemini_direct', '30000', 'Google Gemini (直连) 超时时间（毫秒），默认 30 秒'),
  ('timeout_local', '120000', '本地 AI (Ollama) 超时时间（毫秒），默认 120 秒（本地服务可能较慢）')
ON CONFLICT (key) DO NOTHING;

COMMIT;

