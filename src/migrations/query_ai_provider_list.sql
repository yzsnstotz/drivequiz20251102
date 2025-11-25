-- ============================================================
-- 查询 ai_config 表中所有 aiProvider 相关配置
-- 文件名: query_ai_provider_list.sql
-- 说明: 列出当前数据库中所有支持的 aiProvider 选项及其当前值
-- 日期: 2025-02-11
-- ============================================================

-- 查询当前 aiProvider 配置值
SELECT 
  key,
  value AS current_value,
  description,
  updated_at,
  updated_by
FROM ai_config
WHERE key = 'aiProvider';

-- 查询所有支持的 aiProvider 选项（从描述中提取）
-- 注意：实际支持的选项如下：

/*
所有支持的 aiProvider 选项列表：

1. strategy
   - 描述: 使用调用策略
   - 说明: 策略模式，根据条件自动选择 provider

2. openai
   - 描述: OpenAI（通过 Render）
   - 说明: 通过 Render AI Service 调用 OpenAI API

3. openai_direct
   - 描述: 直连 OpenAI
   - 说明: 直接调用 OpenAI API，不通过 Render

4. gemini
   - 描述: Google Gemini（通过 Render）
   - 说明: 通过 Render AI Service 调用 Google Gemini API

5. gemini_direct
   - 描述: 直连 Google Gemini
   - 说明: 直接调用 Google Gemini API，不通过 Render

6. openrouter
   - 描述: OpenRouter（通过 Render）
   - 说明: 通过 Render AI Service 调用 OpenRouter API

7. openrouter_direct
   - 描述: 直连 OpenRouter
   - 说明: 直接调用 OpenRouter API，不通过 Render

8. local
   - 描述: 本地 AI（Ollama）
   - 说明: 使用本地部署的 Ollama 服务

-- 历史遗留值（可能已废弃）：
- online (旧值，已废弃，应使用 openai)
- openrouter-direct (旧值，已改为 openrouter_direct)
*/

-- 查询所有超时配置（与 provider 相关）
SELECT 
  key,
  value,
  description,
  updated_at
FROM ai_config
WHERE key LIKE 'timeout_%'
ORDER BY key;

