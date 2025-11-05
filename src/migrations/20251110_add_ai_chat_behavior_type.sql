-- ============================================================
-- 添加ai_chat行为类型到user_behaviors表
-- 文件名: 20251110_add_ai_chat_behavior_type.sql
-- 说明: 为user_behaviors表添加ai_chat行为类型（用于记录AI聊天条数）
-- 日期: 2025-11-10
-- 数据库: drivequiz
-- ============================================================

BEGIN;

-- 修改behavior_type的CHECK约束，添加ai_chat类型
DO $$
BEGIN
  -- 删除旧的CHECK约束
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_behaviors_behavior_type_check'
  ) THEN
    ALTER TABLE user_behaviors 
    DROP CONSTRAINT user_behaviors_behavior_type_check;
  END IF;

  -- 添加新的CHECK约束，包含ai_chat
  ALTER TABLE user_behaviors 
  ADD CONSTRAINT user_behaviors_behavior_type_check 
  CHECK (behavior_type IN (
    'login', 
    'logout', 
    'start_quiz', 
    'complete_quiz', 
    'pause_quiz', 
    'resume_quiz', 
    'view_page', 
    'ai_chat',
    'other'
  ));
END $$;

COMMIT;

