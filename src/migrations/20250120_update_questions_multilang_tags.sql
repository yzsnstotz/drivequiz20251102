-- ============================================================
-- 更新 questions 表结构以支持多语言和标签
-- 文件名: 20250120_update_questions_multilang_tags.sql
-- 说明: 
--   1. 将 content 字段从 TEXT 改为 JSONB，支持多语言对象 {zh, en, ja}
--   2. 添加 category 字段（题目分类）
--   3. 添加 stage_tag 字段（阶段标签：both/provisional/regular）
--   4. 添加 topic_tags 字段（主题标签数组）
-- 日期: 2025-01-20
-- 数据库: drivequiz
-- ============================================================

BEGIN;

-- ============================================================
-- 1️⃣ 备份现有数据（将 content 从 TEXT 转换为 JSONB）
-- ============================================================
-- 注意：如果 content 字段已有数据，需要先迁移
-- 这里假设 content 字段存储的是中文内容，迁移为 {zh: content}

-- 添加临时列用于存储多语言内容
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS content_multilang JSONB;

-- 将现有的 content (TEXT) 迁移到 content_multilang (JSONB)
-- 如果 content 已经是 JSON 格式，直接转换；否则包装为 {zh: content}
UPDATE questions
SET content_multilang = CASE
  WHEN content::text ~ '^[\s]*\{' THEN content::jsonb  -- 如果已经是 JSON 格式
  ELSE jsonb_build_object('zh', content)                -- 否则包装为 {zh: content}
END
WHERE content_multilang IS NULL AND content IS NOT NULL;

-- ============================================================
-- 2️⃣ 添加新字段
-- ============================================================

-- 添加 category 字段（题目分类，如 "12"）
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS category VARCHAR(50);

-- 添加 stage_tag 字段（阶段标签：both/provisional/regular）
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS stage_tag VARCHAR(20);

-- 添加 topic_tags 字段（主题标签数组，如 ['traffic_sign']）
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS topic_tags TEXT[];

-- ============================================================
-- 3️⃣ 迁移数据：从 license_types 推断 stage_tag
-- ============================================================
-- 如果 license_types 包含 'all'，设置 stage_tag 为 'both'
-- 如果 license_types 包含 'provisional'，设置 stage_tag 为 'provisional'
-- 如果 license_types 包含 'regular'，设置 stage_tag 为 'regular'
UPDATE questions
SET stage_tag = CASE
  WHEN license_types @> ARRAY['all']::text[] THEN 'both'
  WHEN license_types @> ARRAY['provisional']::text[] THEN 'provisional'
  WHEN license_types @> ARRAY['regular']::text[] THEN 'regular'
  ELSE stage_tag
END
WHERE stage_tag IS NULL;

-- ============================================================
-- 4️⃣ 替换 content 字段
-- ============================================================
-- 删除旧的 content 字段（TEXT）
ALTER TABLE questions 
DROP COLUMN IF EXISTS content;

-- 将 content_multilang 重命名为 content
ALTER TABLE questions 
RENAME COLUMN content_multilang TO content;

-- 设置 content 字段为 NOT NULL（如果允许为空，可以去掉这个约束）
-- 注意：如果现有数据可能为空，先处理空值
UPDATE questions
SET content = jsonb_build_object('zh', '')
WHERE content IS NULL;

-- 添加 NOT NULL 约束
ALTER TABLE questions 
ALTER COLUMN content SET NOT NULL;

-- ============================================================
-- 5️⃣ 创建索引
-- ============================================================

-- category 索引
CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(category);

-- stage_tag 索引
CREATE INDEX IF NOT EXISTS idx_questions_stage_tag ON questions(stage_tag);

-- topic_tags GIN 索引（用于数组查询）
CREATE INDEX IF NOT EXISTS idx_questions_topic_tags ON questions USING GIN(topic_tags);

-- content JSONB 索引（用于多语言查询）
-- 为常用语言创建索引
CREATE INDEX IF NOT EXISTS idx_questions_content_zh ON questions USING GIN((content -> 'zh'));
CREATE INDEX IF NOT EXISTS idx_questions_content_en ON questions USING GIN((content -> 'en'));
CREATE INDEX IF NOT EXISTS idx_questions_content_ja ON questions USING GIN((content -> 'ja'));

-- ============================================================
-- 6️⃣ 添加注释
-- ============================================================

COMMENT ON COLUMN questions.content IS '题目内容（JSONB格式，支持多语言：{zh, en, ja}）';
COMMENT ON COLUMN questions.category IS '题目分类（如 "12"）';
COMMENT ON COLUMN questions.stage_tag IS '阶段标签：both/provisional/regular';
COMMENT ON COLUMN questions.topic_tags IS '主题标签数组（如 traffic_sign）';

COMMIT;

-- ============================================================
-- 回滚脚本（DOWN）
-- ============================================================
-- 如果需要回滚，执行以下SQL：
-- BEGIN;
-- 
-- -- 恢复 content 为 TEXT 类型
-- ALTER TABLE questions 
-- ADD COLUMN IF NOT EXISTS content_text TEXT;
-- 
-- -- 从 JSONB 提取中文内容
-- UPDATE questions
-- SET content_text = content->>'zh'
-- WHERE content_text IS NULL;
-- 
-- -- 删除 JSONB 字段
-- ALTER TABLE questions 
-- DROP COLUMN IF EXISTS content;
-- 
-- -- 重命名
-- ALTER TABLE questions 
-- RENAME COLUMN content_text TO content;
-- 
-- -- 删除新字段
-- ALTER TABLE questions 
-- DROP COLUMN IF EXISTS category;
-- ALTER TABLE questions 
-- DROP COLUMN IF EXISTS stage_tag;
-- ALTER TABLE questions 
-- DROP COLUMN IF EXISTS topic_tags;
-- 
-- -- 删除索引
-- DROP INDEX IF EXISTS idx_questions_category;
-- DROP INDEX IF EXISTS idx_questions_stage_tag;
-- DROP INDEX IF EXISTS idx_questions_topic_tags;
-- DROP INDEX IF EXISTS idx_questions_content_zh;
-- DROP INDEX IF EXISTS idx_questions_content_en;
-- DROP INDEX IF EXISTS idx_questions_content_ja;
-- 
-- COMMIT;

