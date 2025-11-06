-- ==========================================================
-- ZALEM 后台管理系统数据库迁移脚本
-- 文件名: 20251103_add_admins_and_operation_logs.sql
-- 说明: 添加管理员表和操作日志表
-- 日期: 2025-11-03
-- ==========================================================

BEGIN;

-- 1️⃣ 创建管理员表
CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  token VARCHAR(255) NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_admins_token ON admins(token);
CREATE INDEX IF NOT EXISTS idx_admins_username ON admins(username);
CREATE INDEX IF NOT EXISTS idx_admins_is_active ON admins(is_active);

-- 2️⃣ 创建操作日志表
CREATE TABLE IF NOT EXISTS operation_logs (
  id SERIAL PRIMARY KEY,
  admin_id INT NOT NULL,
  admin_username VARCHAR(50) NOT NULL,
  action VARCHAR(20) NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  table_name VARCHAR(50) NOT NULL,
  record_id INT NULL,
  old_value JSONB NULL,
  new_value JSONB NULL,
  description TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_operation_logs_admin_id ON operation_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_operation_logs_admin_username ON operation_logs(admin_username);
CREATE INDEX IF NOT EXISTS idx_operation_logs_table_name ON operation_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_operation_logs_created_at ON operation_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operation_logs_action ON operation_logs(action);

-- 添加外键约束（可选，如果删除管理员则保留日志）
-- ALTER TABLE operation_logs ADD CONSTRAINT fk_operation_logs_admin_id 
--   FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL;

COMMIT;

-- 回滚指令 (如需撤销)
-- DROP TABLE IF EXISTS operation_logs;
-- DROP TABLE IF EXISTS admins;

