# AI 服务商选择机制说明

本文档说明如何让 Render AI Service 知道应该使用 OpenAI 还是 OpenRouter。

---

## 🔍 当前机制

### 问题
- **主服务（Vercel）**和**Render AI Service**都从数据库读取`aiProvider`配置
- 存在重复查询数据库的问题
- 如果主服务已经知道是`online`还是`openrouter`，应该直接告诉Render AI Service

### 解决方案
**通过请求头传递`aiProvider`信息**：
- 主服务在请求头中添加`X-AI-Provider: online`或`X-AI-Provider: openrouter`
- Render AI Service优先使用请求头中的`X-AI-Provider`，如果没有则从数据库读取（向后兼容）

---

## 📋 实现方案

### 1. 主服务（Vercel）- `src/app/api/ai/ask/route.ts`

**当前逻辑**：
```typescript
// 从数据库读取 aiProvider 配置
let aiProviderFromDb: "online" | "local" | "openrouter" | "openrouter-direct" | null = null;
if (!forceMode) {
  const configRow = await aiDb
    .selectFrom("ai_config")
    .select(["value"])
    .where("key", "=", "aiProvider")
    .executeTakeFirst();
  
  if (configRow && (configRow.value === "local" || configRow.value === "online" || configRow.value === "openrouter" || configRow.value === "openrouter-direct")) {
    aiProviderFromDb = configRow.value;
  }
}

// 选择AI服务
if (aiProviderFromDb === "local") {
  selectedAiServiceUrl = LOCAL_AI_SERVICE_URL;
  selectedAiServiceToken = LOCAL_AI_SERVICE_TOKEN;
  aiServiceMode = "local";
} else {
  selectedAiServiceUrl = AI_SERVICE_URL;
  selectedAiServiceToken = AI_SERVICE_TOKEN;
  aiServiceMode = aiProviderFromDb === "openrouter" ? "openrouter" : "online";
}

// 转发请求到Render AI Service
upstream = await fetch(upstreamUrl, {
  method: "POST",
  headers: {
    "content-type": "application/json; charset=utf-8",
    authorization: `Bearer ${selectedAiServiceToken}`,
    "x-zalem-client": "web",
    // ❌ 缺少：X-AI-Provider 请求头
  },
  body: JSON.stringify(requestBody),
});
```

**修改后**：
```typescript
// 从数据库读取 aiProvider 配置
let aiProviderFromDb: "online" | "local" | "openrouter" | "openrouter-direct" | null = null;
if (!forceMode) {
  const configRow = await aiDb
    .selectFrom("ai_config")
    .select(["value"])
    .where("key", "=", "aiProvider")
    .executeTakeFirst();
  
  if (configRow && (configRow.value === "local" || configRow.value === "online" || configRow.value === "openrouter" || configRow.value === "openrouter-direct")) {
    aiProviderFromDb = configRow.value;
  }
}

// 选择AI服务
if (aiProviderFromDb === "local") {
  selectedAiServiceUrl = LOCAL_AI_SERVICE_URL;
  selectedAiServiceToken = LOCAL_AI_SERVICE_TOKEN;
  aiServiceMode = "local";
} else {
  selectedAiServiceUrl = AI_SERVICE_URL;
  selectedAiServiceToken = AI_SERVICE_TOKEN;
  aiServiceMode = aiProviderFromDb === "openrouter" ? "openrouter" : "online";
}

// 转发请求到Render AI Service
const headers: Record<string, string> = {
  "content-type": "application/json; charset=utf-8",
  authorization: `Bearer ${selectedAiServiceToken}`,
  "x-zalem-client": "web",
};

// ✅ 添加：X-AI-Provider 请求头（告诉Render AI Service使用哪个提供商）
if (aiServiceMode === "online" || aiServiceMode === "openrouter") {
  // 将数据库配置值传递给Render AI Service
  // online -> "online", openrouter -> "openrouter"
  headers["X-AI-Provider"] = aiProviderFromDb === "openrouter" ? "openrouter" : "online";
}

upstream = await fetch(upstreamUrl, {
  method: "POST",
  headers,
  body: JSON.stringify(requestBody),
});
```

