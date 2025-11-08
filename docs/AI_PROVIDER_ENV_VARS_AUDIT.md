# AI 服务商环境变量审核文档

本文档列出所有不同 AI 服务商及其对应路径上所使用到的环境变量，供审核后统一修改。

---

## 📋 服务商概览

| 服务商 | 数据库配置值 | 实际服务 | 部署位置 | 代码路径 |
|--------|------------|---------|---------|---------|
| **OpenAI** | `online` | OpenAI API | Render (AI Service) | `apps/ai-service/` |
| **OpenRouter** | `openrouter` / `openrouter-direct` | OpenRouter API | Render (AI Service) | `apps/ai-service/` |
| **本地 AI (Ollama)** | `local` | Ollama (本地) | 本地服务器 | `apps/local-ai-service/` |

---

## 🔍 详细环境变量清单

### 1. 主服务（Vercel/Next.js）- `src/app/api/ai/ask/route.ts`

**功能**: 选择本地或在线 AI 服务，转发请求

| 环境变量 | 用途 | 必需 | 默认值 | 使用场景 | 代码位置 |
|---------|------|------|--------|---------|---------|
| `USE_LOCAL_AI` | 是否使用本地 AI 服务 | ❌ | `false` | 选择本地/在线 | `src/app/api/ai/ask/route.ts:56` |
| `LOCAL_AI_SERVICE_URL` | 本地 AI 服务 URL | ❌ | - | 本地 AI 模式 | `src/app/api/ai/ask/route.ts:57` |
| `LOCAL_AI_SERVICE_TOKEN` | 本地 AI 服务 Token | ❌ | - | 本地 AI 模式 | `src/app/api/ai/ask/route.ts:58` |
| `AI_SERVICE_URL` | 在线 AI 服务 URL | ✅ | - | 在线 AI 模式 | `src/app/api/ai/ask/route.ts:51` |
| `AI_SERVICE_TOKEN` | 在线 AI 服务 Token | ✅ | - | 在线 AI 模式 | `src/app/api/ai/ask/route.ts:52` |
| `USER_JWT_SECRET` | 用户 JWT 密钥 | ✅ | - | 所有模式 | `src/app/api/ai/ask/route.ts:53` |
| `OPENROUTER_API_KEY` | OpenRouter API 密钥 | ❌ | - | **未使用** | `src/app/api/ai/ask/route.ts:62` |
| `OPENAI_BASE_URL` | OpenAI/OpenRouter 基础 URL | ❌ | `https://api.openai.com/v1` | **未使用** | `src/app/api/ai/ask/route.ts:63` |
| `OPENROUTER_REFERER_URL` | OpenRouter Referer URL | ❌ | `https://zalem.app` | **未使用** | `src/app/api/ai/ask/route.ts:64` |
| `OPENROUTER_APP_NAME` | OpenRouter 应用名称 | ❌ | `ZALEM` | **未使用** | `src/app/api/ai/ask/route.ts:65` |

**问题**:
- ❌ `OPENROUTER_API_KEY`, `OPENAI_BASE_URL`, `OPENROUTER_REFERER_URL`, `OPENROUTER_APP_NAME` 在主服务中定义但**未使用**
- ⚠️ 变量命名混乱：`OPENAI_BASE_URL` 既用于 OpenAI 也用于 OpenRouter

---

### 2. AI 服务（Render）- `apps/ai-service/`

**功能**: 处理 AI 请求，支持 OpenAI 和 OpenRouter

#### 2.1 服务配置 - `apps/ai-service/src/index.ts`

