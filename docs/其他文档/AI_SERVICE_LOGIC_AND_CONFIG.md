# AI 服务调取逻辑与配置变量说明

## 一、AI 服务调取逻辑和流程

### 1. 整体架构

```
前端请求 
  ↓
主站路由 (/api/ai/ask) 
  ↓
AI 服务选择（4种模式）
  ↓
├─ local → 本地 Ollama 服务
├─ openrouter_direct → 直连 OpenRouter API
└─ openai/openrouter → AI Service (Render)
    ↓
  AI Service 根据配置选择 OpenAI 或 OpenRouter 客户端
```

### 2. 详细流程

#### 阶段 0：AI 服务选择（主站路由 `src/app/api/ai/ask/route.ts`）

**优先级顺序：**
1. **URL 参数** (`?ai=local|openai|openrouter`) - 最高优先级，用于调试
2. **数据库配置** (`ai_config.aiProvider`) - 正常运行时使用
3. **报错** - 如果以上都未配置

**选择逻辑：**

```typescript
// 1. 检查 URL 参数
const aiParam = url.searchParams.get("ai")?.toLowerCase();
if (aiParam === "local" || aiParam === "online" || aiParam === "openai") {
  forceMode = aiParam === "local" ? "local" : "openai";
}

// 2. 从数据库读取配置（如果 URL 参数未指定）
if (!forceMode) {
  const configRow = await aiDb
    .selectFrom("ai_config")
    .select(["value"])
    .where("key", "=", "aiProvider")
    .executeTakeFirst();
  aiProviderFromDb = normalizeAiProviderValue(configRow.value);
}

// 3. 根据配置选择服务模式
if (wantLocal) {
  // local 模式 → 本地 Ollama 服务
  selectedAiServiceUrl = LOCAL_AI_SERVICE_URL;
  aiServiceMode = "local";
} else if (aiProviderFromDb === "openrouter_direct") {
  // openrouter_direct 模式 → 直连 OpenRouter
  aiServiceMode = "openrouter_direct";
} else {
  // openai/openrouter 模式 → AI Service (Render)
  selectedAiServiceUrl = AI_SERVICE_URL;
  aiServiceMode = aiProviderFromDb === "openrouter" ? "openrouter" : "openai";
}
```

#### 阶段 1：用户鉴权（主站路由）

- 支持多种方式获取 JWT：
  - `Authorization: Bearer <jwt>` header
  - Cookie (`USER_TOKEN` 或 `sb-access-token`)
  - Query 参数 (`?token=<jwt>`)
- 如果未提供 JWT，使用匿名 ID (`anonymous`)
- 支持激活 token 格式 (`act-{hash}-{activationId}`)

#### 阶段 2：请求参数校验（主站路由）

- 验证 `question` 字段（必填，最大 1000 字符）
- 验证 `locale` 格式（BCP47 格式）
- 配额检查（每用户每日 10 次）

#### 阶段 3：AI 服务调用

**模式 A：本地 Ollama 服务 (`local`)**
- 直接调用 `LOCAL_AI_SERVICE_URL/v1/ask`
- 使用 `LOCAL_AI_SERVICE_TOKEN` 进行鉴权

**模式 B：直连 OpenRouter (`openrouter_direct`)**
- 主站直接调用 OpenRouter API
- 不经过 AI Service
- 需要配置 `OPENROUTER_API_KEY`、`OPENROUTER_BASE_URL` 等环境变量
- 从数据库读取模型配置

**模式 C：AI Service (Render) - OpenAI/OpenRouter**
- 主站转发请求到 `AI_SERVICE_URL/v1/ask`
- 使用 `AI_SERVICE_TOKEN` 进行鉴权
- **关键：** 在请求头中携带 `X-AI-Provider: openai` 或 `X-AI-Provider: openrouter`

```typescript
const upstreamHeaders: Record<string, string> = {
  "content-type": "application/json; charset=utf-8",
  authorization: `Bearer ${selectedAiServiceToken}`,
  "x-zalem-client": "web",
};
if (aiServiceMode === "openai" || aiServiceMode === "openrouter") {
  upstreamHeaders["X-AI-Provider"] = aiServiceMode;
}
```

#### 阶段 4：AI Service 处理（`apps/ai-service/src/routes/ask.ts`）

1. **服务间鉴权**：验证 `Authorization: Bearer <SERVICE_TOKEN>`

2. **缓存检查**：
   - 使用 `(question, lang, model)` 构建缓存键
   - 如果命中缓存，直接返回缓存结果

3. **安全审查**：调用 `checkSafety(question)` 检查内容安全性

4. **RAG 检索**：从向量数据库检索相关上下文（可选）

5. **AI 提供商选择**：
   - **优先**：从请求头读取 `X-AI-Provider`
   - **后备**：调用 `getAiProviderFromConfig()` 从数据库读取
   - 返回 `"openai"` 或 `"openrouter"`

