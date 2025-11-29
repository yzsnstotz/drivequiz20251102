# Preview 环境配置指南

## 需要添加的环境变量

在 Vercel Preview 环境中，需要添加以下环境变量：

### 1. 本地 AI 服务配置（如果使用本地 AI）

```bash
USE_LOCAL_AI=true
LOCAL_AI_SERVICE_URL=http://127.0.0.1:8788
LOCAL_AI_SERVICE_TOKEN=local_ai_token_dev_12345
```

**注意**：
- `USE_LOCAL_AI=true`：启用本地 AI 服务
- `LOCAL_AI_SERVICE_URL`：本地 AI 服务的 URL（默认 `http://127.0.0.1:8788`）
- `LOCAL_AI_SERVICE_TOKEN`：本地 AI 服务的认证令牌

### 2. 在线 AI 服务配置（备用或默认）

```bash
AI_SERVICE_URL=https://zalem.onrender.com
AI_SERVICE_TOKEN=0c2a86471894beb557d858775a3217f6
```

**注意**：
- 如果 `USE_LOCAL_AI=false` 或未设置，将使用在线 AI 服务
- 这些变量作为备用配置保留

### 3. 强制选择 AI 服务模式

可以通过 URL 参数强制选择 AI 服务：
- `?ai=local`：强制使用本地 AI 服务
- `?ai=online`：强制使用在线 AI 服务

## 在 Vercel 中添加环境变量

1. 登录 Vercel Dashboard
2. 选择你的项目
3. 进入 **Settings** > **Environment Variables**
4. 添加以下变量：

| 变量名 | 值 | 环境 | 说明 |
|--------|-----|------|------|
| `USE_LOCAL_AI` | `false` | Preview, Production | ⚠️ Preview/Production 无法访问本地服务 |
| `LOCAL_AI_SERVICE_URL` | - | Preview, Production | 如需使用，需部署到云端 URL |
| `LOCAL_AI_SERVICE_TOKEN` | - | Preview, Production | 如需使用，配置部署服务的 token |
| `AI_SERVICE_URL` | `https://zalem.onrender.com` | Preview, Production | 推荐使用在线 AI 服务 |
| `AI_SERVICE_TOKEN` | `0c2a86471894beb557d858775a3217f6` | Preview, Production | 在线 AI 服务 token |

**⚠️ 重要提示**：
- Preview 和 Production 环境**无法访问** `localhost` 或 `127.0.0.1`
- 如果需要在 Preview/Production 使用本地 AI，需要将服务部署到可访问的 URL（如 Render、Railway 等）
- 推荐在 Preview/Production 使用在线 AI 服务（设置 `USE_LOCAL_AI=false`）

## 检查本地 AI 服务是否已启动

### 方法 1：健康检查端点

本地 AI 服务提供健康检查端点：`/healthz`

```bash
# 检查服务是否运行
curl http://127.0.0.1:8788/healthz
```

**成功响应示例**：
```json
{
  "ok": true,
  "data": {
    "status": "ok",
    "version": "1.0.0",
    "model": "llama3.2:3b",
    "embeddingModel": "nomic-embed-text",
    "env": "development",
    "time": "2025-11-06T12:00:00.000Z"
  }
}
```

**失败响应**：
- 连接被拒绝：服务未启动
- 404 错误：服务在运行但端点不存在
- 超时：服务可能未启动或端口被占用

### 方法 2：测试 API 端点

```bash
# 测试 /v1/ask 端点（需要认证）
curl -X POST http://127.0.0.1:8788/v1/ask \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer local_ai_token_dev_12345" \
  -d '{
    "question": "测试问题",
    "lang": "zh"
  }'
```

### 方法 3：检查进程

```bash
# 检查端口是否被占用
lsof -i :8788

# 或使用 netstat
netstat -an | grep 8788

# 检查进程
ps aux | grep "local-ai-service"
```

### 方法 4：查看日志

如果服务是通过 `pnpm dev` 启动的，查看日志：