| 环境变量 | 用途 | 必需 | 默认值 | 使用场景 | 代码位置 |
|---------|------|------|--------|---------|---------|
| `PORT` | 服务端口 | ❌ | `8787` | 所有模式 | `apps/ai-service/src/index.ts:46` |
| `HOST` | 服务监听地址 | ❌ | `0.0.0.0` | 所有模式 | `apps/ai-service/src/index.ts:47` |
| `SERVICE_TOKENS` | AI 服务认证令牌 | ✅ | - | 所有模式 | `apps/ai-service/src/index.ts:48` |
| `AI_MODEL` | 默认 AI 模型 | ❌ | `gpt-4o-mini` | 所有模式 | `apps/ai-service/src/index.ts:49` |
| `OPENAI_API_KEY` | OpenAI API 密钥 | ✅ | - | OpenAI 模式 | `apps/ai-service/src/index.ts:50` |
| `OPENROUTER_API_KEY` | OpenRouter API 密钥 | ❌ | - | OpenRouter 模式 | `apps/ai-service/src/index.ts:51` |
| `SUPABASE_URL` | Supabase 项目 URL | ✅ | - | 所有模式 | `apps/ai-service/src/index.ts:52` |
| `SUPABASE_SERVICE_KEY` | Supabase 服务密钥 | ✅ | - | 所有模式 | `apps/ai-service/src/index.ts:53` |
| `AI_CACHE_REDIS_URL` | Redis 缓存连接 | ❌ | - | 所有模式（可选） | `apps/ai-service/src/index.ts:54` |
| `NODE_ENV` | 节点环境 | ❌ | `development` | 所有模式 | `apps/ai-service/src/index.ts:55` |

#### 2.2 OpenAI 客户端 - `apps/ai-service/src/lib/openaiClient.ts`

| 环境变量 | 用途 | 必需 | 默认值 | 使用场景 | 代码位置 |
|---------|------|------|--------|---------|---------|
| `OPENAI_BASE_URL` | API 基础 URL | ❌ | `https://api.openai.com/v1` | OpenAI/OpenRouter | `apps/ai-service/src/lib/openaiClient.ts:38,42,49` |
| `OLLAMA_BASE_URL` | Ollama 基础 URL | ❌ | - | **向后兼容**（未使用） | `apps/ai-service/src/lib/openaiClient.ts:51` |
| `OPENROUTER_REFERER_URL` | OpenRouter Referer URL | ❌ | `https://zalem.app` | OpenRouter 模式 | `apps/ai-service/src/lib/openaiClient.ts:82` |
| `OPENROUTER_APP_NAME` | OpenRouter 应用名称 | ❌ | `ZALEM` | OpenRouter 模式 | `apps/ai-service/src/lib/openaiClient.ts:83` |

**问题**:
- ⚠️ `OPENAI_BASE_URL` 既用于 OpenAI 也用于 OpenRouter，命名混乱
- ⚠️ `OLLAMA_BASE_URL` 在 AI 服务中定义但**未使用**（向后兼容代码）
- ⚠️ 变量命名不一致：OpenRouter 使用 `OPENAI_BASE_URL` 而不是 `OPENROUTER_BASE_URL`

#### 2.3 配置加载器 - `apps/ai-service/src/lib/configLoader.ts`

| 环境变量 | 用途 | 必需 | 默认值 | 使用场景 | 代码位置 |
|---------|------|------|--------|---------|---------|
| `OPENAI_BASE_URL` | API 基础 URL | ❌ | `https://api.openai.com/v1` | 判断服务商（向后兼容） | `apps/ai-service/src/lib/configLoader.ts:154` |

**问题**:
- ⚠️ 使用 `OPENAI_BASE_URL` 判断是否为 OpenRouter（检查是否包含 `openrouter.ai`）

---

### 3. 本地 AI 服务（Ollama）- `apps/local-ai-service/`

**功能**: 使用本地 Ollama 服务处理 AI 请求

#### 3.1 服务配置 - `apps/local-ai-service/src/lib/config.ts`

