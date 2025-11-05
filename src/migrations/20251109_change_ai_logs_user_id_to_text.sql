-- ============================================================
-- 修改 ai_logs 表的 user_id 字段类型：从 UUID 改为 TEXT
-- 文件名: 20251109_change_ai_logs_user_id_to_text.sql
-- 说明: 支持多种格式的用户ID（UUID、act-{activationId}等）
-- 日期: 2025-11-09
-- ============================================================

BEGIN;

-- 1. 备份现有数据（如果需要）
-- 注意：如果现有数据都是有效的 UUID，可以直接转换

-- 2. 修改 user_id 字段类型：从 UUID 改为 TEXT
-- 这样可以支持：
-- - UUID 格式（原有格式）
-- - act-{activationId} 格式（激活系统）
-- - 其他格式的用户ID

ALTER TABLE ai_logs 
  ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- 3. 更新索引（如果需要）
-- 注意：TEXT 类型的索引仍然有效，不需要重建

-- 4. 验证更改
-- 可以运行以下查询验证：
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'ai_logs' AND column_name = 'user_id';

COMMIT;

