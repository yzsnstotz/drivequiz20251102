-- ============================================================
-- 更新 questions 表的 explanation 字段为 JSONB 类型（支持多语言）
-- 文件名: 20250122_update_explanation_to_jsonb.sql
-- 说明: 
--   1. 将 explanation 字段从 TEXT 改为 JSONB，支持多语言对象 {zh, en, ja}
--   2. 迁移现有数据：将字符串转换为 {zh: explanation} 格式
-- 日期: 2025-01-22
-- 数据库: drivequiz
-- ============================================================

BEGIN;

-- ============================================================
-- 1️⃣ 备份现有数据（将 explanation 从 TEXT 转换为 JSONB）
-- ============================================================
-- 添加临时列用于存储多语言解析
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS explanation_multilang JSONB;

-- 将现有的 explanation (TEXT) 迁移到 explanation_multilang (JSONB)
-- 如果 explanation 已经是 JSON 格式，直接转换；否则包装为 {zh: explanation}
-- 注意：使用事务确保原子性，避免在迁移过程中其他服务看到不一致的状态
UPDATE questions
SET explanation_multilang = CASE
  WHEN explanation IS NULL THEN NULL
  WHEN explanation::text ~ '^[\s]*\{' THEN explanation::jsonb  -- 如果已经是 JSON 格式
  ELSE jsonb_build_object('zh', explanation)                  -- 否则包装为 {zh: explanation}
END
WHERE explanation_multilang IS NULL;

-- ============================================================
-- 2️⃣ 替换 explanation 字段
-- ============================================================
-- 删除旧的 explanation 字段（TEXT）
ALTER TABLE questions 
DROP COLUMN IF EXISTS explanation;

-- 将 explanation_multilang 重命名为 explanation
ALTER TABLE questions 
RENAME COLUMN explanation_multilang TO explanation;

-- ============================================================
-- 3️⃣ 创建索引
-- ============================================================
-- explanation JSONB 索引（用于多语言查询）
CREATE INDEX IF NOT EXISTS idx_questions_explanation_zh ON questions USING GIN((explanation -> 'zh'));
CREATE INDEX IF NOT EXISTS idx_questions_explanation_en ON questions USING GIN((explanation -> 'en'));
CREATE INDEX IF NOT EXISTS idx_questions_explanation_ja ON questions USING GIN((explanation -> 'ja'));

-- ============================================================
-- 4️⃣ 添加注释
-- ============================================================
COMMENT ON COLUMN questions.explanation IS '题目解析（JSONB格式，支持多语言：{zh, en, ja}）';

COMMIT;

-- ============================================================
-- 回滚脚本（DOWN）
-- ============================================================
-- 如果需要回滚，执行以下SQL：
-- BEGIN;
-- 
-- -- 恢复 explanation 为 TEXT 类型
-- ALTER TABLE questions 
-- ADD COLUMN IF NOT EXISTS explanation_text TEXT;
-- 
-- -- 从 JSONB 提取中文内容
-- UPDATE questions
-- SET explanation_text = explanation->>'zh'
-- WHERE explanation_text IS NULL AND explanation IS NOT NULL;
-- 
-- -- 删除 JSONB 字段
-- ALTER TABLE questions 
-- DROP COLUMN IF EXISTS explanation;
-- 
-- -- 重命名
-- ALTER TABLE questions 
-- RENAME COLUMN explanation_text TO explanation;
-- 
-- -- 删除索引
-- DROP INDEX IF EXISTS idx_questions_explanation_zh;
-- DROP INDEX IF EXISTS idx_questions_explanation_en;
-- DROP INDEX IF EXISTS idx_questions_explanation_ja;
-- 
-- COMMIT;

