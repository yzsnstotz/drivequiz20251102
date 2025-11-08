-- ============================================================
-- ZALEM 前台系统 - 车辆与服务表迁移脚本
-- 文件名: 20251112_create_vehicles_and_services.sql
-- 说明: 创建车辆表（vehicles、vehicle_types）和服务表（services、service_categories、service_reviews）
-- 日期: 2025-11-12
-- 数据库: drivequiz
-- ============================================================

BEGIN;

-- ============================================================
-- 1️⃣ 创建车辆类型表（vehicle_types）
-- ============================================================
CREATE TABLE IF NOT EXISTS vehicle_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  name_ja VARCHAR(100),
  name_zh VARCHAR(100),
  name_en VARCHAR(100),
  description TEXT,
  icon VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_types_name ON vehicle_types(name);
CREATE INDEX IF NOT EXISTS idx_vehicle_types_created_at ON vehicle_types(created_at DESC);

-- ============================================================
-- 2️⃣ 创建车辆表（vehicles）
-- ============================================================
CREATE TABLE IF NOT EXISTS vehicles (
  id SERIAL PRIMARY KEY,
  vehicle_type_id INTEGER,
  
  -- 基本信息
  brand VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  year INTEGER,
  
  -- 多语言信息
  name_ja VARCHAR(200),
  name_zh VARCHAR(200),
  name_en VARCHAR(200),
  description_ja TEXT,
  description_zh TEXT,
  description_en TEXT,
  
  -- 车辆属性
  price_min NUMERIC(10,2),
  price_max NUMERIC(10,2),
  fuel_type VARCHAR(20), -- 燃料类型：gasoline, diesel, hybrid, electric
  transmission VARCHAR(20), -- 变速器：manual, automatic, cvt
  seats INTEGER,
  
  -- 图片和链接
  image_url TEXT,
  official_url TEXT,
  dealer_url TEXT,
  
  -- 扩展信息（JSONB格式）
  specifications JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  
  -- 状态
  status VARCHAR(20) DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'archived')),
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicles_vehicle_type_id ON vehicles(vehicle_type_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_brand ON vehicles(brand);
CREATE INDEX IF NOT EXISTS idx_vehicles_model ON vehicles(model);
CREATE INDEX IF NOT EXISTS idx_vehicles_year ON vehicles(year);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_created_at ON vehicles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vehicles_price_range ON vehicles(price_min, price_max);

-- 添加外键约束
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vehicle_types') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_vehicle_type_id_fkey'
    ) THEN
      ALTER TABLE vehicles 
      ADD CONSTRAINT vehicles_vehicle_type_id_fkey 
      FOREIGN KEY (vehicle_type_id) REFERENCES vehicle_types(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- ============================================================
-- 3️⃣ 创建服务分类表（service_categories）
-- ============================================================
CREATE TABLE IF NOT EXISTS service_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  name_ja VARCHAR(100),
  name_zh VARCHAR(100),
  name_en VARCHAR(100),
  description TEXT,
  icon VARCHAR(50),
  parent_id INTEGER, -- 支持分类层级
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_categories_name ON service_categories(name);
CREATE INDEX IF NOT EXISTS idx_service_categories_parent_id ON service_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_service_categories_sort_order ON service_categories(sort_order);

-- 添加自引用外键约束
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'service_categories') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'service_categories_parent_id_fkey'
    ) THEN
      ALTER TABLE service_categories 
      ADD CONSTRAINT service_categories_parent_id_fkey 
      FOREIGN KEY (parent_id) REFERENCES service_categories(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- ============================================================
-- 4️⃣ 创建服务表（services）
-- ============================================================
CREATE TABLE IF NOT EXISTS services (
  id SERIAL PRIMARY KEY,
  category_id INTEGER,
  
  -- 基本信息
  name VARCHAR(200) NOT NULL,
  name_ja VARCHAR(200),
  name_zh VARCHAR(200),
  name_en VARCHAR(200),
  description TEXT,
  description_ja TEXT,
  description_zh TEXT,
  description_en TEXT,
  
  -- 位置信息
  location VARCHAR(200),
  address TEXT,
  latitude NUMERIC(10,8),
  longitude NUMERIC(11,8),
  prefecture VARCHAR(50),
  city VARCHAR(100),
  
  -- 联系信息
  phone VARCHAR(20),
  email VARCHAR(255),
  website TEXT,
  
  -- 价格信息
  price_min NUMERIC(10,2),
  price_max NUMERIC(10,2),
  price_unit VARCHAR(20), -- 价格单位：yen, usd, etc.
  
  -- 评分信息
  rating_avg NUMERIC(3,2) DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  
  -- 图片和链接
  image_url TEXT,
  official_url TEXT,
  
  -- 扩展信息（JSONB格式）
  business_hours JSONB DEFAULT '{}',
  features JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  
  -- 状态
  status VARCHAR(20) DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'archived')),
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_services_category_id ON services(category_id);
CREATE INDEX IF NOT EXISTS idx_services_name ON services(name);
CREATE INDEX IF NOT EXISTS idx_services_location ON services(location);
CREATE INDEX IF NOT EXISTS idx_services_prefecture ON services(prefecture);
CREATE INDEX IF NOT EXISTS idx_services_city ON services(city);
CREATE INDEX IF NOT EXISTS idx_services_status ON services(status);
CREATE INDEX IF NOT EXISTS idx_services_rating_avg ON services(rating_avg DESC);
CREATE INDEX IF NOT EXISTS idx_services_created_at ON services(created_at DESC);

