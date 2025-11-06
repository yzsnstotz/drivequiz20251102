-- ==========================================================
-- 添加管理员权限字段
-- 文件名: 20251105_add_admin_permissions.sql
-- 说明: 为admins表添加permissions字段，用于权限类别管理
-- 日期: 2025-11-05
-- ==========================================================

BEGIN;

-- 添加permissions字段（JSONB数组，存储权限类别）
ALTER TABLE admins
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]'::jsonb;

-- 为现有管理员设置默认权限（空数组表示无权限）
UPDATE admins
SET permissions = '[]'::jsonb
WHERE permissions IS NULL;

-- 创建索引优化权限查询
CREATE INDEX IF NOT EXISTS idx_admins_permissions ON admins USING GIN (permissions);

COMMIT;

-- 回滚指令 (如需撤销)
-- ALTER TABLE admins DROP COLUMN IF EXISTS permissions;
-- DROP INDEX IF EXISTS idx_admins_permissions;

