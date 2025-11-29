# 🔧 Vercel Preview 环境错误修复指南

## ❌ 错误信息

```
【出错】Server misconfigured: USER_JWT_SECRET missing（SERVER_MISCONFIG）
```

## 🔍 问题分析

在 Vercel Preview 环境中，`NODE_ENV` 不是 `development`，所以代码认为这是生产环境，需要 `USER_JWT_SECRET` 环境变量。如果未配置，就会返回此错误。

## ✅ 解决方案

### 方案 A：在 Vercel Dashboard 中配置 USER_JWT_SECRET（推荐）

这是最安全和标准的做法。

#### 步骤 1: 生成 JWT Secret

生成一个安全的密钥（至少 32 个字符）：

```bash
# 方法 1: 使用 openssl
openssl rand -base64 32

# 方法 2: 使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

#### 步骤 2: 在 Vercel Dashboard 中配置

1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 选择您的项目
3. 进入 **Settings** → **Environment Variables**
4. 点击 **Add** 添加新变量：
   - **Key**: `USER_JWT_SECRET`
   - **Value**: 步骤 1 生成的密钥
   - **Environment**: 选择 **Preview**（如果需要生产环境也配置，也选择 **Production**）
5. 点击 **Save**

#### 步骤 3: 重新部署

配置环境变量后，需要重新部署：

1. 进入 **Deployments** 页面
2. 找到最新的部署
3. 点击右侧的 **...** 菜单
4. 选择 **Redeploy**

或者直接推送新的代码触发自动部署。

### 方案 B：修改代码允许 Preview 环境跳过认证（临时方案）

如果暂时不想配置 `USER_JWT_SECRET`，可以修改代码使其在 Preview 环境中也允许跳过认证。

**⚠️ 注意**：这仅适用于测试环境，生产环境应该配置 `USER_JWT_SECRET`。

修改 `src/app/api/ai/chat/route.ts`：

```typescript
// 检测是否为开发或预览环境
const isDev = process.env.NODE_ENV === "development" || 
              !process.env.NODE_ENV ||
              process.env.VERCEL_ENV === "preview"; // Vercel preview 环境

if (!USER_JWT_SECRET && isDev) {
  // 开发或预览模式下允许跳过认证
  return { valid: true as const, payload: { sub: "anonymous-dev" } };
}
```

## 📋 完整的环境变量清单

在 Vercel Dashboard 中，确保以下环境变量已配置：

### 必需的环境变量

| 变量名 | 说明 | 环境 |
|--------|------|------|
| `DATABASE_URL` | 数据库连接字符串 | Production, Preview |
| `ADMIN_TOKEN` | 管理员 Token | Production, Preview |
| `OPENAI_API_KEY` | OpenAI API 密钥 | Production, Preview |
| `USER_JWT_SECRET` | JWT 密钥（用于用户认证） | Production, Preview |
| `TZ` | 时区 | Production, Preview |

### 可选的环境变量

| 变量名 | 说明 | 环境 |
|--------|------|------|
| `AI_MODEL` | AI 模型（默认: gpt-4o-mini） | Production, Preview |
| `AI_SERVICE_URL` | AI-Service 地址（如果使用） | Production, Preview |
| `AI_SERVICE_TOKEN` | AI-Service Token（如果使用） | Production, Preview |

## 🔍 验证配置

### 方法 1: 检查环境变量

在 Vercel Dashboard 中：
1. 进入 **Settings** → **Environment Variables**
2. 确认所有必需变量都已配置
3. 确认每个变量都选择了正确的环境（Preview/Production）

### 方法 2: 测试 API

部署后，访问健康检查端点：

```bash
curl https://your-preview-url.vercel.app/api/ai/chat
```

应该返回：
```json
{
  "ok": true,
  "data": {
    "service": "ai-chat",
    "model": "gpt-4o-mini",
    "ts": "2025-11-04T..."
  }
}
```

### 方法 3: 测试 AI 对话

在浏览器中打开预览 URL，测试 AI 对话功能。

## 🚨 常见问题

### Q1: 配置了环境变量但仍然是错误？

**A:** 
1. 确认环境变量选择了 **Preview** 环境
2. 确认已重新部署（环境变量不会自动应用到现有部署）
3. 检查变量名拼写是否正确（大小写敏感）

### Q2: 不想在生产环境使用 USER_JWT_SECRET？

**A:** 
- 如果只是测试，可以在代码中临时允许 Preview 环境跳过认证
- 但生产环境应该配置 `USER_JWT_SECRET` 以确保安全性

### Q3: 如何区分不同环境？

**A:** 
- Vercel 提供了 `VERCEL_ENV` 环境变量：
  - `development` - 本地开发
  - `preview` - Preview 部署
  - `production` - 生产环境

## 🔒 生产环境安全要求

**⚠️ 重要**：生产环境有严格的安全要求，必须配置以下环境变量：

| 环境变量 | 是否必需 | 说明 |
|---------|---------|------|
| `USER_JWT_SECRET` | ✅ **必需** | 生产环境必须配置，否则 API 会拒绝所有请求 |
| `OPENAI_API_KEY` | ✅ **必需** | 生产环境必须配置，否则无法调用 OpenAI API |

### 生产环境安全检查

代码会在请求处理前进行安全检查：

1. **启动检查**：在处理请求前，检查必需的环境变量是否配置
2. **JWT 验证**：生产环境必须提供有效的 JWT Token
3. **错误日志**：所有安全相关错误都会记录到日志

### 生产环境配置清单

在部署到生产环境前，确保在 Vercel Dashboard 中配置：

```bash
# 必需的环境变量（Production 环境）
USER_JWT_SECRET=<your-secret-key>  # 至少 32 个字符
OPENAI_API_KEY=sk-xxx...           # OpenAI API 密钥
AI_MODEL=gpt-4o-mini               # 可选，默认值
```

### 验证生产环境配置

部署后，可以通过以下方式验证：

```bash
# 测试健康检查（不需要认证）
curl https://your-domain.vercel.app/api/ai/chat

# 应该返回配置信息
{
  "ok": true,
  "data": {
    "service": "ai-chat",
    "model": "gpt-4o-mini",
    "ts": "..."
  }
}
```

如果返回 `SERVER_MISCONFIG` 错误，说明必需的环境变量未配置。

## 📚 相关文档

- [环境变量配置指南](./ENV_SETUP.md)
- [Vercel 环境变量流程](./VERCEL_ENV_FLOW.md)
- [AI 环境变量配置](./AI_ENV_SETUP.md)

