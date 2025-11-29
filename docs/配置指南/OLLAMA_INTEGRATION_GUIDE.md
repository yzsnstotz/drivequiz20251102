# Ollama 集成配置指南

**创建时间**: 2025-01-15  
**适用场景**: 本地运行 Ollama，与 drivequiz 项目集成

---

## 📋 架构方案对比

### 方案 A: 作为模块集成到现有项目（推荐 ⭐⭐⭐⭐⭐）

**架构**:
```
本地电脑 (Ollama) → 本地 AI-Service → Next.js 主站
    或
本地电脑 (Ollama) → Render AI-Service (远程) → Vercel 主站
```

**优点**:
- ✅ **无需新建项目**：利用现有的 `apps/ai-service`
- ✅ **代码已支持**：`openaiClient.ts` 已支持 `OLLAMA_BASE_URL`
- ✅ **配置简单**：只需设置环境变量
- ✅ **架构统一**：保持 monorepo 结构
- ✅ **易于切换**：可在 OpenAI 和 Ollama 之间切换

**缺点**:
- ⚠️ 如果 AI-Service 部署在 Render，需要本地 Ollama 能够被远程访问（需配置网络）

---

### 方案 B: 单独建立 Ollama 代理服务（不推荐）

**架构**:
```
本地电脑 (Ollama) → 独立代理服务 → AI-Service → Next.js 主站
```

**优点**:
- ✅ 完全隔离，独立部署

**缺点**:
- ❌ **增加复杂度**：需要维护新项目
- ❌ **重复开发**：需要重新实现路由、认证等
- ❌ **架构不一致**：破坏现有 monorepo 结构
- ❌ **不必要的抽象**：AI-Service 已支持 Ollama

---

## 🎯 推荐方案：作为模块集成

**推荐使用方案 A**，因为：
1. 现有代码已支持 Ollama（通过 `OLLAMA_BASE_URL`）
2. 无需修改核心代码，只需配置环境变量
3. 保持架构一致性，便于维护

---

## 🔧 实施方案

### 场景 1: 本地开发（AI-Service 运行在本地）

**配置步骤**:

1. **安装 Ollama**（如果未安装）:
```bash
# macOS
brew install ollama

# 或使用官方安装脚本
curl -fsSL https://ollama.com/install.sh | sh
```

2. **启动 Ollama 服务**:
```bash
ollama serve
# 默认监听 http://localhost:11434
```

3. **拉取模型**（根据需要）:
```bash
# Chat 模型（用于问答）
ollama pull llama3.2
# 或
ollama pull qwen2.5

# Embedding 模型（用于向量化，如果需要）
ollama pull nomic-embed-text
```

4. **配置 AI-Service 环境变量**:

在 `apps/ai-service/.env` 或环境变量中设置：
```bash
# Ollama 配置
OLLAMA_BASE_URL=http://localhost:11434/v1
OPENAI_API_KEY=ollama  # Ollama 不需要真实 key，任意值即可
AI_MODEL=llama3.2      # 或你使用的 Ollama 模型名

# 其他配置保持不变
SERVICE_TOKENS=your_service_token
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_key
```

5. **启动 AI-Service**:
```bash
cd apps/ai-service
npm run dev
```

---

### 场景 2: 本地 Ollama + 远程 AI-Service（Render）

**架构**:
```
本地电脑 (Ollama) → 公网暴露 → Render (AI-Service) → Vercel (主站)
```

**配置步骤**:

1. **本地启动 Ollama**:
```bash
ollama serve
```

2. **暴露本地 Ollama 到公网**（选择一种方式）:

#### 方式 A: 使用 ngrok（推荐，简单）
```bash
# 安装 ngrok
brew install ngrok

# 暴露本地 11434 端口
ngrok http 11434

# 会得到类似这样的 URL: https://xxxx-xxx-xxx.ngrok.io
# 使用 https://xxxx-xxx-xxx.ngrok.io/v1 作为 OLLAMA_BASE_URL
```

#### 方式 B: 使用 Cloudflare Tunnel
```bash
# 安装 cloudflared
brew install cloudflared

# 创建隧道
cloudflared tunnel --url http://localhost:11434
```

#### 方式 C: 使用 SSH 隧道（如果 Render 支持 SSH）
```bash
# 在 Render 服务器上建立反向隧道
ssh -R 11434:localhost:11434 your-user@your-server
```

3. **配置 Render AI-Service 环境变量**:

在 Render Dashboard 的环境变量中添加：
```bash
OLLAMA_BASE_URL=https://your-ngrok-url.ngrok.io/v1
OPENAI_API_KEY=ollama
AI_MODEL=llama3.2
```

