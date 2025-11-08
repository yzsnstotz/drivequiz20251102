# AI 数据库安全警告处理建议

## 📋 概述

根据 Supabase 数据库安全检查报告，发现 5 个安全问题需要处理。

## 🔍 问题分析

### 1. ⚠️ **ai_config 表缺少 RLS**（中优先级）

**问题**: `public.ai_config` 表是公开的，但未启用行级安全（RLS）

**影响评估**:
- ✅ **应用层保护**: 已通过 `withAdminAuth` 中间件保护 API 访问
- ❌ **数据库层保护**: 缺少 RLS，如果直接数据库连接可能绕过应用层认证
- 📊 **数据敏感度**: 中等（AI 配置参数，包括模型、限制等）

**建议**: ✅ **应该修复** - 添加 RLS 策略，仅允许 service_role 和管理员访问

---

### 2. ⚠️ **ai_filters_history 表缺少 RLS**（中优先级）

**问题**: `public.ai_filters_history` 表是公开的，但未启用行级安全（RLS）

**影响评估**:
- ✅ **应用层保护**: 已通过 `withAdminAuth` 中间件保护 API 访问
- ❌ **数据库层保护**: 缺少 RLS，如果直接数据库连接可能绕过应用层认证
- 📊 **数据敏感度**: 中等（审计历史记录）

**建议**: ✅ **应该修复** - 添加 RLS 策略，仅允许 service_role 和管理员访问

---

### 3. 🔴 **match_documents 函数 search_path 问题**（高优先级）

**问题**: `public.match_documents` 函数具有可变的角色搜索路径（mutable search_path）

**影响评估**:
- ❌ **安全风险**: 可能导致 SQL 注入攻击（search_path 劫持）
- 📊 **使用频率**: 高（RAG 检索核心函数）
- 🔗 **依赖**: 被 `apps/ai-service/src/lib/rag.ts` 调用

**建议**: ✅ **必须修复** - 设置 `SECURITY DEFINER` 和固定的 `search_path`

---

### 4. 🔴 **ai_filters_audit_trigger 函数 search_path 问题**（高优先级）

**问题**: `public.ai_filters_audit_trigger` 函数具有可变的角色搜索路径

**影响评估**:
- ❌ **安全风险**: 可能导致 SQL 注入攻击
- 📊 **使用频率**: 中（触发器函数，每次 ai_filters 表变更时触发）
- 🔗 **依赖**: 被 `ai_filters` 表的触发器调用

**建议**: ✅ **必须修复** - 设置固定的 `search_path`

---

### 5. ⚪ **vector 扩展在 public schema**（低优先级）

**问题**: `vector` 扩展安装在公共模式中，建议移动到另一个模式

**影响评估**:
- ⚠️ **安全风险**: 低（主要是命名空间污染）
- 📊 **影响范围**: 小（扩展本身，不影响数据安全）
- 🔧 **修复难度**: 中等（需要迁移扩展）

**建议**: ⚪ **可选修复** - 可以保留在 public schema，不影响核心安全

---

## ✅ 修复建议总结

| 问题 | 优先级 | 建议 | 修复难度 |
|------|--------|------|----------|
| ai_config RLS | 中 | ✅ 修复 | 低 |
| ai_filters_history RLS | 中 | ✅ 修复 | 低 |
| match_documents search_path | 高 | ✅ **必须修复** | 中 |
| ai_filters_audit_trigger search_path | 高 | ✅ **必须修复** | 中 |
| vector 扩展位置 | 低 | ⚪ 可选 | 中 |

---

## 🔧 修复方案

### 方案 1: 修复 RLS 策略（推荐）

为 `ai_config` 和 `ai_filters_history` 表添加 RLS 策略，与现有表保持一致。

**迁移脚本**: `src/migrations/20251111_add_ai_config_rls.sql`

```sql
-- ============================================================
-- 为 ai_config 和 ai_filters_history 表添加 RLS 策略
-- ============================================================

-- ai_config 表
ALTER TABLE ai_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS ai_config_service_write ON ai_config
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS ai_config_admin_read ON ai_config
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid()
      AND admins.role = 'admin'
    )
  );

-- ai_filters_history 表
ALTER TABLE ai_filters_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS ai_filters_history_service_write ON ai_filters_history
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS ai_filters_history_admin_read ON ai_filters_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid()
      AND admins.role = 'admin'
    )
  );
```

### 方案 2: 修复函数 search_path（必须）

