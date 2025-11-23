# JWT UserID 为 null 问题排查指南

## 🔍 问题描述

用户的 `userid` 显示为 `null`，即使已经配置了 `USER_JWT_SECRET` 环境变量。

## 📋 架构说明

### 路由使用情况

- **前端使用**: `/api/ai/ask`（推荐路由）
- **JWT 验证方式**: 
  - `/api/ai/ask` 使用 `USER_JWT_PUBLIC_KEY`（RS256，Supabase JWT 公钥）
  - `/api/ai/chat` 使用 `USER_JWT_SECRET`（HS256，Legacy JWT Secret）

### 部署架构

```
用户浏览器
    ↓
Vercel (Next.js 主站)
    ↓ /api/ai/ask
Render (AI-Service) ← 不需要重启，JWT 验证在 Vercel 上完成
```

## ✅ 解决方案

### 1. 确认环境变量配置

**重要**：如果使用 `/api/ai/ask` 路由，需要配置 `USER_JWT_PUBLIC_KEY`，而不是 `USER_JWT_SECRET`。

#### 在 Vercel Dashboard 中配置：

1. 进入项目设置 → Environment Variables
2. 添加环境变量：
   - **Key**: `USER_JWT_PUBLIC_KEY`
   - **Value**: Supabase JWT 公钥（PEM 格式，从 Supabase Dashboard → Settings → API → JWT Settings 获取）
   - **Environment**: Production, Preview, Development

#### 如何获取 Supabase JWT 公钥：

1. 登录 Supabase Dashboard
2. 进入项目设置 → API
3. 找到 "JWT Settings" 部分
4. 复制 "JWT Secret" 旁边的 "Public Key"（PEM 格式）

### 2. 触发 Vercel 重新部署

如果刚刚配置了环境变量，需要触发 Vercel 重新部署以读取新环境变量：

#### 方法 A：手动触发部署（推荐）

1. 在 Vercel Dashboard 中，进入项目的 Deployments 页面
2. 点击最新的部署右侧的 "..." 菜单
3. 选择 "Redeploy"
4. 确认重新部署

#### 方法 B：通过 Git 触发

如果启用了 Auto Deploy，可以：
1. 创建一个空的 commit：`git commit --allow-empty -m "trigger redeploy"`
2. 推送到 GitHub：`git push`
3. Vercel 会自动检测并部署

### 3. 检查 JWT Token 格式

JWT token 的 payload 必须包含有效的用户 ID 字段，并且必须是 UUID 格式。

#### 检查 JWT Token：

可以使用以下脚本检查 JWT token：

```bash
# 使用诊断脚本
npx tsx scripts/debug-jwt-userid.ts <your-jwt-token>
```

或者手动检查：

1. 复制 JWT token（从浏览器 localStorage 中的 `USER_TOKEN`）
2. 访问 https://jwt.io 解码 token
3. 检查 payload 中的字段：
   - `sub`: 用户 ID（Supabase 默认使用此字段）
   - `user_id`: 备选字段
   - `userId`: 备选字段
   - `id`: 备选字段

4. 验证用户 ID 是否为有效的 UUID 格式：
   ```
   格式: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   示例: 123e4567-e89b-12d3-a456-426614174000
   ```

### 4. 检查代码逻辑

代码会按以下顺序尝试提取用户 ID：

1. 从 JWT payload 中提取 `sub`、`user_id`、`userId` 或 `id` 字段
2. 验证是否为有效的 UUID 格式
3. 如果不是 UUID 格式，设置为 `null`（将被视为匿名用户）

## 🔧 调试步骤

### 步骤 1：确认使用的路由

检查前端代码确认使用的路由：

```typescript
// src/components/AIPage.tsx
const CHAT_PATH = "/api/ai/ask"; // 确认使用此路由
```

### 步骤 2：检查环境变量

在 Vercel Dashboard 中确认：
- ✅ `USER_JWT_PUBLIC_KEY` 已配置（如果使用 `/api/ai/ask`）
- ✅ 环境变量已应用到正确的环境（Production/Preview/Development）

### 步骤 3：检查 JWT Token

1. 在浏览器控制台中运行：
   ```javascript
   localStorage.getItem("USER_TOKEN")
   ```
2. 复制 token 并使用诊断脚本检查

### 步骤 4：查看服务器日志

在 Vercel Dashboard 的 Functions 日志中查看：
- JWT 验证是否成功
- 是否有错误信息

## ❌ 常见问题

### Q1: 为什么配置了 USER_JWT_SECRET 但 userid 还是 null？

**A**: 如果使用 `/api/ai/ask` 路由，需要配置 `USER_JWT_PUBLIC_KEY`，而不是 `USER_JWT_SECRET`。

### Q2: 是否需要重启 Render？

**A**: 不需要。JWT 验证在 Vercel 上完成，与 Render 无关。

### Q3: 配置环境变量后需要做什么？

**A**: 需要触发 Vercel 重新部署以读取新环境变量。

### Q4: JWT token 验证成功但 userid 还是 null？

**A**: 检查 JWT token 的 payload 中是否包含有效的 UUID 格式的用户 ID。如果用户 ID 不是 UUID 格式，代码会将其设置为 `null`。

## 📝 检查清单

- [ ] 确认使用 `/api/ai/ask` 路由
- [ ] 在 Vercel Dashboard 中配置 `USER_JWT_PUBLIC_KEY`（不是 `USER_JWT_SECRET`）
- [ ] 环境变量已应用到正确的环境（Production/Preview/Development）
- [ ] 触发 Vercel 重新部署
- [ ] JWT token 的 payload 中包含有效的用户 ID 字段（`sub`、`user_id`、`userId` 或 `id`）
- [ ] 用户 ID 是有效的 UUID 格式
- [ ] 检查服务器日志确认没有错误

## 🎯 总结

1. **不需要重启 Render** - JWT 验证在 Vercel 上完成
2. **配置正确的环境变量** - 使用 `/api/ai/ask` 需要配置 `USER_JWT_PUBLIC_KEY`
3. **触发 Vercel 重新部署** - 配置环境变量后需要重新部署
4. **检查 JWT Token 格式** - 确保 payload 中包含有效的 UUID 格式的用户 ID

