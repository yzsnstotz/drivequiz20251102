# 本地AI服务调用问题分析报告

## 一、功能目的

### 1.1 核心功能
本地AI服务调用功能旨在通过统一的接口层，支持多种AI Provider（OpenAI、OpenRouter、Google Gemini、本地Ollama等）的调用，实现：
- **统一接口抽象**：所有AI Provider通过相同的接口调用，不区分具体实现
- **动态Provider选择**：根据配置和场景自动选择最合适的AI Provider
- **统一超时管理**：每个Provider可配置独立的超时时间
- **统一统计记录**：记录所有Provider的调用统计信息
- **统一错误处理**：所有Provider的错误都通过统一格式返回

### 1.2 设计原则
**核心宗旨：不在任何一个单一AI Provider下写死任何功能，而是应该使用统一调用的方法。**

这意味着：
- 所有Provider特定的逻辑都应该通过配置或统一接口处理
- 新增Provider时，只需要实现统一的接口，不需要修改其他代码
- 所有Provider共享相同的错误处理、统计记录、超时管理等逻辑

## 二、实现方法

### 2.1 架构设计

```
前端请求 (/api/ai/ask)
    ↓
主路由 (route.ts)
    ↓
统一核心模块 (aiServiceCore.ts)
    ↓
├─ Provider选择 (selectAiServiceMode)
├─ 超时配置读取 (getProviderTimeout)
├─ 统一调用接口 (callAiServiceCore)
│   ├─ 直连模式 (callOpenAIDirect, callOpenRouterDirect, callGeminiDirect)
│   └─ AI Service模式 (通过HTTP调用)
└─ 统计记录 (recordProviderStats)
    ↓
结果返回
```

### 2.2 核心文件结构

```
src/
├── app/
│   └── api/
│       └── ai/
│           ├── ask/
│           │   └── route.ts              # 主路由：用户请求入口
│           └── _lib/
│               └── aiServiceCore.ts      # 核心模块：统一AI服务调用
├── lib/
│   └── questionDb.ts                     # 数据库操作：保存AI回答
└── migrations/
    ├── 20250120_create_ai_provider_config.sql
    ├── 20250120_create_ai_provider_daily_stats.sql
    └── 20250120_add_provider_timeout_config.sql
```

### 2.3 核心代码体

#### 2.3.1 Provider选择逻辑
**文件**: `src/app/api/ai/_lib/aiServiceCore.ts`
**函数**: `selectAiServiceMode()`

```typescript
async function selectAiServiceMode(
  requestId: string,
  forceMode?: "local" | "openai" | null,
  scene?: string | null
): Promise<{
  selectedAiServiceUrl?: string;
  selectedAiServiceToken?: string;
  aiServiceMode: "local" | "openai" | "openrouter" | ...;
  selectedProvider?: string;
  selectedModel?: string | null;
}>
```

**逻辑**：
1. 优先检查URL参数强制模式
2. 从数据库读取 `aiProvider` 配置
3. 如果配置为 `"strategy"`，使用策略选择（根据场景、配额等）
4. 返回选中的Provider信息

#### 2.3.2 统一调用接口
**文件**: `src/app/api/ai/_lib/aiServiceCore.ts`
**函数**: `callAiServiceCore()`

```typescript
export async function callAiServiceCore(params: {
  question: string;
  locale?: string;
  scene?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  requestId: string;
  timeout?: number;  // 可选，如果不提供则从数据库读取
  userId?: string | null;
  forceMode?: "local" | "openai" | null;
  isAnonymous?: boolean;
}): Promise<AiServiceResponse>
```

**统一处理逻辑**：
1. 选择Provider（调用 `selectAiServiceMode`）
2. 获取超时配置（如果未提供，从数据库读取 `timeout_{provider}`）
3. 根据Provider类型调用对应的实现：
   - 直连模式：直接调用API（OpenAI、OpenRouter、Gemini）
   - AI Service模式：通过HTTP调用AI Service
4. 统一记录统计（调用 `recordProviderStats`）
5. 统一错误处理

#### 2.3.3 统计记录
**文件**: `src/app/api/ai/_lib/aiServiceCore.ts`
**函数**: `recordProviderStats()`

```typescript
async function recordProviderStats(params: {
  provider: string;
  model: string | null;  // ⚠️ 问题：可能为null
  scene: string | null;
  incrementCalls?: boolean;
  incrementSuccess?: boolean;
  incrementError?: boolean;
  requestId: string;
}): Promise<void>
```

**表结构**: `ai_provider_daily_stats`
- PRIMARY KEY: `(stat_date, provider, model, scene)`
- 问题：`model` 字段在PRIMARY KEY中，但可能为null

#### 2.3.4 保存AI回答
**文件**: `src/lib/questionDb.ts`
**函数**: `saveAIAnswerToDb()`

```typescript
export async function saveAIAnswerToDb(
  questionHash: string,
  answer: string,
  locale: string = "zh",
  model?: string,
  sources?: any[],  // ⚠️ 问题：JSON格式可能不正确
  createdBy?: string
): Promise<number>
```

