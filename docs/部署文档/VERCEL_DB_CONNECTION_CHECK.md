# 🔍 Vercel 数据库连接配置检查指南

## 📋 你提供的连接字符串

```
postgres://postgres.vdtnzjvmvrcdplawwiae:tcaZ6b577mojAkYw@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require
```

## ✅ 检查清单

### 1. 环境变量名称
- ✅ **应该使用**: `DATABASE_URL`
- ❌ **不要使用**: `POSTGRES_URL`（代码支持但 `DATABASE_URL` 优先级更高）
- 📍 **在 Vercel Dashboard 中的位置**: Settings → Environment Variables

### 2. 连接字符串格式问题

你的连接字符串存在以下问题：

#### ❌ 问题 1: 协议不一致
- **当前**: `postgres://` 
- **推荐**: `postgresql://`
- **说明**: PostgreSQL 官方推荐使用 `postgresql://`，虽然 `postgres://` 也能工作，但建议统一使用 `postgresql://`

#### ❌ 问题 2: Pooler 缺少参数
- **当前**: 使用 Pooler（端口 6543），但缺少 `pgbouncer=true` 参数
- **说明**: 使用 Supabase Pooler 时，建议添加 `pgbouncer=true` 参数以确保正确的连接池行为

### 3. 连接字符串解析

**你的连接字符串分解：**
- ✅ 协议: `postgres://` (建议改为 `postgresql://`)
- ✅ 用户名: `postgres.vdtnzjvmvrcdplawwiae` (Pooler 格式正确)
- ✅ 密码: `tcaZ6b577mojAkYw`
- ✅ 主机: `aws-1-ap-southeast-1.pooler.supabase.com` (Pooler 地址)
- ✅ 端口: `6543` (Pooler 端口)
- ✅ 数据库: `postgres`
- ⚠️ SSL: `sslmode=require` (正确)
- ❌ 缺少: `pgbouncer=true`

## 🔧 修复建议

### 选项 1: 使用直接连接（推荐）

**优点：**
- 更简单，不需要特殊参数
- 更稳定，减少连接池相关的潜在问题
- 推荐用于大多数应用场景

**正确的连接字符串：**
```
postgresql://postgres:PASSWORD@db.vdtnzjvmvrcdplawwiae.supabase.co:5432/postgres?sslmode=require
```

**注意：**
- 将 `PASSWORD` 替换为实际的数据库密码
- 用户名改为 `postgres`（不是 `postgres.vdtnzjvmvrcdplawwiae`）
- 主机改为 `db.vdtnzjvmvrcdplawwiae.supabase.co`
- 端口改为 `5432`

**如何在 Supabase 获取：**
1. 登录 Supabase Dashboard
2. 进入项目 → Settings → Database
3. 在 Connection string 部分
4. 选择 **URI** 格式
5. 选择 **Direct connection**（不是 Pooler）
6. 复制完整的连接字符串

### 选项 2: 使用 Pooler（如果需要高并发）

如果你必须使用 Pooler，请使用以下格式：

**修复后的连接字符串：**
```
postgresql://postgres.vdtnzjvmvrcdplawwiae:tcaZ6b577mojAkYw@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require
```

**修改点：**
1. ✅ `postgres://` → `postgresql://`
2. ✅ 添加 `pgbouncer=true` 参数
3. ✅ 保留 `sslmode=require`

## 📝 Vercel 配置步骤

### Step 1: 登录 Vercel Dashboard
访问 https://vercel.com/dashboard

### Step 2: 选择项目
在项目列表中找到你的项目并点击

### Step 3: 进入环境变量设置
- 点击顶部菜单 **Settings**
- 在左侧菜单中找到 **Environment Variables**
- 点击进入

### Step 4: 添加/修改 DATABASE_URL

**如果是新配置：**
1. 点击 **Add** 按钮
2. 变量名：`DATABASE_URL`
3. 值：使用修复后的连接字符串（见上方）
4. 环境：选择 **Production**（如果需要也可以在 Preview 和 Development 都配置）
5. 点击 **Save**

**如果已存在：**
1. 找到 `DATABASE_URL` 行
2. 点击 **Edit** 或 **Delete** 后重新添加
3. 更新为修复后的连接字符串

### Step 5: 验证并重新部署
1. 确认环境变量已保存
2. 进入 **Deployments** 页面
3. 点击最新部署右侧的 **...** 菜单
4. 选择 **Redeploy**
5. 或者在下次代码推送时自动触发部署

## 🧪 验证配置

部署完成后，访问诊断端点：

```bash
curl https://your-domain.vercel.app/api/admin/diagnose
```

**期望的响应：**
```json
{
  "ok": true,
  "message": "数据库连接正常",
  "diagnostics": {
    "connection": {
      "status": "success",
      ...
    },
    "tables": {
      "status": "complete",
      "found": ["activations", "activation_codes", "admins", "operation_logs"]
    }
  }
}
```

## 🚨 常见错误

### 错误 1: "Tenant or user not found"
- **原因**: 使用 Pooler 但用户名格式不正确，或密码错误
- **解决**: 确保用户名是 `postgres.PROJECT_REF` 格式（Pooler），或切换到直接连接

### 错误 2: "Connection refused"
- **原因**: 主机地址或端口错误
- **解决**: 检查连接字符串中的主机和端口是否正确

### 错误 3: "SSL connection required"
- **原因**: 缺少 `sslmode=require` 参数
- **解决**: 在连接字符串末尾添加 `?sslmode=require`

### 错误 4: "Environment variable not set"
- **原因**: Vercel Dashboard 中未配置 `DATABASE_URL`
- **解决**: 在 Vercel Dashboard 中添加 `DATABASE_URL` 环境变量

## 📌 推荐配置（直接连接）

**最简单且推荐的配置：**

```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.vdtnzjvmvrcdplawwiae.supabase.co:5432/postgres?sslmode=require
```

**在 Vercel Dashboard 中：**
- 变量名: `DATABASE_URL`
- 值: 上面的连接字符串（替换 `YOUR_PASSWORD`）
- 环境: Production (或所有环境)

## 🔐 安全提示

1. ✅ 环境变量在 Vercel 中是加密存储的
2. ✅ 只有项目管理员可以查看环境变量
3. ✅ 不要在代码中硬编码连接字符串
4. ✅ 定期轮换数据库密码

