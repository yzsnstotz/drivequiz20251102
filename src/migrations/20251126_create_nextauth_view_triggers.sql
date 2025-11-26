-- ============================================================
-- NextAuth 视图触发器脚本
-- 文件名: 20251126_create_nextauth_view_triggers.sql
-- 说明: 为 NextAuth 视图创建 INSTEAD OF 触发器，支持 INSERT/UPDATE/DELETE
-- 日期: 2025-11-26
-- 数据库: drivequiz
-- ============================================================
-- 
-- 执行顺序说明（⚠️ 重要：必须按顺序执行）：
-- 1. 先执行 20251126_alter_users_and_auth_ids_to_text.sql
-- 2. 再执行 20251126_create_nextauth_table_views.sql（⚠️ 必须先执行此脚本创建视图）
-- 3. 执行 20251126_fix_user_view_emailverified_timestamp.sql（会移除 User 视图的触发器）
-- 4. 最后执行本文件：20251126_create_nextauth_view_triggers.sql
-- 
-- 注意：
-- - User 视图不再需要触发器（使用可更新视图），但其他视图（Session、Account、VerificationToken）仍需要触发器
-- - 如果执行本脚本时出现 "relation does not exist" 错误，请先执行 20251126_create_nextauth_table_views.sql 创建视图
-- - 本脚本会在开头检查所有必需的视图是否存在，如果缺失会给出明确的错误提示
-- ============================================================

BEGIN;

-- ============================================================
-- 0️⃣ 检查必需的视图是否存在
-- ============================================================
DO $$
DECLARE
  missing_views TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- 检查 Session 视图
  IF NOT EXISTS (
    SELECT 1 FROM pg_views 
    WHERE schemaname = 'public' AND viewname = 'Session'
  ) THEN
    missing_views := array_append(missing_views, 'Session');
  END IF;

  -- 检查 Account 视图
  IF NOT EXISTS (
    SELECT 1 FROM pg_views 
    WHERE schemaname = 'public' AND viewname = 'Account'
  ) THEN
    missing_views := array_append(missing_views, 'Account');
  END IF;

  -- 检查 VerificationToken 视图
  IF NOT EXISTS (
    SELECT 1 FROM pg_views 
    WHERE schemaname = 'public' AND viewname = 'VerificationToken'
  ) THEN
    missing_views := array_append(missing_views, 'VerificationToken');
  END IF;

  -- 如果有缺失的视图，抛出错误
  IF array_length(missing_views, 1) > 0 THEN
    RAISE EXCEPTION '以下视图不存在，请先执行 20251126_create_nextauth_table_views.sql 创建视图: %', 
      array_to_string(missing_views, ', ');
  END IF;
END $$;

-- ============================================================
-- 1️⃣ 为 Session 视图创建 INSTEAD OF 触发器
-- ============================================================

-- 删除已存在的触发器（如果存在）
DROP TRIGGER IF EXISTS session_view_insert_trigger ON "Session";
DROP TRIGGER IF EXISTS session_view_update_trigger ON "Session";
DROP TRIGGER IF EXISTS session_view_delete_trigger ON "Session";

-- INSERT 触发器
CREATE OR REPLACE FUNCTION session_view_insert()
RETURNS TRIGGER AS $$
DECLARE
  session_id VARCHAR(255);
BEGIN
  -- 如果 NextAuth 没有提供 id，自动生成 UUID
  -- 使用 gen_random_uuid()（PostgreSQL 13+，内置函数，不需要扩展）
  -- Supabase 使用 PostgreSQL 14+，支持此函数
  IF NEW.id IS NULL OR NEW.id = '' THEN
    session_id := gen_random_uuid()::text;
  ELSE
    session_id := NEW.id;
  END IF;

  INSERT INTO sessions (
    id,
    session_token,
    user_id,
    expires,
    created_at,
    updated_at
  ) VALUES (
    session_id, -- 使用生成的或提供的 id
    NEW."sessionToken",
    NEW."userId", -- ✅ user_id 现在已经是 text 类型，不需要转换
    NEW.expires,
    COALESCE(NEW."createdAt", NOW()),
    COALESCE(NEW."updatedAt", NOW())
  );
  
  -- 更新 NEW.id，确保返回值包含正确的 id
  NEW.id := session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER session_view_insert_trigger
  INSTEAD OF INSERT ON "Session"
  FOR EACH ROW
  EXECUTE FUNCTION session_view_insert();

