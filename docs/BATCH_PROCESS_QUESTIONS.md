# 批量AI修正题目功能说明

## 概述

批量AI修正功能允许管理员通过AI对数据库中的题目进行批量处理，支持翻译、填漏、润色、分类、标签等多种操作。

## 功能特性

### 支持的操作类型

1. **翻译（translate）**：将题目从一种语言翻译到另一种语言
2. **润色（polish）**：对题目文本进行润色改进，生成待审核的润色建议
3. **填漏（fill_missing）**：智能补充缺失的题目内容（题干、选项、解析）
4. **分类标签（category_tags）**：自动生成题目的分类、阶段标签和主题标签

### 处理范围

- **全部题目**：不指定 `questionIds` 时，处理数据库中的所有题目
- **指定范围**：提供 `questionIds` 数组时，只处理指定的题目

### 批量处理特性

- 支持分批处理，可配置每批处理数量（默认10个）
- 支持错误继续模式，遇到错误可继续处理其他题目
- 详细的处理结果统计和错误报告

## API 使用

### 端点

```
POST /api/admin/question-processing/batch-process
```

### 请求参数

```typescript
{
  questionIds?: number[];           // 可选：指定要处理的题目ID列表，不提供则处理全部
  operations: string[];              // 必需：要执行的操作数组，可选值：["translate", "polish", "fill_missing", "category_tags"]
  translateOptions?: {               // 可选：翻译选项（当 operations 包含 "translate" 时必需）
    from: string;                     // 源语言（如 "zh", "ja", "en"）
    to: string;                      // 目标语言（如 "zh", "ja", "en"）
  };
  polishOptions?: {                  // 可选：润色选项（当 operations 包含 "polish" 时必需）
    locale: string;                   // 要润色的语言（如 "zh-CN", "ja-JP", "en-US"）
  };
  batchSize?: number;                // 可选：每批处理数量，默认 10
  continueOnError?: boolean;          // 可选：遇到错误是否继续，默认 true
}
```

### 响应格式

```typescript
{
  ok: true,
  data: {
    total: number;                   // 总题目数
    processed: number;               // 已处理数量
    succeeded: number;               // 成功数量
    failed: number;                 // 失败数量
    taskId: string;                  // 任务ID（用于查询进度）
    errors: Array<{                  // 错误列表
      questionId: number;
      error: string;
    }>;
    details: Array<{                 // 详细处理结果
      questionId: number;
      operations: string[];          // 成功执行的操作列表
      status: "success" | "failed";
    }>;
  }
}
```

### 任务状态查询

#### 查询单个任务

```
GET /api/admin/question-processing/batch-process?taskId={taskId}
```

响应格式：
```typescript
{
  ok: true,
  data: {
    id: number;
    task_id: string;
    status: "pending" | "processing" | "completed" | "failed" | "cancelled";
    operations: string[];
    question_ids: number[] | null;
    total_questions: number;
    processed_count: number;
    succeeded_count: number;
    failed_count: number;
    current_batch: number;
    errors: Array<{ questionId: number; error: string }> | null;
    details: Array<{ questionId: number; operations: string[]; status: string }> | null;
    created_by: string | null;
    started_at: Date | null;
    completed_at: Date | null;
    created_at: Date;
    updated_at: Date;
  }
}
```

#### 查询所有任务

```
GET /api/admin/question-processing/batch-process?status={status}&limit={limit}&offset={offset}
```

查询参数：
- `status` (可选): 过滤任务状态（pending, processing, completed, failed, cancelled）
- `limit` (可选): 每页数量，默认 50
- `offset` (可选): 偏移量，默认 0

响应格式：
```typescript
{
  ok: true,
  data: {
    tasks: Array<{ /* 任务详情 */ }>;
    total: number;
    limit: number;
    offset: number;
  }
}
```

## 使用示例

### 示例1：批量翻译所有题目（中文到日文）

```typescript
const response = await fetch('/api/admin/question-processing/batch-process', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    operations: ['translate'],
    translateOptions: {
      from: 'zh',
      to: 'ja'
    },
    batchSize: 20,
    continueOnError: true
  })
});
```

### 示例2：批量生成分类和标签（指定题目范围）

```typescript
const response = await fetch('/api/admin/question-processing/batch-process', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    questionIds: [1, 2, 3, 4, 5],  // 只处理这5个题目
    operations: ['category_tags'],
    batchSize: 5
  })
});
```

### 示例3：同时执行多个操作

```typescript
const response = await fetch('/api/admin/question-processing/batch-process', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    operations: ['fill_missing', 'category_tags', 'polish'],
    polishOptions: {
      locale: 'zh-CN'
    },
    batchSize: 10,
    continueOnError: true
  })
});
```

### 示例4：批量翻译并生成标签

```typescript
const response = await fetch('/api/admin/question-processing/batch-process', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    questionIds: [100, 101, 102],  // 指定题目范围
    operations: ['translate', 'category_tags'],
    translateOptions: {
      from: 'zh',
      to: 'en'
    },
    batchSize: 5
  })
});
```

