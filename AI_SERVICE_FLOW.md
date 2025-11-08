# AI服务切换逻辑流程详解

## 📋 完整流程概览

```
前端请求 → 主服务(/api/ai/ask) → 环境变量加载 → AI服务选择 → 转发请求 → 本地AI服务(/v1/ask) → 鉴权 → 处理 → 返回响应
```

---

## 🔵 主服务端（Next.js）

### 文件1: `apps/web/app/api/ai/ask/route.ts`

#### 1.1 模块加载时 - 环境变量加载
**位置**: 第7-48行（模块顶层，在函数定义之前）

**方法**: 模块加载时执行的代码块
```typescript
if (process.env.NODE_ENV !== "production") {
  // 加载环境变量文件
}
```

**参数**:
- `process.cwd()`: 项目根目录路径
- `__dirname`: 当前文件所在目录
- 环境变量文件路径:
  - `rootEnvLocal`: `resolve(process.cwd(), ".env.local")`
  - `rootEnv`: `resolve(process.cwd(), ".env")`
  - `webEnvLocal`: `resolve(__dirname, "../../../.env.local")`
  - `webEnv`: `resolve(__dirname, "../../../.env")`

**执行逻辑**:
1. 调用 `config({ path: webEnvLocal, override: true })` - 加载 `apps/web/.env.local`
2. 调用 `config({ path: rootEnvLocal, override: true })` - 加载项目根目录 `.env.local`
3. 调用 `config({ path: rootEnv, override: false })` - 加载项目根目录 `.env`
4. 调用 `config({ path: webEnv, override: false })` - 加载 `apps/web/.env`

**关键环境变量**:
- `USE_LOCAL_AI`: "true" 或 其他值
- `LOCAL_AI_SERVICE_URL`: "http://localhost:8788"
- `LOCAL_AI_SERVICE_TOKEN`: "local_ai_token_dev_12345"
- `AI_SERVICE_URL`: "https://zalem.onrender.com"
- `AI_SERVICE_TOKEN`: "0c2a86471894beb557d858775a3217f6"

---

#### 1.2 环境变量读取函数
**位置**: 第89-96行

**方法**: `getEnvVar(key: string, defaultValue = ""): string`

**参数**:
- `key`: 环境变量名称（字符串）
- `defaultValue`: 默认值（字符串，默认为空字符串）

**返回值**: 环境变量的值（字符串）

**调用链**:
- `getUseLocalAI()` → 调用 `getEnvVar("USE_LOCAL_AI") === "true"`
- `getLocalAIServiceUrl()` → 调用 `getEnvVar("LOCAL_AI_SERVICE_URL")`
- `getLocalAIServiceToken()` → 调用 `getEnvVar("LOCAL_AI_SERVICE_TOKEN")`
- `getAIServiceUrl()` → 调用 `getEnvVar("AI_SERVICE_URL")`
- `getAIServiceToken()` → 调用 `getEnvVar("AI_SERVICE_TOKEN")`

---

#### 1.3 主路由处理函数
**位置**: 第280-469行

**方法**: `export async function POST(req: NextRequest)`

**参数**:
- `req: NextRequest` - Next.js请求对象

**返回值**: `Promise<NextResponse>` - Next.js响应对象

---

#### 1.3.1 步骤1: JWT鉴权和用户ID解析
**位置**: 第280-305行

**方法调用**:
- `readUserJwt(req: NextRequest): string | null` (第155-181行)
  - 从请求头 `Authorization: Bearer <token>` 读取
  - 从Cookie `sb-access-token` 读取
  - 从URL参数 `?token=<token>` 读取

- `unsafeDecodeJwtSub(jwt: string): string | null` (第184-224行)
  - 解析JWT payload，提取 `sub`、`user_id`、`userId` 或 `id` 字段
  - 验证是否为UUID格式

- `generateAnonymousId(token: string): string` (第227-243行)
  - 如果JWT解析失败，基于token生成匿名ID

