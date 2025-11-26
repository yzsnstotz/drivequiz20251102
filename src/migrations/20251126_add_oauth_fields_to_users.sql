-- ============================================================
-- 用户表OAuth字段迁移脚本
-- 文件名: 20251126_add_oauth_fields_to_users.sql
-- 说明: 在users表中添加OAuth相关字段
-- 日期: 2025-11-26
-- 数据库: drivequiz
-- ============================================================

BEGIN;

-- ============================================================
-- 1️⃣ 添加OAuth相关字段到users表
-- ============================================================

-- 添加电话号码验证时间字段（暂时不使用，为未来扩展预留）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'phone_verified_at'
  ) THEN
    ALTER TABLE users ADD COLUMN phone_verified_at TIMESTAMPTZ;
  END IF;
END $$;

-- 添加首次登录使用的OAuth提供商字段
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'oauth_provider'
  ) THEN
    ALTER TABLE users ADD COLUMN oauth_provider VARCHAR(50);
  END IF;
END $$;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_users_oauth_provider ON users(oauth_provider);
CREATE INDEX IF NOT EXISTS idx_users_phone_verified_at ON users(phone_verified_at);

COMMIT;

