# 创建 ai_config 表

## 问题

如果遇到错误 `relation "ai_config" does not exist`，说明 `ai_config` 表还没有在数据库中创建。

## 解决方案

执行迁移脚本 `src/migrations/20251108_create_ai_config.sql`。

## 执行步骤

### 方式 1：通过 Supabase SQL Editor（推荐）

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择项目
3. 进入 **SQL Editor**
4. 复制以下 SQL 并执行：

```sql
-- ============================================================
-- AI 配置中心迁移脚本
-- 文件名: 20251108_create_ai_config.sql
-- 说明: 创建 ai_config 表用于存储 AI 运营参数
-- 日期: 2025-11-08
-- ============================================================

BEGIN;

-- ============================================================
-- 创建 ai_config 表
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_config (
  id SERIAL PRIMARY KEY,
  key VARCHAR(64) NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  updated_by INTEGER,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_ai_config_key ON ai_config(key);
CREATE INDEX IF NOT EXISTS idx_ai_config_updated_at ON ai_config(updated_at DESC);

-- 如果 admins 表存在，添加外键约束
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admins') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'ai_config_updated_by_fkey'
    ) THEN
      ALTER TABLE ai_config 
      ADD CONSTRAINT ai_config_updated_by_fkey 
      FOREIGN KEY (updated_by) REFERENCES admins(id);
    END IF;
  END IF;
END $$;

-- 插入默认配置值
INSERT INTO ai_config (key, value, description) VALUES
  ('dailyAskLimit', '10', '每用户每日提问限制'),
  ('answerCharLimit', '300', '回答字符限制'),
  ('model', 'gpt-4o-mini', 'AI 模型名称'),
  ('cacheTtl', '86400', '缓存 TTL（秒），默认 24 小时'),
  ('costAlertUsdThreshold', '10.00', '成本警告阈值（USD）')
ON CONFLICT (key) DO NOTHING;

COMMIT;
```

### 方式 2：通过命令行

```bash
psql -h your-host -U your-user -d your-database -f src/migrations/20251108_create_ai_config.sql
```

### 方式 3：通过 Vercel Postgres

1. 在 Vercel 项目设置中找到数据库连接
2. 使用 Vercel CLI 或 Web 界面执行上述 SQL

## 验证

执行迁移后，可以通过以下方式验证：

```sql
-- 检查表是否存在
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'ai_config';

-- 检查默认配置是否已插入
SELECT key, value, description 
FROM ai_config 
ORDER BY key;

-- 应该返回：
-- key                    | value   | description
-- -----------------------+---------+--------------------------
-- answerCharLimit        | 300     | 回答字符限制
-- cacheTtl              | 86400   | 缓存 TTL（秒），默认 24 小时
-- costAlertUsdThreshold | 10.00   | 成本警告阈值（USD）
-- dailyAskLimit         | 10      | 每用户每日提问限制
-- model                 | gpt-4o-mini | AI 模型名称
```

## 注意事项

- 如果表已存在，`CREATE TABLE IF NOT EXISTS` 不会报错
- 如果默认配置已存在，`ON CONFLICT (key) DO NOTHING` 不会重复插入
- 外键约束只在 `admins` 表存在时才会创建
- 索引使用 `CREATE INDEX IF NOT EXISTS`，已存在的索引不会被重复创建