- `incrAndCheckDailyLimit(key: string)` (第245-258行)
  - 检查日配额限制
  - 参数: `quotaKey` = `"anon:${userId}"` 或 `"u:${userId}"`

**变量**:
- `jwt: string | null` - JWT token
- `userId: string | null` - 用户ID
- `isAnonymous: boolean` - 是否为匿名用户
- `quotaKey: string` - 配额统计键

---

#### 1.3.2 步骤2: 请求体验证
**位置**: 第307-320行

**方法调用**:
- `req.json()` - 解析请求体JSON

**参数验证**:
- `body.question`: 字符串，必填，长度1-1000字符
- `body.locale`: 字符串，可选，BCP-47格式

**方法调用**:
- `isValidLocale(locale?: string): boolean` (第260-264行)
  - 验证locale格式: `/^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/`

**变量**:
- `body: AskRequestBody` - 请求体对象
- `question: string` - 问题文本
- `locale: string | undefined` - 语言代码

---

#### 1.3.3 步骤3: AI服务选择 ⭐关键步骤⭐
**位置**: 第322-354行

**方法调用**:
- `getUseLocalAI()` → `getEnvVar("USE_LOCAL_AI") === "true"`
- `getLocalAIServiceUrl()` → `getEnvVar("LOCAL_AI_SERVICE_URL")`
- `getLocalAIServiceToken()` → `getEnvVar("LOCAL_AI_SERVICE_TOKEN")`
- `getAIServiceUrl()` → `getEnvVar("AI_SERVICE_URL")`
- `getAIServiceToken()` → `getEnvVar("AI_SERVICE_TOKEN")`

**逻辑判断**:
```typescript
const useLocalAI = USE_LOCAL_AI && LOCAL_AI_SERVICE_URL && LOCAL_AI_SERVICE_TOKEN;
const aiServiceUrl = useLocalAI ? LOCAL_AI_SERVICE_URL : AI_SERVICE_URL;
const aiServiceToken = useLocalAI ? LOCAL_AI_SERVICE_TOKEN : AI_SERVICE_TOKEN;
```

**变量**:
- `USE_LOCAL_AI: boolean` - 是否使用本地AI（从环境变量读取）
- `LOCAL_AI_SERVICE_URL: string` - 本地AI服务URL
- `LOCAL_AI_SERVICE_TOKEN: string` - 本地AI服务Token
- `AI_SERVICE_URL: string` - 线上AI服务URL
- `AI_SERVICE_TOKEN: string` - 线上AI服务Token
- `useLocalAI: boolean` - 最终决定是否使用本地AI
- `aiServiceUrl: string` - 最终选择的AI服务URL
- `aiServiceToken: string` - 最终选择的AI服务Token

---

#### 1.3.4 步骤4: 构建转发请求体
**位置**: 第356-370行

**方法调用**:
- `mapLocaleToLang(locale?: string): "zh" | "ja" | "en"` (第267-272行)
  - 将BCP-47格式的locale映射为AI服务期望的lang格式

**变量**:
- `forwardPayload: Record<string, unknown>` - 转发给AI服务的请求体
  ```typescript
  {
    userId: string | null,        // 用户ID
    lang: "zh" | "ja" | "en",    // 语言代码
    question: string,             // 问题文本
    metadata: {                   // 元数据
      channel: "web",
      client: "zalem",
      isAnonymous: boolean,
      originalUserId: string | null
    }
  }
  ```

---

#### 1.3.5 步骤5: 转发请求到AI服务
**位置**: 第372-425行

**方法调用**:
- `fetch(requestUrl, options)` - 发送HTTP请求

**参数**:
- `requestUrl: string` - `${aiServiceUrl}/v1/ask` (去除尾部斜杠)
- `method: "POST"`
- `headers: Record<string, string>`:
  ```typescript
  {
    "content-type": "application/json; charset=utf-8",
    "authorization": `Bearer ${aiServiceToken}`,
    "x-user-jwt": jwt  // 可选，如果存在JWT
  }
  ```
- `body: string` - `JSON.stringify(forwardPayload)`

**返回值**:
- `aiResp: Response` - fetch响应对象

