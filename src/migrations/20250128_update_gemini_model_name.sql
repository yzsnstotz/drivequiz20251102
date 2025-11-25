-- ============================================================
-- 更新 Gemini 模型名称：将 gemini-pro 映射到 gemini-2.5-flash
-- 文件名: 20250128_update_gemini_model_name.sql
-- 说明: gemini-pro 模型已在 Gemini API v1beta 中停用，需要更新为 gemini-2.5-flash
-- 日期: 2025-01-28
-- 数据库: DriveQuiz 主库（ai_config 表）
-- ============================================================

BEGIN;

-- ============================================================
-- 更新 ai_config 表中的 model 配置
-- 将 gemini-pro 更新为 gemini-2.5-flash
-- ============================================================
UPDATE ai_config
SET 
  value = 'gemini-2.5-flash',
  updated_at = NOW()
WHERE key = 'model' 
  AND value = 'gemini-pro';

-- ============================================================
-- 同时更新其他已停用的 Gemini 模型名称
-- ============================================================
UPDATE ai_config
SET 
  value = 'gemini-2.5-flash',
  updated_at = NOW()
WHERE key = 'model' 
  AND value IN ('gemini-pro-1.5', 'gemini-1.5-flash');

UPDATE ai_config
SET 
  value = 'gemini-2.5-pro',
  updated_at = NOW()
WHERE key = 'model' 
  AND value = 'gemini-1.5-pro';

COMMIT;