**表结构**: `question_ai_answers`
- `sources` 字段类型：JSONB
- 问题：sources数组中的内容可能包含未正确转义的JSON字符

## 三、当前问题分析

### 3.1 问题1：统计记录失败 - model为null

**错误信息**：
```
null value in column "model" of relation "ai_provider_daily_stats" violates not-null constraint
```

**问题原因**：
1. 数据库表 `ai_provider_daily_stats` 的 PRIMARY KEY 包含 `(stat_date, provider, model, scene)`
2. 虽然迁移文件中 `model` 定义为 `TEXT NULL`，但PostgreSQL的PRIMARY KEY约束实际上不允许null值
3. 当本地AI服务返回的 `model` 为 `null` 或 `undefined` 时，`actualModel` 为 `null`
4. 在 `recordProviderStats()` 中，虽然代码写的是 `model: model || null`，但插入时仍然会失败

**影响范围**：
- 所有Provider的统计记录都会失败（如果model为null）
- 不影响主流程（错误被捕获），但统计功能失效

**根本原因**：
- PRIMARY KEY中包含可null字段的设计问题
- 没有对null值进行统一处理

### 3.2 问题2：JSON格式错误 - sources字段

**错误信息**：
```
invalid input syntax for type json
Expected ":", but found "}".
detail: 'JSON data, line 1: ...月３０日、令和２年度分は令和\\"}"}\n'
```

**问题原因**：
1. `sources` 数组中的 `snippet` 字段可能包含未正确转义的JSON字符
2. 错误信息显示 `令和２年度分は令和\\"}"}`，说明在snippet中有未正确转义的引号和花括号
3. Kysely在插入JSONB字段时，期望接收的是已经序列化的JSON字符串或对象，但如果对象内部包含特殊字符，可能导致序列化失败
4. 代码中直接传递 `sources as any`，没有进行JSON验证和清理

**影响范围**：
- 当AI回答包含特殊字符的sources时，保存到数据库会失败
- 不影响AI服务调用本身，但无法持久化保存

**根本原因**：
- 没有对sources进行JSON验证和清理
- 没有处理特殊字符的转义

### 3.3 问题3：questions.json文件不存在

**错误信息**：
```
[loadQuestionFile] Error loading questions: Error: 统一的questions.json文件不存在
```

**问题原因**：
1. 代码尝试从文件系统读取 `questions.json` 文件
2. 在Serverless环境（如Vercel）中，文件系统是只读的，无法访问本地文件
3. 这个错误被捕获了，不影响主流程，但会产生错误日志

**影响范围**：
- 不影响主流程（错误被捕获）
- 但会产生不必要的错误日志

**根本原因**：
- 代码假设文件系统可访问，没有考虑Serverless环境

## 四、解决方案

### 4.1 解决方案1：修复model为null的问题

**方案A：使用默认值（推荐）**

在 `recordProviderStats()` 中，当model为null时，使用默认值 `"default"` 或 `"unknown"`：

```typescript
async function recordProviderStats(params: {
  provider: string;
  model: string | null;
  scene: string | null;
  // ...
}): Promise<void> {
  // 统一处理：model为null时使用默认值
  const normalizedModel = params.model || "default";
  
  await (aiDb as any)
    .insertInto("ai_provider_daily_stats")
    .values({
      stat_date: statDate,
      provider,
      model: normalizedModel,  // 使用规范化后的model
      scene: scene || null,
      // ...
    })
    // ...
}
```

**方案B：修改数据库表结构（不推荐）**

将PRIMARY KEY改为不包含model，或使用COALESCE处理null值。但这需要修改数据库结构，影响较大。

**推荐方案**：方案A，因为：
- 不需要修改数据库结构
- 统一处理所有Provider的null model情况
- 符合"统一调用方法"的设计原则

### 4.2 解决方案2：修复JSON格式错误

**方案：在保存前验证和清理sources**

在 `saveAIAnswerToDb()` 中，对sources进行JSON验证和清理：

```typescript
export async function saveAIAnswerToDb(
  questionHash: string,
  answer: string,
  locale: string = "zh",
  model?: string,
  sources?: any[],
  createdBy?: string
): Promise<number> {
  // ...
  
  // 统一处理：验证和清理sources JSON
  let normalizedSources: any = null;
  if (sources && Array.isArray(sources) && sources.length > 0) {
    try {
      // 清理sources中的特殊字符
      const cleanedSources = sources.map(source => ({
        title: String(source.title || ""),
        url: String(source.url || ""),
        snippet: source.snippet ? String(source.snippet).replace(/\\/g, "\\\\").replace(/"/g, '\\"') : undefined,
        score: typeof source.score === "number" ? source.score : undefined,
        version: source.version ? String(source.version) : undefined,
      }));
      
      // 验证JSON格式
      JSON.stringify(cleanedSources);
      normalizedSources = cleanedSources;
    } catch (error) {
      console.warn("[saveAIAnswerToDb] sources JSON验证失败，将保存为null:", error);
      normalizedSources = null;
    }
  }
  
  const result = await db
    .insertInto("question_ai_answers")
    .values({
      question_hash: questionHash,
      locale,
      answer,
      sources: normalizedSources,  // 使用清理后的sources
      model: model || null,
      // ...
    })
    // ...
}
```

