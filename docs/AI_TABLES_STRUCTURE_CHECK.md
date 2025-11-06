# AI 数据库表结构检查清单

## ✅ 已存在的表（根据 Supabase Dashboard）

根据您提供的截图，数据库中已存在以下表：

1. ✅ **ai_config** - 5 行数据，6 列
2. ✅ **ai_daily_summary** - 0 行，9 列
3. ✅ **ai_filters** - 0 行，8 列
4. ✅ **ai_filters_history** - 0 行，8 列
5. ✅ **ai_logs** - 0 行，11 列
6. ✅ **ai_rag_docs** - 0 行，11 列
7. ✅ **ai_vectors** - 0 行，8 列（大小 1640 kB，说明索引已创建）

## 🔍 需要验证的字段

### 1. ai_logs 表
**必需字段**：
- ✅ `id` (BIGSERIAL)
- ✅ `user_id` (UUID)
- ✅ `question` (TEXT)
- ✅ `answer` (TEXT)
- ✅ `locale` (VARCHAR(8))
- ✅ `model` (VARCHAR(32))
- ✅ `rag_hits` (INTEGER)
- ✅ `cost_est` (NUMERIC(10,4))
- ✅ `safety_flag` (VARCHAR(16))
- ✅ `created_at` (TIMESTAMPTZ)
- ⚠️ **`sources` (JSONB)** - 需要验证是否存在

**迁移脚本**：`20251105_add_sources_to_ai_logs.sql`

### 2. ai_filters 表
**必需字段**：
- ✅ `id` (BIGSERIAL)
- ✅ `type` (VARCHAR(32))
- ✅ `pattern` (TEXT)
- ✅ `created_at` (TIMESTAMPTZ)
- ⚠️ **`status` (VARCHAR(16))** - 需要验证是否存在
- ⚠️ **`changed_by` (INTEGER)** - 需要验证是否存在
- ⚠️ **`changed_at` (TIMESTAMPTZ)** - 需要验证是否存在

**迁移脚本**：`20251107_add_filters_versioning_and_audit.sql`

### 3. ai_rag_docs 表
**必需字段**（根据代码期望）：
- ✅ `id` (BIGSERIAL)
- ✅ `title` (TEXT)
- ✅ `url` (TEXT)
- ✅ `version` (VARCHAR(32))
- ✅ `chunks` (INTEGER)
- ✅ `uploaded_by` (UUID)
- ✅ `created_at` (TIMESTAMPTZ)
- ⚠️ **`lang` (VARCHAR(8))** - 需要验证是否存在
- ⚠️ **`tags` (TEXT[])** - 需要验证是否存在
- ⚠️ **`status` (VARCHAR(32))** - 需要验证是否存在
- ⚠️ **`updated_at` (TIMESTAMPTZ)** - 需要验证是否存在

**迁移脚本**：`20251103_ai_core.sql` 或 `20250115_create_ai_tables.sql`

### 4. ai_vectors 表
**必需字段**：
- ✅ `id` (BIGSERIAL)
- ✅ `doc_id` (VARCHAR(64))
- ✅ `content` (TEXT)
- ⚠️ **`embedding` (vector(1536))** - 需要验证类型是否正确
- ✅ `source_title` (TEXT)
- ✅ `source_url` (TEXT)
- ✅ `version` (VARCHAR(32))
- ✅ `updated_at` (TIMESTAMPTZ)

**注意事项**：
- 需要启用 `pgvector` 扩展
- `embedding` 字段应该是 `vector(1536)` 类型
- 应该有 `ivfflat` 索引

### 5. ai_config 表
**必需字段**：
- ✅ `id` (SERIAL)
- ✅ `key` (VARCHAR(64))
- ✅ `value` (TEXT)
- ✅ `description` (TEXT)
- ✅ `updated_by` (INTEGER)
- ✅ `updated_at` (TIMESTAMPTZ)

**默认数据**：应该有 5 条记录（dailyAskLimit, answerCharLimit, model, cacheTtl, costAlertUsdThreshold）

## 📋 验证步骤

### 步骤 1：在 Supabase SQL Editor 中执行检查脚本

执行 `scripts/verify-ai-tables-structure.sql` 脚本，检查：
1. 所有表是否存在
2. 每个表的字段列表
3. `pgvector` 扩展是否已启用
4. `ai_vectors.embedding` 字段类型是否正确

### 步骤 2：检查缺失的字段

根据检查结果，如果发现缺失字段，执行相应的迁移脚本：

#### 如果 `ai_logs.sources` 缺失：
```sql
-- 执行: src/migrations/20251105_add_sources_to_ai_logs.sql
ALTER TABLE ai_logs ADD COLUMN IF NOT EXISTS sources JSONB DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS idx_ai_logs_sources ON ai_logs USING gin (sources);
```

#### 如果 `ai_filters.status` 或相关字段缺失：
```sql
-- 执行: src/migrations/20251107_add_filters_versioning_and_audit.sql
ALTER TABLE ai_filters 
ADD COLUMN IF NOT EXISTS status VARCHAR(16) DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS changed_by INTEGER,
ADD COLUMN IF NOT EXISTS changed_at TIMESTAMPTZ DEFAULT now();
```

#### 如果 `ai_rag_docs` 缺少字段：
```sql
-- 检查并添加缺失字段
ALTER TABLE ai_rag_docs 
ADD COLUMN IF NOT EXISTS lang VARCHAR(8),
ADD COLUMN IF NOT EXISTS tags TEXT[],
ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'ready',
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
```

## ⚠️ 潜在问题

### 1. ai_vectors 表大小异常
- **现象**：0 行但 1640 kB 大小
- **原因**：可能是索引占用空间（`ivfflat` 索引）
- **验证**：检查索引是否正确创建

### 2. 所有表都是 0 行（除了 ai_config）
- **正常**：如果还没有实际使用，0 行是正常的
- **注意**：`ai_config` 有 5 行说明迁移脚本已执行

### 3. 字段数量与期望不一致
- **ai_logs**: 应该是 11 列（包含 `sources`）
- **ai_filters**: 应该是 8 列（包含 `status`, `changed_by`, `changed_at`）
- **ai_rag_docs**: 应该是 11 列（包含 `lang`, `tags`, `status`, `updated_at`）

## 📝 建议

1. **执行检查脚本**：在 Supabase SQL Editor 中运行 `scripts/verify-ai-tables-structure.sql`
2. **对比字段列表**：确认每个表的字段是否完整
3. **执行缺失的迁移**：如果发现缺失字段，执行相应的迁移脚本
4. **验证索引**：确认所有必要的索引都已创建

