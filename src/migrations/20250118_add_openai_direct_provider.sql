-- ============================================================
-- 添加直连 OpenAI 作为新的 AI 服务提供商
-- 文件名: 20250118_add_openai_direct_provider.sql
-- 说明: 更新 ai_config 表，添加 openai_direct 作为新的 provider 选项
-- 日期: 2025-01-18
-- ============================================================

BEGIN;

-- 更新 aiProvider 配置的描述，添加 openai_direct 选项
UPDATE ai_config 
SET description = 'AI服务提供商：openai=OpenAI（通过Render），openai_direct=直连OpenAI（不通过Render），openrouter=OpenRouter（通过Render），openrouter_direct=直连OpenRouter（不通过Render），local=本地AI（Ollama）'
WHERE key = 'aiProvider';

-- 规范化旧值：将 openai-direct 转换为 openai_direct
UPDATE ai_config
SET value = 'openai_direct'
WHERE key = 'aiProvider' AND value IN ('openai-direct', 'OPENAI-DIRECT');

COMMIT;

