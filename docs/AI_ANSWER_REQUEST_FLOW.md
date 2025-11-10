# AI助手请求（aiAnswer request）完整流程文档

## 概述

当用户在做题时发起AI助手请求（aiAnswer request）时，系统会触发一系列逻辑。本文档详细描述了从前端到后端的完整流程。

## 前端流程

### 1. 组件初始化 (`QuestionAIDialog.tsx`)

**位置**: `src/components/QuestionAIDialog.tsx`

**触发时机**: 用户打开AI助手对话框时

**逻辑**:
1. **加载本地JSON包中的aiAnswers** (第85-101行)
   - 调用 `loadAiAnswers()` 从本地缓存加载AI回答
   - 存储在组件state中 (`localAiAnswers`)
   - 只在第一次加载时执行

2. **初始化AI解释** (第104-110行)
   - 当对话框打开且未初始化时，自动调用 `fetchAIExplanation()`

### 2. 发起AI请求 (`fetchAIExplanation`)

**位置**: `src/components/QuestionAIDialog.tsx:156-250`

**触发时机**: 
- 对话框首次打开时（自动）
- 用户发送新问题时（手动）

**逻辑流程**:

#### 2.1 格式化题目内容
```typescript
const questionText = formatQuestionForAI();
// 包含：题目内容、选项、正确答案、解析
```

#### 2.2 获取题目hash值
```typescript
const questionHash = question.hash;
// 前端必须传递hash值，避免后端重复计算
```

#### 2.3 检查本地JSON包缓存（优先）
```typescript
if (localAiAnswers !== null && localAiAnswers[questionHash]) {
  // 从本地JSON包找到AI解析，直接返回
  // 跳过后端请求
  return;
}
```

#### 2.4 请求后端API
```typescript
const result = await apiFetch("/api/ai/ask", {
  method: "POST",
  body: {
    question: questionText,
    locale: "zh-CN",
    questionHash: questionHash, // 传递题目的hash值
  },
});
```

## 后端流程 (`/api/ai/ask`)

**位置**: `src/app/api/ai/ask/route.ts`

### STEP 0: 选择AI服务

**代码位置**: 第468-601行

**逻辑**:
1. **检查URL参数强制模式**
   - 如果URL参数包含 `?ai=local` 或 `?ai=online`，强制选择模式

2. **从数据库读取aiProvider配置**
   - 查询 `ai_config` 表，获取 `aiProvider` 配置值
   - 优先级：URL参数 > 数据库配置

3. **选择AI服务模式**
   - `local`: 本地AI服务（Ollama）
   - `openai`: OpenAI服务（通过Render AI Service）
   - `openrouter`: OpenRouter服务（通过Render AI Service）
   - `openrouter_direct`: 直连OpenRouter API
   - `openai_direct`: 直连OpenAI API

4. **配置服务URL和Token**
   - 根据选择的模式，设置对应的服务URL和Token

### STEP 1: JWT验证

**代码位置**: 第603-703行

**逻辑**:
1. **获取JWT Token**（多种方式）
   - Authorization header: `Bearer <jwt>`
   - Cookie: `USER_TOKEN` 或 `sb-access-token`
   - Query参数: `?token=<jwt>`

2. **验证JWT**
   - 生产环境：必须配置 `USER_JWT_SECRET`，严格验证
   - 开发/预览环境：如果未配置密钥，允许跳过认证

3. **处理特殊Token格式**
   - `act-` 格式：激活token，直接使用（不需要JWT验证）
   - 标准JWT格式：使用 `jwtVerify` 验证签名

4. **生成会话信息**
   - 如果验证成功，使用 `userId`
   - 如果验证失败或未提供token，使用匿名ID `"anonymous"`

### STEP 2: 参数校验

**代码位置**: 第705-748行

**逻辑**:
1. **解析请求体**
   - 验证JSON格式
   - 提取 `question`、`locale`、`questionHash`

2. **校验question字段**
   - 必须存在且为字符串
   - 长度限制：1-1000字符
   - 规范化：去除多余空格

3. **校验locale字段**
   - 可选字段
   - 如果提供，必须符合BCP-47格式

4. **获取questionHash**
   - 优先使用前端传递的hash值
   - 如果没有传递，说明不是题目请求

### STEP 3: 配额检查

**代码位置**: 第750-792行

**逻辑**:
1. **检查用户每日配额**
   - 每用户每日限制：10次
   - 使用内存计数器（UTC按日重置）
   - 生产环境建议改造为Redis/DB聚合

2. **配额判断**
   - 新用户/新日期：初始化计数器
   - 已使用配额：检查是否超过限制
   - 超过限制：返回429错误

