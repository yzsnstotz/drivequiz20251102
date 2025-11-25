-- ============================================================
-- AI Provider 频率限制配置迁移脚本
-- 文件名: 20250220_add_provider_rate_limit_config.sql
-- 说明: 为每个 AI Provider 添加可配置的频率限制设置
-- 日期: 2025-02-20
-- ============================================================

BEGIN;

-- ============================================================
-- 插入默认频率限制配置
-- rate_limit_max: 每个时间窗口内的最大请求数（默认：60）
-- rate_limit_time_window: 时间窗口（秒，默认：60）
-- ============================================================
INSERT INTO ai_config (key, value, description) VALUES
  ('rate_limit_openai_max', '60', 'OpenAI (通过 Render) 频率限制：每个时间窗口内的最大请求数，默认 60 次'),
  ('rate_limit_openai_time_window', '60', 'OpenAI (通过 Render) 频率限制：时间窗口（秒），默认 60 秒'),
  ('rate_limit_openai_direct_max', '60', 'OpenAI (直连) 频率限制：每个时间窗口内的最大请求数，默认 60 次'),
  ('rate_limit_openai_direct_time_window', '60', 'OpenAI (直连) 频率限制：时间窗口（秒），默认 60 秒'),
  ('rate_limit_openrouter_max', '60', 'OpenRouter (通过 Render) 频率限制：每个时间窗口内的最大请求数，默认 60 次'),
  ('rate_limit_openrouter_time_window', '60', 'OpenRouter (通过 Render) 频率限制：时间窗口（秒），默认 60 秒'),
  ('rate_limit_openrouter_direct_max', '60', 'OpenRouter (直连) 频率限制：每个时间窗口内的最大请求数，默认 60 次'),
  ('rate_limit_openrouter_direct_time_window', '60', 'OpenRouter (直连) 频率限制：时间窗口（秒），默认 60 秒'),
  ('rate_limit_gemini_max', '60', 'Google Gemini (通过 Render) 频率限制：每个时间窗口内的最大请求数，默认 60 次'),
  ('rate_limit_gemini_time_window', '60', 'Google Gemini (通过 Render) 频率限制：时间窗口（秒），默认 60 秒'),
  ('rate_limit_gemini_direct_max', '60', 'Google Gemini (直连) 频率限制：每个时间窗口内的最大请求数，默认 60 次'),
  ('rate_limit_gemini_direct_time_window', '60', 'Google Gemini (直连) 频率限制：时间窗口（秒），默认 60 秒'),
  ('rate_limit_local_max', '120', '本地 AI (Ollama) 频率限制：每个时间窗口内的最大请求数，默认 120 次（本地服务可承受更高频率）'),
  ('rate_limit_local_time_window', '60', '本地 AI (Ollama) 频率限制：时间窗口（秒），默认 60 秒')
ON CONFLICT (key) DO NOTHING;

COMMIT;

