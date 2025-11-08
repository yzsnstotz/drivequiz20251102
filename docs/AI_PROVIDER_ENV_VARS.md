# AI 服务商环境变量说明

本文档说明当数据库 `aiProvider` 配置为不同值时，AI 服务使用的环境变量。

## 📋 配置映射

| 数据库配置 | AI 服务选择 | 使用的环境变量 |
|-----------|-----------|--------------|
| `online` | OpenAI | `OPENAI_API_KEY`（必需）<br>`OPENAI_BASE_URL`（可选） |
| `openrouter` | OpenRouter | `OPENROUTER_API_KEY`（必需）<br>`OPENAI_BASE_URL`（可选）<br>`OPENROUTER_REFERER_URL`（可选）<br>`OPENROUTER_APP_NAME`（可选） |
| `local` | 本地 AI | 不适用（由主服务处理） |

---

## 🔍 详细说明

### 当 `aiProvider = "online"` 时

**代码位置**: `apps/ai-service/src/lib/openaiClient.ts`

```typescript
if (aiProvider === "openai") {
  // 明确使用 OpenAI
  isOpenRouter = false;
  baseUrl = process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1";
  // 如果环境变量设置为 OpenRouter，但配置要求使用 OpenAI，则强制使用 OpenAI
  if (baseUrl.includes("openrouter.ai")) {
    baseUrl = "https://api.openai.com/v1";  // 强制使用 OpenAI
  }
}

// 根据提供商选择 API key
const apiKey = isOpenRouter && config.openrouterApiKey 
  ? config.openrouterApiKey 
  : config.openaiApiKey;  // 使用 OPENAI_API_KEY
```

**使用的环境变量**:

1. **`OPENAI_API_KEY`**（必需）
   - 用途: OpenAI API 密钥
   - 格式: `sk-...`
   - 来源: `process.env.OPENAI_API_KEY`
   - 验证: 如果未设置，会抛出错误：`"OPENAI_API_KEY is not set. Please set OPENAI_API_KEY environment variable."`

2. **`OPENAI_BASE_URL`**（可选）
   - 用途: OpenAI API 基础 URL
   - 默认值: `"https://api.openai.com/v1"`
   - 来源: `process.env.OPENAI_BASE_URL`
   - 注意: 如果设置为 OpenRouter URL（包含 `openrouter.ai`），会被强制覆盖为 `"https://api.openai.com/v1"`

**不会使用的环境变量**:
- ❌ `OPENROUTER_API_KEY` - 不会使用
- ❌ `OPENROUTER_REFERER_URL` - 不会使用
- ❌ `OPENROUTER_APP_NAME` - 不会使用

**最终配置**:
```typescript
{
  apiKey: OPENAI_API_KEY,  // 使用 OpenAI API Key
  baseURL: "https://api.openai.com/v1",  // 强制使用 OpenAI URL
  defaultHeaders: {
    "User-Agent": "ZalemAI/{version}",
    // 不包含 OpenRouter 的 headers
  }
}
```

---

### 当 `aiProvider = "openrouter"` 时

**代码位置**: `apps/ai-service/src/lib/openaiClient.ts`

```typescript
if (aiProvider === "openrouter") {
  // 明确使用 OpenRouter
  isOpenRouter = true;
  baseUrl = process.env.OPENAI_BASE_URL?.trim() || "https://openrouter.ai/api/v1";
}

// 根据提供商选择 API key
const apiKey = isOpenRouter && config.openrouterApiKey 
  ? config.openrouterApiKey  // 使用 OPENROUTER_API_KEY
  : config.openaiApiKey;
```

**使用的环境变量**:

1. **`OPENROUTER_API_KEY`**（必需，优先）
   - 用途: OpenRouter API 密钥
   - 格式: `sk-or-v1-...`
   - 来源: `process.env.OPENROUTER_API_KEY`
   - 注意: 如果未设置，会回退到 `OPENAI_API_KEY`

2. **`OPENAI_API_KEY`**（可选，回退）
   - 用途: 如果 `OPENROUTER_API_KEY` 未设置，使用此密钥
   - 来源: `process.env.OPENAI_API_KEY`

3. **`OPENAI_BASE_URL`**（可选）
   - 用途: OpenRouter API 基础 URL
   - 默认值: `"https://openrouter.ai/api/v1"`
   - 来源: `process.env.OPENAI_BASE_URL`
   - 注意: 如果未设置，使用默认的 OpenRouter URL

4. **`OPENROUTER_REFERER_URL`**（可选）
   - 用途: OpenRouter 要求的 Referer URL
   - 默认值: `"https://zalem.app"`
   - 来源: `process.env.OPENROUTER_REFERER_URL`

5. **`OPENROUTER_APP_NAME`**（可选）
   - 用途: OpenRouter 要求的应用名称
   - 默认值: `"ZALEM"`
   - 来源: `process.env.OPENROUTER_APP_NAME`

**最终配置**:
```typescript
{
  apiKey: OPENROUTER_API_KEY || OPENAI_API_KEY,  // 优先使用 OpenRouter Key
  baseURL: OPENAI_BASE_URL || "https://openrouter.ai/api/v1",  // OpenRouter URL
  defaultHeaders: {
    "User-Agent": "ZalemAI/{version}",
    "HTTP-Referer": OPENROUTER_REFERER_URL || "https://zalem.app",
    "X-Title": OPENROUTER_APP_NAME || "ZALEM",
  }
}
```

---

## 🔑 关键点

### 1. 强制使用配置

