-- ============================================================
-- 将 NextAuth 相关用户 ID 字段从 INTEGER 改为 TEXT
-- 文件名: 20251126_alter_users_and_auth_ids_to_text.sql
-- 说明: 统一 NextAuth v5 + KyselyAdapter 使用字符串 id（UUID），数据库相应改成文本类型
-- 日期: 2025-11-26
-- 数据库: drivequiz
-- ============================================================

BEGIN;

-- ============================================================
-- 0️⃣ 先删除依赖 users.id 的视图和触发器（必须在修改列类型之前）
-- ============================================================
-- 注意：PostgreSQL 不允许修改被视图或触发器依赖的列类型
-- 必须先删除视图和触发器，修改列类型，然后重新创建视图和触发器

-- 删除 NextAuth 视图触发器
-- 注意：使用 DO 块安全删除触发器，即使视图不存在也不会报错
DO $$
BEGIN
  -- 删除 Session 视图触发器（如果视图存在）
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'Session') THEN
    DROP TRIGGER IF EXISTS session_view_insert_trigger ON "Session";
    DROP TRIGGER IF EXISTS session_view_update_trigger ON "Session";
    DROP TRIGGER IF EXISTS session_view_delete_trigger ON "Session";
  END IF;

  -- 删除 Account 视图触发器（如果视图存在）
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'Account') THEN
    DROP TRIGGER IF EXISTS account_view_insert_trigger ON "Account";
    DROP TRIGGER IF EXISTS account_view_update_trigger ON "Account";
    DROP TRIGGER IF EXISTS account_view_delete_trigger ON "Account";
  END IF;

  -- 删除 User 视图触发器（如果视图存在）
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'User') THEN
    DROP TRIGGER IF EXISTS user_view_insert_trigger ON "User";
    DROP TRIGGER IF EXISTS user_view_update_trigger ON "User";
    DROP TRIGGER IF EXISTS user_view_delete_trigger ON "User";
  END IF;

  -- 删除 VerificationToken 视图触发器（如果视图存在）
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'VerificationToken') THEN
    DROP TRIGGER IF EXISTS verification_token_view_insert_trigger ON "VerificationToken";
    DROP TRIGGER IF EXISTS verification_token_view_update_trigger ON "VerificationToken";
    DROP TRIGGER IF EXISTS verification_token_view_delete_trigger ON "VerificationToken";
  END IF;
END $$;

-- 删除触发器函数（如果存在）
DROP FUNCTION IF EXISTS session_view_insert();
DROP FUNCTION IF EXISTS session_view_update();
DROP FUNCTION IF EXISTS session_view_delete();
DROP FUNCTION IF EXISTS account_view_insert();
DROP FUNCTION IF EXISTS account_view_update();
DROP FUNCTION IF EXISTS account_view_delete();
DROP FUNCTION IF EXISTS user_view_insert();
DROP FUNCTION IF EXISTS user_view_update();
DROP FUNCTION IF EXISTS user_view_delete();
DROP FUNCTION IF EXISTS verification_token_view_insert();
DROP FUNCTION IF EXISTS verification_token_view_update();
DROP FUNCTION IF EXISTS verification_token_view_delete();

-- 删除 NextAuth 视图
DROP VIEW IF EXISTS "User";
DROP VIEW IF EXISTS "Account";
DROP VIEW IF EXISTS "Session";
DROP VIEW IF EXISTS "VerificationToken";

-- ============================================================
-- 1️⃣ 先删除所有引用 users.id 的外键约束（必须在修改 users.id 类型之前）
-- ============================================================
-- 注意：PostgreSQL 不允许修改被外键约束引用的列类型
-- 必须先删除所有外键约束，修改类型，然后重新添加外键约束

