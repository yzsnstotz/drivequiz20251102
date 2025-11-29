# 🔧 修复 Vercel 生产环境 AI 数据库 DNS 解析错误

## ❌ 问题症状

日志显示：
```
Error: getaddrinfo ENOTFOUND db.cgpmpfnjzlzbquakmmrj.supabase.co
errno: -3007
code: 'ENOTFOUND'
```

**诊断**: Vercel 无法解析 Supabase 数据库主机名

## 🔍 可能原因

1. **数据库已暂停**（Supabase 免费版在闲置时会自动暂停）
2. **直接连接（端口 5432）在 Vercel 环境中不可用**，需要使用连接池（端口 6543）

## ✅ 解决方案

### 方案 1: 使用连接池（Pooler）连接（推荐）

**连接池连接字符串格式**：
```
postgresql://postgres.cgpmpfnjzlzbquakmmrj:zKV0rtIV1QOByu89@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require
```

**关键点**：
1. ✅ 用户名：`postgres.cgpmpfnjzlzbquakmmrj`（不是 `postgres`）
2. ✅ 主机：`aws-1-ap-southeast-1.pooler.supabase.com`（pooler 地址）
3. ✅ 端口：`6543`（不是 `5432`）
4. ✅ 参数：`pgbouncer=true&sslmode=require`

### 方案 2: 检查并恢复数据库

如果数据库已暂停：

1. 登录 [Supabase Dashboard](https://app.supabase.com)
2. 进入项目 `cgpmpfnjzlzbquakmmrj`
3. 检查项目状态，如果暂停请点击 **Resume** 恢复数据库
4. 等待数据库完全启动（通常需要 1-2 分钟）

### 方案 3: 获取正确的 Pooler 地址

1. 登录 Supabase Dashboard
2. 进入项目 → **Settings** → **Database**
3. 找到 **Connection Pooling** 部分
4. 选择 **URI** 格式
5. 复制 Pooler 连接字符串

**注意**：Pooler 地址格式通常是：
- `aws-1-ap-southeast-1.pooler.supabase.com:6543`（新加坡）
- `aws-1-ap-northeast-1.pooler.supabase.com:6543`（日本）
- `aws-0-us-east-1.pooler.supabase.com:6543`（美国东部）

## 📝 在 Vercel 中更新环境变量

### 步骤 1: 登录 Vercel Dashboard
访问 https://vercel.com/dashboard

### 步骤 2: 进入环境变量设置
1. 选择项目
2. 点击 **Settings** → **Environment Variables**

### 步骤 3: 更新 AI_DATABASE_URL

**如果使用连接池（推荐）**：
```
postgresql://postgres.cgpmpfnjzlzbquakmmrj:zKV0rtIV1QOByu89@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require
```

**如果数据库已恢复且使用直接连接**：
```
postgresql://postgres:zKV0rtIV1QOByu89@db.cgpmpfnjzlzbquakmmrj.supabase.co:5432/postgres?sslmode=require
```

### 步骤 4: 重新部署
1. 保存环境变量
2. 进入 **Deployments** 页面
3. 点击最新部署右侧的 **...** 菜单
4. 选择 **Redeploy**

## 🧪 验证修复

部署完成后，检查日志应该看到：
- ✅ 不再出现 `ENOTFOUND` 错误
- ✅ 数据库连接成功
- ✅ 查询执行成功

## 📊 两种连接方式对比

| 特性 | 直接连接 (5432) | 连接池 (6543) |
|------|----------------|--------------|
| **连接稳定性** | 需要数据库活跃 | 更稳定 |
| **Vercel 兼容性** | ❌ 可能 DNS 解析失败 | ✅ 推荐 |
| **用户名格式** | `postgres` | `postgres.PROJECT_ID` |
| **端口** | `5432` | `6543` |
| **特殊参数** | `sslmode=require` | `pgbouncer=true&sslmode=require` |

## ⚠️ 重要提示

1. **连接池的用户名格式很重要**：必须是 `postgres.cgpmpfnjzlzbquakmmrj`，不是 `postgres`
2. **必须添加 `pgbouncer=true` 参数**：否则连接池可能无法正常工作
3. **SSL 配置必须保留**：`sslmode=require` 是必需的

## 🔗 相关文档

- [Supabase Connection Pooling](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

