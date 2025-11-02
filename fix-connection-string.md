# 🔧 修复数据库连接字符串

## 问题

诊断结果显示：
- 错误: "Tenant or user not found"
- 当前使用的是连接池 (Pooler) 端口 6543

## 解决方案

### 选项 1: 使用直接连接（推荐）

Supabase 提供两种连接方式。对于 Kysely/pg 库，**推荐使用直接连接**。

正确的连接字符串格式：
```
postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres
```

对于您的项目：
- 项目 ID: `vdtnzjvmvrcdplawwiae`
- 密码: `iK7USyhmI0IfWEfZ`

**正确的连接字符串应该是：**
```
postgresql://postgres:iK7USyhmI0IfWEfZ@db.vdtnzjvmvrcdplawwiae.supabase.co:5432/postgres?sslmode=require
```

### 选项 2: 使用连接池（如果需要）

如果您必须使用连接池（例如需要高并发），用户名格式应该是：
```
postgresql://postgres.PROJECT_REF:PASSWORD@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require
```

**注意：连接池需要特殊配置，且用户名是 `postgres.PROJECT_REF`，不是 `postgres`**

## 如何获取正确的连接字符串

1. 登录 Supabase Dashboard
2. 进入您的项目
3. 点击 **Settings** → **Database**
4. 找到 **Connection string** 部分
5. 选择 **URI** 格式
6. 确保选择的是 **Direct connection**（不是 Pooler）
7. 复制完整的连接字符串

## 更新 .env.local 文件

请将 `.env.local` 文件中的 `DATABASE_URL` 更新为：

```bash
DATABASE_URL=postgresql://postgres:iK7USyhmI0IfWEfZ@db.vdtnzjvmvrcdplawwiae.supabase.co:5432/postgres?sslmode=require
ADMIN_TOKEN=your-admin-token-here
TZ=UTC
```

## 验证修复

更新 `.env.local` 后：

1. **重启开发服务器**：
   ```bash
   # 停止当前服务器（Ctrl+C）
   npm run dev
   ```

2. **再次访问诊断端点**：
   ```
   http://localhost:3000/api/admin/diagnose
   ```

3. **检查连接状态**：
   - 应该显示 `"status": "success"`
   - 不再显示 "Tenant or user not found" 错误

## 常见错误

### ❌ 错误格式 1: 使用 Pooler 但用户名不正确
```
postgresql://postgres:PASSWORD@pooler.supabase.com:6543/postgres
```
应该是：`postgres.PROJECT_REF:PASSWORD`（如果使用 Pooler）

### ❌ 错误格式 2: 缺少端口
```
postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co/postgres
```
应该明确指定端口：`:5432`

### ❌ 错误格式 3: 缺少 SSL 模式
```
postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres
```
应该添加：`?sslmode=require`

## 推荐配置

**直接连接**（最简单且推荐）：
```
DATABASE_URL=postgresql://postgres:iK7USyhmI0IfWEfZ@db.vdtnzjvmvrcdplawwiae.supabase.co:5432/postgres?sslmode=require
```

