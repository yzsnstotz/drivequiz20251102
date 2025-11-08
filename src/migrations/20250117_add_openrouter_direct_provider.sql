-- ============================================================
-- 添加直连 OpenRouter 作为新的 AI 服务提供商
-- 文件名: 20250117_add_openrouter_direct_provider.sql
-- 说明: 更新 ai_config 表，添加 openrouter-direct 作为新的 provider 选项
-- 日期: 2025-01-17
-- ============================================================

BEGIN;

-- 更新 aiProvider 配置的描述，添加 openrouter-direct 选项
UPDATE ai_config 
SET description = 'AI服务提供商：online=在线AI（OpenAI），local=本地AI（Ollama），openrouter=OpenRouter（通过Render），openrouter-direct=直连OpenRouter（不通过Render）'
WHERE key = 'aiProvider';

-- 如果 aiProvider 配置不存在，插入默认配置
INSERT INTO ai_config (key, value, description) 
VALUES ('aiProvider', 'online', 'AI服务提供商：online=在线AI（OpenAI），local=本地AI（Ollama），openrouter=OpenRouter（通过Render），openrouter-direct=直连OpenRouter（不通过Render）')
ON CONFLICT (key) DO NOTHING;

COMMIT;

