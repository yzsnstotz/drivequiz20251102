# AI 服务商配置流程详解

本文档详细说明从配置中心设置 AI 服务商到最终调用 AI 服务的完整流程。

## 📋 流程概览

```
配置中心 → 数据库 → 主服务（Vercel）→ AI 服务（Render）→ OpenAI/OpenRouter
```

## 🔄 完整流程

### 步骤 1: 配置中心保存配置

**位置**: `apps/web/app/admin/ai/config/page.tsx`

1. **管理员在配置中心设置 AI 服务商**
   - 访问 `/admin/ai/config` 页面
   - 选择 AI 服务商：`online`（OpenAI）、`local`（本地 AI）、`openrouter`（OpenRouter）
   - 点击"保存配置"

2. **前端发送 PUT 请求**
   ```typescript
   PUT /api/admin/ai/config
   Body: {
     aiProvider: "online" | "local" | "openrouter" | "openrouter-direct"
   }
   ```

3. **后端保存到数据库**
   **位置**: `apps/web/app/api/admin/ai/config/route.ts`
   
   ```typescript
   // 验证配置值
   if (body.aiProvider !== undefined) {
     const validProviders = ["online", "local", "openrouter", "openrouter-direct"];
     if (!validProviders.includes(body.aiProvider)) {
       return badRequest("Invalid aiProvider value.");
     }
     updates.push({ key: "aiProvider", value: body.aiProvider });
   }
   
   // 在事务中更新数据库
   await aiDb.transaction().execute(async (trx) => {
     for (const update of updates) {
       await getAiConfigInsert(trx)
         .values({
           key: update.key,        // "aiProvider"
           value: update.value,    // "online" | "local" | "openrouter"
           updated_by: adminInfo.id,
           updated_at: sql`NOW()`,
         })
         .onConflict((oc) =>
           oc.column("key").doUpdateSet({
             value: sql`excluded.value`,
             updated_by: adminInfo.id,
             updated_at: sql`NOW()`,
           })
         )
         .execute();
     }
   });
   ```

4. **数据库存储**
   - 表名: `ai_config`
   - 字段: `key = "aiProvider"`, `value = "online" | "local" | "openrouter" | "openrouter-direct"`
   - 使用 `ON CONFLICT` 实现 upsert（存在则更新，不存在则插入）

---

### 步骤 2: 主服务读取配置并选择 AI 服务

**位置**: `src/app/api/ai/ask/route.ts` 或 `apps/web/app/api/ai/ask/route.ts`

**注意**: 根据项目结构，可能存在两个版本的路由文件：
- `src/app/api/ai/ask/route.ts` - 支持从数据库读取配置
- `apps/web/app/api/ai/ask/route.ts` - 仅使用环境变量

当用户发起 AI 问答请求时：

1. **读取数据库配置**（如果使用支持数据库配置的版本）
   ```typescript
   let aiProviderFromDb: "online" | "local" | "openrouter" | "openrouter-direct" | null = null;
   
   // 从数据库读取 aiProvider 配置
   const configRow = await (aiDb as any)
     .selectFrom("ai_config")
     .select(["value"])
     .where("key", "=", "aiProvider")
     .executeTakeFirst();
   
   if (configRow && (configRow.value === "local" || configRow.value === "online" || 
       configRow.value === "openrouter" || configRow.value === "openrouter-direct")) {
     aiProviderFromDb = configRow.value as "online" | "local" | "openrouter" | "openrouter-direct";
   }
   ```

2. **选择 AI 服务（本地或在线）**
   ```typescript
   // 优先级：URL 参数 > 数据库配置 > 环境变量
   const wantLocal = forceMode 
     ? forceMode === "local" 
     : (aiProviderFromDb !== null 
         ? aiProviderFromDb === "local" 
         : USE_LOCAL_AI);
   
   if (wantLocal) {
     // 使用本地 AI 服务
     selectedAiServiceUrl = LOCAL_AI_SERVICE_URL;
     selectedAiServiceToken = LOCAL_AI_SERVICE_TOKEN;
     aiServiceMode = "local";
   } else {
     // 使用在线 AI 服务（Render）
     selectedAiServiceUrl = AI_SERVICE_URL;  // https://zalem.onrender.com
     selectedAiServiceToken = AI_SERVICE_TOKEN;
     aiServiceMode = "online";
   }
   ```
   
   **注意**: 如果使用 `apps/web/app/api/ai/ask/route.ts`，则只使用环境变量 `USE_LOCAL_AI`，不读取数据库配置。

3. **转发请求到 AI 服务**
   ```typescript
   const upstream = await fetch(`${selectedAiServiceUrl}/v1/ask`, {
     method: "POST",
     headers: {
       "content-type": "application/json; charset=utf-8",
       authorization: `Bearer ${selectedAiServiceToken}`,
     },
     body: JSON.stringify({
       userId,
       question,
       lang: mapLocaleToLang(locale),
       metadata: { ... },
     }),
   });
   ```