| 环境变量 | 用途 | 必需 | 默认值 | 使用场景 | 代码位置 |
|---------|------|------|--------|---------|---------|
| `PORT` | 服务端口 | ❌ | `8788` | 所有模式 | `apps/local-ai-service/src/lib/config.ts:22` |
| `HOST` | 服务监听地址 | ❌ | `0.0.0.0` | 所有模式 | `apps/local-ai-service/src/lib/config.ts:23` |
| `SERVICE_TOKENS` | AI 服务认证令牌 | ✅ | - | 所有模式 | `apps/local-ai-service/src/lib/config.ts:24` |
| `OLLAMA_BASE_URL` | Ollama 基础 URL | ❌ | `http://localhost:11434/v1` | 所有模式 | `apps/local-ai-service/src/lib/config.ts:25` |
| `AI_MODEL` | AI 模型名称 | ❌ | `llama3.2:3b` | 所有模式 | `apps/local-ai-service/src/lib/config.ts:26` |
| `EMBEDDING_MODEL` | Embedding 模型名称 | ❌ | `nomic-embed-text` | 所有模式 | `apps/local-ai-service/src/lib/config.ts:27` |
| `SUPABASE_URL` | Supabase 项目 URL | ✅ | - | 所有模式 | `apps/local-ai-service/src/lib/config.ts:28` |
| `SUPABASE_SERVICE_KEY` | Supabase 服务密钥 | ✅ | - | 所有模式 | `apps/local-ai-service/src/lib/config.ts:29` |
| `NODE_ENV` | 节点环境 | ❌ | `development` | 所有模式 | `apps/local-ai-service/src/lib/config.ts:30` |

**问题**:
- ✅ 变量命名清晰，使用 `OLLAMA_BASE_URL` 而不是 `OPENAI_BASE_URL`

---

## 🔴 问题总结

### 1. 变量命名混乱

| 问题 | 当前状态 | 影响 |
|------|---------|------|
| `OPENAI_BASE_URL` 用于 OpenRouter | `OPENAI_BASE_URL` 既用于 OpenAI 也用于 OpenRouter | 命名不清晰，容易混淆 |
| `OLLAMA_BASE_URL` 在 AI 服务中未使用 | AI 服务中定义了 `OLLAMA_BASE_URL` 但未使用 | 代码冗余，向后兼容代码 |
| 主服务中定义了未使用的变量 | `OPENROUTER_API_KEY`, `OPENAI_BASE_URL`, `OPENROUTER_REFERER_URL`, `OPENROUTER_APP_NAME` 在主服务中定义但未使用 | 代码冗余 |

### 2. 变量使用不一致

| 服务商 | 基础 URL 变量 | API Key 变量 | 其他变量 |
|--------|--------------|-------------|---------|
| **OpenAI** | `OPENAI_BASE_URL` | `OPENAI_API_KEY` | - |
| **OpenRouter** | `OPENAI_BASE_URL` ⚠️ | `OPENROUTER_API_KEY` | `OPENROUTER_REFERER_URL`, `OPENROUTER_APP_NAME` |
| **Ollama (本地)** | `OLLAMA_BASE_URL` | 不需要 | - |

### 3. 代码位置不一致

