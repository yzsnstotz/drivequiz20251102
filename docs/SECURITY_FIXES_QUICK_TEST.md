# 安全修复快速测试参考

## 🚀 快速测试命令

### 1. 运行自动化测试脚本

```bash
# 进入项目根目录
cd /Users/leo/Desktop/kkdrivequiz

# 运行测试脚本
npx tsx scripts/test-security-fixes.ts
```

这个脚本会自动测试所有四个功能：
- ✅ match_documents 函数
- ✅ ai_filters_audit_trigger 触发器
- ✅ ai_config 表 RLS
- ✅ ai_filters_history 表 RLS

### 2. 手动测试 API（需要管理员 token）

#### 测试 AI 配置 API

```bash
# 读取配置
curl -X GET "http://localhost:3000/api/admin/ai/config" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# 更新配置
curl -X PUT "http://localhost:3000/api/admin/ai/config" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"dailyAskLimit": 20}'
```

#### 测试过滤器历史 API

```bash
# 查询历史记录（替换 FILTER_ID）
curl -X GET "http://localhost:3000/api/admin/ai/filters/history?filterId=FILTER_ID" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 3. 数据库直接测试（Supabase SQL Editor）

#### 测试 match_documents 函数

```sql
-- 检查函数配置
SELECT proname, prosecdef, proconfig
FROM pg_proc
WHERE proname = 'match_documents';

-- 测试函数调用（如果有数据）
SELECT * FROM match_documents(
  ARRAY(SELECT 0::float FROM generate_series(1, 1536))::vector(1536),
  0.0::float,
  1::int
);
```

#### 测试 ai_filters_audit_trigger 触发器

```sql
-- 检查触发器函数配置
SELECT proname, prosecdef, proconfig
FROM pg_proc
WHERE proname = 'ai_filters_audit_trigger';

-- 检查触发器
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgname = 'ai_filters_audit';

-- 测试触发器（插入测试数据）
INSERT INTO ai_filters (type, pattern, status, changed_by, changed_at)
VALUES ('not-driving', 'test_trigger_' || EXTRACT(EPOCH FROM NOW())::text, 'draft', NULL, NOW())
RETURNING id;

-- 检查历史记录（替换 FILTER_ID）
SELECT * FROM ai_filters_history 
WHERE filter_id = FILTER_ID
ORDER BY changed_at DESC;

-- 清理测试数据
DELETE FROM ai_filters WHERE id = FILTER_ID;
```

#### 验证 RLS 策略

```sql
-- 检查 ai_config RLS
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'ai_config';

SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'ai_config';

-- 检查 ai_filters_history RLS
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'ai_filters_history';

SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'ai_filters_history';

-- 测试数据库访问
SELECT * FROM ai_config LIMIT 5;
SELECT * FROM ai_filters_history LIMIT 5;
```

## 📊 预期测试结果

### match_documents 函数
- ✅ 函数存在
- ✅ `prosecdef` = `true` (SECURITY DEFINER)
- ✅ `proconfig` 包含 `search_path=public`
- ✅ 函数调用成功（如果有数据）

### ai_filters_audit_trigger 触发器
- ✅ 函数存在且配置正确
- ✅ 触发器存在
- ✅ 插入过滤器时自动创建历史记录
- ✅ 历史记录包含正确字段

### ai_config API
- ✅ GET 返回 200 和配置数据
- ✅ PUT 可以更新配置
- ✅ RLS 已启用
- ✅ 策略支持 `postgres` 用户

### ai_filters_history API
- ✅ GET 返回 200 和历史记录
- ✅ RLS 已启用
- ✅ 策略支持 `postgres` 用户

## ⚠️ 注意事项

1. **环境变量**: 确保 `.env.local` 中配置了 `AI_DATABASE_URL`
2. **管理员 Token**: API 测试需要有效的管理员 token
3. **测试数据**: 触发器测试会创建和删除测试数据，不会影响生产数据

## 📚 详细文档

完整测试指南请参考：[SECURITY_FIXES_TEST_GUIDE.md](./SECURITY_FIXES_TEST_GUIDE.md)