-- UPDATE 触发器
CREATE OR REPLACE FUNCTION session_view_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE sessions SET
    session_token = NEW."sessionToken",
    user_id = NEW."userId", -- ✅ user_id 现在已经是 text 类型，不需要转换
    expires = NEW.expires,
    updated_at = COALESCE(NEW."updatedAt", NOW())
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER session_view_update_trigger
  INSTEAD OF UPDATE ON "Session"
  FOR EACH ROW
  EXECUTE FUNCTION session_view_update();

-- DELETE 触发器
CREATE OR REPLACE FUNCTION session_view_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM sessions WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER session_view_delete_trigger
  INSTEAD OF DELETE ON "Session"
  FOR EACH ROW
  EXECUTE FUNCTION session_view_delete();

-- ============================================================
-- 2️⃣ 为 Account 视图创建 INSTEAD OF 触发器
-- ============================================================

-- 删除已存在的触发器（如果存在）
DROP TRIGGER IF EXISTS account_view_insert_trigger ON "Account";
DROP TRIGGER IF EXISTS account_view_update_trigger ON "Account";
DROP TRIGGER IF EXISTS account_view_delete_trigger ON "Account";

-- INSERT 触发器
CREATE OR REPLACE FUNCTION account_view_insert()
RETURNS TRIGGER AS $$
DECLARE
  new_id INTEGER;
BEGIN
  INSERT INTO oauth_accounts (
    user_id,
    provider,
    provider_account_id,
    access_token,
    refresh_token,
    expires_at,
    token_type,
    scope,
    id_token,
    session_state,
    created_at,
    updated_at
  ) VALUES (
    COALESCE(NEW."userId", NEW.user_id), -- 支持驼峰命名（userId）或下划线命名（user_id）
    NEW.provider,
    COALESCE(NEW."providerAccountId", NEW.provider_account_id), -- 支持驼峰命名或下划线命名
    COALESCE(NEW."accessToken", NEW.access_token), -- 支持驼峰命名或下划线命名
    COALESCE(NEW."refreshToken", NEW.refresh_token), -- 支持驼峰命名或下划线命名
    COALESCE(NEW."expiresAt", NEW.expires_at), -- 支持驼峰命名或下划线命名
    COALESCE(NEW."tokenType", NEW.token_type), -- 支持驼峰命名或下划线命名
    NEW.scope,
    COALESCE(NEW."idToken", NEW.id_token), -- 支持驼峰命名或下划线命名
    COALESCE(NEW."sessionState", NEW.session_state), -- 支持驼峰命名或下划线命名
    COALESCE(NEW."createdAt", NEW.created_at, NOW()), -- 支持驼峰命名或下划线命名
    COALESCE(NEW."updatedAt", NEW.updated_at, NOW()) -- 支持驼峰命名或下划线命名
  )
  RETURNING id INTO new_id;
  
  -- 返回包含新 ID 的记录
  NEW.id := new_id::text;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER account_view_insert_trigger
  INSTEAD OF INSERT ON "Account"
  FOR EACH ROW
  EXECUTE FUNCTION account_view_insert();

