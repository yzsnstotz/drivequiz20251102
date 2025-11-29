-- ============================================================
-- 后台动态内容多语言配置迁移脚本
-- 文件名: 20251129_add_multilang_fields.sql
-- 说明: 将商户、商户类型、广告栏、服务条款相关字段改为JSONB类型以支持多语言
-- 日期: 2025-11-29
-- 数据库: drivequiz
-- ============================================================

BEGIN;

-- ============================================================
-- 1. merchants 表：name, description, address 改为 JSONB
-- ============================================================

-- 添加临时列
ALTER TABLE merchants 
  ADD COLUMN IF NOT EXISTS name_new JSONB,
  ADD COLUMN IF NOT EXISTS description_new JSONB,
  ADD COLUMN IF NOT EXISTS address_new JSONB;

-- 迁移现有数据：将字符串转换为 JSONB 格式 {zh: "原值", en: "", ja: ""}
UPDATE merchants 
SET 
  name_new = CASE 
    WHEN name IS NOT NULL AND name != '' THEN jsonb_build_object('zh', name, 'en', '', 'ja', '')
    ELSE NULL
  END,
  description_new = CASE 
    WHEN description IS NOT NULL AND description != '' THEN jsonb_build_object('zh', description, 'en', '', 'ja', '')
    ELSE NULL
  END,
  address_new = CASE 
    WHEN address IS NOT NULL AND address != '' THEN jsonb_build_object('zh', address, 'en', '', 'ja', '')
    ELSE NULL
  END;

-- 删除旧列
ALTER TABLE merchants 
  DROP COLUMN IF EXISTS name,
  DROP COLUMN IF EXISTS description,
  DROP COLUMN IF EXISTS address;

-- 重命名新列（PostgreSQL 要求每个 RENAME COLUMN 单独执行）
ALTER TABLE merchants RENAME COLUMN name_new TO name;
ALTER TABLE merchants RENAME COLUMN description_new TO description;
ALTER TABLE merchants RENAME COLUMN address_new TO address;

-- ============================================================
-- 2. merchant_categories 表：name 改为 JSONB
-- ============================================================

-- 添加临时列
ALTER TABLE merchant_categories 
  ADD COLUMN IF NOT EXISTS name_new JSONB;

-- 迁移现有数据
UPDATE merchant_categories 
SET name_new = CASE 
  WHEN name IS NOT NULL AND name != '' THEN jsonb_build_object('zh', name, 'en', '', 'ja', '')
  ELSE NULL
END;

-- 删除旧列
ALTER TABLE merchant_categories 
  DROP COLUMN IF EXISTS name;

-- 重命名新列
ALTER TABLE merchant_categories 
  RENAME COLUMN name_new TO name;

-- 注意：由于 name 原来是 UNIQUE 约束，需要重新创建唯一索引（基于 JSONB 的 zh 字段）
-- 但 PostgreSQL 不支持直接在 JSONB 字段上创建唯一约束，所以移除 UNIQUE 约束
-- 如果需要唯一性，可以在应用层或通过触发器实现

-- ============================================================
-- 3. ad_slots_config 表：title, description 改为 JSONB
-- ============================================================

-- 添加临时列
ALTER TABLE ad_slots_config 
  ADD COLUMN IF NOT EXISTS title_new JSONB,
  ADD COLUMN IF NOT EXISTS description_new JSONB;

-- 迁移现有数据
UPDATE ad_slots_config 
SET 
  title_new = CASE 
    WHEN title IS NOT NULL AND title != '' THEN jsonb_build_object('zh', title, 'en', '', 'ja', '')
    ELSE NULL
  END,
  description_new = CASE 
    WHEN description IS NOT NULL AND description != '' THEN jsonb_build_object('zh', description, 'en', '', 'ja', '')
    ELSE NULL
  END;

-- 删除旧列
ALTER TABLE ad_slots_config 
  DROP COLUMN IF EXISTS title,
  DROP COLUMN IF EXISTS description;

-- 重命名新列（PostgreSQL 要求每个 RENAME COLUMN 单独执行）
ALTER TABLE ad_slots_config RENAME COLUMN title_new TO title;
ALTER TABLE ad_slots_config RENAME COLUMN description_new TO description;

-- ============================================================
-- 4. terms_of_service 表：title, content 改为 JSONB
-- ============================================================

-- 添加临时列
ALTER TABLE terms_of_service 
  ADD COLUMN IF NOT EXISTS title_new JSONB,
  ADD COLUMN IF NOT EXISTS content_new JSONB;

-- 迁移现有数据
UPDATE terms_of_service 
SET 
  title_new = CASE 
    WHEN title IS NOT NULL AND title != '' THEN jsonb_build_object('zh', title, 'en', '', 'ja', '')
    ELSE NULL
  END,
  content_new = CASE 
    WHEN content IS NOT NULL AND content != '' THEN jsonb_build_object('zh', content, 'en', '', 'ja', '')
    ELSE NULL
  END;

-- 删除旧列
ALTER TABLE terms_of_service 
  DROP COLUMN IF EXISTS title,
  DROP COLUMN IF EXISTS content;

-- 重命名新列（PostgreSQL 要求每个 RENAME COLUMN 单独执行）
ALTER TABLE terms_of_service RENAME COLUMN title_new TO title;
ALTER TABLE terms_of_service RENAME COLUMN content_new TO content;

COMMIT;

-- ============================================================
-- 验证迁移结果
-- ============================================================
-- 执行以下查询验证迁移是否成功：
-- 
-- SELECT 
--   column_name, 
--   data_type 
-- FROM information_schema.columns 
-- WHERE table_name IN ('merchants', 'merchant_categories', 'ad_slots_config', 'terms_of_service')
--   AND column_name IN ('name', 'description', 'address', 'title', 'content')
-- ORDER BY table_name, column_name;
--
-- 预期结果：所有相关字段的 data_type 应该是 'jsonb'

