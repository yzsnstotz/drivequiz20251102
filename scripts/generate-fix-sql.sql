-- ============================================================
-- 修复 chat 场景配置 - 移除 {lang} 占位符
-- 文件名: scripts/generate-fix-sql.sql
-- 说明: 预防性修复脚本，确保 chat 场景的 prompt 不包含 {lang} 占位符
-- 日期: 2025-11-29
-- 数据库: AI Service 数据库（使用 AI_DATABASE_URL）
-- ============================================================

BEGIN;

-- ============================================================
-- 修复 chat 场景的日文和英文 prompt
-- ============================================================

-- 检查当前配置
SELECT 
  scene_key,
  CASE 
    WHEN system_prompt_ja LIKE '%{lang}%' OR system_prompt_ja LIKE '%{Lang}%' OR system_prompt_ja LIKE '%{LANG}%' 
    THEN '⚠️  包含 {lang} 占位符'
    ELSE '✅ 正常'
  END as ja_status,
  CASE 
    WHEN system_prompt_en LIKE '%{lang}%' OR system_prompt_en LIKE '%{Lang}%' OR system_prompt_en LIKE '%{LANG}%' 
    THEN '⚠️  包含 {lang} 占位符'
    ELSE '✅ 正常'
  END as en_status,
  LENGTH(system_prompt_ja) as ja_length,
  LENGTH(system_prompt_en) as en_length
FROM ai_scene_config
WHERE scene_key = 'chat';

-- 修复日文 prompt（如果包含 {lang} 占位符）
UPDATE ai_scene_config 
SET 
  system_prompt_ja = REPLACE(
    REPLACE(
      REPLACE(system_prompt_ja, '{lang}', ''),
      '{Lang}', ''
    ),
    '{LANG}', ''
  ),
  updated_at = NOW()
WHERE scene_key = 'chat'
  AND (
    system_prompt_ja LIKE '%{lang}%' 
    OR system_prompt_ja LIKE '%{Lang}%' 
    OR system_prompt_ja LIKE '%{LANG}%'
  );

-- 修复英文 prompt（如果包含 {lang} 占位符）
UPDATE ai_scene_config 
SET 
  system_prompt_en = REPLACE(
    REPLACE(
      REPLACE(system_prompt_en, '{lang}', ''),
      '{Lang}', ''
    ),
    '{LANG}', ''
  ),
  updated_at = NOW()
WHERE scene_key = 'chat'
  AND (
    system_prompt_en LIKE '%{lang}%' 
    OR system_prompt_en LIKE '%{Lang}%' 
    OR system_prompt_en LIKE '%{LANG}%'
  );

-- 如果 prompt 为空或只包含空白字符，恢复为标准配置
UPDATE ai_scene_config 
SET 
  system_prompt_ja = 'あなたは ZALEM の運転免許学習アシスタントです。日本の交通法規と問題集の知識に基づいて、簡潔かつ正確に回答してください。推測や捏造は禁止し、関係のない内容は出力しないでください。運転免許に関連する質問には、日本の交通法規に基づいて回答してください。運転免許に関係のない質問には、丁寧に運転免許関連の質問のみに回答できることを説明してください。',
  system_prompt_en = 'You are ZALEM''s driving-test study assistant. Answer based on Japan''s traffic laws and question bank. Be concise and accurate. Do not fabricate or include unrelated content. If users ask about driving test related questions, answer based on Japan''s traffic laws. If questions are unrelated to driving tests, politely explain that you can only answer driving test related questions.',
  updated_at = NOW()
WHERE scene_key = 'chat'
  AND (
    system_prompt_ja IS NULL 
    OR TRIM(system_prompt_ja) = ''
    OR system_prompt_en IS NULL 
    OR TRIM(system_prompt_en) = ''
  );

-- 验证修复结果
SELECT 
  scene_key,
  scene_name,
  CASE 
    WHEN system_prompt_ja LIKE '%{lang}%' OR system_prompt_ja LIKE '%{Lang}%' OR system_prompt_ja LIKE '%{LANG}%' 
    THEN '❌ 仍包含 {lang} 占位符'
    ELSE '✅ 正常'
  END as ja_status,
  CASE 
    WHEN system_prompt_en LIKE '%{lang}%' OR system_prompt_en LIKE '%{Lang}%' OR system_prompt_en LIKE '%{LANG}%' 
    THEN '❌ 仍包含 {lang} 占位符'
    ELSE '✅ 正常'
  END as en_status,
  LENGTH(system_prompt_ja) as ja_length,
  LENGTH(system_prompt_en) as en_length,
  LEFT(system_prompt_ja, 100) as ja_preview,
  LEFT(system_prompt_en, 100) as en_preview
FROM ai_scene_config
WHERE scene_key = 'chat';

COMMIT;

-- ============================================================
-- 使用说明
-- ============================================================
-- 1. 此脚本会检查并修复 chat 场景配置中的 {lang} 占位符
-- 2. 如果发现占位符，会自动移除
-- 3. 如果 prompt 为空，会恢复为标准配置
-- 4. 执行前请先查看检查结果，确认是否需要修复
-- 5. 执行后请验证修复结果，确认配置正确
-- ============================================================

