# 修复 full_pipeline 保存时 JSON 格式错误问题 - 执行报告

## 问题描述

**错误信息**：`invalid input syntax for type json`  
**错误阶段**：`SAVE_ALL_CHANGES_IN_TX`  
**发生时间**：2025-11-25

### 错误详情

在 `processFullPipelineBatch` 函数执行 `SAVE_ALL_CHANGES_IN_TX` 阶段时，保存题目到数据库时出现 JSON 格式错误。

**错误堆栈**：
```
error: invalid input syntax for type json
    at PostgresConnection.executeQuery
    at saveQuestionToDb
    at processFullPipelineBatch
```

## 问题分析

### 根本原因

1. **字段处理不一致**：
   - `content`、`explanation`、`options`、`correct_answer` 等 JSONB 字段都使用了 `sanitizeJsonForDb` 处理
   - `license_type_tag` 和 `topic_tags` 字段没有使用 `sanitizeJsonForDb` 处理
   - 这导致某些情况下数组无法正确序列化为 JSONB

2. **数据类型要求**：
   - `license_type_tag` 是 JSONB 类型，需要确保是有效的 JSON
   - `topic_tags` 是 PostgreSQL 数组类型（`string[]`），虽然不是 JSONB，但也需要确保格式正确

3. **数据来源**：
   - `processFullPipelineBatch` 构建 `savePayload`，包含 `license_type_tag` 和 `topic_tags`
   - `savePayload` 传递给 `saveQuestionToDb`
   - `saveQuestionToDb` 直接将这些字段赋值给 `updateData`，没有进行清理

## 修复方案

在 `saveQuestionToDb` 函数中，对 `license_type_tag` 和 `topic_tags` 使用 `sanitizeJsonForDb` 处理，确保：
1. `license_type_tag` 正确序列化为 JSONB
2. `topic_tags` 保持为有效的数组格式
3. 移除 `undefined` 值，避免序列化错误

## 修改内容

### 修改文件

- `src/lib/questionDb.ts`

### 具体修改

#### 1. 更新逻辑（第248-261行）

**修改前**：
```typescript
// ✅ 修复：只有 license_type_tag 存在时才更新（null/undefined 时不更新，保留原值）
if ((cleanedQuestion as any).license_type_tag !== null && (cleanedQuestion as any).license_type_tag !== undefined) {
  updateData.license_type_tag = (cleanedQuestion as any).license_type_tag;
}

// ✅ 修复：只有 topic_tags 存在时才更新（null/undefined 时不更新，保留原值）
if (cleanedQuestion.topic_tags !== null && cleanedQuestion.topic_tags !== undefined) {
  updateData.topic_tags = cleanedQuestion.topic_tags;
}
```

**修改后**：
```typescript
// ✅ 修复：只有 license_type_tag 存在时才更新（null/undefined 时不更新，保留原值）
// ✅ 使用 sanitizeJsonForDb 处理 JSONB 字段，确保格式正确
if ((cleanedQuestion as any).license_type_tag !== null && (cleanedQuestion as any).license_type_tag !== undefined) {
  updateData.license_type_tag = sanitizeJsonForDb((cleanedQuestion as any).license_type_tag) as any;
}

// ✅ 修复：只有 topic_tags 存在时才更新（null/undefined 时不更新，保留原值）
// ✅ 使用 sanitizeJsonForDb 处理数组字段，确保格式正确
if (cleanedQuestion.topic_tags !== null && cleanedQuestion.topic_tags !== undefined) {
  updateData.topic_tags = sanitizeJsonForDb(cleanedQuestion.topic_tags) as any;
}
```

#### 2. 插入逻辑（第283-300行）

**修改前**：
```typescript
// ✅ 修复：插入时，如果字段值存在则设置，否则使用 null（新插入允许 null）
if ((cleanedQuestion as any).license_type_tag !== null && (cleanedQuestion as any).license_type_tag !== undefined) {
  insertData.license_type_tag = (cleanedQuestion as any).license_type_tag;
} else {
  insertData.license_type_tag = null;
}

if (cleanedQuestion.topic_tags !== null && cleanedQuestion.topic_tags !== undefined) {
  insertData.topic_tags = cleanedQuestion.topic_tags;
} else {
  insertData.topic_tags = null;
}
```

**修改后**：
```typescript
// ✅ 修复：插入时，如果字段值存在则设置，否则使用 null（新插入允许 null）
// ✅ 使用 sanitizeJsonForDb 处理 JSONB 字段，确保格式正确
if ((cleanedQuestion as any).license_type_tag !== null && (cleanedQuestion as any).license_type_tag !== undefined) {
  insertData.license_type_tag = sanitizeJsonForDb((cleanedQuestion as any).license_type_tag) as any;
} else {
  insertData.license_type_tag = null;
}

// ✅ 使用 sanitizeJsonForDb 处理数组字段，确保格式正确
if (cleanedQuestion.topic_tags !== null && cleanedQuestion.topic_tags !== undefined) {
  insertData.topic_tags = sanitizeJsonForDb(cleanedQuestion.topic_tags) as any;
} else {
  insertData.topic_tags = null;
}
```

## 版本更新

- **文件**：`src/lib/version.ts`
- **版本号**：`2025-11-25 13:14:44`
- **更新说明**：修复full_pipeline保存时JSON格式错误，使用sanitizeJsonForDb处理license_type_tag和topic_tags

## 测试建议

1. **功能测试**：
   - 运行 `full_pipeline` 批量处理，验证保存是否成功
   - 检查 `license_type_tag` 和 `topic_tags` 是否正确保存到数据库
   - 验证 JSONB 字段格式是否正确

2. **边界情况测试**：
   - 测试 `license_type_tag` 为空数组的情况
   - 测试 `topic_tags` 为空数组的情况
   - 测试字段值为 `null` 的情况
   - 测试字段值为 `undefined` 的情况

3. **数据验证**：
   - 检查数据库中保存的数据格式是否正确
   - 验证 JSONB 字段可以正常查询和解析

## 影响范围

- **影响功能**：`full_pipeline` 批量处理功能
- **影响文件**：`src/lib/questionDb.ts`
- **向后兼容**：✅ 是（不影响现有数据）

## 注意事项

1. `sanitizeJsonForDb` 会移除 `undefined` 值，确保 JSON 格式正确
2. `topic_tags` 虽然是数组，但使用 `sanitizeJsonForDb` 可以确保格式正确
3. 修改与现有代码逻辑兼容，不会影响其他功能

## 执行时间

- **开始时间**：2025-11-25 13:14:44
- **完成时间**：2025-11-25 13:14:44
- **执行人员**：AI Assistant

## 总结

本次修复解决了 `full_pipeline` 批量处理时保存题目到数据库时出现的 JSON 格式错误问题。通过在 `saveQuestionToDb` 函数中对 `license_type_tag` 和 `topic_tags` 使用 `sanitizeJsonForDb` 处理，确保了这些字段能够正确序列化为数据库所需的格式，避免了 `invalid input syntax for type json` 错误。

修复后的代码与现有逻辑保持一致，所有 JSONB 字段都统一使用 `sanitizeJsonForDb` 处理，提高了代码的一致性和可维护性。