修复两个函数的 `search_path` 安全问题。

**迁移脚本**: `src/migrations/20251111_fix_function_search_path.sql`

```sql
-- ============================================================
-- 修复函数 search_path 安全问题
-- ============================================================

-- 修复 match_documents 函数
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.75,
  match_count int DEFAULT 3
)
RETURNS TABLE (
  id bigint,
  doc_id varchar,
  content text,
  source_title text,
  source_url text,
  version varchar,
  similarity float
)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, doc_id, content, source_title, source_url, version,
         1 - (embedding <=> query_embedding) AS similarity
  FROM ai_vectors
  WHERE 1 - (embedding <=> query_embedding) >= match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

-- 修复 ai_filters_audit_trigger 函数
CREATE OR REPLACE FUNCTION ai_filters_audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO ai_filters_history (
    filter_id,
    type,
    pattern,
    status,
    changed_by,
    changed_at,
    action
  ) VALUES (
    NEW.id,
    NEW.type,
    NEW.pattern,
    NEW.status,
    NEW.changed_by,
    NEW.changed_at,
    CASE 
      WHEN TG_OP = 'INSERT' THEN 'create'
      WHEN OLD.status != NEW.status THEN 'status_change'
      ELSE 'update'
    END
  );
  RETURN NEW;
END;
$$;
```

---

## 📝 实施步骤

### 步骤 1: 迁移脚本已创建 ✅

1. ✅ `src/migrations/20251111_fix_function_search_path.sql` - 修复函数 search_path 问题
2. ✅ `src/migrations/20251111_add_ai_config_rls.sql` - 添加 RLS 策略

### 步骤 2: 在 Supabase SQL Editor 中执行

1. 登录 Supabase Dashboard
2. 进入项目 → **SQL Editor**
3. **先执行** `20251111_fix_function_search_path.sql`（修复函数安全问题）
4. **再执行** `20251111_add_ai_config_rls.sql`（添加 RLS 策略）
5. 验证策略和函数已正确创建

### 步骤 3: 验证修复

#### 验证函数 search_path 修复

```sql
-- 检查函数是否设置了 search_path 和 SECURITY DEFINER
SELECT 
  proname AS function_name,
  prosecdef AS is_security_definer,
  proconfig AS config
FROM pg_proc
WHERE proname IN ('match_documents', 'ai_filters_audit_trigger');
```

**期望结果**:
- `is_security_definer` 应该为 `true`
- `config` 应该包含 `search_path=public`

#### 验证 RLS 策略启用

```sql
-- 检查 RLS 是否启用
SELECT 
  tablename, 
  rowsecurity AS rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('ai_config', 'ai_filters_history');
```

**期望结果**:
- `rls_enabled` 应该为 `true`

#### 验证策略已创建

```sql
-- 检查策略是否已创建
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd AS command
FROM pg_policies
WHERE tablename IN ('ai_config', 'ai_filters_history')
ORDER BY tablename, policyname;
```

**期望结果**:
- `ai_config` 表应该有 3 个策略：`ai_config_service_write`, `ai_config_admin_read`, `ai_config_anon_deny`
- `ai_filters_history` 表应该有 3 个策略：`ai_filters_history_service_write`, `ai_filters_history_admin_read`, `ai_filters_history_anon_deny`

---

## ⚠️ 注意事项

1. **RLS 策略**: 确保策略与现有表（如 `ai_logs`）保持一致
2. **函数权限**: `SECURITY DEFINER` 函数以创建者权限运行，需要谨慎处理
3. **测试验证**: 修复后需要测试 API 功能是否正常
4. **回滚方案**: 准备回滚脚本，以防修复后出现问题

---

## 🎯 优先级建议

### 立即修复（高优先级）
- ✅ 修复 `match_documents` 函数的 `search_path`
- ✅ 修复 `ai_filters_audit_trigger` 函数的 `search_path`

### 近期修复（中优先级）
- ✅ 为 `ai_config` 表添加 RLS
- ✅ 为 `ai_filters_history` 表添加 RLS

### 可选修复（低优先级）
- ⚪ 迁移 `vector` 扩展到专用 schema（可选）

---

## 📚 参考资料

- [PostgreSQL RLS 文档](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [PostgreSQL search_path 安全](https://www.postgresql.org/docs/current/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY)
- [Supabase RLS 最佳实践](https://supabase.com/docs/guides/auth/row-level-security)

