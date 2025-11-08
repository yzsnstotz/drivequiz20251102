# 安全修复业务功能测试指南

## 📋 概述

本文档提供测试安全修复后四个业务功能的详细步骤。

## 🧪 测试内容

1. **match_documents 函数**（RAG 检索）
2. **ai_filters_audit_trigger 触发器**（过滤器历史记录）
3. **ai_config API**（AI 配置）
4. **ai_filters_history API**（过滤器历史）

---

## 测试 1: match_documents 函数（RAG 检索）

### 测试方法 1: 数据库直接测试

在 Supabase SQL Editor 中执行：

```sql
-- 检查函数是否存在且配置正确
SELECT 
  proname AS function_name,
  prosecdef AS is_security_definer,
  proconfig AS config
FROM pg_proc
WHERE proname = 'match_documents';

-- 如果 ai_vectors 表有数据，测试函数调用
-- 创建一个测试向量（1536维的零向量）
SELECT * FROM match_documents(
  ARRAY(SELECT 0::float FROM generate_series(1, 1536))::vector(1536),
  0.0::float,
  1::int
);
```

**预期结果**:
- ✅ 函数存在
- ✅ `is_security_definer` = `true`
- ✅ `config` 包含 `search_path=public`
- ✅ 函数调用成功（如果有数据）或返回空结果（如果表为空）

### 测试方法 2: 使用测试脚本

```bash
npx tsx scripts/test-security-fixes.ts
```

---

## 测试 2: ai_filters_audit_trigger 触发器

### 测试步骤

1. **检查触发器函数配置**（在 Supabase SQL Editor 中）：

```sql
-- 检查函数配置
SELECT 
  proname AS function_name,
  prosecdef AS is_security_definer,
  proconfig AS config
FROM pg_proc
WHERE proname = 'ai_filters_audit_trigger';

-- 检查触发器是否存在
SELECT 
  tgname AS trigger_name,
  tgenabled AS enabled
FROM pg_trigger
WHERE tgname = 'ai_filters_audit';
```

2. **测试触发器执行**：

```sql
-- 记录当前历史记录数量
SELECT COUNT(*) as before_count FROM ai_filters_history;

-- 插入测试过滤器（触发触发器）
INSERT INTO ai_filters (type, pattern, status, changed_by, changed_at)
VALUES ('not-driving', 'test_trigger_' || EXTRACT(EPOCH FROM NOW())::text, 'draft', NULL, NOW())
RETURNING id;

-- 记录插入后的 filter_id（假设为 123）
-- 等待一小段时间后检查历史记录
SELECT COUNT(*) as after_count 
FROM ai_filters_history 
WHERE filter_id = 123;  -- 替换为实际的 filter_id

-- 检查历史记录内容
SELECT * FROM ai_filters_history 
WHERE filter_id = 123  -- 替换为实际的 filter_id
ORDER BY changed_at DESC
LIMIT 1;

-- 清理测试数据
DELETE FROM ai_filters WHERE id = 123;  -- 替换为实际的 filter_id
```

**预期结果**:
- ✅ 函数存在且配置正确（`SECURITY DEFINER` 和固定 `search_path`）
- ✅ 触发器存在
- ✅ 插入过滤器后，历史记录数量增加
- ✅ 历史记录包含正确的字段（`action='create'`）

### 测试方法 2: 使用测试脚本

```bash
npx tsx scripts/test-security-fixes.ts
```

---

## 测试 3: ai_config API

### 前提条件

- 需要有效的管理员 token
- 应用正在运行（本地或生产环境）

### 测试步骤

#### 3.1 测试 GET 端点（读取配置）

