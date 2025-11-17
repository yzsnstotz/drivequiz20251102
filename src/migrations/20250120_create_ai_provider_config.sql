-- ============================================================
-- AI Provider 配置表
-- 文件名: 20250120_create_ai_provider_config.sql
-- 说明: 记录每个 Provider 的调用上限、优先级等配置
-- 日期: 2025-01-20
-- ============================================================

BEGIN;

-- ============================================================
-- ai_provider_config - Provider 配置表
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_provider_config (
  id SERIAL PRIMARY KEY,
  provider TEXT NOT NULL, -- 'openai' | 'gemini' | 'ollama' | 'openrouter' | 'openrouter_direct' | 'openai_direct' | 'gemini_direct' | 'local'
  model TEXT NULL, -- 可选：限制到具体模型；为空则表示该 provider 默认配置
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  -- 每日调用上限（硬限制）；为 NULL 或 0 表示不限制
  daily_limit INTEGER NULL,
  -- 优先级：数值越小优先级越高
  priority INTEGER NOT NULL DEFAULT 100,
  -- 指示是否为"本地兜底"Provider（如 ollama 本地）
  is_local_fallback BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, model)
);

-- 创建索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_ai_provider_config_provider ON ai_provider_config(provider);
CREATE INDEX IF NOT EXISTS idx_ai_provider_config_is_enabled ON ai_provider_config(is_enabled);
CREATE INDEX IF NOT EXISTS idx_ai_provider_config_priority ON ai_provider_config(priority);
CREATE INDEX IF NOT EXISTS idx_ai_provider_config_is_local_fallback ON ai_provider_config(is_local_fallback);

-- 添加约束：确保只有一个 is_local_fallback = true 的记录
-- 注意：这个约束在 PostgreSQL 中需要使用唯一的部分索引实现
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_provider_config_single_local_fallback 
ON ai_provider_config(is_local_fallback) 
WHERE is_local_fallback = true;

-- ============================================================
-- 初始化默认配置（可选）
-- ============================================================
-- 插入默认的本地兜底 Provider（如果不存在）
INSERT INTO ai_provider_config (provider, model, is_enabled, daily_limit, priority, is_local_fallback)
VALUES ('local', NULL, true, NULL, 100, true)
ON CONFLICT (provider, model) DO NOTHING;

COMMIT;

-- ============================================================
-- 回滚指令（如果需要回滚，执行以下 SQL）
-- ============================================================
-- BEGIN;
-- DROP INDEX IF EXISTS idx_ai_provider_config_single_local_fallback;
-- DROP INDEX IF EXISTS idx_ai_provider_config_is_local_fallback;
-- DROP INDEX IF EXISTS idx_ai_provider_config_priority;
-- DROP INDEX IF EXISTS idx_ai_provider_config_is_enabled;
-- DROP INDEX IF EXISTS idx_ai_provider_config_provider;
-- DROP TABLE IF EXISTS ai_provider_config;
-- COMMIT;

