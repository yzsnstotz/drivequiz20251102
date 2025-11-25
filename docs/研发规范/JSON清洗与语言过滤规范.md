# JSON 清洗与语言过滤规范

**版本**: v1.0  
**最后更新**: 2025-01-24  
**维护者**: 开发团队

---

## 1. 概述

本文档定义了 DriveQuiz 系统中 JSON 清洗和语言过滤的统一规范，确保 AI 返回的数据能够正确解析和存储到数据库。

---

## 2. JSON 清洗工具（cleanJsonString）

### 2.1 用途

`cleanJsonString` 函数用于清理 AI 返回的 JSON 字符串，使其符合标准 JSON 语法。

### 2.2 输入输出

**函数签名**:
```typescript
function cleanJsonString(input: string): string
```

**输入**: 原始 JSON 字符串（可能包含格式问题）

**输出**: 清理后的 JSON 字符串

### 2.3 处理规则

1. **去除 UTF-8 BOM / 零宽空格**
   - 移除字符串开头的 `\uFEFF` 和 `\u200B` 字符

2. **去除 Markdown 代码块包裹**
   - 移除开头的 ` ```json ` 或 ` ``` ` 标记
   - 移除结尾的 ` ``` ` 标记

3. **去除尾随逗号**
   - 移除对象和数组结尾处的尾随逗号（如 `{...,}` 或 `[...,]`）

### 2.4 使用场景

所有从 AI 服务返回的 JSON 字符串，在调用 `JSON.parse()` 之前，必须先通过 `cleanJsonString` 处理。

**示例**:
```typescript
import { cleanJsonString } from './jsonUtils';

// ❌ 错误：直接解析可能失败
const parsed = JSON.parse(rawJsonString);

// ✅ 正确：先清洗再解析
const parsed = JSON.parse(cleanJsonString(rawJsonString));
```

### 2.5 异常情况处理

- 如果输入为空或 `null`，直接返回原值
- 如果清洗后仍然无法解析，抛出 `JSON.parse` 错误（由调用方处理）

---

## 3. 数据库 JSONB 规范化（sanitizeJsonForDb）

### 3.1 用途

`sanitizeJsonForDb` 函数用于递归清理将要写入 JSONB 字段的数据，确保不包含 `undefined` 值和无效类型。

### 3.2 输入输出

**函数签名**:
```typescript
function sanitizeJsonForDb<T>(value: T): T | null
```

**输入**: 任意类型的值（对象、数组、基本类型）

**输出**: 清理后的值（不包含 `undefined`）

### 3.3 处理规则

1. **移除 `undefined` 值**
   - 对象中的 `undefined` 属性会被移除
   - 数组中的 `undefined` 元素会被丢弃

2. **类型保证**
   - 只保留 JSON 支持的类型：`string`、`number`、`boolean`、`null`、`object`、`array`
   - 其他类型（如 `BigInt`、`Date`、`Function`）会被丢弃或转换为 `null`

3. **递归处理**
   - 嵌套对象和数组会递归处理
   - 保证所有层级都不包含 `undefined`

### 3.4 使用场景

所有要写入数据库 JSONB 字段的数据，在调用数据库操作之前，必须先通过 `sanitizeJsonForDb` 处理。

**示例**:
```typescript
import { sanitizeJsonForDb } from './jsonUtils';

// ❌ 错误：可能包含 undefined
await db
  .updateTable('questions')
  .set({
    content: updatedContent,
    explanation: updatedExplanation,
  })
  .execute();

// ✅ 正确：先清理再写入
const safeContent = sanitizeJsonForDb(updatedContent);
const safeExplanation = sanitizeJsonForDb(updatedExplanation);
await db
  .updateTable('questions')
  .set({
    content: safeContent as any,
    explanation: safeExplanation as any,
  })
  .execute();
