# JWT 配置指南

## 📋 概述

本指南说明如何配置 `USER_JWT_PUBLIC_KEY` 和 `USER_JWT_SECRET` 环境变量，用于验证前端用户发送的 JWT Token。

---

## 🔑 Supabase Auth JWT 配置

### 方案 1: 使用 Legacy JWT Secret (HS256)

**适用场景**: `/api/ai/chat` 路由使用 HMAC 密钥验证

**环境变量**: `USER_JWT_SECRET`

**配置步骤**:

1. **登录 Supabase Dashboard**
   - 访问 [Supabase Dashboard](https://app.supabase.com)
   - 选择您的项目

2. **获取 Legacy JWT Secret**
   - 进入 **Settings** → **API**
   - 在 "JWT Settings" 部分找到 **"JWT Secret"**（这是 Legacy JWT Secret）
   - 点击 **"Reveal"** 按钮显示密钥
   - 复制该值（通常是一个长字符串，至少 32 个字符）

3. **配置到 Vercel Dashboard**
   - 登录 [Vercel Dashboard](https://vercel.com/dashboard)
   - 选择您的项目
   - 进入 **Settings** → **Environment Variables**
   - 点击 **Add** 添加新变量：
     - **Key**: `USER_JWT_SECRET`
     - **Value**: 步骤 2 复制的 Legacy JWT Secret
     - **Environment**: 选择 **Production**（如果需要，也可以选择 Preview）
   - 点击 **Save**

4. **重新部署**
   - 配置环境变量后，需要重新部署项目
   - 进入 **Deployments** 页面
   - 点击最新部署右侧的 **...** 菜单
   - 选择 **Redeploy**

**代码验证**:
```typescript
// src/app/api/ai/chat/route.ts
const secret = new TextEncoder().encode(USER_JWT_SECRET);
const { payload } = await jwtVerify(token, secret); // 默认允许 HS256
```

---

### 方案 2: 使用 JWT Public Key (RS256)

**适用场景**: `/api/ai/ask` 路由使用 RS256 公钥验证

**环境变量**: `USER_JWT_PUBLIC_KEY`

**配置步骤**:

1. **登录 Supabase Dashboard**
   - 访问 [Supabase Dashboard](https://app.supabase.com)
   - 选择您的项目

2. **获取 JWT Public Key**
   
   **方法 1: 从 Dashboard 获取**
   - 进入 **Settings** → **API**
   - 在 "JWT Settings" 部分找到 **"JWT Public Key"**（PEM 格式）
   - 复制完整的公钥（包括 `-----BEGIN PUBLIC KEY-----` 和 `-----END PUBLIC KEY-----`）

   **方法 2: 从 JWKS 端点获取**
   - 访问 JWKS 端点：`https://<project-id>.supabase.co/auth/v1/.well-known/jwks.json`
   - 找到 `keys` 数组中的第一个 key
   - 提取 `n` 和 `e` 值，转换为 PEM 格式的公钥
   - 或者使用工具将 JWK 转换为 PEM 格式

3. **配置到 Vercel Dashboard**
   - 登录 [Vercel Dashboard](https://vercel.com/dashboard)
   - 选择您的项目
   - 进入 **Settings** → **Environment Variables**
   - 点击 **Add** 添加新变量：
     - **Key**: `USER_JWT_PUBLIC_KEY`
     - **Value**: 步骤 2 获取的 JWT Public Key（完整 PEM 格式，包含换行符）
     - **Environment**: 选择 **Production**（如果需要，也可以选择 Preview）
   - 点击 **Save**

4. **重新部署**
   - 配置环境变量后，需要重新部署项目
   - 进入 **Deployments** 页面
   - 点击最新部署右侧的 **...** 菜单
   - 选择 **Redeploy**

**代码验证**:
```typescript
// src/app/api/ai/ask/route.ts
const pubKey = await crypto.subtle.importKey(
  "spki",
  pemToArrayBuffer(USER_JWT_PUBLIC_KEY),
  { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
  false,
  ["verify"],
);
```

---

## 📊 两种方案对比

| 方案 | 环境变量 | 算法 | 适用路由 | Supabase 配置位置 |
|------|---------|------|---------|------------------|
| Legacy JWT Secret | `USER_JWT_SECRET` | HS256 (HMAC) | `/api/ai/chat` | Settings → API → JWT Secret |
| JWT Public Key | `USER_JWT_PUBLIC_KEY` | RS256 (RSA) | `/api/ai/ask` | Settings → API → JWT Public Key |

---

## ⚠️ 重要提示

### 1. Legacy JWT Secret vs New JWT

- **Legacy JWT Secret**: 使用 HS256 (HMAC) 算法，对称密钥
  - ✅ 适用于 `/api/ai/chat` 路由
  - ✅ 配置简单，直接使用密钥字符串
  - ⚠️ Supabase 推荐迁移到新的 JWT 系统

- **New JWT Public Key**: 使用 RS256 (RSA) 算法，非对称密钥
  - ✅ 适用于 `/api/ai/ask` 路由
  - ✅ 更安全，不需要共享私钥
  - ✅ Supabase 推荐使用的新方法

### 2. 如何选择

- **如果使用 `/api/ai/chat` 路由**: 配置 `USER_JWT_SECRET`（Legacy JWT Secret）
- **如果使用 `/api/ai/ask` 路由**: 配置 `USER_JWT_PUBLIC_KEY`（JWT Public Key）
- **如果两个路由都使用**: 两个环境变量都需要配置

### 3. 迁移建议

如果当前使用 Legacy JWT Secret，建议：
1. 迁移到新的 JWT Public Key 系统
2. 更新代码使用 RS256 算法验证
3. 配置 `USER_JWT_PUBLIC_KEY` 环境变量

---

## 🔍 验证配置

### 测试 JWT 验证

```bash
# 测试 /api/ai/ask (使用 RS256 公钥验证)
curl -X POST "https://your-domain.vercel.app/api/ai/ask" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question": "测试问题"}'

# 测试 /api/ai/chat (使用 HS256 密钥验证)
curl -X POST "https://your-domain.vercel.app/api/ai/chat" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question": "测试问题"}'
```

### 预期结果

- ✅ 返回状态码 200
- ✅ 返回数据格式：`{ ok: true, data: { answer: "...", ... } }`
- ✅ 能够正确识别用户（从 JWT Token 中提取 userId）

---

## 📝 常见问题

### Q1: 应该使用 Legacy JWT Secret 还是 JWT Public Key？

**A**: 
- 如果使用 `/api/ai/chat` 路由，使用 **Legacy JWT Secret** (`USER_JWT_SECRET`)
- 如果使用 `/api/ai/ask` 路由，使用 **JWT Public Key** (`USER_JWT_PUBLIC_KEY`)
- 如果两个路由都使用，两个环境变量都需要配置

### Q2: 为什么代码中使用了两种不同的验证方式？

**A**: 
- `/api/ai/ask` 使用 RS256 公钥验证（更安全，推荐）
- `/api/ai/chat` 使用 HS256 密钥验证（Legacy 方式）

### Q3: 如何从 JWKS 端点获取公钥？

**A**: 
1. 访问 `https://<project-id>.supabase.co/auth/v1/.well-known/jwks.json`
2. 找到 `keys` 数组中的第一个 key
3. 提取 `n` 和 `e` 值
4. 使用工具将 JWK 转换为 PEM 格式

### Q4: Legacy JWT Secret 和 JWT Public Key 有什么区别？

**A**: 
- **Legacy JWT Secret**: 对称密钥，使用 HS256 算法，需要共享密钥
- **JWT Public Key**: 非对称密钥，使用 RS256 算法，只需要公钥验证，更安全

---

## 📚 相关文档

- [Supabase Auth JWT Settings](https://supabase.com/docs/guides/auth/jwt)
- [Supabase Legacy JWT Secret](https://supabase.com/docs/guides/auth/jwt#legacy-jwt-secret)
- [Supabase JWKS Endpoint](https://supabase.com/docs/guides/auth/jwt#jwks-endpoint)

---

**最后更新**: 2025-01-XX

