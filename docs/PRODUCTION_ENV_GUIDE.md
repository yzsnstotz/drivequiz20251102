# 生产环境配置指南

## ⚠️ 重要说明：生产环境无法访问本地服务

**生产环境（Production）无法访问运行在本地机器上的服务（localhost 或 127.0.0.1）**

### 原因

1. **网络隔离**：
   - Vercel Production 环境运行在云端的独立容器中
   - 这些容器无法访问你的本地网络
   - `localhost` 和 `127.0.0.1` 在生产环境中指向容器本身，而不是你的本地机器

2. **架构限制**：
   - 生产环境是分布式的，可能运行在多个不同的服务器上
   - 本地服务只在你的开发机器上运行
   - 两者之间没有网络连接

## 解决方案

### 方案 1：使用在线 AI 服务（推荐，最简单）

在生产环境中使用已部署的在线 AI 服务：

```bash
# 在 Vercel Production 环境变量中设置
USE_LOCAL_AI=false
AI_SERVICE_URL=https://zalem.onrender.com
AI_SERVICE_TOKEN=0c2a86471894beb557d858775a3217f6
```

**优点**：
- 简单直接
- 无需额外部署
- 稳定可靠

### 方案 2：将本地服务器暴露为公共服务器

将本地 AI 服务暴露为公共服务器，让生产环境可以访问。有多种方案：

#### 2.1 使用 ngrok（开发测试）

```bash
# 安装 ngrok
brew install ngrok

# 配置 authtoken
ngrok config add-authtoken YOUR_AUTH_TOKEN

# 暴露本地服务
ngrok http 8788
```

**输出**：`https://abc123.ngrok-free.app -> http://localhost:8788`

**在 Vercel Production 中配置**：
```bash
USE_LOCAL_AI=true
LOCAL_AI_SERVICE_URL=https://abc123.ngrok-free.app
LOCAL_AI_SERVICE_TOKEN=local_ai_token_dev_12345
```

**优点**：简单快速、支持 HTTPS
**缺点**：免费版 URL 会变化、有连接限制

**详细说明**：请参考 [EXPOSE_LOCAL_SERVER.md](./EXPOSE_LOCAL_SERVER.md)

#### 2.2 使用 Cloudflare Tunnel（生产推荐）

```bash
# 安装 cloudflared
brew install cloudflared

# 创建隧道
cloudflared tunnel create local-ai-service
cloudflared tunnel route dns local-ai-service ai.yourdomain.com
```

**在 Vercel Production 中配置**：
```bash
USE_LOCAL_AI=true
LOCAL_AI_SERVICE_URL=https://ai.yourdomain.com
LOCAL_AI_SERVICE_TOKEN=local_ai_token_dev_12345
```

**优点**：免费、稳定、可自定义域名、支持 HTTPS
**缺点**：配置稍复杂

**详细说明**：请参考 [EXPOSE_LOCAL_SERVER.md](./EXPOSE_LOCAL_SERVER.md)

### 方案 3：部署本地 AI 服务到云端

将本地 AI 服务部署到可访问的 URL（如 Render、Railway、Vercel 等）：

#### 3.1 部署到 Render

1. 创建新的 Web Service
2. 连接 GitHub 仓库
3. 设置构建命令：`cd apps/local-ai-service && pnpm install && pnpm build`
4. 设置启动命令：`cd apps/local-ai-service && pnpm start`
5. 配置环境变量：
   - `PORT=8788`
   - `HOST=0.0.0.0`
   - `SERVICE_TOKENS=your_token_here`
   - `SUPABASE_URL=...`
   - `SUPABASE_SERVICE_KEY=...`
   - `OLLAMA_BASE_URL=...`
   - `AI_MODEL=...`
   - `EMBEDDING_MODEL=...`

6. 获取部署后的 URL（如：`https://your-local-ai-service.onrender.com`）

#### 3.2 在 Vercel Production 中配置

```bash
# 在 Vercel Production 环境变量中设置
USE_LOCAL_AI=true
LOCAL_AI_SERVICE_URL=https://your-local-ai-service.onrender.com
LOCAL_AI_SERVICE_TOKEN=your_token_here
```

**优点**：
- 可以使用本地 AI 服务（Ollama）
- 完全控制 AI 模型和配置
- 可以自定义和优化

**缺点**：
- 需要额外的部署和维护
- 需要额外的服务器资源
- 可能产生额外费用

### 方案 3：使用 Vercel Serverless Functions

如果本地 AI 服务足够轻量，可以考虑将其转换为 Vercel Serverless Function：

