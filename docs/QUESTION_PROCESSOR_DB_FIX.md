# Question Processor 数据库连接修复

## 问题描述

翻译和润色功能报错：`signal is aborted without reason`，返回 500 错误。

## 修复内容

### 1. 数据库连接配置改进 (`apps/question-processor/src/db.ts`)

- ✅ 添加了详细的日志记录（连接字符串、SSL 配置、连接状态）
- ✅ 自动检测 Supabase 连接并启用 SSL
- ✅ 添加连接池错误监听
- ✅ 确保连接到 drivequiz 主程序数据库

**环境变量优先级：**
1. `QUESTION_PROCESSOR_DATABASE_URL` (首选)
2. `DATABASE_URL` (备用)
3. `POSTGRES_URL` (备用)

### 2. 表结构迁移脚本 (`src/migrations/20251113_ensure_question_processor_tables.sql`)

确保以下表结构完善：
- `languages` - 支持语言配置
- `question_translations` - 题目翻译存储
- `question_polish_reviews` - 润色建议与审核
- `question_polish_history` - 润色历史记录

### 3. 日志记录增强

#### Question Processor (`apps/question-processor/src/index.ts`)
- ✅ 翻译端点 (`/translate`) 添加详细日志
- ✅ 润色端点 (`/polish`) 添加详细日志
- ✅ 每个请求都有唯一的 requestId 用于追踪
- ✅ 记录数据库查询、AI 调用、错误等关键步骤

#### API 路由 (`src/app/api/admin/question-processing/`)
- ✅ 翻译 API 路由添加日志
- ✅ 润色 API 路由添加日志
- ✅ 记录请求、响应、错误信息

## 执行步骤

### 1. 执行数据库迁移

确保表结构已创建：

```bash
# 使用 DATABASE_URL 环境变量
psql $DATABASE_URL -f src/migrations/20251113_ensure_question_processor_tables.sql

# 或使用 QUESTION_PROCESSOR_DATABASE_URL
psql $QUESTION_PROCESSOR_DATABASE_URL -f src/migrations/20251113_ensure_question_processor_tables.sql
```

### 2. 确认环境变量配置

确保 question-processor 服务配置了正确的数据库连接：

```bash
# 检查环境变量
echo $QUESTION_PROCESSOR_DATABASE_URL
echo $DATABASE_URL
echo $POSTGRES_URL
```

**重要：** 确保连接的是 **drivequiz 主程序数据库**，而不是其他数据库。

### 3. 验证表结构

执行以下 SQL 验证表是否存在：

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'languages',
    'question_translations',
    'question_polish_reviews',
    'question_polish_history',
    'questions'
  );
```

### 4. 查看日志

修复后，日志会显示：

- `[Question Processor DB]` - 数据库连接相关日志
- `[Translate]` - 翻译功能日志
- `[Polish]` - 润色功能日志
- `[API Translate]` - API 路由日志
- `[API Polish]` - API 路由日志

## 排查问题

### 如果仍然出现 500 错误

1. **检查数据库连接**
   - 查看日志中的 `[Question Processor DB]` 信息
   - 确认连接字符串是否正确
   - 确认 SSL 配置是否正确（Supabase 需要 SSL）

2. **检查表结构**
   - 执行迁移脚本
   - 验证所有必需的表是否存在

3. **检查日志**
   - 查看完整的错误堆栈
   - 根据 requestId 追踪特定请求

4. **检查 question-processor 服务**
   - 确认服务正在运行
   - 确认 `QUESTION_PROCESSOR_URL` 环境变量正确配置

## 环境变量检查清单

- [ ] `QUESTION_PROCESSOR_DATABASE_URL` 或 `DATABASE_URL` 已配置
- [ ] 数据库连接字符串指向 drivequiz 主程序数据库
- [ ] 表结构已通过迁移脚本创建
- [ ] `QUESTION_PROCESSOR_URL` 已配置（API 路由使用）
- [ ] `AI_SERVICE_URL` 已配置（翻译和润色功能需要）

## 相关文件

- `apps/question-processor/src/db.ts` - 数据库连接配置
- `apps/question-processor/src/index.ts` - 翻译和润色端点
- `src/app/api/admin/question-processing/translate/route.ts` - 翻译 API 路由
- `src/app/api/admin/question-processing/polish/route.ts` - 润色 API 路由
- `src/migrations/20251113_ensure_question_processor_tables.sql` - 表结构迁移脚本