**注意**: 
- 如果 `aiProviderFromDb === "local"`，请求会发送到本地 AI 服务
- 如果 `aiProviderFromDb === "online"` 或 `"openrouter"`，请求会发送到在线 AI 服务（Render）
- 主服务只负责选择**本地或在线**，不区分 OpenAI 和 OpenRouter

---

### 步骤 3: AI 服务读取配置并选择提供商

**位置**: `apps/ai-service/src/routes/ask.ts`

当 AI 服务（Render）收到请求时：

1. **从数据库读取 AI 提供商配置**
   ```typescript
   // 6) 从数据库读取 AI 提供商配置
   const { getAiProviderFromConfig } = await import("../lib/configLoader.js");
   const aiProvider = await getAiProviderFromConfig();
   ```

2. **读取配置的详细逻辑**
   **位置**: `apps/ai-service/src/lib/configLoader.ts`
   
   ```typescript
   export async function getAiProviderFromConfig(): Promise<"openai" | "openrouter" | null> {
     // 1. 检查缓存（5分钟过期）
     if (configCache && now - configCache.lastUpdated < CONFIG_CACHE_TTL) {
       if (configCache.aiProvider) {
         // 数据库配置：online = OpenAI, openrouter = OpenRouter
         if (configCache.aiProvider === "online") {
           return "openai";
         } else if (configCache.aiProvider === "openrouter" || 
                    configCache.aiProvider === "openrouter-direct") {
           return "openrouter";
         }
       }
     }
   
     // 2. 从数据库读取配置
     const dbConfig = await fetchConfigFromDb();
     if (dbConfig?.aiProvider) {
       // 更新缓存
       configCache.aiProvider = dbConfig.aiProvider;
       configCache.lastUpdated = now;
       
       // 映射配置值
       if (dbConfig.aiProvider === "online") {
         return "openai";  // online → OpenAI
       } else if (dbConfig.aiProvider === "openrouter" || 
                  dbConfig.aiProvider === "openrouter-direct") {
         return "openrouter";  // openrouter → OpenRouter
       }
     }
   
     // 3. 如果数据库读取失败，使用环境变量判断（向后兼容）
     const baseUrl = process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1";
     if (baseUrl.includes("openrouter.ai")) {
       return "openrouter";
     }
     
     return "openai"; // 默认使用 OpenAI
   }
   ```

3. **创建 OpenAI 客户端**
   ```typescript
   // 7) 调用 OpenAI
   openai = getOpenAIClient(config, aiProvider);
   ```

---

### 步骤 4: 根据配置创建 AI 客户端

**位置**: `apps/ai-service/src/lib/openaiClient.ts`

1. **根据配置选择提供商**
   ```typescript
   export function getOpenAIClient(config: ServiceConfig, aiProvider?: "openai" | "openrouter" | null): OpenAI {
     let isOpenRouter: boolean;
     let baseUrl: string;
     
     if (aiProvider === "openrouter") {
       // 明确使用 OpenRouter
       isOpenRouter = true;
       baseUrl = process.env.OPENAI_BASE_URL?.trim() || "https://openrouter.ai/api/v1";
     } else if (aiProvider === "openai") {
       // 明确使用 OpenAI
       isOpenRouter = false;
       baseUrl = process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1";
       // 如果环境变量设置为 OpenRouter，但配置要求使用 OpenAI，则强制使用 OpenAI
       if (baseUrl.includes("openrouter.ai")) {
         baseUrl = "https://api.openai.com/v1";  // 强制使用 OpenAI
       }
     } else {
       // 没有传入配置，使用环境变量判断（向后兼容）
       baseUrl = process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1";
       isOpenRouter = baseUrl.includes("openrouter.ai");
     }
     
     // 根据提供商选择 API key
     const apiKey = isOpenRouter && config.openrouterApiKey 
       ? config.openrouterApiKey 
       : config.openaiApiKey;
     
     // 创建 OpenAI 客户端实例
     const clientInstance = new OpenAI({
       apiKey: apiKey,
       baseURL: baseUrl,
       defaultHeaders: {
         "User-Agent": `ZalemAI/${config.version}`,
         // OpenRouter 需要额外的 headers
         ...(isOpenRouter ? {
           "HTTP-Referer": process.env.OPENROUTER_REFERER_URL || "https://zalem.app",
           "X-Title": process.env.OPENROUTER_APP_NAME || "ZALEM",
         } : {}),
       },
     });
     
     return clientInstance;
   }
   ```

