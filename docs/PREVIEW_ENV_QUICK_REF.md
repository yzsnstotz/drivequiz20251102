# Preview 环境配置快速参考

## 必需的环境变量

在 Vercel Preview 环境中添加以下环境变量：

### 本地 AI 服务配置

```bash
USE_LOCAL_AI=true
LOCAL_AI_SERVICE_URL=http://127.0.0.1:8788
LOCAL_AI_SERVICE_TOKEN=local_ai_token_dev_12345
```

### 在线 AI 服务配置（备用）

```bash
AI_SERVICE_URL=https://zalem.onrender.com
AI_SERVICE_TOKEN=0c2a86471894beb557d858775a3217f6
```

## 快速检查本地 AI 服务

### 方法 1：使用检查脚本

```bash
./scripts/check-local-ai.sh
```

### 方法 2：健康检查端点

```bash
curl http://127.0.0.1:8788/healthz
```

**成功响应**：
```json
{
  "ok": true,
  "data": {
    "status": "ok",
    "version": "1.0.0",
    "model": "llama3.2:3b",
    "embeddingModel": "nomic-embed-text",
    "env": "development",
    "time": "2025-11-06T18:02:30.647Z"
  }
}
```

### 方法 3：检查端口

```bash
# 使用 lsof
lsof -i :8788

# 或使用 netstat
netstat -an | grep 8788
```

### 方法 4：测试 API

```bash
curl -X POST http://127.0.0.1:8788/v1/ask \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer local_ai_token_dev_12345" \
  -d '{"question": "测试", "lang": "zh"}'
```

## 启动本地 AI 服务

```bash
cd apps/local-ai-service
pnpm dev
```

## 重要提示

⚠️ **Preview 环境限制**：
- Preview 环境无法访问 `localhost` 或 `127.0.0.1`
- 如果需要在 Preview 环境使用本地 AI，需要将本地 AI 服务部署到可访问的 URL
- 或者使用在线 AI 服务（设置 `USE_LOCAL_AI=false`）

## 验证配置

在 Preview 环境中测试：

```bash
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

## 详细文档

更多信息请参考：[PREVIEW_ENV_SETUP.md](./PREVIEW_ENV_SETUP.md)

