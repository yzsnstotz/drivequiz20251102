# 🏠 Ollama 完全本地化部署指南

**场景**: 完全本地运行，不需要 Render 或其他云端服务

---

## 📋 架构对比

### 当前架构（使用 Render）

```
用户浏览器
    ↓
Vercel (主站) - 云端
    ↓
Render (AI-Service) - 云端
    ↓
OpenAI API - 云端
```

### 完全本地架构（使用 Ollama）

```
用户浏览器
    ↓
本地 Next.js (主站) - localhost:3000
    ↓
本地 AI-Service - localhost:8787
    ↓
本地 Ollama - localhost:11434
```

**优点**:
- ✅ **完全免费**：不需要任何云端服务
- ✅ **零成本**：不需要 OpenAI API 费用
- ✅ **数据隐私**：所有数据都在本地
- ✅ **无网络依赖**：可以离线运行
- ✅ **快速响应**：本地网络延迟低

**缺点**:
- ⚠️ 只能本地访问（除非配置公网暴露）
- ⚠️ 需要本地电脑一直运行

---

## 🚀 部署步骤

### 1. 安装 Ollama

```bash
# macOS
brew install ollama

# 或使用官方安装脚本
curl -fsSL https://ollama.com/install.sh | sh
```

### 2. 启动 Ollama 服务

```bash
# 启动 Ollama（默认监听 localhost:11434）
ollama serve

# 或后台运行
ollama serve &
```

### 3. 拉取模型

```bash
# Chat 模型（生成回答）
ollama pull llama3.2:3b

# Embedding 模型（RAG 检索）
ollama pull nomic-embed-text
```

### 4. 执行数据库迁移（如果还没做）

```bash
# 在 Supabase SQL Editor 中执行
# src/migrations/20250115_migrate_to_ollama_768d.sql
```

### 5. 配置 AI-Service

在 `apps/ai-service/.env` 中：

```bash
# Ollama 配置
OLLAMA_BASE_URL=http://localhost:11434/v1
OPENAI_API_KEY=ollama  # 任意值，Ollama 不需要真实 key
AI_MODEL=llama3.2:3b
EMBEDDING_MODEL=nomic-embed-text

# 服务配置
PORT=8787
HOST=0.0.0.0
SERVICE_TOKENS=your_local_service_token

# 数据库配置
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_key
```

### 6. 配置主站

在项目根目录 `.env.local` 中：

```bash
# AI-Service 本地地址
AI_SERVICE_URL=http://localhost:8787
AI_SERVICE_TOKEN=your_local_service_token

# 其他配置...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
```

### 7. 启动服务

```bash
# 终端 1: 启动 Ollama（如果还没启动）
ollama serve

# 终端 2: 启动 AI-Service
cd apps/ai-service
npm install
npm run dev

# 终端 3: 启动主站
npm install
npm run dev
```

### 8. 访问应用

- 主站: http://localhost:3000
- AI-Service: http://localhost:8787
- Ollama: http://localhost:11434

---

## ✅ 验证

### 1. 测试 Ollama

```bash
# 测试 Chat
curl http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.2:3b",
    "messages": [{"role": "user", "content": "你好"}]
  }'

# 测试 Embedding
curl http://localhost:11434/api/embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "model": "nomic-embed-text",
    "prompt": "测试文本"
  }'
```

### 2. 测试 AI-Service

```bash
# 健康检查
curl http://localhost:8787/healthz

# 测试问答
curl -X POST http://localhost:8787/v1/ask \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_local_service_token" \
  -d '{
    "question": "日本驾考中，超速行驶的处罚是什么？",
    "lang": "zh"
  }'
```

### 3. 测试主站

访问 http://localhost:3000 并测试 AI 问答功能

---

## 🔧 生产环境选项

如果你想在生产环境使用，有以下选项：

### 选项 A: 自托管服务器（推荐）

在自己的服务器上运行所有服务：

```
用户浏览器
    ↓
你自己的服务器 (VPS/云服务器)
    ├─ Next.js (主站) - 端口 3000
    ├─ AI-Service - 端口 8787
    └─ Ollama - 端口 11434
```

**优点**:
- ✅ 完全控制
- ✅ 零 API 成本
- ✅ 数据隐私

**缺点**:
- ⚠️ 需要自己维护服务器
- ⚠️ 需要配置域名和 SSL

### 选项 B: 混合架构（主站在 Vercel，AI-Service 自托管）

```
用户浏览器
    ↓
Vercel (主站) - 云端
    ↓
你的服务器 (AI-Service + Ollama) - 自托管
```

**优点**:
- ✅ 主站使用 Vercel 的 CDN 优势
- ✅ AI 服务自托管，节省成本

**缺点**:
- ⚠️ 需要配置公网访问
- ⚠️ 需要维护 AI-Service 服务器

---

## 📊 成本对比

| 方案 | 月度成本 | 说明 |
|------|---------|------|
| 当前（Render + OpenAI） | ~$30-50 | Render 服务 + OpenAI API |
| 完全本地（开发） | $0 | 本地运行 |
| 自托管服务器 | ~$5-20 | VPS 费用（如 DigitalOcean、Linode） |

---

## 🎯 总结

**回答你的问题：用 Ollama 是否可以不用 Render？**

- **本地开发**：✅ **是的，完全不需要 Render**
- **生产环境**：
  - ✅ 可以用自己的服务器替代 Render
  - ✅ 在服务器上运行 AI-Service + Ollama
  - ⚠️ 如果主站在 Vercel，AI-Service 还是需要部署在某个地方（可以是自己的服务器）

**推荐方案**：
- **开发环境**：完全本地运行（Ollama + AI-Service + Next.js 都在本地）
- **生产环境**：自托管服务器运行 AI-Service + Ollama（主站可以继续用 Vercel）

---

**文档创建时间**: 2025-01-15

