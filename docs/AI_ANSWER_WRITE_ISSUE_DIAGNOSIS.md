# AI Answer 写入 question_ai_answers 表问题诊断报告

## 问题描述
AI 回答被成功记录到 `ai_logs` 表，但没有被记录到 `question_ai_answers` 表。

## 根本原因分析

### 1. questionHash 为空导致写入被跳过

**问题位置：** `src/app/api/ai/ask/route.ts` 第 2074 行

```typescript
if (questionHash) {
  // 写入 question_ai_answers 表
  // ...
}
```

**问题原因：**
- 如果前端没有传递 `questionHash`，代码会尝试通过题目内容匹配数据库
- 如果匹配失败（题目不在数据库中），`questionHash` 会保持为 `null`
- 当 `questionHash` 为 `null` 时，写入 `question_ai_answers` 的代码会被跳过

### 2. 题目匹配逻辑可能失败

**问题位置：** `src/app/api/ai/ask/route.ts` 第 2030-2072 行

**匹配逻辑：**
1. 优先精确匹配：`content = trimmedQuestion`
2. 如果失败，尝试模糊匹配：`content ILIKE %trimmedQuestion%`

**可能失败的原因：**
- 题目内容不完全匹配（空格、标点符号差异）
- 题目不在数据库中
- 数据库查询失败

### 3. 写入前重复检查可能导致问题

**问题位置：** `src/app/api/ai/ask/route.ts` 第 2095-2100 行

代码在写入前会检查是否已存在：
```typescript
const existing = await getAIAnswerFromDb(questionHash, localeStr);
if (existing) {
  // 跳过写入
  return;
}
```

而 `saveAIAnswerToDb` 函数内部也会检查：
```typescript
const existing = await db
  .selectFrom("question_ai_answers")
  .select(["id", "answer"])
  .where("question_hash", "=", questionHash)
  .where("locale", "=", locale)
  .executeTakeFirst();
```

这可能导致并发问题或性能问题。

## 解决方案

### ✅ 已实施：移除题目匹配逻辑

**修改内容：**
- 删除了 STEP 7.5 中的题目匹配逻辑（第 2033-2072 行）
- 如果 `questionHash` 为空，直接跳过写入 `question_ai_answers` 表
- 不再尝试通过题目内容匹配数据库来获取 `questionHash`

**修改后的逻辑：**
- 只有当 `questionHash` 存在时，才会写入 `question_ai_answers` 表
- 如果前端没有传递 `questionHash`，AI 回答只会记录到 `ai_logs` 表，不会写入 `question_ai_answers` 表

### 方案 1：改进题目匹配逻辑（已废弃）

~~1. **使用更宽松的匹配条件**~~
   ~~- 去除标点符号和空格后匹配~~
   ~~- 使用相似度匹配（如 Levenshtein 距离）~~

~~2. **如果匹配失败，仍然尝试写入**~~
   ~~- 使用问题的 hash 值作为 `question_hash`~~
   ~~- 即使题目不在数据库中，也可以记录 AI 回答~~

### 方案 2：改进错误处理和日志

1. **增强日志记录**
   - 记录 `questionHash` 为空的原因
   - 记录题目匹配失败的原因
   - 记录写入失败的具体错误

2. **改进错误处理**
   - 不要静默忽略错误
   - 记录详细的错误信息到日志

### 方案 3：优化写入逻辑

1. **移除重复检查**
   - 只在 `saveAIAnswerToDb` 函数内部检查
   - 移除外部的重复检查

2. **改进并发处理**
   - 使用数据库的唯一约束处理并发
   - 使用事务确保数据一致性

## 检查清单

- [ ] 检查前端是否传递 `questionHash`
- [ ] 检查题目匹配逻辑是否正常工作
- [ ] 检查数据库连接和权限
- [ ] 检查 `saveAIAnswerToDb` 函数的错误处理
- [ ] 检查日志中是否有相关错误信息

## 下一步行动

1. 检查实际运行日志，确认 `questionHash` 是否为空
2. 检查题目匹配逻辑是否正常工作
3. 改进错误处理和日志记录
4. 优化写入逻辑，确保即使 `questionHash` 为空也能记录 AI 回答