-- 地理位置索引（如果支持 PostGIS）
-- CREATE INDEX IF NOT EXISTS idx_services_location_gist ON services USING GIST (point(longitude, latitude));

-- 添加外键约束
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'service_categories') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'services_category_id_fkey'
    ) THEN
      ALTER TABLE services 
      ADD CONSTRAINT services_category_id_fkey 
      FOREIGN KEY (category_id) REFERENCES service_categories(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- ============================================================
-- 5️⃣ 创建服务评价表（service_reviews）
-- ============================================================
CREATE TABLE IF NOT EXISTS service_reviews (
  id BIGSERIAL PRIMARY KEY,
  service_id INTEGER NOT NULL,
  user_id INTEGER,
  
  -- 评价内容
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  
  -- 扩展信息（JSONB格式）
  metadata JSONB DEFAULT '{}',
  
  -- 状态
  status VARCHAR(20) DEFAULT 'active'
    CHECK (status IN ('active', 'hidden', 'deleted')),
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_reviews_service_id ON service_reviews(service_id);
CREATE INDEX IF NOT EXISTS idx_service_reviews_user_id ON service_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_service_reviews_rating ON service_reviews(rating);
CREATE INDEX IF NOT EXISTS idx_service_reviews_status ON service_reviews(status);
CREATE INDEX IF NOT EXISTS idx_service_reviews_created_at ON service_reviews(created_at DESC);

-- 添加外键约束
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'services') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'service_reviews_service_id_fkey'
    ) THEN
      ALTER TABLE service_reviews 
      ADD CONSTRAINT service_reviews_service_id_fkey 
      FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE;
    END IF;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'service_reviews_user_id_fkey'
    ) THEN
      ALTER TABLE service_reviews 
      ADD CONSTRAINT service_reviews_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- ============================================================
-- 6️⃣ 创建触发器函数：自动更新 updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_vehicles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_services_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_service_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS trigger_update_vehicles_updated_at ON vehicles;
CREATE TRIGGER trigger_update_vehicles_updated_at
  BEFORE UPDATE ON vehicles
  FOR EACH ROW
  EXECUTE FUNCTION update_vehicles_updated_at();

DROP TRIGGER IF EXISTS trigger_update_services_updated_at ON services;
CREATE TRIGGER trigger_update_services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW
  EXECUTE FUNCTION update_services_updated_at();

DROP TRIGGER IF EXISTS trigger_update_service_reviews_updated_at ON service_reviews;
CREATE TRIGGER trigger_update_service_reviews_updated_at
  BEFORE UPDATE ON service_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_service_reviews_updated_at();

-- ============================================================
-- 7️⃣ 创建触发器函数：自动更新服务评分
-- ============================================================
CREATE OR REPLACE FUNCTION update_service_rating()
RETURNS TRIGGER AS $$
BEGIN
  -- 更新服务的平均评分和评分数量
  UPDATE services
  SET 
    rating_avg = (
      SELECT AVG(rating)::NUMERIC(3,2)
      FROM service_reviews
      WHERE service_id = COALESCE(NEW.service_id, OLD.service_id)
        AND status = 'active'
    ),
    rating_count = (
      SELECT COUNT(*)
      FROM service_reviews
      WHERE service_id = COALESCE(NEW.service_id, OLD.service_id)
        AND status = 'active'
    )
  WHERE id = COALESCE(NEW.service_id, OLD.service_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS trigger_update_service_rating ON service_reviews;
CREATE TRIGGER trigger_update_service_rating
  AFTER INSERT OR UPDATE OR DELETE ON service_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_service_rating();

COMMIT;

-- ============================================================
-- 验证查询
-- ============================================================
-- 检查表是否创建成功：
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_name IN ('vehicle_types', 'vehicles', 'service_categories', 'services', 'service_reviews');
--
-- 检查索引是否创建成功：
-- SELECT indexname FROM pg_indexes 
-- WHERE tablename IN ('vehicle_types', 'vehicles', 'service_categories', 'services', 'service_reviews');

