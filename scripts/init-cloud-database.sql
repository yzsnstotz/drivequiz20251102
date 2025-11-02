-- ==========================================================
-- ZALEM 数据库初始化脚本（云端数据库）
-- 说明: 完整初始化所有表结构
-- 日期: 2025-11-03
-- ==========================================================

BEGIN;

-- ==========================================================
-- 1️⃣ 创建激活记录表
-- ==========================================================
CREATE TABLE IF NOT EXISTS activations (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    activation_code VARCHAR(255) NOT NULL UNIQUE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    activated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_activations_email ON activations(email);
CREATE INDEX IF NOT EXISTS idx_activations_activation_code ON activations(activation_code);

-- ==========================================================
-- 2️⃣ 创建激活码表（基础结构）
-- ==========================================================
CREATE TABLE IF NOT EXISTS activation_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    is_used BOOLEAN DEFAULT FALSE,
    usage_limit INTEGER DEFAULT 1,
    used_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_activation_codes_code ON activation_codes(code);

-- ==========================================================
-- 3️⃣ 添加 activation_codes 后台管理字段
-- ==========================================================
ALTER TABLE activation_codes
ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'disabled'
CHECK (status IN ('disabled', 'enabled', 'suspended', 'expired'));

ALTER TABLE activation_codes
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP NULL;

ALTER TABLE activation_codes
ADD COLUMN IF NOT EXISTS enabled_at TIMESTAMP NULL;

ALTER TABLE activation_codes
ADD COLUMN IF NOT EXISTS notes TEXT NULL;

-- 确保使用次数字段存在
ALTER TABLE activation_codes
ADD COLUMN IF NOT EXISTS used_count INT NOT NULL DEFAULT 0;

-- 确保使用上限字段存在
ALTER TABLE activation_codes
ADD COLUMN IF NOT EXISTS usage_limit INT NOT NULL DEFAULT 1;

-- 创建索引优化查询
CREATE INDEX IF NOT EXISTS idx_activation_codes_status ON activation_codes(status);
CREATE INDEX IF NOT EXISTS idx_activation_codes_expires_at ON activation_codes(expires_at);

-- ==========================================================
-- 4️⃣ 添加 activation_codes 有效期字段
-- ==========================================================
ALTER TABLE activation_codes
ADD COLUMN IF NOT EXISTS validity_period INTEGER NULL;

ALTER TABLE activation_codes
ADD COLUMN IF NOT EXISTS validity_unit VARCHAR(10) NULL
CHECK (validity_unit IS NULL OR validity_unit IN ('day', 'month', 'year'));

ALTER TABLE activation_codes
ADD COLUMN IF NOT EXISTS activation_started_at TIMESTAMP NULL;

-- 创建索引优化查询
CREATE INDEX IF NOT EXISTS idx_activation_codes_activation_started_at 
ON activation_codes(activation_started_at);

-- ==========================================================
-- 5️⃣ 创建管理员表
-- ==========================================================
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

-- ==========================================================
-- 6️⃣ 创建操作日志表
-- ==========================================================
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

COMMIT;

-- ==========================================================
-- 初始化完成
-- ==========================================================

