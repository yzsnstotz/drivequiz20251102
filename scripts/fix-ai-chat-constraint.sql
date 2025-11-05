-- ============================================================
-- 修复user_behaviors表的behavior_type约束，添加ai_chat类型
-- 文件名: fix-ai-chat-constraint.sql
-- 说明: 直接执行此SQL来修复数据库约束
-- ============================================================

BEGIN;

-- 删除旧的CHECK约束
ALTER TABLE user_behaviors 
DROP CONSTRAINT IF EXISTS user_behaviors_behavior_type_check;

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

COMMIT;

-- 验证约束是否已更新
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conname = 'user_behaviors_behavior_type_check';

