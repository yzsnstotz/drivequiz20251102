# 🔐 管理员认证错误诊断指南

## ❌ 错误信息

```json
{
  "ok": false,
  "errorCode": "AUTH_REQUIRED",
  "message": "Missing Authorization header"
}
```

## 🔍 问题分析

### 这不是数据库连接问题！

**AUTH_REQUIRED 错误**表示：
- ✅ 服务器正常运行
- ✅ API 路由正常响应
- ❌ **前端没有发送 Authorization header**

### 可能的原因

1. **用户还未登录**（最常见）
   - `localStorage` 中没有 `ADMIN_TOKEN`
   - 前端 `apiFetch` 函数检测不到 token，就不会添加 `Authorization` header

2. **数据库中没有管理员账户**
   - 数据库连接正常，但 `admins` 表中没有数据
   - 即使发送了 token，也无法验证通过

3. **数据库连接失败**（这种情况会返回不同错误）
   - 如果数据库连接失败，会返回 `DATABASE_ERROR`，不是 `AUTH_REQUIRED`
   - 但如果数据库表不存在，也可能导致认证失败

## 🔧 解决步骤

### Step 1: 检查数据库连接

首先确认数据库是否正常连接：

```bash
# 访问诊断端点（不需要认证）
curl https://your-domain.vercel.app/api/admin/diagnose
```

**期望的响应：**
```json
{
  "ok": true,
  "message": "数据库连接正常",
  "diagnostics": {
    "connection": {
      "status": "success"
    },
    "tables": {
      "status": "complete",
      "found": ["activations", "activation_codes", "admins", "operation_logs"]
    }
  }
}
```

**如果数据库连接失败：**
- 参考 `docs/VERCEL_DB_CONNECTION_CHECK.md` 修复数据库连接
- 确认 Vercel 中 `DATABASE_URL` 环境变量已正确配置

### Step 2: 检查管理员表是否有数据

如果数据库连接正常，检查 `admins` 表是否有管理员账户。

**方法 1：通过 Supabase Dashboard**
1. 登录 Supabase Dashboard
2. 进入项目 → **Table Editor**
3. 找到 `admins` 表
4. 检查是否有数据

**方法 2：通过诊断 API（如果表存在但数据为空）**
- 诊断 API 会显示表是否存在，但不会显示数据内容

### Step 3: 创建默认管理员账户

如果数据库中**没有管理员账户**，需要创建：

#### 选项 1: 通过 Supabase Dashboard（手动）

1. 登录 Supabase Dashboard
2. 进入项目 → **Table Editor**
3. 选择 `admins` 表
4. 点击 **Insert row** 或 **New row**
5. 填写以下字段：
   - `username`: `admin`
   - `token`: `Aa123456` (或你自定义的 token)
   - `is_active`: `true` (勾选)
   - `created_at`: 当前时间
   - `updated_at`: 当前时间
6. 保存

#### 选项 2: 通过 SQL（推荐）

在 Supabase Dashboard → **SQL Editor** 中执行：

```sql
-- 检查是否已存在管理员
SELECT id, username, token, is_active FROM admins WHERE username = 'admin';

-- 如果不存在，创建默认管理员
INSERT INTO admins (username, token, is_active, created_at, updated_at)
VALUES ('admin', 'Aa123456', true, NOW(), NOW())
ON CONFLICT (username) DO UPDATE
SET token = EXCLUDED.token,
    is_active = true,
    updated_at = NOW();
```

#### 选项 3: 通过本地脚本（如果有本地访问权限）

```bash
# 确保 .env.local 中有正确的 DATABASE_URL
npm run create-admin
# 或
tsx scripts/create-default-admin.ts
```

### Step 4: 在前端登录

1. 访问管理后台登录页面：
   ```
   https://your-domain.vercel.app/admin/login
   ```

2. 输入管理员 Token：
   - 如果使用默认配置：`Aa123456`
   - 如果是自定义 token：使用你在数据库中创建的管理员 token

3. 点击登录
   - 前端会将 token 保存到 `localStorage.ADMIN_TOKEN`
   - 后续所有 API 请求都会自动携带 `Authorization: Bearer <token>` header

### Step 5: 验证登录成功

登录后，访问需要认证的 API：

