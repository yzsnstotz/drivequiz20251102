# 剩余安全问题修复指南

## 📋 概述

本文档说明如何处理 Supabase 建议的剩余安全问题。

## ✅ 已修复的问题

### 1. 函数 search_path 安全问题

**状态**: ✅ 已修复（代码更新完成，需要执行迁移脚本）

**迁移脚本**: 
- `src/migrations/20251111_fix_function_search_path.sql` - AI 数据库中的函数
- `src/migrations/20251111_fix_remaining_function_search_path.sql` - 主数据库中的函数

**修复的函数**:
- ✅ `match_documents` - 向量相似度检索函数（已更新原始创建脚本）
- ✅ `update_users_updated_at` - 自动更新 users 表的 updated_at 字段
- ✅ `update_user_last_login` - 自动更新 users 表的 last_login_at 字段
- ✅ `ai_filters_audit_trigger` - AI filters 审计触发器函数

**修复方法**: 为所有函数添加 `SET search_path = public`，确保使用固定的搜索路径。

**更新的脚本**:
- `src/migrations/20250115_create_match_documents_rpc.sql` - 已更新包含 search_path
- `src/migrations/20251103_ai_rpc.sql` - 已更新包含 search_path

**验证脚本**: `scripts/verify-security-fixes.sql` - 用于验证修复状态

---

### 2. Multiple Permissive Policies 性能问题

**状态**: ✅ 已修复（迁移脚本已创建，需要执行）

**问题**: 多个表存在多个 permissive 策略用于相同的角色和操作（SELECT），导致性能问题。每个策略都需要在每次查询时评估。

**影响评估**:
- ⚠️ **安全风险**: 无（不影响安全性）
- 📊 **影响范围**: 所有表的 SELECT 操作性能
- 🔧 **修复难度**: 低（只需修改策略定义）

**修复方法**: 将 `service_write` 策略从 `FOR ALL` 改为 `FOR INSERT, UPDATE, DELETE`，排除 SELECT 操作。这样 SELECT 操作只由读策略处理，写操作只由写策略处理，避免策略重叠。

**迁移脚本**: 
- `src/migrations/20251111_fix_multiple_permissive_policies.sql` - 主数据库（11个表）
- `src/migrations/20251111_fix_multiple_permissive_policies_ai.sql` - AI 数据库（2个表）

**修复的表**:
- ✅ `activation_codes` - 激活码表
- ✅ `activations` - 激活记录表
- ✅ `admins` - 管理员表
- ✅ `contact_info` - 联系信息表
- ✅ `merchant_categories` - 商户类别表
- ✅ `merchants` - 商户表
- ✅ `operation_logs` - 操作日志表
- ✅ `terms_of_service` - 服务条款表
- ✅ `user_behaviors` - 用户行为表
- ✅ `users` - 用户表
- ✅ `videos` - 视频表

**执行步骤**:
1. **主数据库**: 在 Supabase SQL Editor 中选择主数据库，执行 `20251111_fix_multiple_permissive_policies.sql`
2. **AI 数据库**: 在 Supabase SQL Editor 中选择 ZALEM AI Service 数据库，执行 `20251111_fix_multiple_permissive_policies_ai.sql`
3. 验证修复结果（使用迁移脚本中的验证查询）

**注意**: AI 相关表（`ai_config`, `ai_filters_history`）在 AI 数据库中，需要单独执行 AI 数据库的迁移脚本。

**验证查询**:

**主数据库验证**:
```sql
-- 检查策略是否已正确更新（应该显示 FOR INSERT, UPDATE, DELETE）
SELECT 
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename IN (
  'activation_codes', 'activations', 'admins', 'contact_info',
  'merchant_categories', 'merchants', 'operation_logs', 'terms_of_service',
  'user_behaviors', 'users', 'videos'
)
AND policyname LIKE '%service_write%'
ORDER BY tablename;

-- 检查是否还有 multiple permissive policies（应该没有结果）
SELECT 
  tablename,
  cmd,
  COUNT(*) as policy_count
FROM pg_policies
WHERE tablename IN (
  'activation_codes', 'activations', 'admins', 'contact_info',
  'merchant_categories', 'merchants', 'operation_logs', 'terms_of_service',
  'user_behaviors', 'users', 'videos'
)
GROUP BY tablename, cmd
HAVING COUNT(*) > 1
ORDER BY tablename, cmd;
```

**AI 数据库验证**:
```sql
-- 检查策略是否已正确更新
SELECT 
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename IN ('ai_config', 'ai_filters_history')
AND policyname LIKE '%service_write%'
ORDER BY tablename;

-- 检查是否还有 multiple permissive policies（应该没有结果）
SELECT 
  tablename,
  cmd,
  COUNT(*) as policy_count
FROM pg_policies
WHERE tablename IN ('ai_config', 'ai_filters_history')
GROUP BY tablename, cmd
HAVING COUNT(*) > 1
ORDER BY tablename, cmd;
```

---

## ⚠️ 需要手动处理的问题

### 3. Vector 扩展在 public schema

**状态**: ⚠️ 可选修复（低优先级）

