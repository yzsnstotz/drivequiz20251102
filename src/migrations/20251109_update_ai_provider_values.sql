-- 2025-11-09: 规范化 aiProvider 字段取值
-- 将遗留的 online / openrouter-direct 等值迁移到新的命名体系

BEGIN;

UPDATE ai_config
SET value = 'openai'
WHERE key = 'aiProvider' AND value IN ('online', 'ONLINE');

UPDATE ai_config
SET value = 'openrouter_direct'
WHERE key = 'aiProvider' AND value IN ('openrouter-direct', 'OPENROUTER-DIRECT');

COMMIT;