```bash
# 查看服务日志
tail -f /tmp/local-ai.log

# 或直接查看进程输出
```

## 启动本地 AI 服务

### 开发环境

```bash
cd apps/local-ai-service
pnpm dev
```

### 生产环境

```bash
cd apps/local-ai-service
pnpm build
pnpm start
```

## 验证配置

### 1. 检查环境变量是否加载

在 Preview 环境中，可以通过以下方式验证：

```bash
# 在浏览器控制台或 API 响应中检查
# 响应头应包含：
# x-route-fingerprint: ask-route-fp-*
# x-ai-service-mode: local 或 online
# x-ai-service-url: http://127.0.0.1:8788 或 https://zalem.onrender.com
```

### 2. 测试 API 端点

```bash
# 强制使用本地 AI
curl -X POST https://your-preview-url.vercel.app/api/ai/ask?ai=local \
  -H "Content-Type: application/json" \
  -d '{
    "question": "测试问题",
    "locale": "zh"
  }'

# 检查响应头
curl -I -X POST https://your-preview-url.vercel.app/api/ai/ask?ai=local \
  -H "Content-Type: application/json" \
  -d '{"question":"test","locale":"zh"}'
```

**期望的响应头**：
```
x-route-fingerprint: ask-route-fp-*
x-ai-service-mode: local
x-ai-service-url: http://127.0.0.1:8788
```

## 常见问题

### 1. 本地 AI 服务无法连接

**问题**：Preview/Production 环境无法连接到 `http://127.0.0.1:8788`

**原因**：Preview 和 Production 环境是独立的云端容器，无法访问本地服务

**解决方案**：
- **推荐**：使用在线 AI 服务（设置 `USE_LOCAL_AI=false`）
- **替代方案**：如果需要在 Preview/Production 使用本地 AI，需要将本地 AI 服务部署到可访问的 URL（如 Render、Railway 等），然后配置 `LOCAL_AI_SERVICE_URL` 为部署后的 URL

**详细说明**：请参考 [PRODUCTION_ENV_GUIDE.md](./PRODUCTION_ENV_GUIDE.md)

### 2. 环境变量未生效

**检查**：
1. 确认环境变量已添加到 Vercel Dashboard
2. 确认已重新部署
3. 检查变量名拼写是否正确
4. 检查是否有 `.env.local` 文件覆盖了环境变量

### 3. 响应头未出现

**检查**：
1. 确认代码已部署最新版本
2. 检查是否有 middleware 拦截了响应头
3. 检查 Next.js 配置是否有响应头过滤

## 调试技巧

### 1. 查看服务器日志

在 Vercel Dashboard 中查看函数日志：
- **Deployments** > 选择部署 > **Functions** > 查看日志

### 2. 使用测试脚本

```bash
# 运行测试脚本
./scripts/test-ai-ask-route.sh
```

### 3. 检查响应头

```bash
# 使用 curl 检查响应头
curl -v -X POST https://your-preview-url.vercel.app/api/ai/ask?ai=local \
  -H "Content-Type: application/json" \
  -d '{"question":"test","locale":"zh"}' 2>&1 | grep -i "x-route\|x-ai"
```

## 注意事项

1. **Preview/Production 环境限制**：
   - ⚠️ **Preview 和 Production 环境无法访问 `localhost` 或 `127.0.0.1`**
   - 如果使用本地 AI，需要部署到可访问的 URL（如 Render、Railway 等）
   - **推荐**：在 Preview/Production 使用在线 AI 服务（设置 `USE_LOCAL_AI=false`）

2. **环境变量优先级**：
   - Vercel 环境变量 > `.env.local` > `.env`

3. **安全性**：
   - 不要在代码中硬编码敏感信息
   - 使用 Vercel 环境变量管理敏感配置

4. **生产环境配置**：
   - 详细说明请参考：[PRODUCTION_ENV_GUIDE.md](./PRODUCTION_ENV_GUIDE.md)

