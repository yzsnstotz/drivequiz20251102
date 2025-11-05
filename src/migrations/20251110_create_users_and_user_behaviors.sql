-- ============================================================
-- 用户表与用户行为表迁移脚本
-- 文件名: 20251110_create_users_and_user_behaviors.sql
-- 说明: 创建用户表（静态信息）和用户行为表（动态信息）
-- 日期: 2025-11-10
-- 数据库: drivequiz
-- ============================================================

BEGIN;

-- ============================================================
-- 1️⃣ 创建用户表（users）- 存储用户静态信息
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  userid VARCHAR(255) UNIQUE, -- 用户唯一标识符（区别于id，用于AI日志关联）
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(100),
  phone VARCHAR(20),
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'suspended', 'pending')),
  
  -- 关联激活码信息
  activation_code_id INTEGER,
  
  -- 注册相关信息（JSONB格式，可扩展）
  registration_info JSONB DEFAULT '{}',
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  
  -- 备注信息
  notes TEXT
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_users_userid ON users(userid);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_activation_code_id ON users(activation_code_id);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_last_login_at ON users(last_login_at DESC);

-- 添加外键约束（如果 activation_codes 表存在）
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'activation_codes') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'users_activation_code_id_fkey'
    ) THEN
      ALTER TABLE users 
      ADD CONSTRAINT users_activation_code_id_fkey 
      FOREIGN KEY (activation_code_id) REFERENCES activation_codes(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- ============================================================
-- 2️⃣ 创建用户行为表（user_behaviors）- 存储用户动态信息
-- ============================================================
CREATE TABLE IF NOT EXISTS user_behaviors (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  
  -- 行为类型
  behavior_type VARCHAR(50) NOT NULL
    CHECK (behavior_type IN ('login', 'logout', 'start_quiz', 'complete_quiz', 'pause_quiz', 'resume_quiz', 'view_page', 'ai_chat', 'other')),
  
  -- 网络信息
  ip_address VARCHAR(45),
  user_agent TEXT,
  
  -- 客户端信息
  client_type VARCHAR(20)
    CHECK (client_type IS NULL OR client_type IN ('web', 'mobile', 'api', 'desktop', 'other')),
  client_version VARCHAR(50),
  
  -- 设备信息（可扩展）
  device_info JSONB DEFAULT '{}',
  
  -- 行为相关的元数据（JSONB格式，可存储各种动态信息）
  metadata JSONB DEFAULT '{}',
  
  -- 行为发生时间
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 备注
  notes TEXT
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_behaviors_user_id ON user_behaviors(user_id);
CREATE INDEX IF NOT EXISTS idx_user_behaviors_behavior_type ON user_behaviors(behavior_type);
CREATE INDEX IF NOT EXISTS idx_user_behaviors_created_at ON user_behaviors(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_behaviors_ip_address ON user_behaviors(ip_address);
CREATE INDEX IF NOT EXISTS idx_user_behaviors_client_type ON user_behaviors(client_type);

-- 复合索引：用户ID + 行为类型 + 时间（用于快速查询用户特定行为）
CREATE INDEX IF NOT EXISTS idx_user_behaviors_user_behavior_time 
  ON user_behaviors(user_id, behavior_type, created_at DESC);

-- 复合索引：用户ID + 时间（用于查询用户所有行为的时间线）
CREATE INDEX IF NOT EXISTS idx_user_behaviors_user_time 
  ON user_behaviors(user_id, created_at DESC);

-- 添加外键约束（关联到 users 表）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_behaviors_user_id_fkey'
  ) THEN
    ALTER TABLE user_behaviors 
    ADD CONSTRAINT user_behaviors_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================
-- 3️⃣ 创建触发器函数：自动更新 users 表的 last_login_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_user_last_login()
RETURNS TRIGGER AS $$
BEGIN
  -- 当记录登录行为时，更新 users 表的 last_login_at
  IF NEW.behavior_type = 'login' THEN
    UPDATE users 
    SET last_login_at = NEW.created_at 
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS trigger_update_user_last_login ON user_behaviors;
CREATE TRIGGER trigger_update_user_last_login
  AFTER INSERT ON user_behaviors
  FOR EACH ROW
  WHEN (NEW.behavior_type = 'login')
  EXECUTE FUNCTION update_user_last_login();

-- ============================================================
-- 4️⃣ 创建触发器函数：自动更新 users 表的 updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS trigger_update_users_updated_at ON users;
CREATE TRIGGER trigger_update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_users_updated_at();

COMMIT;

-- ============================================================
-- 验证查询
-- ============================================================
-- 检查表是否创建成功：
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_name IN ('users', 'user_behaviors');
--
-- 检查索引是否创建成功：
-- SELECT indexname FROM pg_indexes 
-- WHERE tablename IN ('users', 'user_behaviors');
--
-- 检查约束是否创建成功：
-- SELECT constraint_name, constraint_type 
-- FROM information_schema.table_constraints 
-- WHERE table_name IN ('users', 'user_behaviors');

