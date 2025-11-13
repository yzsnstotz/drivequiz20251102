-- ============================================================
-- AI 场景配置表迁移脚本
-- 文件名: 20251113_create_ai_scene_config.sql
-- 说明: 创建 ai_scene_config 表用于存储不同 AI 场景的 prompt 和格式配置
-- 日期: 2025-11-13
-- ============================================================

BEGIN;

-- ============================================================
-- 创建 ai_scene_config 表
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_scene_config (
  id SERIAL PRIMARY KEY,
  scene_key VARCHAR(64) NOT NULL UNIQUE,  -- 场景标识：chat, question_explanation 等
  scene_name VARCHAR(128) NOT NULL,       -- 场景名称（显示用）
  system_prompt_zh TEXT NOT NULL,         -- 中文系统 prompt
  system_prompt_ja TEXT,                  -- 日文系统 prompt（可选）
  system_prompt_en TEXT,                  -- 英文系统 prompt（可选）
  output_format TEXT,                     -- 输出格式要求（JSON 或其他格式说明）
  max_length INTEGER DEFAULT 1000,        -- 最大输出长度（字符数）
  temperature NUMERIC(3,2) DEFAULT 0.4,   -- 温度参数（0.0-2.0）
  enabled BOOLEAN DEFAULT TRUE,           -- 是否启用
  description TEXT,                       -- 场景描述
  updated_by INTEGER,                     -- 更新人（关联 admins.id）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_ai_scene_config_key ON ai_scene_config(scene_key);
CREATE INDEX IF NOT EXISTS idx_ai_scene_config_enabled ON ai_scene_config(enabled);

-- 如果 admins 表存在，添加外键约束
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admins') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'ai_scene_config_updated_by_fkey'
    ) THEN
      ALTER TABLE ai_scene_config 
      ADD CONSTRAINT ai_scene_config_updated_by_fkey 
      FOREIGN KEY (updated_by) REFERENCES admins(id);
    END IF;
  END IF;
END $$;

-- 插入默认场景配置
INSERT INTO ai_scene_config (scene_key, scene_name, system_prompt_zh, system_prompt_ja, system_prompt_en, output_format, max_length, temperature, description) VALUES
  (
    'chat',
    '首页 AI 助手对话框',
    '你是 ZALEM 驾驶考试学习助手。请基于日本交通法规与题库知识回答用户问题，引用时要简洁，不编造，不输出与驾驶考试无关的内容。如果用户询问驾驶考试相关问题，请基于日本交通法规回答。如果问题与驾驶考试无关，请礼貌地说明你只能回答驾驶考试相关问题。',
    'あなたは ZALEM の運転免許学習アシスタントです。日本の交通法規と問題集の知識に基づいて、簡潔かつ正確に回答してください。推測や捏造は禁止し、関係のない内容は出力しないでください。運転免許に関連する質問には、日本の交通法規に基づいて回答してください。運転免許に関係のない質問には、丁寧に運転免許関連の質問のみに回答できることを説明してください。',
    'You are ZALEM''s driving-test study assistant. Answer based on Japan''s traffic laws and question bank. Be concise and accurate. Do not fabricate or include unrelated content. If users ask about driving test related questions, answer based on Japan''s traffic laws. If questions are unrelated to driving tests, politely explain that you can only answer driving test related questions.',
    NULL,
    1000,
    0.4,
    '首页 AI 助手对话框场景，用于通用对话'
  ),
  (
    'question_explanation',
    '驾照页 AI 助手解析题目',
    '你是 ZALEM 驾驶考试学习助手。当用户提供完整的题目信息（包括题目、选项、正确答案）时，请：\n1. 解释为什么正确答案是正确的\n2. 说明其他选项为什么错误（如果有）\n3. 引用相关的交通法规或知识点\n4. 保持回答简洁，控制在200字以内\n5. 如果题目有图片但无法查看，请提示用户描述图片内容以便提供更准确的解析',
    'あなたは ZALEM の運転免許学習アシスタントです。ユーザーが完全な問題情報（問題、選択肢、正解を含む）を提供した場合、以下を行ってください：\n1. 正解が正しい理由を説明する\n2. 他の選択肢が間違っている理由を説明する（該当する場合）\n3. 関連する交通法規や知識を引用する\n4. 回答を簡潔に保ち、200文字以内に抑える\n5. 問題に画像があるが確認できない場合は、より正確な解析のために画像の内容を説明するようユーザーに促す',
    'You are ZALEM''s driving-test study assistant. When users provide complete question information (including question, options, and correct answer), please:\n1. Explain why the correct answer is correct\n2. Explain why other options are wrong (if applicable)\n3. Cite relevant traffic laws or knowledge points\n4. Keep the answer concise, within 200 characters\n5. If the question has an image but cannot be viewed, prompt the user to describe the image content for more accurate analysis',
    NULL,
    500,
    0.3,
    '驾照页 AI 助手解析题目场景，用于题目详细解析'
  )
ON CONFLICT (scene_key) DO NOTHING;

COMMIT;

