-- ============================================================
-- NextAuth 表名视图映射脚本
-- 文件名: 20251126_create_nextauth_table_views.sql
-- 说明: 创建视图，将 NextAuth adapter 期望的表名映射到实际表
-- 日期: 2025-11-26
-- 数据库: drivequiz
-- ============================================================
-- 
-- 执行顺序说明：
-- 1. 先执行 20251126_alter_users_and_auth_ids_to_text.sql
-- 2. 再执行本文件：20251126_create_nextauth_table_views.sql
-- 3. 最后执行：20251126_create_nextauth_view_triggers.sql
-- ============================================================

BEGIN;

-- ============================================================
-- 1️⃣ 创建 User 视图（映射到 users 表）
-- 注意：users 表使用 phone_verified_at 字段映射到 emailVerified
-- NextAuth adapter 期望字段名为驼峰命名
-- 注意：如果视图已存在且列名不同，需要先删除再创建
-- ============================================================
-- 先删除旧视图，避免结构不一致
DROP VIEW IF EXISTS "User";

-- 重新创建 NextAuth 用的 User 视图
-- 关键：emailVerified 使用简单列映射，方便触发器写入
CREATE VIEW "User" AS
SELECT 
  id as id, -- users.id 已经是 text 类型，不需要转换
  name,
  email,
  -- 关键：直接把基础表里的 phone_verified_at 映射为视图的 "emailVerified"
  -- 使用简单表达式，确保触发器可以写入
  (phone_verified_at IS NOT NULL)::boolean as "emailVerified",
  NULL::text as image, -- users 表没有 image 字段，使用 NULL
  created_at as "createdAt", -- NextAuth 期望 createdAt（驼峰命名）
  updated_at as "updatedAt" -- NextAuth 期望 updatedAt（驼峰命名）
FROM users;

-- ============================================================
-- 2️⃣ 创建 Account 视图（映射到 oauth_accounts 表）
-- 注意：NextAuth adapter 期望字段名为 userId（驼峰），但表使用 user_id（下划线）
-- 注意：如果视图已存在且列名不同，需要先删除再创建
-- ============================================================
DROP VIEW IF EXISTS "Account";
CREATE VIEW "Account" AS
SELECT 
  id::text as id, -- NextAuth 期望 id 为字符串
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

-- ============================================================
-- 3️⃣ 创建 Session 视图（映射到 sessions 表）
-- NextAuth adapter 期望字段名为驼峰命名
-- 注意：如果视图已存在且列名不同，需要先删除再创建
-- ============================================================
DROP VIEW IF EXISTS "Session";
CREATE VIEW "Session" AS
SELECT 
  id,
  session_token as "sessionToken", -- NextAuth 期望 sessionToken（驼峰命名）
  user_id::text as "userId", -- NextAuth 期望 userId（驼峰命名），映射自 user_id
  expires,
  created_at as "createdAt", -- NextAuth 期望 createdAt（驼峰命名）
  updated_at as "updatedAt" -- NextAuth 期望 updatedAt（驼峰命名）
FROM sessions;

-- ============================================================
-- 4️⃣ 创建 VerificationToken 视图（映射到 verification_tokens 表）
-- 注意：如果视图已存在且列名不同，需要先删除再创建
-- ============================================================
DROP VIEW IF EXISTS "VerificationToken";
CREATE VIEW "VerificationToken" AS
SELECT 
  identifier,
  token,
  expires
FROM verification_tokens;

COMMIT;