1. 将本地 AI 服务代码迁移到 Vercel Functions
2. 在同一个 Vercel 项目中部署
3. 使用内部 URL 调用（如：`https://your-project.vercel.app/api/local-ai`）

**注意**：
- Serverless Functions 有执行时间限制
- 可能不适合长时间运行的 AI 推理任务
- 需要确保 Ollama 可以在 Serverless 环境中运行

## 生产环境推荐配置

### 推荐配置（使用在线 AI 服务）

```bash
# Vercel Production 环境变量
USE_LOCAL_AI=false
AI_SERVICE_URL=https://zalem.onrender.com
AI_SERVICE_TOKEN=0c2a86471894beb557d858775a3217f6
```

### 如果使用部署的本地 AI 服务

```bash
# Vercel Production 环境变量
USE_LOCAL_AI=true
LOCAL_AI_SERVICE_URL=https://your-local-ai-service.onrender.com
LOCAL_AI_SERVICE_TOKEN=your_production_token_here

# 备用在线 AI 服务
AI_SERVICE_URL=https://zalem.onrender.com
AI_SERVICE_TOKEN=0c2a86471894beb557d858775a3217f6
```

## 环境变量配置表

| 环境 | USE_LOCAL_AI | LOCAL_AI_SERVICE_URL | 说明 |
|------|--------------|---------------------|------|
| **Development** | `true` | `http://127.0.0.1:8788` | 本地开发，可以访问本地服务 |
| **Preview** | `false` | - | 无法访问本地服务，使用在线服务 |
| **Production** | `false` | - | 无法访问本地服务，使用在线服务 |
| **Production（部署的本地 AI）** | `true` | `https://your-service.com` | 使用部署到云端的本地 AI 服务 |

## 验证配置

### 1. 检查环境变量

在 Vercel Dashboard 中确认：
- **Settings** > **Environment Variables**
- 确认 Production 环境变量已正确设置

### 2. 测试 API 端点

```bash
# 测试生产环境 API
curl -I -X POST https://your-production-url.vercel.app/api/ai/ask?ai=online \
  -H "Content-Type: application/json" \
  -d '{"question":"test","locale":"zh"}'
```

**期望的响应头**：
```
x-route-fingerprint: ask-route-fp-*
x-ai-service-mode: online
x-ai-service-url: https://zalem.onrender.com
```

### 3. 检查日志

在 Vercel Dashboard 中查看函数日志：
- **Deployments** > 选择部署 > **Functions** > 查看日志
- 确认 AI 服务选择逻辑正确执行

## 常见问题

### Q1: 为什么生产环境无法访问本地服务？

**A**: 生产环境运行在云端容器中，与你的本地机器没有网络连接。`localhost` 和 `127.0.0.1` 在生产环境中指向容器本身，而不是你的本地机器。

### Q2: 如何在生产环境使用本地 AI 服务？

**A**: 需要将本地 AI 服务部署到可访问的 URL（如 Render、Railway 等），然后在 Vercel Production 环境变量中配置该 URL。

### Q3: 生产环境应该使用哪个 AI 服务？

**A**: 推荐使用在线 AI 服务（`USE_LOCAL_AI=false`），因为：
- 更简单，无需额外部署
- 更稳定，由专业团队维护
- 更可靠，有更好的可用性保障

### Q4: 如何在不同环境使用不同的 AI 服务？

**A**: 在 Vercel Dashboard 中为不同环境设置不同的环境变量：
- **Development**: 使用本地服务
- **Preview**: 使用在线服务
- **Production**: 使用在线服务或部署的本地服务

## 最佳实践

1. **开发环境**：
   - 使用本地 AI 服务（`USE_LOCAL_AI=true`，`LOCAL_AI_SERVICE_URL=http://127.0.0.1:8788`）
   - 便于调试和开发

2. **Preview 环境**：
   - 使用在线 AI 服务（`USE_LOCAL_AI=false`）
   - 验证功能是否正常

3. **Production 环境**：
   - 使用在线 AI 服务（`USE_LOCAL_AI=false`）
   - 或使用部署到云端的本地 AI 服务（`USE_LOCAL_AI=true`，`LOCAL_AI_SERVICE_URL=https://...`）

## 总结

- ❌ **生产环境无法访问本地服务**（localhost/127.0.0.1）
- ✅ **推荐使用在线 AI 服务**（简单、稳定、可靠）
- ✅ **如需使用本地 AI，需部署到云端**（Render、Railway 等）
- ✅ **通过环境变量控制不同环境的行为**