## 操作说明

### 1. 翻译（translate）

- **功能**：将题目从源语言翻译到目标语言
- **结果存储**：保存到 `question_translations` 表
- **要求**：必须提供 `translateOptions`

### 2. 润色（polish）

- **功能**：对题目文本进行润色改进
- **结果存储**：创建润色建议到 `question_polish_reviews` 表（状态为 `pending`，需要审核）
- **要求**：必须提供 `polishOptions`

### 3. 填漏（fill_missing）

- **功能**：智能补充缺失的题目内容
- **结果存储**：直接更新 `questions` 表
- **说明**：只有当内容确实缺失时才会更新

### 4. 分类标签（category_tags）

- **功能**：自动生成题目的分类、阶段标签和主题标签
- **结果存储**：直接更新 `questions` 表的 `category`、`stage_tag`、`topic_tags` 字段
- **说明**：如果AI无法确定某些值，会保持原值不变

## 注意事项

1. **顺序执行**：
   - 系统确保在上次请求完成后再开始下次请求
   - 如果已有任务正在处理，新请求会返回 409 错误，提示等待
   - 可以通过查询任务状态来确认是否完成

2. **批量处理时间**：处理大量题目可能需要较长时间，建议：
   - 使用合理的 `batchSize`（建议 10-20）
   - 对于大量题目，考虑分批提交请求
   - 使用任务ID定期查询进度，而不是等待请求完成

3. **错误处理**：
   - 默认 `continueOnError: true`，会继续处理其他题目
   - 设置为 `false` 时，遇到错误会立即停止

4. **任务记录**：
   - 每次批量处理都会创建任务记录
   - 任务状态包括：pending（待处理）、processing（处理中）、completed（已完成）、failed（失败）、cancelled（已取消）
   - 可以通过任务ID查询实时进度和最终结果

5. **润色审核**：
   - 润色操作会创建待审核建议，不会直接更新题目
   - 需要在管理后台审核通过后才会应用

6. **AI场景配置**：
   - 系统使用数据库中的AI场景配置
   - 确保以下场景已配置：
     - `question_translation`（翻译）
     - `question_polish`（润色）
     - `question_fill_missing`（填漏）
     - `question_category_tags`（分类标签）

7. **数据库迁移**：
   - 首次使用前，需要按顺序运行以下迁移文件：
     
     **在主程序数据库中运行**：
     ```bash
     # 1. 创建批量处理任务表（主程序数据库）
     src/migrations/20250121_create_batch_process_tasks.sql
     ```
     
     **在 AI Service 数据库中运行**：
     ```bash
     # 2. 创建AI场景配置表（如果还没运行）
     src/migrations/20251113_create_ai_scene_config.sql
     
     # 3. 添加批量处理所需的AI场景配置
     src/migrations/20250121_add_ai_scenes_for_batch_process.sql
     ```
     
   **重要提示**：
   - `batch_process_tasks` 表在主程序数据库中（question-processor 使用）
   - `ai_scene_config` 表在 AI Service 数据库中（AI 服务使用）

## 技术实现

### 架构

- **question-processor 服务**：提供批量处理端点 `/batch-process`
- **主站 API**：提供 `/api/admin/question-processing/batch-process` 路由
- **AI 服务**：通过场景配置调用不同的AI prompt

### 处理流程

1. 接收批量处理请求
2. 根据 `questionIds` 获取要处理的题目列表
3. 分批处理题目（每批 `batchSize` 个）
4. 对每个题目执行指定的操作
5. 收集处理结果和错误信息
6. 返回详细的处理统计

### 相关文件

- `apps/question-processor/src/index.ts` - 批量处理端点实现
- `apps/question-processor/src/ai.ts` - AI函数实现
- `apps/question-processor/src/db.ts` - 数据库类型定义
- `src/app/api/admin/question-processing/batch-process/route.ts` - 主站API路由
- `src/migrations/20250121_create_batch_process_tasks.sql` - 批量处理任务表迁移
- `src/migrations/20250121_add_ai_scenes_for_batch_process.sql` - AI场景配置迁移

### 数据库表结构

#### batch_process_tasks 表

用于记录批量处理任务的状态和进度：

- `task_id`: 任务唯一标识
- `status`: 任务状态（pending, processing, completed, failed, cancelled）
- `operations`: 要执行的操作列表
- `question_ids`: 要处理的题目ID列表（null表示全部）
- `total_questions`: 总题目数
- `processed_count`: 已处理数量
- `succeeded_count`: 成功数量
- `failed_count`: 失败数量
- `current_batch`: 当前批次号
- `errors`: 错误列表（JSONB）
- `details`: 详细处理结果（JSONB）
- `created_by`: 创建者
- `started_at`: 开始时间
- `completed_at`: 完成时间

