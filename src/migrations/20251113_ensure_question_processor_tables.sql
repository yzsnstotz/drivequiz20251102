-- ============================================================
-- 确保 question-processor 所需表结构完善
-- 日期: 2025-11-13
-- 说明: 此脚本确保翻译和润色功能所需的表结构已创建并完善
-- 数据库: drivequiz 主程序数据库
-- ============================================================

-- 1) 支持语言配置表
CREATE TABLE IF NOT EXISTS languages (
  id BIGSERIAL PRIMARY KEY,
  locale VARCHAR(16) NOT NULL UNIQUE,         -- 如 zh, zh-CN, ja, en
  name VARCHAR(64) NOT NULL,                  -- 语言名称
  enabled BOOLEAN NOT NULL DEFAULT TRUE,      -- 是否启用
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2) 题目翻译表（与 questions.content_hash 关联）
CREATE TABLE IF NOT EXISTS question_translations (
  id BIGSERIAL PRIMARY KEY,
  content_hash VARCHAR(64) NOT NULL,          -- 关联 questions.content_hash
  locale VARCHAR(16) NOT NULL,                -- 翻译语言
  content TEXT NOT NULL,                      -- 翻译后的题干
  options JSONB,                              -- 翻译后的选项（数组字符串）
  explanation TEXT,                           -- 翻译后的解析
  image TEXT,                                 -- 如有多语言图片（可选）
  source VARCHAR(32) DEFAULT 'ai',            -- 来源：ai / human / import
  created_by UUID NULL,                       -- 创建者（可为空）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (content_hash, locale)
);

-- 确保索引存在
CREATE INDEX IF NOT EXISTS idx_qt_content_hash ON question_translations(content_hash);
CREATE INDEX IF NOT EXISTS idx_qt_locale ON question_translations(locale);
CREATE INDEX IF NOT EXISTS idx_qt_content_hash_locale ON question_translations(content_hash, locale);

-- 3) 题目润色建议表（审核流）
CREATE TABLE IF NOT EXISTS question_polish_reviews (
  id BIGSERIAL PRIMARY KEY,
  content_hash VARCHAR(64) NOT NULL,
  locale VARCHAR(16) NOT NULL,                -- 目标语言（针对该语言的题面进行润色）
  proposed_content TEXT NOT NULL,
  proposed_options JSONB,
  proposed_explanation TEXT,
  status VARCHAR(16) NOT NULL DEFAULT 'pending', -- pending / approved / rejected
  notes TEXT,                                  -- 审核备注
  created_by UUID NULL,
  reviewed_by UUID NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 确保索引存在
CREATE INDEX IF NOT EXISTS idx_qpr_content_hash ON question_polish_reviews(content_hash);
CREATE INDEX IF NOT EXISTS idx_qpr_status ON question_polish_reviews(status);
CREATE INDEX IF NOT EXISTS idx_qpr_locale ON question_polish_reviews(locale);
CREATE INDEX IF NOT EXISTS idx_qpr_content_hash_locale ON question_polish_reviews(content_hash, locale);

-- 4) 润色历史表（留痕）
CREATE TABLE IF NOT EXISTS question_polish_history (
  id BIGSERIAL PRIMARY KEY,
  content_hash VARCHAR(64) NOT NULL,
  locale VARCHAR(16) NOT NULL,
  old_content TEXT,
  old_options JSONB,
  old_explanation TEXT,
  new_content TEXT NOT NULL,
  new_options JSONB,
  new_explanation TEXT,
  approved_by UUID NULL,
  approved_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 确保索引存在
CREATE INDEX IF NOT EXISTS idx_qph_content_hash ON question_polish_history(content_hash);
CREATE INDEX IF NOT EXISTS idx_qph_locale ON question_polish_history(locale);
CREATE INDEX IF NOT EXISTS idx_qph_content_hash_locale ON question_polish_history(content_hash, locale);

-- 5) 验证表是否存在（用于检查）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'languages') THEN
    RAISE EXCEPTION 'Table languages does not exist';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'question_translations') THEN
    RAISE EXCEPTION 'Table question_translations does not exist';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'question_polish_reviews') THEN
    RAISE EXCEPTION 'Table question_polish_reviews does not exist';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'question_polish_history') THEN
    RAISE EXCEPTION 'Table question_polish_history does not exist';
  END IF;
  RAISE NOTICE 'All required tables exist';
END $$;

-- 6) 验证 questions 表是否存在（question-processor 依赖此表）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'questions') THEN
    RAISE EXCEPTION 'Table questions does not exist - this is required for question-processor';
  END IF;
  RAISE NOTICE 'Table questions exists';
END $$;

