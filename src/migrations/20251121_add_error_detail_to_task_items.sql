-- ============================================================
-- 为 question_processing_task_items 表添加错误详情字段
-- 文件名: 20251121_add_error_detail_to_task_items.sql
-- 说明: 添加 error_detail JSONB 字段来存储结构化的错误诊断信息
-- 日期: 2025-11-21
-- 数据库: 主程序数据库（drivequiz）
-- ============================================================

BEGIN;

-- 添加错误详情字段
ALTER TABLE question_processing_task_items
ADD COLUMN IF NOT EXISTS error_detail JSONB;

-- 添加注释
COMMENT ON COLUMN question_processing_task_items.error_detail IS '错误详情（JSONB），包含结构化的诊断信息：questionId, sourceLanguage, targetLanguage, parsedSourceLanguage, translationsKeys, errorStage, errorCode, errorMessage, sampleText, parsed, sanitized, rawAiResponse 等';

COMMIT;