当数据库配置为 `online`（OpenAI）时：
- ✅ 即使 `OPENAI_BASE_URL` 设置为 OpenRouter URL，也会强制使用 OpenAI URL
- ✅ 只使用 `OPENAI_API_KEY`，不会使用 `OPENROUTER_API_KEY`
- ✅ 不会添加 OpenRouter 的 headers

### 2. 环境变量优先级

**当 `aiProvider = "openai"`**:
```
OPENAI_API_KEY (必需)
  ↓
OPENAI_BASE_URL (可选，默认: https://api.openai.com/v1)
```

**当 `aiProvider = "openrouter"`**:
```
OPENROUTER_API_KEY (优先)
  ↓ (如果未设置)
OPENAI_API_KEY (回退)
  ↓
OPENAI_BASE_URL (可选，默认: https://openrouter.ai/api/v1)
  ↓
OPENROUTER_REFERER_URL (可选，默认: https://zalem.app)
  ↓
OPENROUTER_APP_NAME (可选，默认: ZALEM)
```

### 3. 代码逻辑

```typescript
// apps/ai-service/src/lib/openaiClient.ts

if (aiProvider === "openai") {
  // 强制使用 OpenAI
  baseUrl = process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1";
  if (baseUrl.includes("openrouter.ai")) {
    baseUrl = "https://api.openai.com/v1";  // 强制覆盖
  }
  apiKey = config.openaiApiKey;  // 只使用 OPENAI_API_KEY
} else if (aiProvider === "openrouter") {
  // 使用 OpenRouter
  baseUrl = process.env.OPENAI_BASE_URL?.trim() || "https://openrouter.ai/api/v1";
  apiKey = config.openrouterApiKey || config.openaiApiKey;  // 优先使用 OPENROUTER_API_KEY
}
```

---

## 📝 环境变量清单

### 必需的环境变量（所有配置）

| 环境变量 | 用途 | 必需 |
|---------|------|------|
| `OPENAI_API_KEY` | OpenAI API 密钥 | ✅ 必需 |
| `SERVICE_TOKENS` | AI 服务认证令牌 | ✅ 必需 |
| `SUPABASE_URL` | Supabase 项目 URL | ✅ 必需 |
| `SUPABASE_SERVICE_KEY` | Supabase 服务密钥 | ✅ 必需 |

### 可选的环境变量

| 环境变量 | 用途 | 默认值 | 使用场景 |
|---------|------|--------|---------|
| `OPENAI_BASE_URL` | API 基础 URL | `https://api.openai.com/v1` | OpenAI/OpenRouter |
| `OPENROUTER_API_KEY` | OpenRouter API 密钥 | - | OpenRouter |
| `OPENROUTER_REFERER_URL` | OpenRouter Referer URL | `https://zalem.app` | OpenRouter |
| `OPENROUTER_APP_NAME` | OpenRouter 应用名称 | `ZALEM` | OpenRouter |
| `AI_MODEL` | 默认 AI 模型 | `gpt-4o-mini` | 所有配置 |
| `AI_CACHE_REDIS_URL` | Redis 缓存连接 | - | 所有配置（可选） |
| `PORT` | 服务端口 | `8787` | 所有配置 |
| `HOST` | 服务监听地址 | `0.0.0.0` | 所有配置 |

---

## ✅ 总结

**当数据库 `aiProvider = "online"` 时**:

1. **使用的环境变量**:
   - ✅ `OPENAI_API_KEY`（必需）
   - ✅ `OPENAI_BASE_URL`（可选，默认: `https://api.openai.com/v1`）

2. **不会使用的环境变量**:
   - ❌ `OPENROUTER_API_KEY`
   - ❌ `OPENROUTER_REFERER_URL`
   - ❌ `OPENROUTER_APP_NAME`

3. **强制行为**:
   - 即使 `OPENAI_BASE_URL` 设置为 OpenRouter URL，也会强制使用 OpenAI URL
   - 只使用 `OPENAI_API_KEY`，不会使用 `OPENROUTER_API_KEY`

4. **最终调用**:
   - API URL: `https://api.openai.com/v1`
   - API Key: `OPENAI_API_KEY`
   - Headers: 不包含 OpenRouter 的 headers

---

## 🔍 验证方法

### 检查环境变量

```bash
# 在 AI 服务（Render）中检查环境变量
echo $OPENAI_API_KEY
echo $OPENAI_BASE_URL
echo $OPENROUTER_API_KEY
```

### 检查日志

查看 AI 服务的日志，确认：
1. `aiProvider` 的值（应该是 `"openai"`）
2. `baseUrl` 的值（应该是 `https://api.openai.com/v1`）
3. `isOpenRouter` 的值（应该是 `false`）
4. 使用的 API Key（应该是 `OPENAI_API_KEY`）

### 检查代码

```typescript
// apps/ai-service/src/lib/openaiClient.ts
// 当 aiProvider === "openai" 时
console.log({
  aiProvider: "openai",
  baseUrl: "https://api.openai.com/v1",  // 强制使用 OpenAI URL
  apiKey: config.openaiApiKey,  // 使用 OPENAI_API_KEY
  isOpenRouter: false,
});
```

---

## 📚 相关文件

- **配置加载器**: `apps/ai-service/src/lib/configLoader.ts`
- **OpenAI 客户端**: `apps/ai-service/src/lib/openaiClient.ts`
- **服务配置**: `apps/ai-service/src/index.ts`
- **路由处理**: `apps/ai-service/src/routes/ask.ts`