```bash
# 本地测试
curl -X GET "http://localhost:3000/api/admin/ai/config" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"

# 生产环境测试
curl -X GET "https://your-domain.vercel.app/api/admin/ai/config" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

**预期响应**:
```json
{
  "ok": true,
  "dailyAskLimit": "10",
  "answerCharLimit": "300",
  "model": "gpt-4o-mini",
  "cacheTtl": "86400",
  "costAlertUsdThreshold": "10.00"
}
```

#### 3.2 测试 PUT 端点（更新配置）

```bash
# 本地测试
curl -X PUT "http://localhost:3000/api/admin/ai/config" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dailyAskLimit": 20,
    "answerCharLimit": 400
  }'

# 生产环境测试
curl -X PUT "https://your-domain.vercel.app/api/admin/ai/config" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dailyAskLimit": 20,
    "answerCharLimit": 400
  }'
```

**预期响应**:
```json
{
  "ok": true,
  "dailyAskLimit": "20",
  "answerCharLimit": "400",
  "model": "gpt-4o-mini",
  "cacheTtl": "86400",
  "costAlertUsdThreshold": "10.00"
}
```

#### 3.3 验证数据库中的配置

在 Supabase SQL Editor 中执行：

```sql
-- 检查配置是否更新
SELECT * FROM ai_config 
WHERE key IN ('dailyAskLimit', 'answerCharLimit')
ORDER BY key;
```

**预期结果**:
- ✅ GET 端点返回 200 状态码和配置数据
- ✅ PUT 端点返回 200 状态码和更新后的配置
- ✅ 数据库中的配置值已更新
- ✅ RLS 策略允许 `postgres` 用户访问

---

## 测试 4: ai_filters_history API

### 前提条件

- 需要有效的管理员 token
- 应用正在运行（本地或生产环境）
- `ai_filters` 表中有至少一条记录（用于测试历史记录）

### 测试步骤

#### 4.1 准备测试数据（如果需要）

在 Supabase SQL Editor 中执行：

```sql
-- 检查是否有过滤器记录
SELECT id, type, pattern FROM ai_filters LIMIT 5;

-- 如果没有记录，创建一个测试过滤器
INSERT INTO ai_filters (type, pattern, status, changed_by, changed_at)
VALUES ('sensitive', 'test_history_pattern', 'active', NULL, NOW())
RETURNING id;
```

#### 4.2 测试 GET 端点（读取历史记录）

```bash
# 本地测试（替换 FILTER_ID 为实际的 filter_id）
curl -X GET "http://localhost:3000/api/admin/ai/filters/history?filterId=FILTER_ID" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"

# 生产环境测试
curl -X GET "https://your-domain.vercel.app/api/admin/ai/filters/history?filterId=FILTER_ID" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

**预期响应**:
```json
{
  "ok": true,
  "items": [
    {
      "id": "1",
      "filterId": 123,
      "type": "sensitive",
      "pattern": "test_history_pattern",
      "status": "active",
      "changedBy": null,
      "changedAt": "2025-11-11T12:00:00.000Z",
      "action": "create"
    }
  ]
}
```

#### 4.3 测试更新过滤器（触发历史记录）

```bash
# 更新过滤器状态（这应该触发触发器创建新的历史记录）
curl -X PUT "http://localhost:3000/api/admin/ai/filters/FILTER_ID/status" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "inactive"
  }'
```

然后再次查询历史记录：

