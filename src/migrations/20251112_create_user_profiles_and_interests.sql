-- ============================================================
-- ZALEM 前台系统 - 用户画像与兴趣表迁移脚本
-- 文件名: 20251112_create_user_profiles_and_interests.sql
-- 说明: 创建用户画像表（user_profiles）和用户兴趣表（user_interests）
-- 日期: 2025-11-12
-- 数据库: drivequiz
-- ============================================================

BEGIN;

-- ============================================================
-- 1️⃣ 创建用户画像表（user_profiles）
-- ============================================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  
  -- 基本信息
  language VARCHAR(8) DEFAULT 'ja',
  goals TEXT[], -- 用户目标（数组）
  level VARCHAR(20) DEFAULT 'beginner' 
    CHECK (level IN ('beginner', 'intermediate', 'advanced', 'expert')),
  
  -- 扩展信息（JSONB格式，可存储各种动态信息）
  metadata JSONB DEFAULT '{}',
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 唯一约束：每个用户只能有一个profile
  CONSTRAINT user_profiles_user_id_unique UNIQUE (user_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_language ON user_profiles(language);
CREATE INDEX IF NOT EXISTS idx_user_profiles_level ON user_profiles(level);
CREATE INDEX IF NOT EXISTS idx_user_profiles_created_at ON user_profiles(created_at DESC);

-- 添加外键约束（关联到 users 表）
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_user_id_fkey'
    ) THEN
      ALTER TABLE user_profiles 
      ADD CONSTRAINT user_profiles_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- ============================================================
-- 2️⃣ 创建用户兴趣表（user_interests）
-- ============================================================
CREATE TABLE IF NOT EXISTS user_interests (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  
  -- 兴趣标签（数组格式）
  vehicle_brands TEXT[], -- 车辆品牌兴趣
  service_types TEXT[], -- 服务类型兴趣
  
  -- 扩展兴趣（JSONB格式，可存储其他兴趣标签）
  other_interests JSONB DEFAULT '{}',
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 唯一约束：每个用户只能有一个兴趣记录
  CONSTRAINT user_interests_user_id_unique UNIQUE (user_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_interests_user_id ON user_interests(user_id);
CREATE INDEX IF NOT EXISTS idx_user_interests_created_at ON user_interests(created_at DESC);

-- 添加外键约束（关联到 users 表）
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'user_interests_user_id_fkey'
    ) THEN
      ALTER TABLE user_interests 
      ADD CONSTRAINT user_interests_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- ============================================================
-- 3️⃣ 创建触发器函数：自动更新 updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_user_interests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS trigger_update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER trigger_update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_user_profiles_updated_at();

DROP TRIGGER IF EXISTS trigger_update_user_interests_updated_at ON user_interests;
CREATE TRIGGER trigger_update_user_interests_updated_at
  BEFORE UPDATE ON user_interests
  FOR EACH ROW
  EXECUTE FUNCTION update_user_interests_updated_at();

COMMIT;

-- ============================================================
-- 验证查询
-- ============================================================
-- 检查表是否创建成功：
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_name IN ('user_profiles', 'user_interests');
--
-- 检查索引是否创建成功：
-- SELECT indexname FROM pg_indexes 
-- WHERE tablename IN ('user_profiles', 'user_interests');

