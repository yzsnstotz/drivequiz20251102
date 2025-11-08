# 🔧 AI 对话 500 错误排查指南

## 问题描述

本地测试时，AI 对话返回 500 Internal Server Error：
```
POST http://localhost:3001/api/ai/ask 500 (Internal Server Error)
```

## 🔍 排查步骤

### 1. 检查环境变量配置

确保 `.env.local` 文件中配置了以下环境变量：

```bash
# AI-Service 配置（必需）
AI_SERVICE_URL=https://zalem.onrender.com  # 或你的 Render 服务 URL
AI_SERVICE_TOKEN=你的服务Token

# JWT 配置（可选，用于用户认证）
USER_JWT_PUBLIC_KEY=你的JWT公钥  # 如果未配置，允许匿名访问
```

**检查方法：**
```bash
# 在项目根目录执行
cat .env.local | grep AI_SERVICE
```

**如果环境变量未配置：**
- 错误信息会显示：`"AI service is not configured."`
- 响应中会包含 `details.missing` 字段，列出缺失的变量

### 2. 检查服务器终端日志

查看 Next.js 开发服务器的终端输出，查找错误信息：

```
[AI Ask Route] Unexpected error: {
  message: "错误信息",
  stack: "错误堆栈",
  env: {
    hasAiServiceUrl: true/false,
    hasAiServiceToken: true/false,
    nodeEnv: "development"
  }
}
```

### 3. 常见错误原因

#### 3.1 环境变量未配置

**错误信息：**
```json
{
  "ok": false,
  "errorCode": "INTERNAL_ERROR",
  "message": "AI service is not configured.",
  "details": {
    "missing": ["AI_SERVICE_URL", "AI_SERVICE_TOKEN"]
  }
}
```

**解决方法：**
1. 创建 `.env.local` 文件（如果不存在）
2. 添加必需的环境变量
3. **重启 Next.js 开发服务器**（环境变量更改后需要重启）

#### 3.2 AI-Service 不可达

**错误信息：**
```json
{
  "ok": false,
  "errorCode": "PROVIDER_ERROR",
  "message": "AI service is unreachable: ..."
}
```

**可能原因：**
- `AI_SERVICE_URL` 配置错误
- Render 服务未启动或不可用
- 网络连接问题

**解决方法：**
1. 检查 `AI_SERVICE_URL` 是否正确
2. 访问 Render Dashboard 确认服务状态
3. 测试服务是否可达：
   ```bash
   curl https://zalem.onrender.com/healthz
   ```

#### 3.3 Service Token 不匹配

**错误信息：**
```json
{
  "ok": false,
  "errorCode": "AUTH_REQUIRED",
  "message": "Invalid or expired authentication token."
}
```

**解决方法：**
1. 确认 `AI_SERVICE_TOKEN` 与 Render 服务中的 `SERVICE_TOKENS` 环境变量匹配
2. 检查 Render Dashboard 中的环境变量配置

#### 3.4 请求超时

**错误信息：**
```json
{
  "ok": false,
  "errorCode": "PROVIDER_ERROR",
  "message": "AI service request timeout."
}
```

**解决方法：**
- 检查 AI-Service 是否响应缓慢
- 检查网络连接
- 检查 Render 服务日志

#### 3.5 JSON 解析错误

**错误信息：**
```json
{
  "ok": false,
  "errorCode": "PROVIDER_ERROR",
  "message": "Invalid response from AI service: ..."
}
```

**解决方法：**
- 检查 AI-Service 返回的响应格式
- 查看 Render 服务日志

### 4. 调试步骤

#### 步骤 1: 检查环境变量

```bash
# 在项目根目录
cd /Users/leo/Desktop/kkdrivequiz
cat .env.local | grep -E "AI_SERVICE|NODE_ENV"
```

**预期输出：**
```
AI_SERVICE_URL=https://zalem.onrender.com
AI_SERVICE_TOKEN=svc_token_xxx
NODE_ENV=development
```

#### 步骤 2: 检查服务器日志

启动 Next.js 开发服务器后，发送一个 AI 对话请求，查看终端输出：

```bash
npm run dev
# 或
yarn dev
```

**预期输出（成功）：**
- 无错误信息
- 请求正常返回

**异常输出（失败）：**
```
[AI Ask Route] Unexpected error: {
  message: "...",
  stack: "...",
  env: { ... }
}
```

#### 步骤 3: 测试 AI-Service 连接

```bash
# 测试健康检查
curl https://zalem.onrender.com/healthz

# 测试 API 端点（需要 Service Token）
curl -X POST https://zalem.onrender.com/v1/ask \
  -H "Authorization: Bearer YOUR_SERVICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question":"测试","lang":"zh"}'
```

#### 步骤 4: 检查浏览器控制台

打开浏览器开发者工具（F12），查看：
1. **Network 标签**：查看 `/api/ai/ask` 请求的详细信息
2. **Console 标签**：查看是否有客户端错误

**请求详情：**
- Status: 应显示 200（成功）或具体错误码
- Response: 查看响应体内容
- Headers: 查看请求和响应头

### 5. 快速修复检查清单

- [ ] `.env.local` 文件存在且包含 `AI_SERVICE_URL` 和 `AI_SERVICE_TOKEN`
- [ ] 环境变量值正确（无多余空格、引号等）
- [ ] Next.js 开发服务器已重启（环境变量更改后）
- [ ] Render 服务正常运行（检查 Render Dashboard）
- [ ] `AI_SERVICE_TOKEN` 与 Render 的 `SERVICE_TOKENS` 匹配
- [ ] 网络连接正常（可以访问 Render 服务）

### 6. 获取更多调试信息

如果问题仍然存在，请提供以下信息：

1. **服务器终端日志**（完整的错误堆栈）
2. **浏览器 Network 标签**中的请求详情
3. **环境变量配置**（隐藏敏感信息）：
   ```bash
   cat .env.local | grep AI_SERVICE | sed 's/=.*/=***/'
   ```
4. **AI-Service 健康检查结果**：
   ```bash
   curl -I https://zalem.onrender.com/healthz
   ```

### 7. 常见配置示例

**`.env.local` 文件示例：**

```bash
# AI-Service 配置
AI_SERVICE_URL=https://zalem.onrender.com
AI_SERVICE_TOKEN=svc_token_abc123

# 可选：JWT 配置（如果使用用户认证）
USER_JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----
...
-----END PUBLIC KEY-----

# Node 环境
NODE_ENV=development
```

**注意：**
- `.env.local` 文件不应提交到 Git（已在 `.gitignore` 中）
- 环境变量值不要加引号（除非值本身包含引号）
- 修改环境变量后需要重启开发服务器

---

**最后更新：** 2025-11-04






