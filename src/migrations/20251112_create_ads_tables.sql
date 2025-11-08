-- ============================================================
-- ZALEM 前台系统 - 广告系统表迁移脚本
-- 文件名: 20251112_create_ads_tables.sql
-- 说明: 创建广告位表（ad_slots）、广告内容表（ad_contents）、广告日志表（ad_logs）
-- 日期: 2025-11-12
-- 数据库: drivequiz
-- ============================================================

BEGIN;

-- ============================================================
-- 1️⃣ 创建广告位表（ad_slots）
-- ============================================================
CREATE TABLE IF NOT EXISTS ad_slots (
  id SERIAL PRIMARY KEY,
  
  -- 广告位基本信息
  position VARCHAR(50) NOT NULL UNIQUE, -- 广告位位置标识：license_top, vehicle_list, service_detail, etc.
  name VARCHAR(100) NOT NULL,
  name_ja VARCHAR(100),
  name_zh VARCHAR(100),
  name_en VARCHAR(100),
  description TEXT,
  
  -- 广告位规格
  width INTEGER,
  height INTEGER,
  format VARCHAR(20) DEFAULT 'banner', -- banner, square, rectangle, etc.
  
  -- 状态
  status VARCHAR(20) DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'archived')),
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_slots_position ON ad_slots(position);
CREATE INDEX IF NOT EXISTS idx_ad_slots_status ON ad_slots(status);
CREATE INDEX IF NOT EXISTS idx_ad_slots_created_at ON ad_slots(created_at DESC);

-- ============================================================
-- 2️⃣ 创建广告内容表（ad_contents）
-- ============================================================
CREATE TABLE IF NOT EXISTS ad_contents (
  id SERIAL PRIMARY KEY,
  slot_id INTEGER NOT NULL,
  
  -- 广告内容基本信息
  title VARCHAR(200) NOT NULL,
  title_ja VARCHAR(200),
  title_zh VARCHAR(200),
  title_en VARCHAR(200),
  description TEXT,
  description_ja TEXT,
  description_zh TEXT,
  description_en TEXT,
  
  -- 广告素材
  image_url TEXT,
  video_url TEXT,
  link_url TEXT,
  
  -- 广告设置
  start_date DATE,
  end_date DATE,
  priority INTEGER DEFAULT 0, -- 优先级（数字越大优先级越高）
  weight INTEGER DEFAULT 1, -- 权重（用于随机展示）
  
  -- 统计信息
  impression_count BIGINT DEFAULT 0, -- 展示次数
  click_count BIGINT DEFAULT 0, -- 点击次数
  
  -- 扩展信息（JSONB格式）
  metadata JSONB DEFAULT '{}',
  
  -- 状态
  status VARCHAR(20) DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_contents_slot_id ON ad_contents(slot_id);
CREATE INDEX IF NOT EXISTS idx_ad_contents_status ON ad_contents(status);
CREATE INDEX IF NOT EXISTS idx_ad_contents_priority ON ad_contents(priority DESC);
CREATE INDEX IF NOT EXISTS idx_ad_contents_dates ON ad_contents(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_ad_contents_created_at ON ad_contents(created_at DESC);

-- 添加外键约束
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ad_slots') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'ad_contents_slot_id_fkey'
    ) THEN
      ALTER TABLE ad_contents 
      ADD CONSTRAINT ad_contents_slot_id_fkey 
      FOREIGN KEY (slot_id) REFERENCES ad_slots(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- ============================================================
-- 3️⃣ 创建广告日志表（ad_logs）
-- ============================================================
CREATE TABLE IF NOT EXISTS ad_logs (
  id BIGSERIAL PRIMARY KEY,
  ad_content_id INTEGER NOT NULL,
  user_id INTEGER,
  
  -- 日志类型
  log_type VARCHAR(20) NOT NULL
    CHECK (log_type IN ('impression', 'click', 'conversion')),
  
  -- 网络信息
  ip_address VARCHAR(45),
  user_agent TEXT,
  
  -- 客户端信息
  client_type VARCHAR(20)
    CHECK (client_type IS NULL OR client_type IN ('web', 'mobile', 'api', 'desktop', 'other')),
  
  -- 扩展信息（JSONB格式）
  metadata JSONB DEFAULT '{}',
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_logs_ad_content_id ON ad_logs(ad_content_id);
CREATE INDEX IF NOT EXISTS idx_ad_logs_user_id ON ad_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ad_logs_log_type ON ad_logs(log_type);
CREATE INDEX IF NOT EXISTS idx_ad_logs_created_at ON ad_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_logs_ip_address ON ad_logs(ip_address);

-- 复合索引：广告内容ID + 日志类型 + 时间（用于统计）
CREATE INDEX IF NOT EXISTS idx_ad_logs_content_type_time 
ON ad_logs(ad_content_id, log_type, created_at DESC);

-- 添加外键约束
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ad_contents') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'ad_logs_ad_content_id_fkey'
    ) THEN
      ALTER TABLE ad_logs 
      ADD CONSTRAINT ad_logs_ad_content_id_fkey 
      FOREIGN KEY (ad_content_id) REFERENCES ad_contents(id) ON DELETE CASCADE;
    END IF;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'ad_logs_user_id_fkey'
    ) THEN
      ALTER TABLE ad_logs 
      ADD CONSTRAINT ad_logs_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- ============================================================
-- 4️⃣ 创建触发器函数：自动更新 updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_ad_slots_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_ad_contents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS trigger_update_ad_slots_updated_at ON ad_slots;
CREATE TRIGGER trigger_update_ad_slots_updated_at
  BEFORE UPDATE ON ad_slots
  FOR EACH ROW
  EXECUTE FUNCTION update_ad_slots_updated_at();

DROP TRIGGER IF EXISTS trigger_update_ad_contents_updated_at ON ad_contents;
CREATE TRIGGER trigger_update_ad_contents_updated_at
  BEFORE UPDATE ON ad_contents
  FOR EACH ROW
  EXECUTE FUNCTION update_ad_contents_updated_at();

-- ============================================================
-- 5️⃣ 创建触发器函数：自动更新广告统计
-- ============================================================
CREATE OR REPLACE FUNCTION update_ad_content_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- 更新广告内容的统计信息
  IF NEW.log_type = 'impression' THEN
    UPDATE ad_contents
    SET impression_count = impression_count + 1
    WHERE id = NEW.ad_content_id;
  ELSIF NEW.log_type = 'click' THEN
    UPDATE ad_contents
    SET click_count = click_count + 1
    WHERE id = NEW.ad_content_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS trigger_update_ad_content_stats ON ad_logs;
CREATE TRIGGER trigger_update_ad_content_stats
  AFTER INSERT ON ad_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_ad_content_stats();

COMMIT;

-- ============================================================
-- 验证查询
-- ============================================================
-- 检查表是否创建成功：
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_name IN ('ad_slots', 'ad_contents', 'ad_logs');
--
-- 检查索引是否创建成功：
-- SELECT indexname FROM pg_indexes 
-- WHERE tablename IN ('ad_slots', 'ad_contents', 'ad_logs');