```

### 3.5 数据库写入规范

**必须使用 `sanitizeJsonForDb` 的字段**:
- `questions.content` - 多语言题干 JSONB
- `questions.explanation` - 多语言解析 JSONB
- `questions.options` - 选项 JSONB
- `questions.correct_answer` - 答案 JSONB

**验证步骤**:
1. 使用 `sanitizeJsonForDb` 清理数据
2. 使用 `JSON.stringify` 进行轻量验证（提前发现 BigInt 等不支持类型）
3. 写入数据库

---

## 4. AI Payload 语言过滤（sanitizeAiPayload）

### 4.1 用途

`sanitizeAiPayload` 函数用于安全过滤 AI 返回的 payload，只允许白名单字段写入 question 模型，并在源头就按照目标语言过滤 translations。

### 4.2 输入输出

**函数签名**:
```typescript
function sanitizeAiPayload(
  aiResult: any,
  params: SanitizeAiPayloadParams
): SanitizedPayload
```

**参数类型**:
```typescript
type SanitizeAiPayloadParams = {
  sourceLanguage: string;          // 源语言代码（如 'zh'）
  targetLanguages?: string[];      // 目标语言列表（如 ['ja', 'en']）
  scene?: string;                  // 场景标识（如 'question_full_pipeline'）
};
```

**返回类型**:
```typescript
type SanitizedPayload = {
  source?: {
    content?: string;
    options?: string[];
    explanation?: string;
  };
  translations?: Record<string, {
    content?: string;
    options?: string[];
    explanation?: string;
  }>;
  tags?: {
    license_type_tags?: string[];
    stage_tags?: string[];
    topic_tags?: string[];
    difficulty_level?: "easy" | "medium" | "hard" | null;
  };
  correct_answer?: any;
};
```

### 4.3 语言过滤规则

1. **目标语言过滤**
   - 如果指定了 `targetLanguages`，只保留这些语言的翻译
   - 如果未指定，保留所有语言的翻译

2. **源语言保留规则**
   - 对于 `full_pipeline` 场景，如果 AI 在 `translations` 里返回了源语言，可以视需要保留（如果不在已过滤列表中）

3. **类型验证**
   - `translations` 必须是 `Record<string, any>` 类型（不能是数组）
   - 所有 language key 必须为字符串类型

### 4.4 使用场景

所有从 AI 服务返回的完整结果对象，在写入数据库之前，必须先通过 `sanitizeAiPayload` 处理。

**示例**:
```typescript
// ❌ 错误：直接使用 AI 返回的数据
const translations = parsed.translations; // 可能包含不需要的语言

// ✅ 正确：先过滤再使用
const sanitized = sanitizeAiPayload(parsed, {
  sourceLanguage: 'zh',
  targetLanguages: ['ja'],
  scene: 'question_full_pipeline',
});
const translations = sanitized.translations; // 只包含 ja
```

### 4.5 白名单字段

**允许的字段**:
- `source` - 源语言内容
- `translations` - 多语言翻译（按目标语言过滤）
- `tags` - 标签信息
- `correct_answer` - 正确答案

**不允许的字段**:
- 所有其他字段都会被过滤掉

---

## 5. full_pipeline 调用路径

### 5.1 完整流程

```
1. 接收批量处理请求
   ↓
2. 调用 processFullPipelineBatch
   ↓
3. 构造 AI 请求（包含 prompt）
   ↓
4. 调用 AI 服务（callAiAskInternal）
   ↓
5. 清理 JSON 字符串（cleanJsonString）
   ↓
6. 解析 JSON（JSON.parse）
   ↓
7. 过滤 AI Payload（sanitizeAiPayload）
   ↓
8. 应用翻译结果到模型
   ↓
9. 清理 JSONB 数据（sanitizeJsonForDb）
   ↓
10. 验证 JSON 可序列化性
   ↓
