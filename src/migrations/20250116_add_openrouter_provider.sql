-- ============================================================
-- 添加 OpenRouter 作为新的 AI 服务提供商
-- 文件名: 20250116_add_openrouter_provider.sql
-- 说明: 更新 ai_config 表，添加 openrouter 作为新的 provider 选项
-- 日期: 2025-01-16
-- ============================================================

BEGIN;

-- 更新 aiProvider 配置的描述，添加 openrouter 选项
UPDATE ai_config 
SET description = 'AI服务提供商：online=在线AI（OpenAI），local=本地AI（Ollama），openrouter=OpenRouter（支持多种AI提供商）'
WHERE key = 'aiProvider';

-- 如果 aiProvider 配置不存在，插入默认配置
INSERT INTO ai_config (key, value, description) 
VALUES ('aiProvider', 'online', 'AI服务提供商：online=在线AI（OpenAI），local=本地AI（Ollama），openrouter=OpenRouter（支持多种AI提供商）')
ON CONFLICT (key) DO NOTHING;

COMMIT;

