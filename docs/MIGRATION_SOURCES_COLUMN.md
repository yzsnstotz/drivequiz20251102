# 添加 sources 字段到 ai_logs 表

## 问题

如果遇到错误 `column "sources" does not exist`，说明 `ai_logs` 表还没有 `sources` 字段。

## 解决方案

执行迁移脚本 `src/migrations/20251105_add_sources_to_ai_logs.sql`。

## 执行步骤

### 方式 1：通过 Supabase SQL Editor

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择项目
3. 进入 **SQL Editor**
4. 复制以下 SQL 并执行：

```sql
-- ============================================================
-- 为 ai_logs 表添加 sources 字段
-- 文件名: 20251105_add_sources_to_ai_logs.sql
-- 说明: 添加 JSONB 字段用于存储来源信息
-- 日期: 2025-11-05
-- ============================================================

BEGIN;

-- 添加 sources 字段（JSONB 类型，用于存储来源信息数组）
ALTER TABLE ai_logs 
ADD COLUMN IF NOT EXISTS sources JSONB DEFAULT '[]'::jsonb;

-- 创建索引以支持 JSONB 查询（可选）
CREATE INDEX IF NOT EXISTS idx_ai_logs_sources ON ai_logs USING gin (sources);

COMMIT;
```

### 方式 2：通过命令行

```bash
psql -h your-host -U your-user -d your-database -f src/migrations/20251105_add_sources_to_ai_logs.sql
```

### 方式 3：通过 Vercel Postgres

1. 在 Vercel 项目设置中找到数据库连接
2. 使用 Vercel CLI 或 Web 界面执行上述 SQL

## 验证

执行迁移后，可以通过以下方式验证：

```sql
-- 检查字段是否存在
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'ai_logs' 
AND column_name = 'sources';

-- 应该返回：
-- column_name | data_type
-- sources      | jsonb
```

## 注意事项

- 如果字段已存在，`ADD COLUMN IF NOT EXISTS` 不会报错
- 索引创建使用 `CREATE INDEX IF NOT EXISTS`，已存在的索引不会被重复创建
- 代码已经兼容字段不存在的情况（会检查字段是否存在后再查询），但为了完整功能，建议执行迁移