2. **关键逻辑**
   - 如果 `aiProvider === "openai"`，强制使用 OpenAI，即使环境变量设置为 OpenRouter
   - 如果 `aiProvider === "openrouter"`，使用 OpenRouter
   - 如果 `aiProvider === null`，使用环境变量判断（向后兼容）

---

### 步骤 5: 调用 AI API

**位置**: `apps/ai-service/src/routes/ask.ts`

```typescript
const completion = await openai.chat.completions.create({
  model: model,  // 从数据库读取的模型配置
  temperature: 0.4,
  messages: [
    { role: "system", content: sys },
    {
      role: "user",
      content: `${userPrefix} ${question}\n\n${refPrefix}\n${reference || "（無/None）"}`,
    },
  ],
});

const answer = completion.choices?.[0]?.message?.content?.trim() ?? "";
```

---

## 📊 配置映射表

| 配置中心值 | 主服务选择 | AI 服务选择 | 最终调用 |
|-----------|----------|------------|---------|
| `local` | 本地 AI 服务 | - | Ollama (本地) |
| `online` | 在线 AI 服务 | OpenAI | OpenAI API |
| `openrouter` | 在线 AI 服务 | OpenRouter | OpenRouter API |
| `openrouter-direct` | 在线 AI 服务 | OpenRouter | OpenRouter API |

---

## 🔑 关键点

### 1. 配置存储位置
- **数据库表**: `ai_config`
- **字段**: `key = "aiProvider"`, `value = "online" | "local" | "openrouter" | "openrouter-direct"`

### 2. 配置读取时机
- **主服务**: 每次请求时从数据库读取（无缓存）
- **AI 服务**: 每次请求时从数据库读取（有 5 分钟缓存）

### 3. 配置优先级
- **主服务**: URL 参数 > 数据库配置 > 环境变量
- **AI 服务**: 数据库配置 > 环境变量

### 4. 配置映射
- `online` → OpenAI
- `openrouter` → OpenRouter
- `local` → 本地 AI 服务（Ollama）

### 5. 强制使用配置
- 如果数据库配置为 `online`（OpenAI），即使环境变量设置为 OpenRouter，也会强制使用 OpenAI
- 这确保了配置中心的设置能够正确生效

---

## 🐛 常见问题

### Q1: 配置中心设置为 `online`，但实际使用了 OpenRouter？

**原因**: AI 服务可能没有正确读取数据库配置，或者环境变量覆盖了配置。

**解决方案**: 
1. 检查 AI 服务的日志，确认是否读取到数据库配置
2. 检查 `OPENAI_BASE_URL` 环境变量，确保没有设置为 OpenRouter
3. 清除配置缓存（等待 5 分钟或重启服务）

### Q2: 配置更新后不生效？

**原因**: AI 服务有 5 分钟配置缓存。

**解决方案**: 
1. 等待 5 分钟让缓存过期
2. 重启 AI 服务清除缓存
3. 检查数据库配置是否正确更新

### Q3: 如何验证配置是否正确？

**检查步骤**:
1. 查看主服务日志：确认读取到的 `aiProviderFromDb` 值
2. 查看 AI 服务日志：确认读取到的 `aiProvider` 值
3. 查看 AI 服务日志：确认 `isOpenRouter` 的值
4. 查看实际调用的 API URL：确认是 OpenAI 还是 OpenRouter

---

## 📝 相关文件

- **配置中心页面**: `apps/web/app/admin/ai/config/page.tsx`
- **配置 API**: `apps/web/app/api/admin/ai/config/route.ts`
- **主服务路由**: `apps/web/app/api/ai/ask/route.ts`
- **AI 服务路由**: `apps/ai-service/src/routes/ask.ts`
- **配置加载器**: `apps/ai-service/src/lib/configLoader.ts`
- **OpenAI 客户端**: `apps/ai-service/src/lib/openaiClient.ts`

---

## 🔄 流程图

```
管理员设置配置
    ↓
保存到数据库 (ai_config 表)
    ↓
用户发起 AI 问答请求
    ↓
主服务读取数据库配置
    ↓
选择本地或在线 AI 服务
    ↓
转发请求到 AI 服务
    ↓
AI 服务读取数据库配置
    ↓
选择 OpenAI 或 OpenRouter
    ↓
创建 AI 客户端
    ↓
调用 AI API
    ↓
返回答案
```

---

## ✅ 总结

1. **配置中心** → 保存到数据库 `ai_config` 表
2. **主服务** → 从数据库读取，选择本地或在线 AI 服务
3. **AI 服务** → 从数据库读取，选择 OpenAI 或 OpenRouter
4. **AI 客户端** → 根据配置创建客户端，强制使用配置的提供商
5. **AI API** → 调用实际的 AI API（OpenAI 或 OpenRouter）

整个流程确保了配置中心的设置能够正确生效，不会被环境变量覆盖。