### STEP 4: userId转发

**代码位置**: 第794-815行

**逻辑**:
1. **处理userId转发**
   - 匿名用户：`forwardedUserId = null`
   - `act-` 格式：直接使用（格式：`act-{activationId}`）
   - UUID格式：直接使用

### STEP 4.5: 检查缓存（数据库）

**代码位置**: 第817-895行

**逻辑**:
1. **获取questionHash**
   - 优先使用前端传递的hash值
   - 如果没有传递，说明不是题目请求，跳过缓存检查

2. **检查数据库缓存**
   - 调用 `getAIAnswerFromDb(questionHash, locale)`
   - 查询 `question_ai_answers` 表

3. **如果找到缓存**
   - 存入用户缓存（内存缓存）
   - 写入 `ai_logs` 表（标记为缓存，来源：database）
   - 直接返回缓存答案，跳过AI服务调用

### STEP 5: 调用AI服务

**代码位置**: 第897-1639行

**逻辑**（根据AI服务模式不同）：

#### 5.1 直连OpenRouter模式 (`openrouter_direct`)

**代码位置**: 第898-1165行

1. **检查环境变量**
   - `OPENROUTER_API_KEY`
   - `OPENROUTER_BASE_URL`
   - `OPENROUTER_REFERER_URL`
   - `OPENROUTER_APP_NAME`

2. **从数据库读取模型配置**
   - 查询 `ai_config` 表，获取 `model` 配置

3. **安全审查**
   - 调用 `checkSafetySimple(question)` 进行内容安全检查

4. **RAG检索**（可选）
   - 如果配置了Supabase，可以调用RAG检索
   - 当前实现中暂时跳过

5. **构建系统提示**
   - 根据语言构建系统提示词

6. **调用OpenRouter API**
   - 发送POST请求到 `/chat/completions`
   - 包含系统提示、用户问题、RAG上下文

7. **处理响应**
   - 提取AI回答
   - 计算成本估算
   - 写入 `ai_logs` 表

#### 5.2 直连OpenAI模式 (`openai_direct`)

**代码位置**: 第1168-1417行

逻辑与OpenRouter直连模式类似，但调用OpenAI API。

#### 5.3 通过AI Service模式 (`local` / `openai` / `openrouter`)

**代码位置**: 第1419-1639行

1. **构建请求体**
   ```typescript
   {
     userId: forwardedUserId,
     locale,
     question,
     metadata: {
       channel: "web",
       client: "zalem",
       answerCharLimit: 300,
       version: "v1.0.1",
       isAnonymous: session.userId === "anonymous",
       originalUserId: session.userId,
     },
   }
   ```

2. **发送请求到AI Service**
   - URL: `${baseUrl}/v1/ask`
   - Headers: 
     - `Authorization: Bearer ${selectedAiServiceToken}`
     - `X-AI-Provider: ${aiServiceMode}` (如果适用)

3. **超时控制**
   - 30秒超时
   - 使用 `AbortController` 实现

4. **错误处理和回退**
   - 如果本地AI服务失败（网络错误），尝试回退到在线AI服务
   - 如果返回502/503/504错误，尝试回退

### STEP 6: 处理上游响应

**代码位置**: 第1641-1765行

**逻辑**:
1. **解析响应**
   - 读取响应文本
   - 解析JSON格式

2. **检查响应状态**
   - 如果 `upstream.ok === false` 或 `result.ok === false`，处理错误

3. **错误映射**
   - 将上游错误码映射到标准错误码
   - `VALIDATION_FAILED` → `VALIDATION_FAILED`
   - `RATE_LIMIT_EXCEEDED` → `RATE_LIMIT_EXCEEDED`
   - `SAFETY_BLOCKED` → `FORBIDDEN`
   - `NOT_RELEVANT` → `PROVIDER_ERROR`

4. **回退机制**
   - 如果本地AI服务返回502/503/504错误，尝试回退到在线AI服务

### STEP 7: 记录AI聊天行为（异步）

**代码位置**: 第1769-1862行

**逻辑**:
1. **查找用户ID**
   - 通过 `forwardedUserId` 查询 `users` 表
   - 获取用户的数字ID

2. **记录聊天行为**
   - 调用 `getAiChatBehaviorCache().addChatRecord()`
   - 记录：用户ID、问题、IP地址、User-Agent、客户端类型
   - 异步执行，不阻塞响应

### STEP 7: 写入ai_logs表（备份）

**代码位置**: 第1864-1910行

**逻辑**:
1. **检查是否需要写入**
   - 如果使用了缓存（`cached=true`），跳过（已在STEP 4.5.3中写入）
   - 如果AI服务模式是 `local`，跳过（本地AI服务会自己写入）