**错误处理**:
- 如果fetch失败，返回502错误

---

#### 1.3.6 步骤6: 解析AI服务响应
**位置**: 第427-455行

**方法调用**:
- `aiResp.text()` - 读取响应文本
- `JSON.parse(responseText)` - 解析JSON

**变量**:
- `responseText: string` - 响应原始文本
- `aiJson: AiServiceResponse` - 解析后的响应对象
  ```typescript
  {
    ok: true,
    data: {
      answer: string,
      model: string,
      reference: string | null,
      lang: string,
      cached: boolean,
      time: string
    }
  }
  ```

---

#### 1.3.7 步骤7: 返回响应给前端
**位置**: 第457-469行

**方法调用**:
- `truncateAnswer(ans: string, limit: number): string` (第274-277行)
  - 截断答案长度，限制为 `ANSWER_CHAR_LIMIT` (默认300字符)

- `json<Ok<AiAskData>>(200, { ok: true, data: cut })` (第124-126行)
  - 返回成功响应

**变量**:
- `cut: AiAskData` - 处理后的响应数据（答案已截断）

---

## 🟢 本地AI服务端（Fastify）

### 文件2: `apps/local-ai-service/src/routes/ask.ts`

#### 2.1 路由注册
**位置**: 第38-187行

**方法**: `export default async function askRoute(app: FastifyInstance)`

**参数**:
- `app: FastifyInstance` - Fastify应用实例

**路由注册**:
- `app.post("/v1/ask", handler)` - 注册POST路由

---

#### 2.2 请求处理函数
**位置**: 第41-185行

**方法**: `async (request: FastifyRequest<{ Body: AskBody }>, reply: FastifyReply)`

**参数**:
- `request: FastifyRequest<{ Body: AskBody }>` - Fastify请求对象
  - `request.body: AskBody`:
    ```typescript
    {
      question?: string,
      userId?: string,
      lang?: string
    }
    ```
- `reply: FastifyReply` - Fastify响应对象

**变量**:
- `config: LocalAIConfig` - 从 `app.config` 获取配置
- `requestId: string` - 请求ID（用于日志追踪）

---

#### 2.2.1 步骤1: 服务间鉴权
**位置**: 第55-58行

**方法调用**:
- `ensureServiceAuth(request, config)` (来自 `../middlewares/auth.js`)

**参数传递**:
- `request: FastifyRequest` - 请求对象
- `config: LocalAIConfig` - 配置对象（包含 `serviceTokens: Set<string>`）

**鉴权逻辑** (在 `apps/local-ai-service/src/middlewares/auth.ts`):
1. 检查请求头 `Authorization: Bearer <token>`
2. 提取token: `authHeader.slice(7)`
3. 验证token是否在 `config.serviceTokens` 中
4. 如果验证失败，抛出401错误

---

#### 2.2.2 步骤2: 请求体验证
**位置**: 第60-82行

**参数提取**:
- `body.question: string` - 问题文本（trim后）
- `body.lang: string` - 语言代码（默认"zh"，转小写，trim后）
- `body.userId: string | undefined` - 用户ID

**验证规则**:
- `question`: 必填，长度1-2000字符

**错误处理**:
- 如果验证失败，返回400错误

---

#### 2.2.3 步骤3: RAG检索
**位置**: 第84-90行

**方法调用**:
- `getRagContext(question: string, lang: string)` (来自 `../lib/rag.js`)

**参数**:
- `question: string` - 问题文本
- `lang: string` - 语言代码

**返回值**:
- `reference: string | null` - RAG检索到的参考内容

---

#### 2.2.4 步骤4: 调用Ollama Chat
**位置**: 第92-129行

**方法调用**:
- `buildSystemPrompt(lang: string): string` (第26-36行)
  - 根据语言构建系统提示词
  - 支持: "zh"（中文）、"ja"（日文）、"en"（英文）

- `callOllamaChat(messages, temperature)` (来自 `../lib/ollamaClient.js`)

