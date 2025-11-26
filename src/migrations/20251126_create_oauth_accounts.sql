-- ============================================================
-- OAuth账户表迁移脚本
-- 文件名: 20251126_create_oauth_accounts.sql
-- 说明: 创建OAuth账户关联表，用于存储第三方登录账户信息
-- 日期: 2025-11-26
-- 数据库: drivequiz
-- ============================================================

BEGIN;

-- ============================================================
-- 1️⃣ 创建OAuth账户表（oauth_accounts）
-- ============================================================
CREATE TABLE IF NOT EXISTS oauth_accounts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  provider VARCHAR(50) NOT NULL, -- 'wechat', 'line', 'google', 'facebook', 'twitter'
  provider_account_id VARCHAR(255) NOT NULL, -- 第三方平台的用户ID
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMP,
  token_type VARCHAR(50),
  scope TEXT,
  id_token TEXT,
  session_state TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 唯一约束：同一提供商的同一账户只能关联一个用户
  UNIQUE(provider, provider_account_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user_id ON oauth_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_accounts_provider_account ON oauth_accounts(provider, provider_account_id);
CREATE INDEX IF NOT EXISTS idx_oauth_accounts_provider ON oauth_accounts(provider);

-- 添加外键约束（关联到 users 表）
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'oauth_accounts_user_id_fkey'
    ) THEN
      ALTER TABLE oauth_accounts 
      ADD CONSTRAINT oauth_accounts_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- ============================================================
-- 2️⃣ 创建NextAuth会话表（sessions）
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(255) PRIMARY KEY,
  session_token VARCHAR(255) NOT NULL UNIQUE,
  user_id INTEGER NOT NULL,
  expires TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_session_token ON sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires);

-- 添加外键约束
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'sessions_user_id_fkey'
    ) THEN
      ALTER TABLE sessions 
      ADD CONSTRAINT sessions_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- ============================================================
-- 3️⃣ 创建NextAuth验证表（verification_tokens）
-- ============================================================
CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier VARCHAR(255) NOT NULL,
  token VARCHAR(255) NOT NULL,
  expires TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (identifier, token)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_verification_tokens_identifier ON verification_tokens(identifier);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_expires ON verification_tokens(expires);

COMMIT;