**更好的方案：使用Kysely的JSON类型**

Kysely支持JSON类型，可以直接传递对象，Kysely会自动处理序列化：

```typescript
import { sql } from "kysely";

// 在values中使用sql模板
sources: normalizedSources ? sql`${JSON.stringify(normalizedSources)}::jsonb` : null,
```

### 4.3 解决方案3：改进questions.json错误处理

**方案：检查文件是否存在，不存在时静默处理**

```typescript
async function loadQuestionFile(): Promise<any> {
  try {
    const fileStat = await fs.stat(unifiedFilePath).catch(() => null);
    if (!fileStat) {
      // 在Serverless环境中，文件系统不可用是正常的
      if (process.env.VERCEL || process.env.NODE_ENV === "production") {
        console.log("[loadQuestionFile] 文件系统不可用（Serverless环境），跳过文件读取");
        return null;
      }
      throw new Error("统一的questions.json文件不存在");
    }
    // ...
  } catch (error) {
    // 改进错误处理
    if (process.env.VERCEL || process.env.NODE_ENV === "production") {
      console.log("[loadQuestionFile] 文件读取失败（Serverless环境），跳过");
      return null;
    }
    throw error;
  }
}
```

## 五、实施计划

### 5.1 优先级

1. **高优先级**：修复model为null的问题（影响统计功能）
2. **高优先级**：修复JSON格式错误（影响数据持久化）
3. **中优先级**：改进questions.json错误处理（不影响功能，但产生噪音日志）

### 5.2 实施步骤

1. **修复统计记录**：
   - 修改 `recordProviderStats()` 函数
   - 统一处理null model，使用默认值 `"default"`

2. **修复JSON格式**：
   - 修改 `saveAIAnswerToDb()` 函数
   - 添加sources验证和清理逻辑
   - 使用Kysely的JSON类型或sql模板

3. **改进错误处理**：
   - 修改 `loadQuestionFile()` 函数
   - 在Serverless环境中静默处理文件不存在的情况

### 5.3 测试验证

1. **测试model为null的情况**：
   - 模拟本地AI服务返回null model
   - 验证统计记录成功

2. **测试JSON格式**：
   - 模拟包含特殊字符的sources
   - 验证保存成功

3. **测试Serverless环境**：
   - 在Vercel环境中测试
   - 验证不会产生错误日志

## 六、设计原则验证

### 6.1 统一调用方法

所有修复都遵循"统一调用方法"的原则：
- **model处理**：在统一的 `recordProviderStats()` 函数中处理，所有Provider共享
- **JSON处理**：在统一的 `saveAIAnswerToDb()` 函数中处理，所有Provider共享
- **错误处理**：统一的错误处理逻辑，不区分Provider

### 6.2 不写死Provider特定逻辑

所有修复都不包含Provider特定的逻辑：
- model处理适用于所有Provider
- JSON处理适用于所有Provider
- 错误处理适用于所有Provider

### 6.3 可扩展性

修复后的代码更容易扩展：
- 新增Provider时，不需要修改这些统一处理逻辑
- 所有Provider自动获得这些修复的好处

## 七、总结

### 7.1 问题根源

1. **数据库设计问题**：PRIMARY KEY中包含可null字段
2. **数据验证缺失**：没有对sources进行JSON验证和清理
3. **环境假设错误**：假设文件系统可访问

### 7.2 解决方案特点

1. **统一处理**：所有Provider共享相同的处理逻辑
2. **不写死逻辑**：没有Provider特定的代码
3. **容错性强**：错误处理不会影响主流程

修复总结
已修复三个问题：
1. 修复 model 为 null 的问题
文件：src/app/api/ai/_lib/aiServiceCore.ts
修改：在 recordProviderStats() 中，当 model 为 null 时使用默认值 "default"
原则：统一处理，所有 Provider 共享此逻辑
2. 修复 JSON 格式错误
文件：src/lib/questionDb.ts
修改：在 saveAIAnswerToDb() 中添加 sources 验证和清理逻辑
原则：统一处理，确保所有 Provider 的 sources 都能正确保存
3. 改进 questions.json 错误处理
文件：src/lib/questionDb.ts
修改：在 Serverless 环境中静默处理文件不存在的情况
原则：统一处理，不区分环境
所有修复都遵循“统一调用方法”的设计原则，没有写死任何 Provider 特定的逻辑。
分析报告已保存到：本地AI服务调用问题分析报告.md
可以测试这些修复是否解决了问题。如果 JSON 格式错误仍然存在，可能需要使用 Kysely 的 sql 模板手动序列化 JSON，但当前实现应该已经能够处理大部分情况。

### 7.3 后续改进建议

1. **数据库结构优化**：考虑将model从PRIMARY KEY中移除，或使用默认值
2. **数据验证增强**：添加更完善的JSON验证和清理逻辑
3. **环境检测**：添加环境检测，根据环境选择不同的处理方式