DO $$
BEGIN
  -- 删除 oauth_accounts 的外键约束
  BEGIN
    ALTER TABLE public.oauth_accounts
      DROP CONSTRAINT IF EXISTS oauth_accounts_user_id_fkey;
    RAISE NOTICE 'Dropped foreign key oauth_accounts_user_id_fkey (if existed)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop oauth_accounts_user_id_fkey: %', SQLERRM;
  END;
  
  -- 删除 sessions 的外键约束
  BEGIN
    ALTER TABLE public.sessions
      DROP CONSTRAINT IF EXISTS sessions_user_id_fkey;
    RAISE NOTICE 'Dropped foreign key sessions_user_id_fkey (if existed)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop sessions_user_id_fkey: %', SQLERRM;
  END;
  
  -- 删除 user_profiles 的外键约束
  BEGIN
    ALTER TABLE public.user_profiles
      DROP CONSTRAINT IF EXISTS user_profiles_user_id_fkey;
    RAISE NOTICE 'Dropped foreign key user_profiles_user_id_fkey (if existed)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop user_profiles_user_id_fkey: %', SQLERRM;
  END;
  
  -- 删除 user_interests 的外键约束
  BEGIN
    ALTER TABLE public.user_interests
      DROP CONSTRAINT IF EXISTS user_interests_user_id_fkey;
    RAISE NOTICE 'Dropped foreign key user_interests_user_id_fkey (if existed)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop user_interests_user_id_fkey: %', SQLERRM;
  END;
  
  -- 删除 user_behaviors 的外键约束
  BEGIN
    ALTER TABLE public.user_behaviors
      DROP CONSTRAINT IF EXISTS user_behaviors_user_id_fkey;
    RAISE NOTICE 'Dropped foreign key user_behaviors_user_id_fkey (if existed)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop user_behaviors_user_id_fkey: %', SQLERRM;
  END;
  
  -- 删除 ad_logs 的外键约束
  BEGIN
    ALTER TABLE public.ad_logs
      DROP CONSTRAINT IF EXISTS ad_logs_user_id_fkey;
    RAISE NOTICE 'Dropped foreign key ad_logs_user_id_fkey (if existed)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop ad_logs_user_id_fkey: %', SQLERRM;
  END;
  
  -- 删除 service_reviews 的外键约束
  BEGIN
    ALTER TABLE public.service_reviews
      DROP CONSTRAINT IF EXISTS service_reviews_user_id_fkey;
    RAISE NOTICE 'Dropped foreign key service_reviews_user_id_fkey (if existed)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop service_reviews_user_id_fkey: %', SQLERRM;
  END;
END $$;

-- ============================================================
-- 2️⃣ users.id 从 INTEGER 改为 TEXT
-- ============================================================
DO $$
BEGIN
  -- 删除 users.id 的默认值和序列（如果存在）
  ALTER TABLE public.users
    ALTER COLUMN id DROP DEFAULT;
  
  DROP SEQUENCE IF EXISTS users_id_seq;
  
  -- 将 id 从 INTEGER 改为 TEXT
  -- 使用 USING 子句将现有数字 ID 转换为字符串
  ALTER TABLE public.users
    ALTER COLUMN id TYPE text USING id::text;
  
  RAISE NOTICE 'Changed users.id from INTEGER to TEXT';
END $$;

-- ============================================================
-- 3️⃣ oauth_accounts.user_id 从 INTEGER 改为 TEXT
-- ============================================================
DO $$
BEGIN
  -- 将 user_id 从 INTEGER 改为 TEXT
  ALTER TABLE public.oauth_accounts
    ALTER COLUMN user_id TYPE text USING user_id::text;
  
  -- 重新添加外键约束
  ALTER TABLE public.oauth_accounts
    ADD CONSTRAINT oauth_accounts_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  
  RAISE NOTICE 'Changed oauth_accounts.user_id from INTEGER to TEXT';
END $$;

-- ============================================================
-- 4️⃣ sessions.user_id 从 INTEGER 改为 TEXT
-- ============================================================
DO $$
BEGIN
  -- 将 user_id 从 INTEGER 改为 TEXT
  ALTER TABLE public.sessions
    ALTER COLUMN user_id TYPE text USING user_id::text;
  
  -- 重新添加外键约束
  ALTER TABLE public.sessions
    ADD CONSTRAINT sessions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  
  RAISE NOTICE 'Changed sessions.user_id from INTEGER to TEXT';
END $$;

-- ============================================================
-- 5️⃣ user_profiles.user_id 从 INTEGER 改为 TEXT
-- ============================================================
DO $$
BEGIN
  -- 先删除唯一约束（外键约束已在步骤 1 中删除）
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_user_id_unique'
  ) THEN
    ALTER TABLE public.user_profiles
      DROP CONSTRAINT user_profiles_user_id_unique;
  END IF;
  
  -- 将 user_id 从 INTEGER 改为 TEXT
  ALTER TABLE public.user_profiles
    ALTER COLUMN user_id TYPE text USING user_id::text;
  
  -- 重新添加外键约束和唯一约束
  ALTER TABLE public.user_profiles
    ADD CONSTRAINT user_profiles_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  
  ALTER TABLE public.user_profiles
    ADD CONSTRAINT user_profiles_user_id_unique
    UNIQUE (user_id);
  
  RAISE NOTICE 'Changed user_profiles.user_id from INTEGER to TEXT';
END $$;

-- ============================================================
-- 6️⃣ user_interests.user_id 从 INTEGER 改为 TEXT
-- ============================================================
DO $$
BEGIN
  -- 先删除唯一约束（外键约束已在步骤 1 中删除）
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_interests_user_id_unique'
  ) THEN
    ALTER TABLE public.user_interests
      DROP CONSTRAINT user_interests_user_id_unique;
  END IF;
  
  -- 将 user_id 从 INTEGER 改为 TEXT
  ALTER TABLE public.user_interests
    ALTER COLUMN user_id TYPE text USING user_id::text;
  
  -- 重新添加外键约束和唯一约束
  ALTER TABLE public.user_interests
    ADD CONSTRAINT user_interests_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  
  ALTER TABLE public.user_interests
    ADD CONSTRAINT user_interests_user_id_unique
    UNIQUE (user_id);
  
  RAISE NOTICE 'Changed user_interests.user_id from INTEGER to TEXT';