-- UPDATE 触发器
CREATE OR REPLACE FUNCTION account_view_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE oauth_accounts SET
    user_id = COALESCE(NEW."userId", NEW.user_id), -- 支持驼峰命名（userId）或下划线命名（user_id）
    provider = NEW.provider,
    provider_account_id = COALESCE(NEW."providerAccountId", NEW.provider_account_id), -- 支持驼峰命名或下划线命名
    access_token = COALESCE(NEW."accessToken", NEW.access_token), -- 支持驼峰命名或下划线命名
    refresh_token = COALESCE(NEW."refreshToken", NEW.refresh_token), -- 支持驼峰命名或下划线命名
    expires_at = COALESCE(NEW."expiresAt", NEW.expires_at), -- 支持驼峰命名或下划线命名
    token_type = COALESCE(NEW."tokenType", NEW.token_type), -- 支持驼峰命名或下划线命名
    scope = NEW.scope,
    id_token = COALESCE(NEW."idToken", NEW.id_token), -- 支持驼峰命名或下划线命名
    session_state = COALESCE(NEW."sessionState", NEW.session_state), -- 支持驼峰命名或下划线命名
    updated_at = COALESCE(NEW."updatedAt", NEW.updated_at, NOW()) -- 支持驼峰命名或下划线命名
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER account_view_update_trigger
  INSTEAD OF UPDATE ON "Account"
  FOR EACH ROW
  EXECUTE FUNCTION account_view_update();

-- DELETE 触发器
CREATE OR REPLACE FUNCTION account_view_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM oauth_accounts WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER account_view_delete_trigger
  INSTEAD OF DELETE ON "Account"
  FOR EACH ROW
  EXECUTE FUNCTION account_view_delete();

-- ============================================================
-- 3️⃣ 为 User 视图创建 INSTEAD OF 触发器
-- ============================================================
-- 
-- ⚠️ 注意：如果已执行 20251126_fix_user_view_emailverified_timestamp.sql，
-- User 视图现在使用可更新视图（直接列映射），不再需要 INSERT/UPDATE 触发器
-- 本节的触发器代码会被 20251126_fix_user_view_emailverified_timestamp.sql 移除
-- 保留 DELETE 触发器，因为 DELETE 操作不涉及列映射

-- 删除已存在的触发器（如果存在，由 20251126_fix_user_view_emailverified_timestamp.sql 处理）
-- 这里仅作为向后兼容保留，实际执行时会检查视图定义
DROP TRIGGER IF EXISTS user_view_insert_trigger ON "User";
DROP TRIGGER IF EXISTS user_view_update_trigger ON "User";
DROP TRIGGER IF EXISTS user_view_delete_trigger ON "User";

-- INSERT 触发器
CREATE OR REPLACE FUNCTION user_view_insert()
RETURNS TRIGGER AS $$
DECLARE
  email_verified_value timestamptz;