| 功能 | 代码位置 | 环境变量 |
|------|---------|---------|
| 主服务选择 AI 服务 | `src/app/api/ai/ask/route.ts` | `USE_LOCAL_AI`, `LOCAL_AI_SERVICE_URL`, `LOCAL_AI_SERVICE_TOKEN`, `AI_SERVICE_URL`, `AI_SERVICE_TOKEN` |
| AI 服务配置 | `apps/ai-service/src/index.ts` | `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `SERVICE_TOKENS`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` |
| OpenAI 客户端 | `apps/ai-service/src/lib/openaiClient.ts` | `OPENAI_BASE_URL`, `OPENROUTER_REFERER_URL`, `OPENROUTER_APP_NAME`, `OLLAMA_BASE_URL` (未使用) |
| 本地 AI 服务配置 | `apps/local-ai-service/src/lib/config.ts` | `OLLAMA_BASE_URL`, `AI_MODEL`, `EMBEDDING_MODEL`, `SERVICE_TOKENS`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` |

---

## 📊 环境变量使用矩阵

### 主服务（Vercel/Next.js）

| 环境变量 | OpenAI | OpenRouter | 本地 AI (Ollama) | 代码位置 |
|---------|--------|-----------|-----------------|---------|
| `USE_LOCAL_AI` | ❌ | ❌ | ✅ | `src/app/api/ai/ask/route.ts:56` |
| `LOCAL_AI_SERVICE_URL` | ❌ | ❌ | ✅ | `src/app/api/ai/ask/route.ts:57` |
| `LOCAL_AI_SERVICE_TOKEN` | ❌ | ❌ | ✅ | `src/app/api/ai/ask/route.ts:58` |
| `AI_SERVICE_URL` | ✅ | ✅ | ❌ | `src/app/api/ai/ask/route.ts:51` |
| `AI_SERVICE_TOKEN` | ✅ | ✅ | ❌ | `src/app/api/ai/ask/route.ts:52` |
| `USER_JWT_SECRET` | ✅ | ✅ | ✅ | `src/app/api/ai/ask/route.ts:53` |
| `OPENROUTER_API_KEY` | ❌ | ❌ | ❌ | **未使用** |
| `OPENAI_BASE_URL` | ❌ | ❌ | ❌ | **未使用** |
| `OPENROUTER_REFERER_URL` | ❌ | ❌ | ❌ | **未使用** |
| `OPENROUTER_APP_NAME` | ❌ | ❌ | ❌ | **未使用** |

### AI 服务（Render）

| 环境变量 | OpenAI | OpenRouter | 本地 AI (Ollama) | 代码位置 |
|---------|--------|-----------|-----------------|---------|
| `OPENAI_API_KEY` | ✅ | ❌ (回退) | ❌ | `apps/ai-service/src/index.ts:50` |
| `OPENROUTER_API_KEY` | ❌ | ✅ | ❌ | `apps/ai-service/src/index.ts:51` |
| `OPENAI_BASE_URL` | ✅ | ✅ | ❌ | `apps/ai-service/src/lib/openaiClient.ts:38,42,49` |
| `OPENROUTER_REFERER_URL` | ❌ | ✅ | ❌ | `apps/ai-service/src/lib/openaiClient.ts:82` |
| `OPENROUTER_APP_NAME` | ❌ | ✅ | ❌ | `apps/ai-service/src/lib/openaiClient.ts:83` |
| `OLLAMA_BASE_URL` | ❌ | ❌ | ❌ | **未使用** (向后兼容) |
| `SERVICE_TOKENS` | ✅ | ✅ | ❌ | `apps/ai-service/src/index.ts:48` |
| `SUPABASE_URL` | ✅ | ✅ | ❌ | `apps/ai-service/src/index.ts:52` |
| `SUPABASE_SERVICE_KEY` | ✅ | ✅ | ❌ | `apps/ai-service/src/index.ts:53` |
| `AI_MODEL` | ✅ | ✅ | ❌ | `apps/ai-service/src/index.ts:49` |
| `AI_CACHE_REDIS_URL` | ✅ | ✅ | ❌ | `apps/ai-service/src/index.ts:54` |

### 本地 AI 服务（Ollama）

| 环境变量 | OpenAI | OpenRouter | 本地 AI (Ollama) | 代码位置 |
|---------|--------|-----------|-----------------|---------|
| `OLLAMA_BASE_URL` | ❌ | ❌ | ✅ | `apps/local-ai-service/src/lib/config.ts:25` |
| `AI_MODEL` | ❌ | ❌ | ✅ | `apps/local-ai-service/src/lib/config.ts:26` |
| `EMBEDDING_MODEL` | ❌ | ❌ | ✅ | `apps/local-ai-service/src/lib/config.ts:27` |
| `SERVICE_TOKENS` | ❌ | ❌ | ✅ | `apps/local-ai-service/src/lib/config.ts:24` |
| `SUPABASE_URL` | ❌ | ❌ | ✅ | `apps/local-ai-service/src/lib/config.ts:28` |
| `SUPABASE_SERVICE_KEY` | ❌ | ❌ | ✅ | `apps/local-ai-service/src/lib/config.ts:29` |

---

## 💡 建议的统一命名方案

### 方案 1: 按服务商命名（推荐）

| 当前变量 | 建议变量 | 说明 |
|---------|---------|------|
| `OPENAI_BASE_URL` (用于 OpenRouter) | `OPENROUTER_BASE_URL` | OpenRouter 使用独立的变量 |
| `OPENAI_BASE_URL` (用于 OpenAI) | `OPENAI_BASE_URL` | OpenAI 保持不变 |
| `OLLAMA_BASE_URL` | `OLLAMA_BASE_URL` | 保持不变 |
| 主服务中未使用的变量 | **删除** | 清理未使用的变量 |

### 方案 2: 通用命名（不推荐）

| 当前变量 | 建议变量 | 说明 |
|---------|---------|------|
| `OPENAI_BASE_URL` | `AI_BASE_URL` | 通用变量名，但不够清晰 |
| `OPENAI_API_KEY` | `AI_API_KEY` | 通用变量名，但不够清晰 |

---

## 📝 待审核问题

1. **是否统一 `OPENAI_BASE_URL` 为 `OPENROUTER_BASE_URL`？**
   - 当前：OpenRouter 使用 `OPENAI_BASE_URL`
   - 建议：OpenRouter 使用 `OPENROUTER_BASE_URL`

2. **是否删除主服务中未使用的变量？**
   - 当前：主服务中定义了 `OPENROUTER_API_KEY`, `OPENAI_BASE_URL`, `OPENROUTER_REFERER_URL`, `OPENROUTER_APP_NAME` 但未使用
   - 建议：删除这些未使用的变量定义

3. **是否删除 AI 服务中未使用的 `OLLAMA_BASE_URL`？**
   - 当前：AI 服务中定义了 `OLLAMA_BASE_URL` 但未使用（向后兼容代码）
   - 建议：删除或保留（向后兼容）

4. **是否统一变量命名规范？**
   - 建议：按服务商命名（`OPENAI_*`, `OPENROUTER_*`, `OLLAMA_*`）

---

## 🔧 修改清单（待审核后执行）

### 1. 主服务（Vercel/Next.js）

- [ ] 删除未使用的变量：`OPENROUTER_API_KEY`, `OPENAI_BASE_URL`, `OPENROUTER_REFERER_URL`, `OPENROUTER_APP_NAME`
- [ ] 文件：`src/app/api/ai/ask/route.ts`

### 2. AI 服务（Render）

- [ ] 将 OpenRouter 的 `OPENAI_BASE_URL` 改为 `OPENROUTER_BASE_URL`
- [ ] 删除或保留 `OLLAMA_BASE_URL`（向后兼容代码）
- [ ] 文件：
  - `apps/ai-service/src/lib/openaiClient.ts`
  - `apps/ai-service/src/lib/configLoader.ts`
  - `apps/ai-service/src/index.ts`（如果需要）

### 3. 文档更新

- [ ] 更新所有相关文档，反映新的变量命名
- [ ] 更新环境变量配置指南

---

## 📚 相关文件清单

### 主服务
- `src/app/api/ai/ask/route.ts` - 主服务路由

### AI 服务
- `apps/ai-service/src/index.ts` - 服务配置
- `apps/ai-service/src/lib/openaiClient.ts` - OpenAI 客户端
- `apps/ai-service/src/lib/configLoader.ts` - 配置加载器
- `apps/ai-service/src/routes/ask.ts` - 问答路由

### 本地 AI 服务
- `apps/local-ai-service/src/lib/config.ts` - 服务配置
- `apps/local-ai-service/src/lib/ollamaClient.ts` - Ollama 客户端

### 文档
- `docs/AI_PROVIDER_ENV_VARS.md` - 环境变量说明
- `docs/AI_PROVIDER_CONFIG_FLOW.md` - 配置流程
- `docs/AI_ENV_SETUP.md` - 环境变量配置指南

---

**审核日期**: 2025-01-XX  
**审核人**: 待审核  
**状态**: ⏳ 待审核

