# RAG Docs API 故障排查指南

## 问题：GET /api/admin/ai/rag/docs 返回 500 错误

### 可能原因

#### 1. 数据库表不存在

**症状：**
- 错误信息包含 "relation \"ai_rag_docs\" does not exist"
- 或 "table \"ai_rag_docs\" does not exist"

**解决方法：**
1. 检查数据库是否已执行迁移脚本
2. 执行数据库迁移：
   ```sql
   -- 检查表是否存在
   SELECT EXISTS (
     SELECT FROM information_schema.tables 
     WHERE table_schema = 'public' 
     AND table_name = 'ai_rag_docs'
   );
   ```

3. 如果表不存在，执行迁移脚本：
   ```bash
   # 查看迁移脚本
   cat src/migrations/20250115_create_ai_tables.sql
   
   # 或执行迁移
   psql -d your_database -f src/migrations/20250115_create_ai_tables.sql
   ```

#### 2. 数据库连接问题

**症状：**
- 错误信息包含 "connection"、"timeout"、"ECONNREFUSED"
- 或 "could not connect to server"

**解决方法：**
1. 检查环境变量 `DATABASE_URL` 是否正确
2. 检查数据库服务是否运行
3. 检查网络连接和防火墙设置

#### 3. 查询结果格式问题

**症状：**
- 错误信息包含 "Cannot read property 'count' of undefined"
- 或 "count is not defined"

**解决方法：**
- ✅ 已修复：代码已更新为安全地处理 count 查询结果
- 如果仍有问题，检查数据库返回的数据格式

#### 4. 权限问题

**症状：**
- 错误信息包含 "permission denied"
- 或 "insufficient privileges"

**解决方法：**
1. 检查数据库用户是否有查询 `ai_rag_docs` 表的权限
2. 授予必要权限：
   ```sql
   GRANT SELECT, INSERT, UPDATE, DELETE ON ai_rag_docs TO your_user;
   ```

#### 5. 排序字段问题

**症状：**
- 错误信息包含 "column \"updated_at\" does not exist"
- 或 "invalid column name"

**解决方法：**
1. 检查表结构是否包含所有必需的列
2. 验证排序字段映射是否正确

---

## 调试步骤

### 步骤 1：查看服务器日志

检查服务器控制台或日志文件，查找详细的错误信息：

```bash
# Vercel 日志
vercel logs

# 或查看本地开发服务器控制台
npm run dev
```

### 步骤 2：检查数据库表结构

```sql
-- 检查表是否存在
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'ai_rag_docs';

-- 检查表结构
\d ai_rag_docs

-- 或使用 SQL
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'ai_rag_docs';
```

### 步骤 3：测试数据库连接

```sql
-- 测试简单查询
SELECT COUNT(*) FROM ai_rag_docs;

-- 测试完整查询（模拟 API 查询）
SELECT 
  id,
  title,
  url,
  lang,
  tags,
  status,
  version,
  chunks,
  created_at,
  updated_at
FROM ai_rag_docs
ORDER BY created_at DESC
LIMIT 20;
```

### 步骤 4：检查环境变量

确保以下环境变量已正确设置：

```bash
# 数据库连接
DATABASE_URL=postgresql://user:password@host:5432/database

# 其他必需的环境变量
# ...
```

### 步骤 5：验证 API 端点

使用 curl 或 Postman 测试 API：

```bash
# 测试 GET 请求
curl -X GET "https://ai.zalem.app/api/admin/ai/rag/docs?page=1&limit=20&sortBy=updatedAt&sortOrder=desc" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 检查响应状态码和错误信息
```

---

## 常见错误信息及解决方法

### 错误 1: "relation \"ai_rag_docs\" does not exist"

**原因：** 数据库表不存在

**解决：** 执行数据库迁移脚本创建表

### 错误 2: "Cannot read property 'count' of undefined"

**原因：** count 查询返回空结果

**解决：** ✅ 已修复，代码已更新为安全处理空结果

### 错误 3: "column \"updated_at\" does not exist"

**原因：** 表结构不完整，缺少 `updated_at` 列

**解决：** 检查并更新表结构，确保包含所有必需的列

### 错误 4: "permission denied for table ai_rag_docs"

**原因：** 数据库用户没有访问表的权限

**解决：** 授予必要的数据库权限

### 错误 5: "connection timeout" 或 "ECONNREFUSED"

**原因：** 数据库连接失败

**解决：** 
1. 检查数据库服务是否运行
2. 检查 `DATABASE_URL` 环境变量
3. 检查网络连接和防火墙

---

## 验证修复

修复后，验证 API 是否正常工作：

```bash
# 1. 测试 GET 请求
curl -X GET "https://ai.zalem.app/api/admin/ai/rag/docs?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 2. 检查响应
# 应该返回 200 状态码和 JSON 数据：
# {
#   "ok": true,
#   "data": {
#     "items": [...],
#     "pagination": {...}
#   }
# }
```

---

## 联系支持

如果问题仍然存在，请提供以下信息：

1. **错误信息**：完整的错误堆栈
2. **请求详情**：URL、参数、请求头
3. **环境信息**：部署环境（Vercel/本地）、Node.js 版本
4. **数据库信息**：数据库类型、版本、表结构
5. **日志**：服务器日志中的相关错误信息

---

## 相关文档

- [数据库迁移脚本](../../src/migrations/20250115_create_ai_tables.sql)
- [API 路由实现](../../apps/web/app/api/admin/ai/rag/docs/route.ts)
- [环境变量配置](../../apps/web/ENV_SETUP.md)

