-- ============================================================
-- 添加 Google Gemini 作为新的 AI 服务提供商
-- 文件名: 20250211_add_gemini_provider_config.sql
-- 说明: 更新 ai_config 表，添加 gemini 和 gemini_direct 作为新的 provider 选项
--       添加 timeout_gemini 超时配置（通过 Render）
-- 日期: 2025-02-11
-- 数据库: AI Service 数据库
-- ============================================================

BEGIN;

-- ============================================================
-- 更新 aiProvider 配置的描述，添加 gemini 和 gemini_direct 选项
-- ============================================================
UPDATE ai_config 
SET description = 'AI服务提供商：openai=OpenAI（通过Render），openai_direct=直连OpenAI（不通过Render），openrouter=OpenRouter（通过Render），openrouter_direct=直连OpenRouter（不通过Render），gemini=Google Gemini（通过Render），gemini_direct=直连Google Gemini（不通过Render），local=本地AI（Ollama），strategy=使用调用策略'
WHERE key = 'aiProvider';

-- 如果 aiProvider 配置不存在，插入默认配置（包含所有选项）
INSERT INTO ai_config (key, value, description) 
VALUES ('aiProvider', 'openai', 'AI服务提供商：openai=OpenAI（通过Render），openai_direct=直连OpenAI（不通过Render），openrouter=OpenRouter（通过Render），openrouter_direct=直连OpenRouter（不通过Render），gemini=Google Gemini（通过Render），gemini_direct=直连Google Gemini（不通过Render），local=本地AI（Ollama），strategy=使用调用策略')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 添加 timeout_gemini 超时配置（通过 Render）
-- ============================================================
INSERT INTO ai_config (key, value, description) VALUES
  ('timeout_gemini', '30000', 'Google Gemini (通过 Render) 超时时间（毫秒），默认 30 秒')
ON CONFLICT (key) DO NOTHING;

COMMIT;