**参数**:
- `messages: Array<{ role: "system" | "user" | "assistant"; content: string }>`:
  ```typescript
  [
    { role: "system", content: sys },  // 系统提示词
    {
      role: "user",
      content: `${userPrefix} ${question}\n\n${refPrefix}\n${reference || "（無/None）"}`
    }
  ]
  ```
- `temperature: number` - 0.4

**返回值**:
- `answer: string` - Ollama返回的答案

**错误处理**:
- 如果answer为空，返回502错误

---

#### 2.2.5 步骤5: 构建响应
**位置**: 第131-147行

**变量**:
- `sources: Array<{ title: string; url: string; snippet?: string }>` - 来源数组
- `result: AskResult` - 响应结果对象
  ```typescript
  {
    answer: string,
    sources?: Array<...>,
    model: string,              // config.aiModel (如 "llama3.2:3b")
    safetyFlag: "ok",
    reference: string | null,
    lang: string,
    cached: false,
    time: string                // ISO8601格式
  }
  ```

---

#### 2.2.6 步骤6: 返回响应
**位置**: 第149-161行

**方法调用**:
- `reply.send({ ok: true, data: result })`

**响应格式**:
```typescript
{
  ok: true,
  data: {
    answer: string,
    model: string,
    safetyFlag: "ok",
    reference: string | null,
    lang: string,
    cached: false,
    time: string
  }
}
```

---

## 🔴 关键问题分析

### 问题1: 环境变量加载时机
**位置**: `apps/web/app/api/ai/ask/route.ts` 第7-48行

**问题**: 环境变量在模块加载时读取，但Next.js可能在启动时已经加载了环境变量，导致后续的 `config()` 调用无法覆盖已存在的环境变量。

**解决方案**: 
- 使用 `override: true` 强制覆盖（已实现）
- 但Next.js可能在启动时已经读取了 `.env.local`，导致 `process.env` 中的值无法被覆盖

### 问题2: 环境变量读取时机
**位置**: `apps/web/app/api/ai/ask/route.ts` 第324-328行

**问题**: `getUseLocalAI()` 等函数在每次请求时调用 `getEnvVar()`，但 `getEnvVar()` 读取的是 `process.env`，如果环境变量在模块加载时没有正确设置，运行时读取也会失败。

**解决方案**:
- 确保环境变量在模块加载时正确设置
- 或者在运行时重新加载环境变量

### 问题3: AI服务选择逻辑
**位置**: `apps/web/app/api/ai/ask/route.ts` 第338-340行

**逻辑**:
```typescript
const useLocalAI = USE_LOCAL_AI && LOCAL_AI_SERVICE_URL && LOCAL_AI_SERVICE_TOKEN;
const aiServiceUrl = useLocalAI ? LOCAL_AI_SERVICE_URL : AI_SERVICE_URL;
const aiServiceToken = useLocalAI ? LOCAL_AI_SERVICE_TOKEN : AI_SERVICE_TOKEN;
```

**问题**: 如果 `USE_LOCAL_AI` 为 `false` 或 `undefined`，或者 `LOCAL_AI_SERVICE_URL` 或 `LOCAL_AI_SERVICE_TOKEN` 为空，就会使用线上AI服务。

**当前状态**: 
- 环境变量配置: ✅ `USE_LOCAL_AI=true`
- 但主服务仍使用线上AI: ❌ `gpt-4o-mini`

**可能原因**:
1. 环境变量在模块加载时没有正确设置
2. Next.js在启动时已经读取了环境变量，后续的 `config()` 调用无法覆盖
3. `process.env` 中的值在运行时读取时仍然是旧值

---

## 📝 调试建议

1. **检查环境变量加载日志**: 查看 `[ENV LOAD]` 日志，确认环境变量是否正确加载
2. **检查环境变量读取日志**: 查看 `[ENV GET]` 日志，确认运行时读取的值
3. **检查AI服务选择日志**: 查看 `[STEP 3]` 日志，确认选择逻辑的执行结果
4. **检查请求转发日志**: 查看 `[STEP 4]` 日志，确认实际转发的URL

