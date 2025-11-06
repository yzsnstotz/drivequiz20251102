-- ==========================================================
-- ZALEM 后台管理系统数据库迁移脚本
-- 文件名: 20251101_add_activation_admin_fields.sql
-- 说明: 为 activation_codes 表新增后台管理所需字段
-- 日期: 2025-11-01
-- ==========================================================

BEGIN;

-- 1️⃣ 添加状态字段
ALTER TABLE activation_codes
ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'disabled'
CHECK (status IN ('disabled', 'enabled', 'suspended', 'expired'));

-- 2️⃣ 添加到期时间字段
ALTER TABLE activation_codes
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP NULL;

-- 3️⃣ 添加启用时间字段
ALTER TABLE activation_codes
ADD COLUMN IF NOT EXISTS enabled_at TIMESTAMP NULL;

-- 4️⃣ 添加备注字段
ALTER TABLE activation_codes
ADD COLUMN IF NOT EXISTS notes TEXT NULL;

-- 5️⃣ 确保使用次数字段存在
ALTER TABLE activation_codes
ADD COLUMN IF NOT EXISTS used_count INT NOT NULL DEFAULT 0;

-- 6️⃣ 确保使用上限字段存在
ALTER TABLE activation_codes
ADD COLUMN IF NOT EXISTS usage_limit INT NOT NULL DEFAULT 1;

-- 7️⃣ 创建索引优化查询
CREATE INDEX IF NOT EXISTS idx_activation_codes_status ON activation_codes(status);
CREATE INDEX IF NOT EXISTS idx_activation_codes_expires_at ON activation_codes(expires_at);

COMMIT;

-- 回滚指令 (如需撤销)
-- ALTER TABLE activation_codes DROP COLUMN status;
-- ALTER TABLE activation_codes DROP COLUMN expires_at;
-- ALTER TABLE activation_codes DROP COLUMN enabled_at;
-- ALTER TABLE activation_codes DROP COLUMN notes;
-- DROP INDEX IF EXISTS idx_activation_codes_status;
-- DROP INDEX IF EXISTS idx_activation_codes_expires_at;
