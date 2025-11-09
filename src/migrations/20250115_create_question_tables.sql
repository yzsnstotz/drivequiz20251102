-- ============================================================
-- ZALEM 题目管理数据库迁移脚本
-- 文件名: 20250115_create_question_tables.sql
-- 说明: 创建题目管理相关的4个数据表
-- 日期: 2025-01-15
-- 数据库: drivequiz
-- ============================================================

BEGIN;

-- ============================================================
-- 1️⃣ questions - 题目表
-- ============================================================
CREATE TABLE IF NOT EXISTS questions (
  id BIGSERIAL PRIMARY KEY,
  content_hash VARCHAR(64) NOT NULL,        -- 题目内容哈希值（用于去重和匹配）
  type VARCHAR(20) NOT NULL,                  -- 题目类型（single/multiple/truefalse）
  content TEXT NOT NULL,                      -- 题目内容
  options JSONB,                              -- 选项（JSONB 格式，支持数组）
  correct_answer JSONB,                       -- 正确答案（JSONB 格式，支持字符串或数组）
  image TEXT,                                  -- 题目图片URL
  explanation TEXT,                            -- 解析说明
  license_types TEXT[],                        -- 驾照类型数组（如 ['provisional', 'regular']）
  version VARCHAR(50),                          -- 版本号
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_questions_content_hash ON questions(content_hash);
CREATE INDEX IF NOT EXISTS idx_questions_type ON questions(type);
CREATE INDEX IF NOT EXISTS idx_questions_version ON questions(version);
CREATE INDEX IF NOT EXISTS idx_questions_license_types ON questions USING GIN(license_types);
CREATE INDEX IF NOT EXISTS idx_questions_created_at ON questions(created_at DESC);

-- 唯一约束：同一content_hash只能有一条记录
CREATE UNIQUE INDEX IF NOT EXISTS idx_questions_content_hash_unique ON questions(content_hash);

-- ============================================================
-- 2️⃣ question_ai_answers - 题目AI回答表
-- ============================================================
CREATE TABLE IF NOT EXISTS question_ai_answers (
  id BIGSERIAL PRIMARY KEY,
  question_hash VARCHAR(64) NOT NULL,         -- 题目哈希值（关联 questions.content_hash）
  locale VARCHAR(8) NOT NULL DEFAULT 'zh',     -- 语言代码（如 'zh', 'ja'）
  answer TEXT NOT NULL,                       -- AI回答内容
  sources JSONB DEFAULT '[]',                -- 来源文档（JSONB 格式，存储 RAG 检索来源）
  model VARCHAR(50),                           -- AI模型名称（如 'gpt-4', 'claude-3'）
  created_by UUID,                             -- 创建者（关联用户或管理员）
  view_count INTEGER DEFAULT 0,                -- 查看次数
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_question_ai_answers_question_hash ON question_ai_answers(question_hash);
CREATE INDEX IF NOT EXISTS idx_question_ai_answers_locale ON question_ai_answers(locale);
CREATE INDEX IF NOT EXISTS idx_question_ai_answers_created_at ON question_ai_answers(created_at DESC);

-- 唯一约束：同一question_hash和locale只能有一条记录
CREATE UNIQUE INDEX IF NOT EXISTS idx_question_ai_answers_hash_locale_unique 
  ON question_ai_answers(question_hash, locale);

-- ============================================================
-- 3️⃣ question_ai_answer_pending_updates - 待更新题目AI回答表
-- ============================================================
CREATE TABLE IF NOT EXISTS question_ai_answer_pending_updates (
  id BIGSERIAL PRIMARY KEY,
  question_hash VARCHAR(64) NOT NULL,         -- 题目哈希值（关联 questions.content_hash）
  locale VARCHAR(8) NOT NULL DEFAULT 'zh',    -- 语言代码
  package_name VARCHAR(100),                   -- 题目包名称（如 '仮免-1', '免许-1'）
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_pending_updates_question_hash ON question_ai_answer_pending_updates(question_hash);
CREATE INDEX IF NOT EXISTS idx_pending_updates_package_name ON question_ai_answer_pending_updates(package_name);
CREATE INDEX IF NOT EXISTS idx_pending_updates_created_at ON question_ai_answer_pending_updates(created_at);

-- 唯一约束：同一question_hash和locale只能有一条待更新记录
CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_updates_hash_locale_unique 
  ON question_ai_answer_pending_updates(question_hash, locale);

-- ============================================================
-- 4️⃣ question_package_versions - 题目包版本表
-- ============================================================
CREATE TABLE IF NOT EXISTS question_package_versions (
  id BIGSERIAL PRIMARY KEY,
  package_name VARCHAR(100) NOT NULL,         -- 题目包名称（如 '仮免-1', '免许-1'）
  version VARCHAR(50) NOT NULL,                -- 版本号（如 '20250109-120000-001'）
  total_questions INTEGER DEFAULT 0,          -- 题目总数
  ai_answers_count INTEGER DEFAULT 0,         -- AI回答数量
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_package_versions_package_name ON question_package_versions(package_name);
CREATE INDEX IF NOT EXISTS idx_package_versions_version ON question_package_versions(version);
CREATE INDEX IF NOT EXISTS idx_package_versions_created_at ON question_package_versions(created_at DESC);

-- 唯一约束：同一package_name只能有一条最新版本记录
-- 注意：这里使用package_name作为唯一键，每次更新时更新version字段
CREATE UNIQUE INDEX IF NOT EXISTS idx_package_versions_package_name_unique 
  ON question_package_versions(package_name);

-- ============================================================
-- 触发器：自动更新 updated_at 字段
-- ============================================================

-- 创建触发器函数
CREATE OR REPLACE FUNCTION update_questions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_question_ai_answers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_question_package_versions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS trigger_update_questions_updated_at ON questions;
CREATE TRIGGER trigger_update_questions_updated_at
  BEFORE UPDATE ON questions
  FOR EACH ROW
  EXECUTE FUNCTION update_questions_updated_at();

DROP TRIGGER IF EXISTS trigger_update_question_ai_answers_updated_at ON question_ai_answers;
CREATE TRIGGER trigger_update_question_ai_answers_updated_at
  BEFORE UPDATE ON question_ai_answers
  FOR EACH ROW
  EXECUTE FUNCTION update_question_ai_answers_updated_at();

DROP TRIGGER IF EXISTS trigger_update_question_package_versions_updated_at ON question_package_versions;
CREATE TRIGGER trigger_update_question_package_versions_updated_at
  BEFORE UPDATE ON question_package_versions
  FOR EACH ROW
  EXECUTE FUNCTION update_question_package_versions_updated_at();

COMMIT;

-- ============================================================
-- 回滚脚本（DOWN）
-- ============================================================
-- 如果需要回滚，执行以下SQL：
-- BEGIN;
-- DROP TRIGGER IF EXISTS trigger_update_questions_updated_at ON questions;
-- DROP TRIGGER IF EXISTS trigger_update_question_ai_answers_updated_at ON question_ai_answers;
-- DROP TRIGGER IF EXISTS trigger_update_question_package_versions_updated_at ON question_package_versions;
-- DROP FUNCTION IF EXISTS update_questions_updated_at();
-- DROP FUNCTION IF EXISTS update_question_ai_answers_updated_at();
-- DROP FUNCTION IF EXISTS update_question_package_versions_updated_at();
-- DROP TABLE IF EXISTS question_package_versions;
-- DROP TABLE IF EXISTS question_ai_answer_pending_updates;
-- DROP TABLE IF EXISTS question_ai_answers;
-- DROP TABLE IF EXISTS questions;
-- COMMIT;