```bash
curl -X GET "http://localhost:3000/api/admin/ai/filters/history?filterId=FILTER_ID" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**预期结果**:
- ✅ GET 端点返回 200 状态码和历史记录列表
- ✅ 历史记录包含正确的字段（`action`, `type`, `pattern`, `status` 等）
- ✅ 更新过滤器后，历史记录数量增加
- ✅ 新的历史记录包含正确的 `action` 值（`create`, `update`, `status_change`）

#### 4.4 验证数据库中的历史记录

在 Supabase SQL Editor 中执行：

```sql
-- 检查历史记录
SELECT * FROM ai_filters_history 
WHERE filter_id = 123  -- 替换为实际的 filter_id
ORDER BY changed_at DESC;
```

**预期结果**:
- ✅ API 返回正确的历史记录
- ✅ 数据库中的历史记录与 API 返回一致
- ✅ RLS 策略允许 `postgres` 用户访问

---

## 🚀 快速测试脚本

### 使用自动化测试脚本

```bash
# 运行完整测试套件
npx tsx scripts/test-security-fixes.ts
```

这个脚本会自动测试：
1. ✅ match_documents 函数配置
2. ✅ ai_filters_audit_trigger 函数配置和触发器执行
3. ✅ ai_config 表 RLS 策略和数据库访问
4. ✅ ai_filters_history 表 RLS 策略和数据库访问

### 测试结果解读

脚本会输出：
- ✅ 绿色勾号：测试通过
- ❌ 红色叉号：测试失败
- 📊 测试总结：显示通过/失败统计

---

## 📝 测试检查清单

### 测试 1: match_documents
- [ ] 函数存在
- [ ] `SECURITY DEFINER` 已设置
- [ ] `search_path=public` 已固定
- [ ] 函数可以正常调用（如果有数据）

### 测试 2: ai_filters_audit_trigger
- [ ] 函数存在
- [ ] `SECURITY DEFINER` 已设置
- [ ] `search_path=public` 已固定
- [ ] 触发器存在
- [ ] 插入过滤器时自动创建历史记录
- [ ] 历史记录包含正确字段

### 测试 3: ai_config API
- [ ] GET 端点返回 200 和配置数据
- [ ] PUT 端点可以更新配置
- [ ] RLS 策略已启用
- [ ] 策略支持 `postgres` 用户
- [ ] 数据库直接访问正常

### 测试 4: ai_filters_history API
- [ ] GET 端点返回 200 和历史记录
- [ ] 更新过滤器时自动创建历史记录
- [ ] RLS 策略已启用
- [ ] 策略支持 `postgres` 用户
- [ ] 数据库直接访问正常

---

## ⚠️ 常见问题

### 问题 1: match_documents 函数调用失败

**可能原因**:
- `ai_vectors` 表为空
- 向量维度不匹配（应该是 1536 维）

**解决方案**:
- 这是正常的，如果表为空，函数应该返回空结果
- 如果需要测试，先在 `ai_vectors` 表中插入测试数据

### 问题 2: ai_filters_audit_trigger 不工作

**可能原因**:
- 触发器未正确创建
- 函数权限问题

**解决方案**:
- 检查触发器是否存在：`SELECT * FROM pg_trigger WHERE tgname = 'ai_filters_audit'`
- 重新执行 `20251111_fix_function_search_path.sql` 脚本

### 问题 3: API 返回 401 或 403

**可能原因**:
- 管理员 token 无效或过期
- RLS 策略阻止访问

**解决方案**:
- 检查 token 是否有效
- 验证 RLS 策略是否正确配置
- 确认策略支持 `postgres` 用户

### 问题 4: 数据库直接访问失败

**可能原因**:
- RLS 策略未正确配置
- 策略不支持 `postgres` 用户

**解决方案**:
- 重新执行 `20251111_add_ai_config_rls.sql` 脚本
- 验证策略包含 `OR current_user = 'postgres'` 条件

---

## ✅ 测试通过标准

所有测试通过的标准：

1. ✅ **match_documents 函数**：
   - 函数存在且配置正确
   - 可以正常调用（如果有数据）

2. ✅ **ai_filters_audit_trigger 触发器**：
   - 函数和触发器存在且配置正确
   - 插入/更新过滤器时自动创建历史记录

3. ✅ **ai_config API**：
   - GET 和 PUT 端点正常工作
   - RLS 策略已启用且支持 `postgres` 用户

4. ✅ **ai_filters_history API**：
   - GET 端点正常工作
   - 触发器自动创建历史记录
   - RLS 策略已启用且支持 `postgres` 用户

---

## 📚 相关文档

- [AI 数据库安全修复文档](./AI_DATABASE_SECURITY_FIXES.md)
- [数据库分离报告](../DATABASE_SEPARATION_REPORT.md)
- [AI 测试指南](./AI_TESTING_GUIDE.md)