11. 写入数据库（事务更新）
```

### 5.2 关键步骤说明

**步骤 5-6: JSON 解析**
- 必须使用 `cleanJsonString` 清理 AI 返回的字符串
- 解析失败时，记录详细错误信息到 `error_detail` 字段

**步骤 7: 语言过滤**
- 在 `sanitizeAiPayload` 阶段就按照 `targetLanguages` 过滤
- 确保后续处理只使用已过滤的数据

**步骤 9-10: 数据清理与验证**
- 使用 `sanitizeJsonForDb` 清理所有 JSONB 数据
- 使用 `JSON.stringify` 进行轻量验证

---

## 6. 前后端日志规范

### 6.1 日志格式

**标准格式**:
```
[BATCH][questionId=xxx] step=xxx
payload=...
result=...
removedLanguages=[ "en" ]
cleanedJsonPreview=...
```

**日志步骤**:
- `AI_CALL_BEFORE` - AI 调用前
- `AI_CALL_AFTER` - AI 调用后
- `SANITIZE_AFTER` - sanitize 之后
- `DB_WRITE_BEFORE` - 数据库写入前

### 6.2 日志存储

**存储位置**:
- `batch_process_tasks.details.server_logs` - 服务器日志数组

**日志限制**:
- 最多保留 500 条日志
- 超过限制时，移除最旧的日志

### 6.3 前端展示

**展示要求**:
- 支持展开/收缩大 JSON
- 支持高亮显示 `removedLanguages`、`cleanedJsonPreview`
- 支持按步骤过滤（AI 调用 / sanitize / DB 写入）

---

## 7. 最佳实践

### 7.1 JSON 解析

```typescript
// ✅ 最佳实践
try {
  const cleaned = cleanJsonString(rawJsonString);
  const parsed = JSON.parse(cleaned);
} catch (error) {
  // 记录详细错误信息
  console.error('JSON 解析失败:', error);
  throw new Error('AI_JSON_PARSE_FAILED');
}
```

### 7.2 数据库写入

```typescript
// ✅ 最佳实践
const safeContent = sanitizeJsonForDb(updatedContent);
const safeExplanation = sanitizeJsonForDb(updatedExplanation);

// 轻量验证
try {
  JSON.stringify(safeContent ?? {});
  JSON.stringify(safeExplanation ?? {});
} catch (jsonError) {
  throw new Error(`JSON格式错误: ${jsonError.message}`);
}

// 写入数据库
await db
  .updateTable('questions')
  .set({
    content: safeContent as any,
    explanation: safeExplanation as any,
  })
  .execute();
```

### 7.3 语言过滤

```typescript
// ✅ 最佳实践
const sanitized = sanitizeAiPayload(parsed, {
  sourceLanguage: 'zh',
  targetLanguages: ['ja'],
  scene: 'question_full_pipeline',
});

// 直接使用 sanitized.translations，不再需要重复过滤
const translations = sanitized.translations || {};
for (const [lang, translation] of Object.entries(translations)) {
  // 处理翻译...
}
```

---

## 8. 错误处理

### 8.1 JSON 解析错误

**错误码**: `AI_JSON_PARSE_FAILED`

**处理方式**:
1. 记录原始响应到 `error_detail.rawAiResponse`
2. 记录错误信息到 `error_detail.errorMessage`
3. 抛出错误，由调用方处理

### 8.2 类型验证错误

**错误信息**: `[sanitizeAiPayload] translations must be an object`

**处理方式**:
1. 抛出错误，阻止继续处理
2. 记录到 `error_detail`

### 8.3 数据库写入错误

**错误信息**: `invalid input syntax for type json`

**处理方式**:
1. 使用 `sanitizeJsonForDb` 清理数据
2. 使用 `JSON.stringify` 提前验证
3. 如果仍然失败，记录详细错误信息

---

## 9. 测试要求

### 9.1 单元测试

- `cleanJsonString` 测试：带尾随逗号、Markdown 代码块、BOM 字符
- `sanitizeJsonForDb` 测试：对象带 `undefined`、数组带 `undefined`、嵌套对象
- `sanitizeAiPayload` 测试：目标语言过滤、类型验证

### 9.2 集成测试

- full_pipeline 完整流程测试
- 双环境测试（local-ai-service + 远程 ai-service）
- 数据库 JSONB 写入验证

---

## 10. 更新记录

- **2025-01-24**: 初始版本，定义 JSON 清洗和语言过滤规范

---

**参考文档**:
- [批量处理 JSON 容错与目标语言过滤修复执行报告](../问题修复/批量处理JSON格式与目标语言过滤问题/执行报告/批量处理JSON容错与目标语言过滤修复_执行报告.md)