**问题**: Extension `vector` is installed in the public schema. Move it to another schema.

**影响评估**:
- ⚠️ **安全风险**: 低（主要是命名空间污染）
- 📊 **影响范围**: 小（扩展本身，不影响数据安全）
- 🔧 **修复难度**: 中等（需要迁移扩展）

**建议**: ⚪ **可选修复** - 可以保留在 public schema，不影响核心安全

**迁移脚本**: `src/migrations/20251111_move_vector_extension.sql`

**如果要修复，可以执行以下步骤**:

1. **备份数据库**（重要！）
2. **在测试环境先验证**（推荐）
3. **执行迁移脚本**:
   ```bash
   # 在 Supabase SQL Editor 中执行
   # 或使用 psql 执行迁移脚本
   psql -f src/migrations/20251111_move_vector_extension.sql
   ```

**迁移脚本功能**:
- 创建 `extensions` schema（如果不存在）
- 将 `vector` 扩展从 `public` schema 迁移到 `extensions` schema
- 更新数据库 `search_path` 以包含 `extensions` schema
- 验证迁移结果

**⚠️ 注意事项**:
- 迁移扩展可能需要重新创建相关对象
- 确保所有使用 vector 类型的表和函数正常工作
- 建议先在测试环境验证
- 迁移后需要验证所有使用 `vector` 类型的表和函数仍然正常工作

---

### 4. Auth 泄露密码保护未启用

**状态**: ⚠️ 需要在 Supabase Dashboard 中配置（高优先级）

**问题**: Leaked password protection is currently disabled.

**影响评估**:
- ✅ **安全风险**: 中（用户可能使用已泄露的密码）
- 📊 **影响范围**: 所有用户密码
- 🔧 **修复难度**: 低（只需在 Dashboard 中启用）

**建议**: ✅ **应该立即启用** - 增强密码安全性，防止用户使用已泄露的密码

**修复步骤**:

1. **登录 Supabase Dashboard**
   - 访问: https://supabase.com/dashboard
   - 登录你的账户
   - 选择你的项目

2. **进入 Authentication 设置**
   - 在左侧菜单中，点击 **Authentication**
   - 然后点击 **Settings** 或 **Policies** 标签
   - 或者直接访问: **Settings** → **Auth**

3. **找到 Password Security 设置**
   - 在 Authentication Settings 页面中，找到 **Password Security** 部分
   - 或者查找 **Leaked Password Protection** 选项

4. **启用泄露密码保护**
   - 找到 **"Check against HaveIBeenPwned"** 选项
   - 启用该选项（切换开关到 ON）
   - 点击 **Save** 或 **Update** 保存设置

5. **验证设置**
   - 尝试创建一个使用已知泄露密码的账户（例如: `password123` 或 `12345678`）
   - 应该被拒绝并提示密码已泄露
   - 错误信息类似: "Password has been found in a data breach"

**详细配置路径**:
```
Supabase Dashboard
  └─ 选择项目
      └─ Authentication (左侧菜单)
          └─ Settings 标签
              └─ Password Security 部分
                  └─ Enable "Check against HaveIBeenPwned"
```

**参考文档**: 
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- https://haveibeenpwned.com/API/v3 - HaveIBeenPwned API 文档

---

## 📝 修复优先级总结

| 问题 | 优先级 | 状态 | 修复方式 | 脚本位置 |
|------|--------|------|----------|----------|
| match_documents search_path | 高 | ✅ 已修复 | 迁移脚本 | `20251111_fix_function_search_path.sql` |
| update_users_updated_at search_path | 高 | ✅ 已修复 | 迁移脚本 | `20251111_fix_remaining_function_search_path.sql` |
| update_user_last_login search_path | 高 | ✅ 已修复 | 迁移脚本 | `20251111_fix_remaining_function_search_path.sql` |
| ai_filters_audit_trigger search_path | 高 | ✅ 已修复 | 迁移脚本 | `20251111_fix_function_search_path.sql` |
| Multiple Permissive Policies | 中 | ✅ 已修复 | 迁移脚本 | `20251111_fix_multiple_permissive_policies.sql` |
| vector 扩展位置 | 低 | ⚪ 可选 | 迁移脚本（可选） | `20251111_move_vector_extension.sql` |
| Auth 泄露密码保护 | 中 | ⚠️ 需配置 | Dashboard 配置 | 手动配置 |

## 🚀 执行修复步骤

### 步骤 1: 执行函数 search_path 修复（必须）

1. **在 AI 数据库中执行**:
   ```bash
   # 在 Supabase SQL Editor 中选择 AI 数据库
   # 或使用 psql 连接到 AI 数据库
   psql -d <ai_database_url> -f src/migrations/20251111_fix_function_search_path.sql
   ```

2. **在主数据库中执行**:
   ```bash
   # 在 Supabase SQL Editor 中选择主数据库
   # 或使用 psql 连接到主数据库
   psql -d <main_database_url> -f src/migrations/20251111_fix_remaining_function_search_path.sql
   ```

3. **验证修复**:
   ```bash
   psql -d <database_url> -f scripts/verify-security-fixes.sql
   ```

