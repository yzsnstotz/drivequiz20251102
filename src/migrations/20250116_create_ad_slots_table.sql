-- ============================================================
-- ZALEM 前台系统 - 广告栏管理表迁移脚本
-- 文件名: 20250116_create_ad_slots_table.sql
-- 说明: 创建广告栏配置表（ad_slots_config）
-- 日期: 2025-01-16
-- 数据库: drivequiz
-- ============================================================

BEGIN;

-- ============================================================
-- 创建广告栏配置表
-- ============================================================
CREATE TABLE IF NOT EXISTS ad_slots_config (
  id SERIAL PRIMARY KEY,
  
  -- 广告位标识
  slot_key VARCHAR(50) NOT NULL UNIQUE, -- 广告位标识：home_first_column, home_second_column, splash_screen, popup_ad
  
  -- 广告栏配置
  title VARCHAR(100) NOT NULL, -- 广告栏标题
  description VARCHAR(255), -- 广告栏描述（小文案）
  
  -- 启动页广告专用配置
  splash_duration INTEGER DEFAULT 3, -- 启动页广告持续时间（秒），仅用于 splash_screen
  
  -- 状态
  is_enabled BOOLEAN DEFAULT true, -- 是否启用
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 如果表已存在但缺少列，则添加缺失的列
DO $$
BEGIN
  -- 检查并添加 splash_duration 列（如果不存在）
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ad_slots_config' AND column_name = 'splash_duration'
  ) THEN
    ALTER TABLE ad_slots_config 
    ADD COLUMN splash_duration INTEGER DEFAULT 3;
  END IF;
  
  -- 检查并添加 is_enabled 列（如果不存在）
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ad_slots_config' AND column_name = 'is_enabled'
  ) THEN
    ALTER TABLE ad_slots_config 
    ADD COLUMN is_enabled BOOLEAN DEFAULT true;
  END IF;
END $$;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_ad_slots_config_slot_key ON ad_slots_config(slot_key);
CREATE INDEX IF NOT EXISTS idx_ad_slots_config_enabled ON ad_slots_config(is_enabled);

-- 插入默认数据
INSERT INTO ad_slots_config (slot_key, title, description, splash_duration, is_enabled)
VALUES 
  ('home_first_column', '首页第一栏', '精选商家推荐', 3, true),
  ('home_second_column', '首页第二栏', '优质商家推荐', 3, true),
  ('splash_screen', '启动页广告', '应用启动时显示的广告', 3, true),
  ('popup_ad', '启动弹窗广告', '首次启动首页后显示的弹窗广告', 3, true)
ON CONFLICT (slot_key) DO NOTHING;

COMMIT;