END $$;

-- ============================================================
-- 7️⃣ user_behaviors.user_id 从 INTEGER 改为 TEXT
-- ============================================================
DO $$
BEGIN
  -- 将 user_id 从 INTEGER 改为 TEXT（外键约束已在步骤 1 中删除）
  ALTER TABLE public.user_behaviors
    ALTER COLUMN user_id TYPE text USING user_id::text;
  
  -- 重新添加外键约束
  ALTER TABLE public.user_behaviors
    ADD CONSTRAINT user_behaviors_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  
  RAISE NOTICE 'Changed user_behaviors.user_id from INTEGER to TEXT';
END $$;

-- ============================================================
-- 8️⃣ ad_logs.user_id 从 INTEGER 改为 TEXT（可为 NULL）
-- ============================================================
DO $$
BEGIN
  -- 将 user_id 从 INTEGER 改为 TEXT（外键约束已在步骤 1 中删除）
  ALTER TABLE public.ad_logs
    ALTER COLUMN user_id TYPE text USING 
      CASE 
        WHEN user_id IS NULL THEN NULL
        ELSE user_id::text
      END;
  
  -- 重新添加外键约束（如果 user_id 不为 NULL，则关联到 users.id）
  -- 注意：PostgreSQL 不支持部分外键约束，所以这里只添加普通外键
  ALTER TABLE public.ad_logs
    ADD CONSTRAINT ad_logs_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
  
  RAISE NOTICE 'Changed ad_logs.user_id from INTEGER to TEXT';
END $$;

-- ============================================================
-- 9️⃣ service_reviews.user_id 从 INTEGER 改为 TEXT（可为 NULL）
-- ============================================================
DO $$
BEGIN
  -- 将 user_id 从 INTEGER 改为 TEXT（外键约束已在步骤 1 中删除）
  ALTER TABLE public.service_reviews
    ALTER COLUMN user_id TYPE text USING 
      CASE 
        WHEN user_id IS NULL THEN NULL
        ELSE user_id::text
      END;
  
  -- 重新添加外键约束（如果 user_id 不为 NULL，则关联到 users.id）
  ALTER TABLE public.service_reviews
    ADD CONSTRAINT service_reviews_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
  
  RAISE NOTICE 'Changed service_reviews.user_id from INTEGER to TEXT';
END $$;

-- ============================================================
-- 🔟 更新 NextAuth 视图，确保 userId 字段类型正确
-- ============================================================
-- 重新创建 Account 视图（user_id 已经是 text 类型）
-- 注意：使用驼峰命名，与 KyselyAdapter 查询一致
-- 写入时，KyselyAdapter 传入的对象可能使用下划线命名（来自 TokenEndpointResponse），
-- 但触发器会处理这种映射
DROP VIEW IF EXISTS "Account";
CREATE VIEW "Account" AS
SELECT 
  id::text as id,
  user_id::text as "userId", -- 使用驼峰命名，与 KyselyAdapter 查询一致
  provider,
  provider_account_id as "providerAccountId", -- 使用驼峰命名，与 KyselyAdapter 查询一致
  access_token as "accessToken", -- 使用驼峰命名，与 KyselyAdapter 查询一致
  refresh_token as "refreshToken", -- 使用驼峰命名
  expires_at as "expiresAt", -- 使用驼峰命名
  token_type as "tokenType", -- 使用驼峰命名
  scope,
  id_token as "idToken", -- 使用驼峰命名
  session_state as "sessionState", -- 使用驼峰命名
  created_at as "createdAt", -- 使用驼峰命名
  updated_at as "updatedAt" -- 使用驼峰命名
FROM oauth_accounts;

-- 重新创建 Session 视图（userId 已经是 text 类型）
DROP VIEW IF EXISTS "Session";
CREATE VIEW "Session" AS
SELECT 
  id,
  session_token as "sessionToken",
  user_id as "userId", -- 现在 user_id 已经是 text 类型，不需要转换
  expires,
  created_at as "createdAt",
  updated_at as "updatedAt"
FROM sessions;

-- 重新创建 User 视图（id 已经是 text 类型）
-- 注意：emailVerified 使用简单表达式，方便触发器写入
DROP VIEW IF EXISTS "User";
CREATE VIEW "User" AS
SELECT 
  id as id, -- 现在 id 已经是 text 类型，不需要转换
  name,
  email,
  -- 关键：使用简单表达式映射 phone_verified_at 到 emailVerified
  (phone_verified_at IS NOT NULL)::boolean as "emailVerified",
  NULL::text as image,
  created_at as "createdAt",
  updated_at as "updatedAt"
FROM users;

-- 重新创建 VerificationToken 视图
DROP VIEW IF EXISTS "VerificationToken";
CREATE VIEW "VerificationToken" AS
SELECT 
  identifier,
  token,
  expires
FROM verification_tokens;

COMMIT;