6. **初始化 AI 客户端**：
   ```typescript
   const aiProvider = await getAiProviderFromConfig();
   const openai = getOpenAIClient(config, aiProvider);
   ```
   - `getOpenAIClient()` 根据 `aiProvider` 选择：
     - `openai` → 使用 `OPENAI_API_KEY` + `OPENAI_BASE_URL`
     - `openrouter` → 使用 `OPENROUTER_API_KEY` + `OPENROUTER_BASE_URL` + Referer + AppName

7. **调用 AI API**：
   - 构建系统提示词（根据语言）
   - 构建用户消息（包含问题和 RAG 上下文）
   - 调用 `openai.chat.completions.create()`

8. **处理响应**：
   - 提取答案
   - 计算成本估算
   - 记录日志到数据库
   - 写入缓存
   - 返回标准响应格式

### 3. 配置读取机制（`apps/ai-service/src/lib/configLoader.ts`）

**缓存机制：**
- 配置缓存有效期：5 分钟
- 缓存键：`model`、`cacheTtl`、`aiProvider`

**读取优先级：**

1. **模型配置 (`getModelFromConfig()`)**
   - 优先：数据库 `ai_config.model`
   - 后备：环境变量 `AI_MODEL`
   - 如果都未配置，抛出错误

2. **AI 提供商配置 (`getAiProviderFromConfig()`)**
   - 优先：数据库 `ai_config.aiProvider`
   - 仅接受：`openai`、`openrouter`、`openrouter_direct`、`local`
   - 如果配置为 `local`，抛出错误（Render 不支持本地模式）
   - 如果未配置，抛出错误

3. **缓存 TTL 配置 (`getCacheTtlFromConfig()`)**
   - 优先：数据库 `ai_config.cacheTtl`
   - 后备：环境变量 `AI_CACHE_TTL_MS`
   - 如果都未配置，抛出错误

---

## 二、外部配置变量清单

### 主站（Vercel / Next.js Web App）

#### 必需环境变量

| 变量名 | 用途 | 对应 AI 服务 | 示例值 |
|--------|------|--------------|--------|
| `AI_SERVICE_URL` | AI Service (Render) 地址 | openai/openrouter | `https://ai.zalem.app` |
| `AI_SERVICE_TOKEN` | AI Service 鉴权 Token | openai/openrouter | `svc_xxx...` |
| `USER_JWT_SECRET` | 用户 JWT 校验密钥 | 所有模式 | `your-secret-key` |
| `SUPABASE_URL` | Supabase 项目 URL | 所有模式（用于读取配置） | `https://xyz.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase 服务端密钥 | 所有模式（用于读取配置） | `eyJxxx...` |

#### 可选环境变量

| 变量名 | 用途 | 对应 AI 服务 | 示例值 |
|--------|------|--------------|--------|
| `LOCAL_AI_SERVICE_URL` | 本地 Ollama 服务地址 | local | `http://localhost:8788` |
| `LOCAL_AI_SERVICE_TOKEN` | 本地 Ollama 服务 Token | local | `local_ai_token_dev_12345` |
| `OPENROUTER_API_KEY` | OpenRouter API Key | openrouter_direct | `sk-or-v1-xxx...` |
| `OPENROUTER_BASE_URL` | OpenRouter Base URL | openrouter_direct | `https://openrouter.ai/api/v1` |
| `OPENROUTER_REFERER_URL` | OpenRouter HTTP-Referer | openrouter_direct | `https://zalem.app` |
| `OPENROUTER_APP_NAME` | OpenRouter X-Title | openrouter_direct | `Zalem AI` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 公共 URL（用于 RAG） | openrouter_direct | `https://xyz.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 服务端密钥（用于 RAG） | openrouter_direct | `eyJxxx...` |

### AI Service (Render / Fastify App)

#### 必需环境变量

| 变量名 | 用途 | 对应 AI 服务 | 示例值 |
|--------|------|--------------|--------|
| `SERVICE_TOKENS` | AI Service 白名单 Token 列表（逗号分隔） | 所有模式 | `svc_token1,svc_token2` |
| `SUPABASE_URL` | Supabase 项目 URL | 所有模式 | `https://xyz.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase 服务端密钥 | 所有模式 | `eyJxxx...` |
| `OPENAI_API_KEY` | OpenAI API Key | openai | `sk-xxx...` |
| `OPENAI_BASE_URL` | OpenAI Base URL | openai | `https://api.openai.com/v1` |

#### 条件必需环境变量（根据 `aiProvider` 配置）

**当 `aiProvider = "openrouter"` 时：**

| 变量名 | 用途 | 示例值 |
|--------|------|--------|
| `OPENROUTER_API_KEY` | OpenRouter API Key | `sk-or-v1-xxx...` |
| `OPENROUTER_BASE_URL` | OpenRouter Base URL | `https://openrouter.ai/api/v1` |
| `OPENROUTER_REFERER_URL` | OpenRouter HTTP-Referer | `https://zalem.app` |
| `OPENROUTER_APP_NAME` | OpenRouter X-Title | `Zalem AI` |