### 步骤 2: 修复 Multiple Permissive Policies（必须）

**重要**: 需要在两个数据库中分别执行迁移脚本：

#### 2.1 主数据库迁移

```bash
# 方式 1: 在 Supabase SQL Editor 中执行（推荐）
# 1. 登录 Supabase Dashboard
# 2. 选择主数据库项目
# 3. 进入 SQL Editor
# 4. 执行 src/migrations/20251111_fix_multiple_permissive_policies.sql

# 方式 2: 使用 psql 执行
psql -d <main_database_url> -f src/migrations/20251111_fix_multiple_permissive_policies.sql
```

#### 2.2 AI 数据库迁移

```bash
# 方式 1: 在 Supabase SQL Editor 中执行（推荐）
# 1. 登录 Supabase Dashboard
# 2. 选择 ZALEM AI Service 数据库项目
# 3. 进入 SQL Editor
# 4. 执行 src/migrations/20251111_fix_multiple_permissive_policies_ai.sql

# 方式 2: 使用 psql 执行
psql -d <ai_database_url> -f src/migrations/20251111_fix_multiple_permissive_policies_ai.sql
```

### 步骤 3: 配置 Auth 泄露密码保护（推荐）

按照上面的 "Auth 泄露密码保护未启用" 部分的详细步骤在 Supabase Dashboard 中配置。

### 步骤 4: 迁移 vector 扩展（可选）

如果需要修复 vector 扩展位置警告：

1. **备份数据库**（重要！）
2. **在测试环境先验证**
3. **执行迁移脚本**:
   ```bash
   psql -d <database_url> -f src/migrations/20251111_move_vector_extension.sql
   ```
4. **验证迁移结果**:
   ```sql
   -- 在 Supabase SQL Editor 中执行
   SELECT extname, nspname 
   FROM pg_extension e 
   JOIN pg_namespace n ON e.extnamespace = n.oid 
   WHERE extname = 'vector';
   ```

---

## 🔍 验证修复

### 快速验证脚本

使用验证脚本快速检查所有修复状态：

```bash
# 在 Supabase SQL Editor 中执行
# 或使用 psql 执行
psql -f scripts/verify-security-fixes.sql
```

### 验证函数 search_path 修复

```sql
-- 检查函数 search_path 是否已设置
SELECT 
  proname AS function_name,
  prosecdef AS is_security_definer,
  proconfig AS config,
  CASE 
    WHEN proconfig::text LIKE '%search_path=public%' THEN '✅ 已修复'
    ELSE '❌ 未修复'
  END AS status
FROM pg_proc
WHERE proname IN ('match_documents', 'update_users_updated_at', 'update_user_last_login', 'ai_filters_audit_trigger')
ORDER BY proname;
```

**期望结果**:
- `match_documents`: `is_security_definer = true`, `config` 包含 `search_path=public`, `status = '✅ 已修复'`
- `update_users_updated_at`: `config` 包含 `search_path=public`, `status = '✅ 已修复'`
- `update_user_last_login`: `config` 包含 `search_path=public`, `status = '✅ 已修复'`
- `ai_filters_audit_trigger`: `config` 包含 `search_path=public`, `status = '✅ 已修复'`

### 验证 vector 扩展位置（如果已迁移）

```sql
-- 检查扩展位置
SELECT 
  extname AS extension_name,
  nspname AS schema_name,
  CASE 
    WHEN nspname = 'public' THEN '⚠️  仍在 public schema'
    WHEN nspname = 'extensions' THEN '✅ 已迁移到 extensions schema'
    ELSE '⚠️  在 ' || nspname || ' schema'
  END AS status
FROM pg_extension e
JOIN pg_namespace n ON e.extnamespace = n.oid
WHERE extname = 'vector';
```

**期望结果**（如果已迁移）:
- `schema_name = 'extensions'`
- `status = '✅ 已迁移到 extensions schema'`

**验证 vector 类型是否仍然可用**:
```sql
-- 测试 vector 类型是否仍然可用
SELECT '[1,2,3]'::vector(3);
-- 应该成功返回，不报错
```

### 验证 Auth 泄露密码保护

1. **在 Supabase Dashboard 中检查**:
   - 进入 **Authentication** → **Settings**
   - 查看 **Password Security** 部分
   - 确认 **"Check against HaveIBeenPwned"** 选项已启用

2. **测试验证**:
   - 尝试使用 Supabase Auth API 注册一个新用户
   - 使用已知泄露的密码（例如: `password123`）
   - 应该收到错误响应，提示密码已泄露
   
   ```javascript
   // 测试示例（使用 Supabase JS Client）
   const { data, error } = await supabase.auth.signUp({
     email: 'test@example.com',
     password: 'password123' // 已知泄露的密码
   });
   // error 应该包含密码泄露的提示
   ```

---

## 📚 参考资料

- [PostgreSQL search_path 安全](https://www.postgresql.org/docs/current/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY)
- [Supabase 密码安全](https://supabase.com/docs/guides/auth/password-security)
- [Supabase 数据库 Linter](https://supabase.com/docs/guides/database/database-linter)