4. **重启 Render 服务**:
Render 会自动重启并应用新配置

---

### 场景 3: 本地 Ollama + 本地 AI-Service（完全本地开发）

**配置步骤**:

1. **启动 Ollama**:
```bash
ollama serve
```

2. **配置 AI-Service**:
在 `apps/ai-service/.env`:
```bash
OLLAMA_BASE_URL=http://localhost:11434/v1
OPENAI_API_KEY=ollama
AI_MODEL=llama3.2
```

3. **配置主站环境变量**:
在项目根目录 `.env.local`:
```bash
AI_SERVICE_URL=http://localhost:8787  # AI-Service 本地端口
AI_SERVICE_TOKEN=your_service_token
```

4. **启动服务**:
```bash
# 终端 1: 启动 AI-Service
cd apps/ai-service
npm run dev

# 终端 2: 启动主站
npm run dev
```

---

## 🔍 验证配置

### 1. 测试 Ollama 服务

```bash
# 测试 Ollama API
curl http://localhost:11434/api/tags

# 测试 Chat 接口
curl http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.2",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

### 2. 测试 AI-Service

```bash
# 测试 AI-Service 健康检查
curl http://localhost:8787/healthz

# 测试问答接口
curl -X POST http://localhost:8787/v1/ask \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_service_token" \
  -d '{
    "question": "测试问题",
    "lang": "zh",
    "userId": "test-user"
  }'
```

---

## 📝 代码说明

### 现有代码已支持 Ollama

查看 `apps/ai-service/src/lib/openaiClient.ts`:
```typescript
const baseUrl =
  process.env.OPENAI_BASE_URL?.trim() ||
  process.env.OLLAMA_BASE_URL?.trim() ||  // ← 已支持
  "https://api.openai.com/v1";

clientInstance = new OpenAI({
  apiKey: config.openaiApiKey,
  baseURL: baseUrl,  // ← 自动使用 Ollama URL
  // ...
});
```

**无需修改代码**，只需配置环境变量即可！

---

## ⚠️ 注意事项

### 1. 模型名称

- **Ollama 模型名**：使用 `ollama list` 查看本地模型
- **AI_MODEL 配置**：必须匹配 Ollama 模型名（如 `llama3.2`，不是 `gpt-4o-mini`）

### 2. 网络访问

- **本地开发**：`localhost` 即可
- **远程访问**：需要配置公网暴露（ngrok、隧道等）
- **防火墙**：确保端口可访问

### 3. 性能考虑

- **本地运行**：需要足够的 RAM（建议 8GB+）
- **GPU 加速**：如果有 GPU，Ollama 会自动使用
- **网络延迟**：如果远程访问，注意网络延迟

### 4. 向量维度兼容性

如果使用 Ollama 进行向量化（embedding），注意：
- OpenAI `text-embedding-3-small`: **1536 维**
- Ollama `nomic-embed-text`: **768 维**

**需要选择相同维度的模型，或修改数据库表结构**。

---

## 🎯 推荐配置

### 开发环境（本地）

```bash
# .env.local
OLLAMA_BASE_URL=http://localhost:11434/v1
OPENAI_API_KEY=ollama
AI_MODEL=llama3.2
```

### 生产环境（如果使用本地 Ollama）

```bash
# Render 环境变量
OLLAMA_BASE_URL=https://your-ngrok-url.ngrok.io/v1
OPENAI_API_KEY=ollama
AI_MODEL=llama3.2
```

### 切换回 OpenAI

只需移除或注释 `OLLAMA_BASE_URL`：
```bash
# OLLAMA_BASE_URL=http://localhost:11434/v1  # 注释掉
OPENAI_API_KEY=sk-xxx  # 使用真实 OpenAI key
AI_MODEL=gpt-4o-mini
```

---

## 📚 相关文档

- [AI 架构说明](./AI_ARCHITECTURE.md)
- [向量化服务替代方案](./向量化服务替代方案.md)
- [AI 环境变量配置](./AI_ENV_SETUP.md)

---

## 🎉 总结

**推荐方案**：作为模块集成到现有项目（方案 A）

**原因**：
1. ✅ 代码已支持，无需修改
2. ✅ 配置简单，只需环境变量
3. ✅ 保持架构一致性
4. ✅ 易于切换和维护

**实施步骤**：
1. 安装并启动 Ollama
2. 配置 `OLLAMA_BASE_URL` 环境变量
3. 重启 AI-Service
4. 完成！

---

**文档创建时间**: 2025-01-15  
**最后更新**: 2025-01-15

