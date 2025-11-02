-- ==========================================================
-- ZALEM 激活码有效期字段迁移脚本
-- 文件名: 20251102_add_validity_period_fields.sql
-- 说明: 为 activation_codes 表新增有效期相关字段
-- 日期: 2025-11-02
-- ==========================================================

BEGIN;

-- 1️⃣ 添加有效期周期字段（数字）
ALTER TABLE activation_codes
ADD COLUMN IF NOT EXISTS validity_period INTEGER NULL;

-- 2️⃣ 添加有效期单位字段（day/month/year）
ALTER TABLE activation_codes
ADD COLUMN IF NOT EXISTS validity_unit VARCHAR(10) NULL
CHECK (validity_unit IS NULL OR validity_unit IN ('day', 'month', 'year'));

-- 3️⃣ 添加激活开始时间字段（用户激活账户时记录）
ALTER TABLE activation_codes
ADD COLUMN IF NOT EXISTS activation_started_at TIMESTAMP NULL;

-- 4️⃣ 创建索引优化查询
CREATE INDEX IF NOT EXISTS idx_activation_codes_activation_started_at 
ON activation_codes(activation_started_at);

COMMIT;

-- 回滚指令 (如需撤销)
-- ALTER TABLE activation_codes DROP COLUMN validity_period;
-- ALTER TABLE activation_codes DROP COLUMN validity_unit;
-- ALTER TABLE activation_codes DROP COLUMN activation_started_at;
-- DROP INDEX IF EXISTS idx_activation_codes_activation_started_at;