2. **计算RAG命中数**
   - 从 `result.data.sources` 数组长度获取

3. **写入ai_logs表**
   - 调用 `writeAiLogToDatabase()`
   - 记录：用户ID、问题、答案、语言、模型、RAG命中数、安全标志、成本估算、来源、AI提供商等
   - 异步执行，不阻塞响应

### STEP 7.5: 写入question_ai_answers表和更新JSON包

**代码位置**: 第1957-2041行

**逻辑**:
1. **检查questionHash**
   - 如果之前没有计算questionHash，尝试重新匹配题目
   - 通过问题内容匹配 `questions` 表

2. **检查是否已存在**
   - 调用 `getAIAnswerFromDb(questionHash, locale)`
   - 如果已存在，跳过数据库写入（避免覆盖）
   - **但会更新JSON包**（确保JSON包是最新的）

3. **写入新回答到数据库**
   - 调用 `saveAIAnswerToDb()`
   - 插入到 `question_ai_answers` 表
   - 记录：question_hash、locale、answer、sources、model、created_by等
   - 检查返回的ID，确保写入成功

4. **存入用户缓存**
   - 调用 `setUserCachedAnswer()` 存入内存缓存

5. **JSON包更新** ⚠️
   - **JSON包不会实时更新**
   - 需要定期在后台手动更新JSON包
   - 用户下次请求时，会从数据库读取缓存（STEP 4.5）

6. **错误处理**
   - 详细的错误日志，包括堆栈信息
   - 使用Promise.catch确保异步错误被捕获

### STEP 8: 返回结果

**代码位置**: 第2007-2032行

**逻辑**:
1. **构建响应数据**
   ```typescript
   {
     answer: string,
     sources?: Array<{...}>,
     model?: string,
     safetyFlag?: "ok" | "needs_human" | "blocked",
     costEstimate?: {...},
     cached?: boolean,
     aiProvider?: string,
     cacheSource?: "json" | "database",
   }
   ```

2. **返回成功响应**
   - HTTP 200
   - JSON格式

## 数据库操作

### 1. 读取操作

- **`ai_config` 表**: 读取AI服务配置（aiProvider、model）
- **`question_ai_answers` 表**: 读取缓存的AI回答
- **`questions` 表**: 匹配题目（如果需要重新计算hash）
- **`users` 表**: 查找用户ID（用于记录聊天行为）

### 2. 写入操作

- **`ai_logs` 表**: 记录所有AI交互日志
  - 包括缓存答案和AI生成的答案
  - 记录来源（`from: "question"`）、AI提供商、缓存信息等

- **`question_ai_answers` 表**: 保存题目的AI回答
  - 只有在数据库中没有时才写入
  - 不会覆盖已存在的回答

## 缓存机制

### 1. 前端缓存

- **本地JSON包**: 从 `questions.json` 加载 `aiAnswers` 对象
- **组件state**: 存储在 `localAiAnswers` 中

### 2. 后端缓存

- **用户内存缓存**: `userAnswerCache` Map结构
  - 格式: `Map<userId, Map<questionHash, answer>>`
  - 限制：每个用户最多1000条

- **数据库缓存**: `question_ai_answers` 表
  - 持久化存储
  - 按 `question_hash` 和 `locale` 索引

## 错误处理

### 1. 认证错误
- **401**: JWT验证失败（生产环境）
- **401**: OpenRouter/OpenAI API认证失败

### 2. 验证错误
- **400**: 请求体格式错误
- **400**: question字段缺失或过长
- **400**: locale格式无效

### 3. 配额错误
- **429**: 每日配额已超限

### 4. 服务错误
- **502**: AI服务不可用
- **503**: AI服务暂时不可用
- **504**: AI服务请求超时（30秒）

### 5. 安全错误
- **403**: 内容被安全策略阻止

## 性能优化

1. **缓存优先**: 前端先检查本地JSON包，后端先检查数据库缓存
2. **异步写入**: 日志和数据库写入都是异步执行，不阻塞响应
3. **超时控制**: AI服务请求有30秒超时限制
4. **回退机制**: 本地AI服务失败时，自动回退到在线AI服务

## 注意事项

1. **questionHash必须传递**: 前端必须传递题目的hash值，避免后端重复计算
2. **缓存不会覆盖**: 如果数据库已有AI回答，不会覆盖，避免重复生成
3. **JSON包不实时更新**: JSON包只有在手动触发批量更新时才更新
4. **配额限制**: 每用户每日10次，使用内存计数器（生产环境建议使用Redis/DB）

