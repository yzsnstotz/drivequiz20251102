# OpenRouter 故障排查指南

## 502 Bad Gateway 错误

### 常见原因

1. **环境变量未正确设置**
2. **AI Service 未重启**
3. **API Key 无效或未设置**
4. **模型名称不正确**
5. **网络连接问题**

### 排查步骤

#### 1. 检查环境变量

确保在 **AI Service** 的环境变量中设置了以下变量：

```bash
# 必需
OPENROUTER_API_KEY=sk-or-v1-xxxxx
OPENAI_BASE_URL=https://openrouter.ai/api/v1

# 可选
OPENROUTER_REFERER_URL=https://zalem.app
OPENROUTER_APP_NAME=ZALEM
```

**重要**：
- 这些环境变量需要在 **AI Service** 中设置，而不是主站
- 如果使用本地开发，确保在 `apps/ai-service/.env` 或 `apps/ai-service/.env.local` 中设置

#### 2. 重启 AI Service

修改环境变量后，**必须重启 AI Service** 才能生效：

```bash
# 如果使用本地开发
cd apps/ai-service
npm run dev

# 或者如果使用 Docker
docker-compose restart ai-service

# 或者如果使用 PM2
pm2 restart ai-service
```

#### 3. 验证 API Key

测试 OpenRouter API Key 是否有效：

```bash
curl https://openrouter.ai/api/v1/models \
  -H "Authorization: Bearer sk-or-v1-xxxxx"
```

如果返回 401 错误，说明 API Key 无效。

#### 4. 检查模型名称

确保在配置中心选择的模型名称格式正确：

- ✅ 正确：`openai/gpt-4o-mini`
- ❌ 错误：`gpt-4o-mini`（缺少 provider 前缀）

#### 5. 查看 AI Service 日志

检查 AI Service 的日志以获取详细错误信息：

```bash
# 本地开发
# 查看终端输出

# Docker
docker logs ai-service

# PM2
pm2 logs ai-service
```

常见错误信息：

- `OPENROUTER_API_KEY is not set` - API Key 未设置
- `Invalid API key` - API Key 无效
- `Model 'xxx' not found` - 模型名称不正确
- `Rate limit exceeded` - 达到速率限制

#### 6. 测试 AI Service 健康状态

```bash
# 检查健康状态
curl http://localhost:8787/healthz

# 检查就绪状态
curl http://localhost:8787/readyz
```

#### 7. 直接测试 AI Service API

```bash
curl -X POST http://localhost:8787/v1/ask \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SERVICE_TOKEN" \
  -d '{
    "question": "测试问题",
    "lang": "zh"
  }'
```

### 常见错误及解决方案

#### 错误 1: `OPENROUTER_API_KEY is not set`

**原因**：环境变量未设置或未读取

**解决方案**：
1. 检查 `.env` 文件是否存在
2. 确认环境变量名称正确（`OPENROUTER_API_KEY`）
3. 重启 AI Service

#### 错误 2: `Invalid API key`

**原因**：API Key 无效或已过期

**解决方案**：
1. 访问 [OpenRouter Keys](https://openrouter.ai/keys) 检查 API Key
2. 创建新的 API Key
3. 更新环境变量并重启服务

#### 错误 3: `Model 'xxx' not found`

**原因**：模型名称格式不正确或模型不可用

**解决方案**：
1. 检查模型名称格式（应该是 `provider/model`）
2. 访问 [OpenRouter Models](https://openrouter.ai/models) 查看可用模型
3. 在配置中心选择正确的模型

#### 错误 4: `Rate limit exceeded`

**原因**：达到 OpenRouter 的速率限制

**解决方案**：
1. 等待一段时间后重试
2. 检查 OpenRouter 账户的配额
3. 考虑升级 OpenRouter 计划

#### 错误 5: 502 Bad Gateway（无详细错误信息）

**原因**：可能是网络问题或 AI Service 未运行

**解决方案**：
1. 检查 AI Service 是否正在运行
2. 检查网络连接
3. 查看 AI Service 日志获取详细错误

### 调试技巧

#### 1. 启用详细日志

在 AI Service 中，检查控制台输出，应该能看到：

```
[STEP 0] 开始选择AI服务
[STEP 0.2] 从数据库读取aiProvider配置
[STEP 0.4] 已选择OpenRouterAI服务
```

#### 2. 检查环境变量加载

在 AI Service 启动时，应该能看到环境变量加载日志。

#### 3. 测试 OpenRouter 连接

```bash
# 测试 OpenRouter API
curl https://openrouter.ai/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "HTTP-Referer: https://zalem.app" \
  -H "X-Title: ZALEM" \
  -d '{
    "model": "openai/gpt-4o-mini",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

### 验证清单

- [ ] `OPENROUTER_API_KEY` 已设置
- [ ] `OPENAI_BASE_URL` 设置为 `https://openrouter.ai/api/v1`
- [ ] AI Service 已重启
- [ ] 在配置中心选择了 "OpenRouter"
- [ ] 模型名称格式正确（`provider/model`）
- [ ] API Key 有效（通过 curl 测试）
- [ ] AI Service 正在运行
- [ ] 网络连接正常

### 获取帮助

如果以上步骤都无法解决问题，请：

1. 收集 AI Service 的完整日志
2. 记录错误发生的具体时间
3. 记录使用的模型名称
4. 检查 OpenRouter Dashboard 中的使用记录

