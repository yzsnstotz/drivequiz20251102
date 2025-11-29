# 修复 updateOnly 模式使用 content_hash 查找题目 - 执行报告

## 任务摘要

修复 `saveQuestionToDb` 函数的 `updateOnly` 模式，统一通过 `content_hash` 查找题目，确保 `content_hash` 是题目标识的唯一手段。同时确保批量处理时传入原始的 `content_hash`，防止因内容润色导致 hash 变化而找不到题目。

## 修改文件列表

1. `src/lib/questionDb.ts` - 修改 `saveQuestionToDb` 函数，统一通过 `content_hash` 查找题目
2. `src/app/api/admin/question-processing/_lib/batchProcessUtils.ts` - 修改 `processFullPipelineBatch` 调用，传入原始的 `content_hash`
3. `src/app/api/admin/question-processing/batch-process/route.ts` - 修改 `category_tags` 操作调用，传入原始的 `content_hash`
4. `src/lib/version.ts` - 更新版本号

## 修改详情

### 1. 修改 `saveQuestionToDb` 函数（src/lib/questionDb.ts）

**修改前**：
- `updateOnly` 模式通过 `id` 查找题目
- `upsert` 模式通过 `content_hash` 查找题目

**修改后**：
- 统一通过 `content_hash` 查找题目（`content_hash` 是题目标识的唯一手段）
- `updateOnly` 模式：通过 `content_hash` 查找，找不到则抛出错误
- `upsert` 模式：通过 `content_hash` 查找，找不到则插入新题目
- 如果传入了 `hash` 字段，使用传入的 hash（原始的 `content_hash`），否则才计算
- 更新时不更新 `content_hash`（保持不变）

**关键代码**：
```typescript
// ✅ 修复：统一通过 content_hash 查找题目（content_hash 是题目标识的唯一手段）
// updateOnly 模式：通过 content_hash 查找，找不到则抛出错误
// upsert 模式：通过 content_hash 查找，找不到则插入新题目
const existing = await db
  .selectFrom("questions")
  .select(["id"])
  .where("content_hash", "=", contentHash)
  .executeTakeFirst();

if (!existing && mode === "updateOnly") {
  console.error(
    `[saveQuestionToDb] [updateOnly] Question content_hash=${contentHash} not found, aborting without insert.`,
  );
  throw new Error("QUESTION_NOT_FOUND_FOR_UPDATE");
}
```

### 2. 修改批量处理调用（src/app/api/admin/question-processing/_lib/batchProcessUtils.ts）

**修改位置**：`processFullPipelineBatch` 函数中调用 `saveQuestionToDb` 的地方（第 3098 行）

**修改内容**：
- 传入原始的 `content_hash` 作为 `hash` 字段
- 确保通过原始的 `content_hash` 查找题目，不因内容润色导致 hash 变化

**关键代码**：
```typescript
await saveQuestionToDb({
  id: question.id,
  hash: question.content_hash, // ✅ 传入原始的 content_hash，不重新计算（防止因内容润色导致 hash 变化）
  type: normalizedQuestion.type,
  content: question.content,
  // ... 其他字段
  mode: "updateOnly",
} as any);
```

### 3. 修改 category_tags 操作调用（src/app/api/admin/question-processing/batch-process/route.ts）

**修改位置**：`category_tags` 操作中调用 `saveQuestionToDb` 的地方（第 2186 行）

**修改内容**：
- 传入原始的 `content_hash` 作为 `hash` 字段
- 确保通过原始的 `content_hash` 查找题目

**关键代码**：
```typescript
await saveQuestionToDb({
  id: currentQuestion.id,
  hash: currentQuestion.content_hash, // ✅ 传入原始的 content_hash，不重新计算
  type: currentQuestion.type,
  // ... 其他字段
  mode: "updateOnly",
} as any);
```

### 4. 确认 content_hash 不在批量处理时更新

**检查结果**：
- `saveQuestionToDb` 在更新时（第 242-258 行）**不更新 `content_hash`**，这是正确的
- 只有在插入新题目时才会设置 `content_hash`（第 266 行），这是正确的
- 没有找到任何其他地方会自动更新 `content_hash`（除了手动更新hash的接口 `/api/admin/questions/update-hashes`）

## 逐条红线规范自检

### A. 架构红线
- **A1** ✅ 已遵守：路由层未承载业务逻辑，业务逻辑在工具层
- **A2** ✅ 不适用：本次修改不涉及 AI 功能
- **A3** ✅ 不适用：本次修改不涉及 ai-service
- **A4** ✅ 已遵守：接口参数、返回结构保持一致

### B. 数据库 & 文件结构红线
- **B1** ✅ 已遵守：未修改数据库字段、表结构、索引
- **B2** ✅ 已遵守：未新增、删除、迁移文件
- **B3** ✅ 已遵守：Kysely 类型定义与数据库结构保持一致
- **B4** ✅ 已遵守：未修改数据库 schema

### C. 测试红线
- **C1** ✅ 不适用：本次修改不涉及 AI 功能
- **C2** ✅ 不适用：本次修改不涉及 AI 功能
- **C3** ✅ 不适用：本次修改不涉及 AI 功能

### D. 执行报告红线
- **D1** ✅ 已遵守：已输出完整执行报告
- **D2** ✅ 已遵守：已逐条对照 A1-D2，标注遵守情况

## 测试结果

### 代码检查
- ✅ 所有修改的文件通过 linter 检查，无错误
- ✅ 类型检查通过，无类型错误

### 逻辑验证
- ✅ `updateOnly` 模式统一通过 `content_hash` 查找题目
- ✅ 批量处理时传入原始的 `content_hash`，不重新计算
- ✅ 更新时不更新 `content_hash`，保持不变
- ✅ 没有其他地方会自动更新 `content_hash`（除了手动更新hash的接口）

## 迁移脚本

无数据库迁移脚本（本次修改不涉及数据库结构变更）

## 更新后的文档

无文档更新（本次修改不涉及数据库结构或文件结构变更）

## 风险点与下一步建议

### 风险点
1. **低风险**：如果批量处理时没有传入原始的 `content_hash`，会基于当前内容重新计算 hash，可能导致找不到题目（但会抛出错误，不会插入新题目）
2. **低风险**：如果传入的 `content_hash` 不正确，会导致找不到题目（但会抛出错误，不会插入新题目）

### 下一步建议
1. 确保所有批量处理调用都传入原始的 `content_hash` 作为 `hash` 字段
2. 监控批量处理日志，确认没有 `QUESTION_NOT_FOUND_FOR_UPDATE` 错误
3. 如果发现错误，检查是否正确传入了原始的 `content_hash`

## 版本号

当前版本号：**2025-11-25 11:41:43**

## 总结

本次修复成功实现了以下目标：
1. ✅ `updateOnly` 模式统一通过 `content_hash` 查找题目（`content_hash` 是题目标识的唯一手段）
2. ✅ 批量处理时传入原始的 `content_hash`，防止因内容润色导致 hash 变化
3. ✅ 确认 `content_hash` 不在批量处理时自动更新（只在手动更新hash时更新）
4. ✅ 确认没有其他地方会自动更新 `content_hash`

修复后的代码确保了 `content_hash` 作为题目标识的唯一手段，避免了因内容变化导致找不到题目的问题。

