-- ============================================================
-- 修复 User 视图 emailVerified 字段插入失败问题
-- 文件名: 20251126_fix_user_view_emailverified_timestamp.sql
-- 说明: 使用直接列映射替代复杂表达式和触发器，让 NextAuth 能直接对视图做 INSERT/UPDATE
-- 日期: 2025-11-26
-- 数据库: drivequiz
-- ============================================================
-- 
-- 执行顺序说明：
-- 1. 先执行 20251126_alter_users_and_auth_ids_to_text.sql
-- 2. 再执行 20251126_create_nextauth_table_views.sql（如果存在）
-- 3. 执行本文件：20251126_fix_user_view_emailverified_timestamp.sql
-- 4. 最后执行：20251126_create_nextauth_view_triggers.sql（但本文件会移除 User 视图的触发器）
-- ============================================================

BEGIN;

-- ============================================================
-- 1️⃣ 确保底层时间戳列存在
-- ============================================================
-- 检查 users 表是否有 phone_verified_at 或 email_verified_at 字段
-- 如果都没有，则添加 email_verified_at 字段
DO $$
BEGIN
  -- 检查是否存在 phone_verified_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'phone_verified_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'email_verified_at'
  ) THEN
    -- 如果两个字段都不存在，添加 email_verified_at
    ALTER TABLE public.users
      ADD COLUMN email_verified_at timestamptz NULL;
    RAISE NOTICE 'Added email_verified_at column to users table';
  ELSE
    RAISE NOTICE 'phone_verified_at or email_verified_at already exists, using existing column';
  END IF;
END $$;

-- ============================================================
-- 2️⃣ 移除旧的 User 视图触发器（如果存在）
-- ============================================================
-- 删除视图上的触发器（如果存在）
DO $$
BEGIN
  -- 删除 INSERT 触发器
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname = 'User' AND c.relnamespace = 'public'::regnamespace
      AND t.tgname = 'user_view_insert_trigger'
  ) THEN
    DROP TRIGGER user_view_insert_trigger ON "User";
    RAISE NOTICE 'Dropped user_view_insert_trigger';
  END IF;

  -- 删除 UPDATE 触发器
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname = 'User' AND c.relnamespace = 'public'::regnamespace
      AND t.tgname = 'user_view_update_trigger'
  ) THEN
    DROP TRIGGER user_view_update_trigger ON "User";
    RAISE NOTICE 'Dropped user_view_update_trigger';
  END IF;

  -- 删除 DELETE 触发器（可更新视图支持 DELETE，但为了彻底清理，这里也删除）
  -- 注意：如果需要 DELETE 触发器，可以在 20251126_create_nextauth_view_triggers.sql 中重新创建
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname = 'User' AND c.relnamespace = 'public'::regnamespace
      AND t.tgname = 'user_view_delete_trigger'
  ) THEN
    DROP TRIGGER user_view_delete_trigger ON "User";
    RAISE NOTICE 'Dropped user_view_delete_trigger';
  END IF;
END $$;

-- 删除旧的触发器函数（如果存在）
DROP FUNCTION IF EXISTS user_view_insert() CASCADE;
DROP FUNCTION IF EXISTS user_view_update() CASCADE;
DROP FUNCTION IF EXISTS user_view_delete() CASCADE;

-- ============================================================
-- 3️⃣ 重建 "User" 视图，使用直接列映射（可更新视图）
-- ============================================================
-- 删除旧视图（CASCADE 会同时删除依赖的触发器）
DROP VIEW IF EXISTS "User" CASCADE;

-- 使用「可更新视图」的形式重建
-- 关键：emailVerified 使用直接列映射，类型为 timestamptz（时间戳）
-- 使用 phone_verified_at 直接映射到 emailVerified（不使用任何表达式）
CREATE VIEW "User" AS
SELECT
  u.id,
  u.name,
  u.email,
  -- 关键：直接列映射，不使用任何表达式（COALESCE、CASE 等）
  -- 这样 PostgreSQL 会把 "User" 视图当作「可更新视图」，允许对 emailVerified 做 INSERT/UPDATE
  u.phone_verified_at AS "emailVerified",
  NULL::text AS image, -- users 表没有 image 字段，使用 NULL
  u.created_at AS "createdAt",
  u.updated_at AS "updatedAt"
FROM public.users u;

COMMIT;

