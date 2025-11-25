-- ============================================================
-- AI Provider 每日统计表
-- 文件名: 20250120_create_ai_provider_daily_stats.sql
-- 说明: 记录每天按 provider、model、scene 的调用统计
-- 日期: 2025-01-20
-- ============================================================

BEGIN;

-- ============================================================
-- ai_provider_daily_stats - Provider 每日统计表
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_provider_daily_stats (
  stat_date DATE NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NULL,
  scene TEXT NULL,
  total_calls INTEGER NOT NULL DEFAULT 0,
  total_success INTEGER NOT NULL DEFAULT 0,
  total_error INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (stat_date, provider, model, scene)
);

-- 创建索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_ai_provider_daily_stats_stat_date ON ai_provider_daily_stats(stat_date DESC);
CREATE INDEX IF NOT EXISTS idx_ai_provider_daily_stats_provider ON ai_provider_daily_stats(provider);
CREATE INDEX IF NOT EXISTS idx_ai_provider_daily_stats_stat_date_provider ON ai_provider_daily_stats(stat_date DESC, provider);

COMMIT;

-- ============================================================
-- 回滚指令（如果需要回滚，执行以下 SQL）
-- ============================================================
-- BEGIN;
-- DROP TABLE IF EXISTS ai_provider_daily_stats;
-- COMMIT;

