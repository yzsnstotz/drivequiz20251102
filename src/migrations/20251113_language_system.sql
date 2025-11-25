-- ============================================================
-- 多语言与题目润色系统 - 数据库迁移
-- 日期: 2025-11-13
-- 说明:
--  1) languages: 系统支持的语言配置
--  2) question_translations: 题目翻译存储（按 content_hash + locale 唯一）
--  3) question_polish_reviews: 润色建议与审核（待审核、通过、驳回）
--  4) question_polish_history: 润色历史（保留修改记录）
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
CREATE INDEX IF NOT EXISTS idx_qt_content_hash ON question_translations(content_hash);
CREATE INDEX IF NOT EXISTS idx_qt_locale ON question_translations(locale);

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
CREATE INDEX IF NOT EXISTS idx_qpr_content_hash ON question_polish_reviews(content_hash);
CREATE INDEX IF NOT EXISTS idx_qpr_status ON question_polish_reviews(status);
CREATE INDEX IF NOT EXISTS idx_qpr_locale ON question_polish_reviews(locale);

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
CREATE INDEX IF NOT EXISTS idx_qph_content_hash ON question_polish_history(content_hash);
CREATE INDEX IF NOT EXISTS idx_qph_locale ON question_polish_history(locale);

-- 5) 约束与参考: 不强制外键（跨服务/最小耦合），依赖 content_hash 对齐
-- 可在业务侧保证 content_hash 一致性


