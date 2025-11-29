# 🔧 修复本地数据库连接问题

## 问题

本地开发环境报错：`relation "ai_config" does not exist`，但 Supabase 中表已存在。

## 原因分析

本地 `.env.local` 中可能使用了：
1. **连接池连接**（端口 6543）- 可能连接到不同的数据库实例
2. **本地数据库连接** - 连接到本地 PostgreSQL，而不是 Supabase

## 解决方案

### 步骤 1：检查当前连接配置

```bash
# 查看当前 DATABASE_URL
cat .env.local | grep DATABASE_URL
```

### 步骤 2：更新为 Supabase 直接连接

`.env.local` 文件应该使用 **直接连接**（端口 5432），而不是连接池（端口 6543）。

**正确的格式：**
```bash
DATABASE_URL=postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres?sslmode=require
```

**对于您的项目：**
```bash
DATABASE_URL=postgresql://postgres:iK7USyhmI0IfWEfZ@db.vdtnzjvmvrcdplawwiae.supabase.co:5432/postgres?sslmode=require
```

### 步骤 3：如何获取正确的连接字符串

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择项目
3. 进入 **Settings** → **Database**
4. 找到 **Connection string** 部分
5. 选择 **URI** 格式
6. 确保选择的是 **Direct connection**（不是 Pooler）
7. 复制完整的连接字符串

### 步骤 4：验证连接

更新 `.env.local` 后：

1. **重启开发服务器**：
   ```bash
   # 停止当前服务器（Ctrl+C）
   npm run dev
   ```

2. **运行验证脚本**：
   ```bash
   npx tsx scripts/verify-ai-config-table.ts
   ```

3. **访问配置页面**：
   ```
   http://localhost:3001/admin/ai/config
   ```

## 常见问题

### ❌ 错误配置 1: 使用连接池
```
DATABASE_URL=postgres://postgres.vdtnzjvmvrcdplawwiae:...@pooler.supabase.com:6543/...
```
**问题**：连接池可能不支持某些操作或连接到不同实例

**解决**：改为直接连接（端口 5432）

### ❌ 错误配置 2: 连接到本地数据库
```
DATABASE_URL=postgresql://localhost:5432/mydb
```
**问题**：本地数据库没有 `ai_config` 表

**解决**：改为 Supabase 连接字符串

### ❌ 错误配置 3: 缺少 SSL
```
DATABASE_URL=postgresql://postgres:...@db....supabase.co:5432/postgres
```
**问题**：Supabase 必须使用 SSL

**解决**：添加 `?sslmode=require`

## 验证清单

- [ ] `.env.local` 文件存在
- [ ] `DATABASE_URL` 使用直接连接（端口 5432）
- [ ] `DATABASE_URL` 包含 `sslmode=require`
- [ ] 开发服务器已重启
- [ ] 验证脚本显示表存在
- [ ] 配置页面可以正常加载

