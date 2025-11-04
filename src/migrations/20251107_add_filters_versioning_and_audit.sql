-- ============================================================
-- 过滤规则版本与审计功能迁移脚本
-- 文件名: 20251107_add_filters_versioning_and_audit.sql
-- 说明: 为 ai_filters 添加状态、审计字段，并创建历史记录表
-- 日期: 2025-11-07
-- ============================================================

BEGIN;

-- ============================================================
-- 1. 为 ai_filters 表添加状态和审计字段
-- ============================================================
ALTER TABLE ai_filters 
ADD COLUMN IF NOT EXISTS status VARCHAR(16) DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS changed_by INTEGER,
ADD COLUMN IF NOT EXISTS changed_at TIMESTAMPTZ DEFAULT now();

-- 添加约束（如果 status 字段已存在但约束不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ai_filters_status_check'
  ) THEN
    ALTER TABLE ai_filters 
    ADD CONSTRAINT ai_filters_status_check 
    CHECK (status IN ('draft', 'active', 'inactive'));
  END IF;
END $$;

-- 更新现有记录的 status（默认为 'active' 以保持向后兼容）
UPDATE ai_filters 
SET status = 'active' 
WHERE status IS NULL OR status = 'draft';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_ai_filters_status ON ai_filters(status);
CREATE INDEX IF NOT EXISTS idx_ai_filters_changed_at ON ai_filters(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_filters_changed_by ON ai_filters(changed_by);

-- 如果 admins 表存在，添加外键约束
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admins') THEN
    -- 检查外键约束是否已存在
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'ai_filters_changed_by_fkey'
    ) THEN
      ALTER TABLE ai_filters 
      ADD CONSTRAINT ai_filters_changed_by_fkey 
      FOREIGN KEY (changed_by) REFERENCES admins(id);
    END IF;
  END IF;
END $$;

-- ============================================================
-- 2. 创建 ai_filters_history 表用于审计追踪
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_filters_history (
  id BIGSERIAL PRIMARY KEY,
  filter_id BIGINT NOT NULL,
  type VARCHAR(32) NOT NULL,           -- not-driving / sensitive
  pattern TEXT NOT NULL,               -- 正则表达式
  status VARCHAR(16) NOT NULL,
  changed_by INTEGER,
  changed_at TIMESTAMPTZ DEFAULT now(),
  action VARCHAR(32) DEFAULT 'update'   -- create, update, status_change
);

-- 添加约束
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ai_filters_history_status_check'
  ) THEN
    ALTER TABLE ai_filters_history 
    ADD CONSTRAINT ai_filters_history_status_check 
    CHECK (status IN ('draft', 'active', 'inactive'));
  END IF;
END $$;

-- 添加外键约束（如果相关表存在）
DO $$
BEGIN
  -- filter_id 外键
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ai_filters_history_filter_id_fkey'
  ) THEN
    ALTER TABLE ai_filters_history 
    ADD CONSTRAINT ai_filters_history_filter_id_fkey 
    FOREIGN KEY (filter_id) REFERENCES ai_filters(id) ON DELETE CASCADE;
  END IF;
  
  -- changed_by 外键（如果 admins 表存在）
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admins') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'ai_filters_history_changed_by_fkey'
    ) THEN
      ALTER TABLE ai_filters_history 
      ADD CONSTRAINT ai_filters_history_changed_by_fkey 
      FOREIGN KEY (changed_by) REFERENCES admins(id);
    END IF;
  END IF;
END $$;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_ai_filters_history_filter_id ON ai_filters_history(filter_id);
CREATE INDEX IF NOT EXISTS idx_ai_filters_history_changed_at ON ai_filters_history(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_filters_history_changed_by ON ai_filters_history(changed_by);

-- ============================================================
-- 3. 创建触发器函数：自动记录历史变更
-- ============================================================
CREATE OR REPLACE FUNCTION ai_filters_audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO ai_filters_history (
    filter_id,
    type,
    pattern,
    status,
    changed_by,
    changed_at,
    action
  ) VALUES (
    NEW.id,
    NEW.type,
    NEW.pattern,
    NEW.status,
    NEW.changed_by,
    NEW.changed_at,
    CASE 
      WHEN TG_OP = 'INSERT' THEN 'create'
      WHEN OLD.status != NEW.status THEN 'status_change'
      ELSE 'update'
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS ai_filters_audit ON ai_filters;
CREATE TRIGGER ai_filters_audit
  AFTER INSERT OR UPDATE ON ai_filters
  FOR EACH ROW
  EXECUTE FUNCTION ai_filters_audit_trigger();

COMMIT;