---

### 2. Render AI Service - `apps/ai-service/src/routes/ask.ts`

**当前逻辑**：
```typescript
// 6) 从数据库读取 AI 提供商配置
const { getAiProviderFromConfig } = await import("../lib/configLoader.js");
const aiProvider = await getAiProviderFromConfig(); // ❌ 总是从数据库读取
```

**修改后**：
```typescript
// 6) 从请求头或数据库读取 AI 提供商配置
// 优先使用请求头中的 X-AI-Provider（由主服务传递）
// 如果没有，则从数据库读取（向后兼容）
let aiProvider: "openai" | "openrouter" | null = null;

const aiProviderHeader = request.headers["x-ai-provider"] as string | undefined;
if (aiProviderHeader) {
  // 主服务通过请求头传递了 aiProvider
  if (aiProviderHeader === "online") {
    aiProvider = "openai";
  } else if (aiProviderHeader === "openrouter") {
    aiProvider = "openrouter";
  }
  console.log("[ASK ROUTE] AI provider from request header", {
    header: aiProviderHeader,
    aiProvider,
  });
} else {
  // 向后兼容：从数据库读取
  const { getAiProviderFromConfig } = await import("../lib/configLoader.js");
  aiProvider = await getAiProviderFromConfig();
  console.log("[ASK ROUTE] AI provider from database (fallback)", {
    aiProvider,
  });
}
```

---

### 3. 配置加载器 - `apps/ai-service/src/lib/configLoader.ts`

**保持不变**（用于向后兼容）：
```typescript
export async function getAiProviderFromConfig(): Promise<"openai" | "openrouter" | null> {
  // 从数据库读取配置
  // ... 现有逻辑保持不变
}
```

---

## 📊 数据流

### 当前流程（存在重复查询）

```
1. 主服务（Vercel）
   └─ 从数据库读取 aiProvider 配置
      └─ 如果 online 或 openrouter，发送到 Render AI Service

2. Render AI Service
   └─ 再次从数据库读取 aiProvider 配置  ❌ 重复查询
      └─ 根据配置选择 OpenAI 或 OpenRouter
```

### 优化后流程（通过请求头传递）

```
1. 主服务（Vercel）
   └─ 从数据库读取 aiProvider 配置
      └─ 在请求头中添加 X-AI-Provider: online/openrouter
         └─ 发送到 Render AI Service

2. Render AI Service
   └─ 从请求头读取 X-AI-Provider  ✅ 优先使用请求头
      └─ 如果没有，则从数据库读取（向后兼容）
         └─ 根据配置选择 OpenAI 或 OpenRouter
```

---

## 🔧 修改清单

### 1. 主服务（Vercel）

- [ ] 修改 `src/app/api/ai/ask/route.ts`
  - [ ] 在转发请求到Render AI Service时，添加`X-AI-Provider`请求头
  - [ ] 请求头值：`online`（对应OpenAI）或`openrouter`（对应OpenRouter）

### 2. Render AI Service

- [ ] 修改 `apps/ai-service/src/routes/ask.ts`
  - [ ] 优先从请求头读取`X-AI-Provider`
  - [ ] 如果没有请求头，则从数据库读取（向后兼容）
  - [ ] 将请求头值（`online`/`openrouter`）转换为内部值（`openai`/`openrouter`）

### 3. 文档更新

- [ ] 更新 `docs/AI_PROVIDER_CONFIG_FLOW.md`
- [ ] 更新 `docs/AI_PROVIDER_ENV_VARS_AUDIT.md`

---

## ✅ 优势

1. **减少数据库查询**：Render AI Service不需要每次都查询数据库
2. **提高性能**：减少数据库查询延迟
3. **向后兼容**：如果请求头不存在，仍然从数据库读取
4. **清晰明确**：主服务明确告诉Render AI Service应该使用哪个提供商

---

## 🔍 测试验证

### 测试场景

1. **主服务传递`X-AI-Provider: online`**
   - 验证Render AI Service使用OpenAI