#### 可选环境变量

| 变量名 | 用途 | 默认值 |
|--------|------|--------|
| `AI_MODEL` | 默认 AI 模型（数据库未配置时使用） | `gpt-4o-mini` |
| `AI_CACHE_TTL_MS` | 缓存 TTL（毫秒，数据库未配置时使用） | 无（必须配置） |
| `AI_CACHE_REDIS_URL` | Redis 缓存连接（可选） | 无 |
| `AI_CACHE_MAX_ENTRIES` | 内存缓存最大条目数 | `1000` |
| `EMBEDDING_MODEL` | 向量模型（用于 RAG） | `text-embedding-3-small` |
| `RAG_FETCH_TIMEOUT_MS` | RAG 检索超时时间 | `10000` |
| `RAG_TOP_K` | RAG 检索返回数量 | `3` |
| `RAG_THRESHOLD` | RAG 相似度阈值 | `0.75` |
| `PORT` | 服务端口 | `8787` |
| `HOST` | 服务监听地址 | `0.0.0.0` |
| `NODE_ENV` | 运行环境 | `development` |

### 数据库配置（`ai_config` 表）

| 配置键 | 值类型 | 可选值 | 对应 AI 服务 | 说明 |
|--------|--------|--------|--------------|------|
| `aiProvider` | string | `openai`<br>`openrouter`<br>`openrouter_direct`<br>`local` | 所有模式 | AI 提供商选择 |
| `model` | string | 模型名称<br>（如 `gpt-4o-mini`、`openai/gpt-4o-mini`） | 所有模式 | AI 模型名称 |
| `cacheTtl` | number | 秒数<br>（如 `86400`） | 所有模式 | 缓存过期时间（秒） |

### 配置变量与 AI 服务对应关系总结

| AI 服务模式 | 主站环境变量 | AI Service 环境变量 | 数据库配置 |
|------------|-------------|-------------------|-----------|
| **local** | `LOCAL_AI_SERVICE_URL`<br>`LOCAL_AI_SERVICE_TOKEN` | 不适用 | `aiProvider = "local"` |
| **openrouter_direct** | `OPENROUTER_API_KEY`<br>`OPENROUTER_BASE_URL`<br>`OPENROUTER_REFERER_URL`<br>`OPENROUTER_APP_NAME` | 不适用 | `aiProvider = "openrouter_direct"`<br>`model` |
| **openai** | `AI_SERVICE_URL`<br>`AI_SERVICE_TOKEN` | `OPENAI_API_KEY`<br>`OPENAI_BASE_URL`<br>`SERVICE_TOKENS`<br>`SUPABASE_URL`<br>`SUPABASE_SERVICE_KEY` | `aiProvider = "openai"`<br>`model` |
| **openrouter** | `AI_SERVICE_URL`<br>`AI_SERVICE_TOKEN` | `OPENROUTER_API_KEY`<br>`OPENROUTER_BASE_URL`<br>`OPENROUTER_REFERER_URL`<br>`OPENROUTER_APP_NAME`<br>`SERVICE_TOKENS`<br>`SUPABASE_URL`<br>`SUPABASE_SERVICE_KEY` | `aiProvider = "openrouter"`<br>`model` |

---

## 三、配置优先级说明

### 模型配置优先级
1. 数据库 `ai_config.model`（最高优先级）
2. 环境变量 `AI_MODEL`（后备）
3. 如果都未配置，抛出错误

### AI 提供商配置优先级
1. URL 参数 `?ai=local|openai|openrouter`（最高优先级，仅用于调试）
2. 数据库 `ai_config.aiProvider`（正常运行时使用）
3. 如果都未配置，抛出错误

### 缓存 TTL 配置优先级
1. 数据库 `ai_config.cacheTtl`（最高优先级）
2. 环境变量 `AI_CACHE_TTL_MS`（后备）
3. 如果都未配置，抛出错误

---

## 四、注意事项

1. **配置缓存**：AI Service 中的配置读取有 5 分钟缓存，修改数据库配置后可能需要等待最多 5 分钟才能生效。

2. **环境变量验证**：AI Service 启动时会验证必需的环境变量，缺少任意必填变量会在启动阶段抛出异常。

3. **模式切换**：切换 `aiProvider` 时，需要确保对应的环境变量已正确配置，否则会导致请求失败。

4. **直连模式**：`openrouter_direct` 模式不经过 AI Service，主站直接调用 OpenRouter API，需要确保主站已配置所有 OpenRouter 相关环境变量。

5. **本地模式**：`local` 模式需要本地运行 Ollama 服务，并配置 `LOCAL_AI_SERVICE_URL` 和 `LOCAL_AI_SERVICE_TOKEN`。

