# USER_JWT_SECRET 配置说明

## 📋 概述

`USER_JWT_SECRET` 用于验证用户 JWT token，确保 API 请求来自已认证的用户。

## 🔍 代码行为分析

根据 `src/app/api/ai/ask/route.ts` 中的代码逻辑：

### 1. 开发环境（本地开发）

**行为**:
- ✅ **不是必需的**
- 如果未配置 `USER_JWT_SECRET`，系统会：
  - 允许跳过 JWT 验证
  - 使用匿名用户 ID（`anonymous`）继续处理请求
  - 不会返回错误

**代码逻辑**:
```typescript
// 开发或预览环境：如果未配置 USER_JWT_SECRET，允许跳过认证
if (!USER_JWT_SECRET) {
  if (isDevelopmentOrPreview()) {
    // 开发模式兜底：允许跳过认证
    return null; // 返回 null，让调用方使用匿名 ID
  }
}
```

### 2. 生产环境（Vercel Production）

**行为**:
- ⚠️ **是必需的**
- 如果未配置 `USER_JWT_SECRET`，系统会：
  - 记录错误日志
  - JWT 验证失败时返回 401 错误
  - 拒绝未认证的请求

**代码逻辑**:
```typescript
// 生产环境安全检查：必须配置 USER_JWT_SECRET
if (isProduction()) {
  if (!USER_JWT_SECRET) {
    console.error("[JWT] Production environment requires USER_JWT_SECRET");
    return null;
  }
}

// 如果配置了密钥但验证失败，拒绝请求（生产环境）
if (!session && USER_JWT_SECRET && isProduction()) {
  return err("AUTH_REQUIRED", "Invalid or expired authentication token.", 401);
}
```

## 🎯 当前环境判断

根据代码中的环境判断逻辑：

```typescript
function isProduction(): boolean {
  const vercelEnv = process.env.VERCEL_ENV;
  const nodeEnv = process.env.NODE_ENV;
  
  // 明确的生产环境：VERCEL_ENV === 'production' 或 NODE_ENV === 'production'
  return vercelEnv === "production" || (nodeEnv === "production" && vercelEnv !== "preview");
}

function isDevelopmentOrPreview(): boolean {
  const vercelEnv = process.env.VERCEL_ENV;
  const nodeEnv = process.env.NODE_ENV;
  
  // 开发或预览环境
  return vercelEnv === "preview" || nodeEnv === "development" || (!vercelEnv && !nodeEnv);
}
```

**当前本地环境**:
- `NODE_ENV`: 未设置（默认视为开发环境）
- `VERCEL_ENV`: 未设置
- **结论**: 当前是**开发环境**，`USER_JWT_SECRET` **不是必需的**

## ✅ 是否需要设置？

### 本地开发环境（当前）

**答案**: **不是必需的** ✅

**原因**:
1. 系统会自动使用匿名用户 ID（`anonymous`）
2. API 请求可以正常处理
3. 不会返回认证错误

**建议**:
- 如果只是测试 AI 功能，可以不设置
- 如果需要测试用户认证流程，建议设置

### 生产环境（Vercel）

**答案**: **是必需的** ⚠️

**原因**:
1. 生产环境必须验证用户身份
2. 未配置会导致认证失败
3. 安全要求

## 🔧 如何设置（如果需要）

### 1. 获取 JWT Secret

**如果使用 Supabase**:
```bash
# Supabase JWT Secret 通常是 Base64 编码的
# 可以在 Supabase Dashboard > Settings > API 中找到
USER_JWT_SECRET=your-supabase-jwt-secret
```

**如果使用自定义 JWT**:
```bash
# 生成一个安全的随机字符串（至少 32 字符）
# 可以使用 openssl 生成：
openssl rand -base64 32

USER_JWT_SECRET=your-custom-jwt-secret
```

### 2. 添加到 `.env.local`

```bash
# 用户 JWT 密钥（用于用户认证）
# 开发环境：可选（未设置时使用匿名用户）
# 生产环境：必需
USER_JWT_SECRET=your-jwt-secret-here
```

### 3. 格式说明

代码支持两种格式：
1. **Base64 编码**（Supabase 格式）: 代码会自动解码
2. **原始字符串**: 直接使用字符串作为密钥

```typescript
// 代码会自动尝试 Base64 解码
try {
  const decodedSecret = Buffer.from(USER_JWT_SECRET, "base64");
  secret = new Uint8Array(decodedSecret);
} catch {
  // 如果 Base64 解码失败，使用原始字符串
  secret = new TextEncoder().encode(USER_JWT_SECRET);
}
```

## 📊 总结

| 环境 | 是否必需 | 说明 |
|------|---------|------|
| **本地开发** | ❌ 不是必需 | 未设置时使用匿名用户，API 正常工作 |
| **Vercel Preview** | ❌ 不是必需 | 未设置时使用匿名用户，API 正常工作 |
| **Vercel Production** | ✅ 必需 | 未设置会导致认证失败，必须配置 |

## 🎯 当前建议

**对于本地开发环境**:
- ✅ **可以不设置** `USER_JWT_SECRET`
- ✅ API 会使用匿名用户 ID（`anonymous`）正常工作
- ✅ 可以正常测试 AI 功能

**如果将来部署到生产环境**:
- ⚠️ **必须设置** `USER_JWT_SECRET`
- ⚠️ 在 Vercel 环境变量中配置
- ⚠️ 确保使用安全的随机字符串

## 🔍 验证方法

### 检查当前是否设置了 USER_JWT_SECRET

```bash
# 检查环境变量
node -e "require('dotenv').config({ path: '.env.local' }); console.log('USER_JWT_SECRET:', process.env.USER_JWT_SECRET ? '已设置' : '未设置');"
```

### 测试 API 调用（不设置 USER_JWT_SECRET）

```bash
# 应该可以正常工作，使用匿名用户
curl -X POST http://localhost:3000/api/ai/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "测试问题", "locale": "zh"}'
```

### 查看日志

在开发环境中，如果未设置 `USER_JWT_SECRET`，日志会显示：
```
[STEP 1.4] 未找到JWT，将使用匿名ID
[STEP 1.7] 使用匿名ID
```

这是**正常行为**，不是错误。

