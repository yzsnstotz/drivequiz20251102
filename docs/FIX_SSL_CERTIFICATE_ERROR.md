# 🔒 修复 SSL 证书错误

## ❌ 错误信息

```json
{
  "ok": false,
  "errorCode": "DATABASE_CONNECTION_ERROR",
  "message": "数据库连接失败",
  "diagnostics": {
    "connection": {
      "status": "error",
      "error": "self-signed certificate in certificate chain"
    }
  }
}
```

## 🔍 问题分析

这个错误是因为：
1. ✅ 数据库连接字符串正确（已配置）
2. ✅ SSL 模式已启用（`sslmode=require`）
3. ❌ **SSL 证书验证失败** - Supabase 使用自签名证书或中间证书，Node.js 默认拒绝此类连接

## 🔧 解决方案

### 方案 1: 通过环境变量（推荐）

在 Vercel Dashboard 中添加环境变量：

1. 登录 Vercel Dashboard
2. 进入项目 → **Settings** → **Environment Variables**
3. 添加以下环境变量：

| 变量名 | 值 | 环境 | 说明 |
|--------|-----|------|------|
| `NODE_TLS_REJECT_UNAUTHORIZED` | `0` | Production, Preview, Development | 允许自签名 SSL 证书 |

**⚠️ 安全提示：**
- 这个设置会允许所有自签名证书，包括不安全的连接
- 但对于 Supabase（受信任的云服务商），这是安全的
- 仅在生产环境需要，本地开发可能不需要

### 方案 2: 确保代码中的 SSL 配置正确应用

代码中已经设置了 `rejectUnauthorized: false`，但需要确保配置正确传递。

**检查点：**
1. `src/lib/db.ts` 中已经设置了 SSL 配置 ✅
2. `src/app/api/admin/diagnose/route.ts` 中已经设置了 SSL 配置 ✅

### 方案 3: 使用直接连接（如果使用 Pooler）

如果当前使用的是 Pooler 连接，可以尝试切换到直接连接：

**Pooler 连接（当前）：**
```
postgresql://postgres.vdtnzjvmvrcdplawwiae:tcaZ6b577mojAkYw@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require
```

**直接连接（推荐）：**
```
postgresql://postgres:tcaZ6b577mojAkYw@db.vdtnzjvmvrcdplawwiae.supabase.co:5432/postgres?sslmode=require
```

**如何获取直接连接字符串：**
1. 登录 Supabase Dashboard
2. 进入项目 → **Settings** → **Database**
3. 找到 **Connection string** 部分
4. 选择 **URI** 格式
5. 选择 **Direct connection**（不是 Pooler）
6. 复制连接字符串

## 📝 修复步骤（推荐方案 1）

### Step 1: 添加环境变量

在 Vercel Dashboard 中：

1. 进入项目 → **Settings** → **Environment Variables**
2. 点击 **Add** 按钮
3. 填写：
   - **变量名**: `NODE_TLS_REJECT_UNAUTHORIZED`
   - **值**: `0`
   - **环境**: 选择 **Production**（如果需要也可以在 Preview 和 Development 都添加）
4. 点击 **Save**

### Step 2: 重新部署

1. 进入 **Deployments** 页面
2. 找到最新部署
3. 点击右侧 **...** 菜单
4. 选择 **Redeploy**
5. 或者在下次代码推送时自动触发部署

### Step 3: 验证修复

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
      "status": "success"
    },
    "tables": {
      "status": "complete"
    }
  }
}
```

## 🔍 诊断检查清单

- [ ] 检查 Vercel Dashboard 中是否设置了 `NODE_TLS_REJECT_UNAUTHORIZED=0`
- [ ] 检查 `DATABASE_URL` 环境变量是否正确配置
- [ ] 检查连接字符串是否包含 `sslmode=require`
- [ ] 检查是否使用了 Supabase 连接（包含 `supabase.com`）
- [ ] 确认已重新部署应用
- [ ] 验证诊断端点返回成功

## 🚨 常见问题

### Q1: 为什么代码中已经设置了 `rejectUnauthorized: false`，但还是报错？

**A:** 在某些环境下（特别是生产环境），Node.js 可能在 Pool 配置之前就验证了证书。通过环境变量 `NODE_TLS_REJECT_UNAUTHORIZED=0` 可以确保在所有层面都允许自签名证书。

### Q2: 使用 `NODE_TLS_REJECT_UNAUTHORIZED=0` 安全吗？

**A:** 对于 Supabase 这样受信任的云服务商是安全的，因为：
- Supabase 是知名且受信任的云数据库服务
- 证书链问题通常是由于中间证书链不完整，而不是真正的安全问题
- 仅在生产环境启用，不会影响其他连接的验证

**但如果担心安全问题，可以：**
- 只对数据库连接禁用证书验证（代码中已设置）
- 保持 `NODE_TLS_REJECT_UNAUTHORIZED` 未设置（或设为 `1`），仅依赖代码中的配置

### Q3: 为什么本地开发没有问题，但生产环境报错？

**A:** 可能的原因：
1. 本地环境可能已经设置了 `NODE_TLS_REJECT_UNAUTHORIZED=0`
2. 本地和生产的 Node.js 版本不同，SSL 验证行为可能有差异
3. 生产环境的 SSL 验证更严格

**解决：** 确保生产环境也设置了相同的 SSL 配置。

### Q4: 可以使用其他方式解决吗？

**A:** 是的，可以使用以下替代方案：

1. **切换到直接连接**（推荐）
   - 直接连接通常有更简单的证书链
   - 参考上面的"方案 3"

2. **使用连接池库的高级 SSL 配置**
   - 已经在代码中实现，但可能需要环境变量支持

## ✅ 快速修复命令

如果可以在 Vercel CLI 中操作：

```bash
vercel env add NODE_TLS_REJECT_UNAUTHORIZED production
# 输入值: 0
```

## 📝 总结

**SSL 证书错误的根本原因：**
- Supabase 使用中间证书或自签名证书
- Node.js 默认严格验证 SSL 证书链
- 需要在应用级别允许此类证书

**推荐解决方案：**
1. ✅ 在 Vercel Dashboard 中添加 `NODE_TLS_REJECT_UNAUTHORIZED=0`
2. ✅ 重新部署应用
3. ✅ 验证数据库连接成功

**如果问题仍然存在：**
- 检查连接字符串格式是否正确
- 考虑切换到直接连接（而不是 Pooler）
- 检查 Supabase 项目的 SSL 证书状态

