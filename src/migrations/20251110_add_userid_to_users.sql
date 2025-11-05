-- ============================================================
-- 为已存在的users表添加userid列
-- 文件名: 20251110_add_userid_to_users.sql
-- 说明: 为已存在的users表添加userid列（如果表已存在但缺少该列）
-- 日期: 2025-11-10
-- 数据库: drivequiz
-- ============================================================

BEGIN;

-- 添加userid列（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'userid'
  ) THEN
    ALTER TABLE users ADD COLUMN userid VARCHAR(255) UNIQUE;
    CREATE INDEX IF NOT EXISTS idx_users_userid ON users(userid);
    
    -- 为现有用户生成userid（基于activation_id生成act-{activationId}格式）
    -- 对于没有activation_code_id的用户，生成UUID格式的userid
    UPDATE users u
    SET userid = CASE
      WHEN u.activation_code_id IS NOT NULL THEN
        -- 通过activation_code_id查找激活记录，生成act-{activationId}格式
        COALESCE(
          (SELECT 'act-' || a.id::text
           FROM activations a
           JOIN activation_codes ac ON ac.code = a.activation_code
           WHERE ac.id = u.activation_code_id
           LIMIT 1),
          'user-' || u.id::text
        )
      ELSE
        -- 没有激活码的用户，生成user-{id}格式
        'user-' || u.id::text
    END
    WHERE u.userid IS NULL;
    
    RAISE NOTICE 'Added userid column to users table and populated existing records';
  ELSE
    RAISE NOTICE 'userid column already exists in users table';
  END IF;
END $$;

COMMIT;