```bash
# 方法 1: 在浏览器开发者工具中
# 打开 Network 标签，查看请求是否包含 Authorization header

# 方法 2: 使用 curl（需要手动设置 header）
curl -H "Authorization: Bearer Aa123456" \
  https://your-domain.vercel.app/api/admin/ping
```

**期望的响应：**
```json
{
  "ok": true,
  "data": {
    "name": "admin-ping",
    "time": "2025-11-02T..."
  }
}
```

## 🧪 完整诊断流程

### 1. 检查数据库连接

```bash
curl https://your-domain.vercel.app/api/admin/diagnose
```

**如果返回错误：**
- 检查 Vercel Dashboard → Settings → Environment Variables
- 确认 `DATABASE_URL` 已正确配置
- 参考 `docs/VERCEL_DB_CONNECTION_CHECK.md`

### 2. 检查管理员账户

**在 Supabase Dashboard 中执行：**

```sql
SELECT id, username, is_active, created_at 
FROM admins 
WHERE is_active = true;
```

**如果没有结果：**
- 执行上面的 "创建默认管理员账户" 步骤

### 3. 测试认证流程

**步骤 A：访问登录页面**
```
https://your-domain.vercel.app/admin/login
```

**步骤 B：输入 token 并登录**
- Token: `Aa123456` (或你创建的管理员 token)

**步骤 C：检查 localStorage**
- 打开浏览器开发者工具 (F12)
- 进入 Console 标签
- 执行：`localStorage.getItem('ADMIN_TOKEN')`
- 应该返回你输入的 token

**步骤 D：访问需要认证的页面**
```
https://your-domain.vercel.app/admin
```

**如果仍然报错：**
- 检查 Network 标签，查看 API 请求
- 确认请求头中包含 `Authorization: Bearer <token>`
- 如果请求头存在但仍有错误，可能是 token 不匹配

## 🚨 常见问题

### Q1: 为什么本地可以登录，但 Vercel 不行？

**A:** 本地和 Vercel 使用不同的数据库：
- 本地：使用 `.env.local` 中的 `DATABASE_URL`
- Vercel：使用 Dashboard 配置的 `DATABASE_URL`

**解决：** 确保 Vercel 的数据库中有管理员账户，并且 token 与本地一致。

### Q2: 登录后立即显示 "未授权"？

**可能原因：**
1. Token 在数据库中不存在
2. Token 对应的管理员 `is_active = false`
3. Token 格式错误（例如有多余的空格）

**解决：**
- 检查数据库中的 token 是否与输入的一致
- 确认管理员账户 `is_active = true`

### Q3: 数据库连接失败，但返回的是 AUTH_REQUIRED？

**A:** 这种情况很少见，但如果数据库表不存在，`withAdminAuth` 会捕获数据库错误并返回 `AUTH_REQUIRED`。

**解决：**
1. 先修复数据库连接问题
2. 确保所有数据库表都已创建（运行迁移脚本）
3. 然后创建管理员账户

### Q4: 如何重置管理员密码/Token？

**方法 1：通过 Supabase Dashboard**
```sql
UPDATE admins 
SET token = '新的token', updated_at = NOW() 
WHERE username = 'admin';
```

**方法 2：通过管理后台（如果已有其他管理员）**
- 使用默认管理员账户登录
- 进入 `/admin/admins` 页面
- 编辑管理员并更新 token

## ✅ 验证清单

完成以下检查，确保一切正常：

- [ ] 数据库连接正常（`/api/admin/diagnose` 返回 success）
- [ ] `admins` 表存在且有数据
- [ ] 管理员账户 `is_active = true`
- [ ] 在前端登录页面输入正确的 token
- [ ] `localStorage.ADMIN_TOKEN` 包含 token
- [ ] API 请求包含 `Authorization: Bearer <token>` header
- [ ] `/api/admin/ping` 返回成功响应

## 📝 总结

**AUTH_REQUIRED 错误的根本原因：**

1. **最常见：** 用户未登录，前端没有 token
   - ✅ **解决：** 访问 `/admin/login` 并输入管理员 token

2. **次常见：** 数据库中没有管理员账户
   - ✅ **解决：** 在数据库中创建管理员账户

3. **少见：** 数据库连接失败
   - ✅ **解决：** 先修复数据库连接，参考 `docs/VERCEL_DB_CONNECTION_CHECK.md`

**这不是数据库连接问题，而是认证配置问题！** 🎯