2. **主服务传递`X-AI-Provider: openrouter`**
   - 验证Render AI Service使用OpenRouter

3. **主服务不传递`X-AI-Provider`（向后兼容）**
   - 验证Render AI Service从数据库读取配置

4. **数据库配置为`online`，请求头为`openrouter`**
   - 验证请求头优先级高于数据库配置

---

## 📝 环境变量总结（审核后）

### OpenAI（通过Render）

| 环境变量 | 用途 | 必需 | 位置 |
|---------|------|------|------|
| `AI_SERVICE_TOKEN` | API 密钥 | ✅ | Vercel |
| `AI_SERVICE_URL` | Render URL | ✅ | Vercel |
| `OPENAI_API_KEY` | OpenAI API 密钥 | ✅ | Render |
| `OPENAI_BASE_URL` | OpenAI API 基础 URL | ❌ | Render（默认：`https://api.openai.com/v1`） |

### OpenRouter（通过Render）

| 环境变量 | 用途 | 必需 | 位置 |
|---------|------|------|------|
| `AI_SERVICE_TOKEN` | API 密钥 | ✅ | Vercel |
| `AI_SERVICE_URL` | Render URL | ✅ | Vercel |
| `OPENROUTER_API_KEY` | OpenRouter API 密钥 | ✅ | Render |
| `OPENAI_BASE_URL` | OpenRouter API 基础 URL | ❌ | Render（默认：`https://openrouter.ai/api/v1`）⚠️ 命名混乱 |
| `OPENROUTER_REFERER_URL` | Referer URL | ❌ | Render（默认：`https://zalem.app`） |
| `OPENROUTER_APP_NAME` | 应用名称 | ❌ | Render（默认：`ZALEM`） |

**注意**：OpenAI和OpenRouter在Vercel阶段使用相同的变量（`AI_SERVICE_TOKEN`和`AI_SERVICE_URL`），通过请求头`X-AI-Provider`告诉Render AI Service使用哪个提供商。

### 直连OpenRouter

| 环境变量 | 用途 | 必需 | 位置 |
|---------|------|------|------|
| `OPENROUTER_API_KEY` | API 密钥 | ✅ | Vercel |
| `OPENAI_BASE_URL` | API 基础 URL | ❌ | Vercel（默认：`https://openrouter.ai/api/v1`）⚠️ 命名混乱 |
| `OPENROUTER_REFERER_URL` | Referer URL | ❌ | Vercel（默认：`https://zalem.app`） |
| `OPENROUTER_APP_NAME` | 应用名称 | ❌ | Vercel（默认：`ZALEM`） |

### 本地AI（Ollama）

| 环境变量 | 用途 | 必需 | 位置 |
|---------|------|------|------|
| `LOCAL_AI_SERVICE_URL` | 本地 AI 服务 URL | ✅ | Vercel |
| `LOCAL_AI_SERVICE_TOKEN` | 本地 AI 服务 Token | ✅ | Vercel |
| `OLLAMA_BASE_URL` | Ollama 基础 URL | ❌ | 本地AI服务（默认：`http://localhost:11434/v1`） |
| `AI_MODEL` | AI 模型名称 | ❌ | 本地AI服务（默认：`llama3.2:3b`） |
| `EMBEDDING_MODEL` | Embedding 模型名称 | ❌ | 本地AI服务（默认：`nomic-embed-text`） |

**注意**：`USE_LOCAL_AI`可以取消，因为已经根据数据库`aiProvider`字段来做选择。

---

## 🎯 总结

**如何让Render知道要请求的是OpenAI还是OpenRouter？**

**答案**：通过请求头`X-AI-Provider`传递。

1. **主服务（Vercel）**从数据库读取`aiProvider`配置
2. 如果`aiProvider === "online"`或`"openrouter"`，都发送到Render AI Service
3. 在请求头中添加`X-AI-Provider: online`或`X-AI-Provider: openrouter`
4. **Render AI Service**优先使用请求头中的`X-AI-Provider`，如果没有则从数据库读取（向后兼容）