BEGIN
  -- 关键：处理两种类型（boolean 或 timestamp）
  -- 如果 emailVerified 是 timestamp 类型，直接使用；如果是 boolean，转换为 timestamp
  IF NEW."emailVerified" IS NULL THEN
    email_verified_value := NULL;
  ELSIF pg_typeof(NEW."emailVerified")::text LIKE '%timestamp%' THEN
    email_verified_value := NEW."emailVerified";
  ELSE
    -- 尝试作为 boolean 处理
    BEGIN
      IF NEW."emailVerified"::boolean = true THEN
        email_verified_value := NOW();
      ELSE
        email_verified_value := NULL;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- 如果转换失败，设为 NULL
      email_verified_value := NULL;
    END;
  END IF;

  INSERT INTO users (
    id,
    name,
    email,
    phone_verified_at, -- 关键：从视图列 emailVerified 写入基础表列 phone_verified_at
    created_at,
    updated_at
  ) VALUES (
    NEW.id, -- ✅ id 现在已经是 text 类型，不需要转换
    NEW.name,
    -- 关键：如果 email 为 NULL，生成一个默认 email（用于 LINE 等不提供 email 的 OAuth 提供商）
    COALESCE(NEW.email, 'oauth-' || NEW.id || '@oauth.local'),
    email_verified_value,
    COALESCE(NEW."createdAt", NOW()),
    COALESCE(NEW."updatedAt", NOW())
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_view_insert_trigger
  INSTEAD OF INSERT ON "User"
  FOR EACH ROW
  EXECUTE FUNCTION user_view_insert();

-- UPDATE 触发器
CREATE OR REPLACE FUNCTION user_view_update()
RETURNS TRIGGER AS $$
DECLARE
  email_verified_value timestamptz;
BEGIN
  -- 关键：处理两种类型（boolean 或 timestamp）
  -- 如果 emailVerified 是 timestamp 类型，直接使用；如果是 boolean，转换为 timestamp
  IF NEW."emailVerified" IS NULL THEN
    email_verified_value := NULL;
  ELSIF pg_typeof(NEW."emailVerified")::text LIKE '%timestamp%' THEN
    email_verified_value := NEW."emailVerified";
  ELSE
    -- 尝试作为 boolean 处理
    BEGIN
      IF NEW."emailVerified"::boolean = true THEN
        -- 获取当前值，如果为 NULL 则使用 NOW()
        SELECT COALESCE(phone_verified_at, NOW()) INTO email_verified_value
        FROM users WHERE id = OLD.id;
      ELSE
        email_verified_value := NULL;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- 如果转换失败，设为 NULL
      email_verified_value := NULL;
    END;
  END IF;

  UPDATE users SET
    name = NEW.name,
    -- 关键：如果 email 为 NULL，保持原有 email（不更新为 NULL）
    email = COALESCE(NEW.email, users.email),
    phone_verified_at = email_verified_value,
    updated_at = COALESCE(NEW."updatedAt", NOW())
  WHERE id = OLD.id; -- ✅ id 现在已经是 text 类型，不需要转换
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_view_update_trigger
  INSTEAD OF UPDATE ON "User"
  FOR EACH ROW
  EXECUTE FUNCTION user_view_update();

-- DELETE 触发器
CREATE OR REPLACE FUNCTION user_view_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM users WHERE id = OLD.id; -- ✅ id 现在已经是 text 类型，不需要转换
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_view_delete_trigger
  INSTEAD OF DELETE ON "User"
  FOR EACH ROW
  EXECUTE FUNCTION user_view_delete();

-- ============================================================
-- 4️⃣ 为 VerificationToken 视图创建 INSTEAD OF 触发器
-- ============================================================

-- 删除已存在的触发器（如果存在）
DROP TRIGGER IF EXISTS verification_token_view_insert_trigger ON "VerificationToken";
DROP TRIGGER IF EXISTS verification_token_view_update_trigger ON "VerificationToken";
DROP TRIGGER IF EXISTS verification_token_view_delete_trigger ON "VerificationToken";

-- INSERT 触发器
CREATE OR REPLACE FUNCTION verification_token_view_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO verification_tokens (
    identifier,
    token,
    expires
  ) VALUES (
    NEW.identifier,
    NEW.token,
    NEW.expires
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER verification_token_view_insert_trigger
  INSTEAD OF INSERT ON "VerificationToken"
  FOR EACH ROW
  EXECUTE FUNCTION verification_token_view_insert();

-- UPDATE 触发器
CREATE OR REPLACE FUNCTION verification_token_view_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE verification_tokens SET
    token = NEW.token,
    expires = NEW.expires
  WHERE identifier = OLD.identifier AND token = OLD.token;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER verification_token_view_update_trigger
  INSTEAD OF UPDATE ON "VerificationToken"
  FOR EACH ROW
  EXECUTE FUNCTION verification_token_view_update();

-- DELETE 触发器
CREATE OR REPLACE FUNCTION verification_token_view_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM verification_tokens 
  WHERE identifier = OLD.identifier AND token = OLD.token;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER verification_token_view_delete_trigger
  INSTEAD OF DELETE ON "VerificationToken"
  FOR EACH ROW
  EXECUTE FUNCTION verification_token_view_delete();

COMMIT;

