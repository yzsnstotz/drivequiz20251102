# 查看 Datapull 上传分片指南

本文档介绍如何查看 Datapull 上传的文档分片内容。

---

## 方法一：使用 API 查询（推荐）

### 1. 查询操作记录列表

查看所有上传操作：

```bash
curl -X GET "http://localhost:8789/api/v1/rag/operations" \
  -H "Authorization: Bearer <TOKEN>"
```

**按来源ID过滤**：
```bash
curl -X GET "http://localhost:8789/api/v1/rag/operations?sourceId=your_source_id" \
  -H "Authorization: Bearer <TOKEN>"
```

**按状态过滤**：
```bash
curl -X GET "http://localhost:8789/api/v1/rag/operations?status=success" \
  -H "Authorization: Bearer <TOKEN>"
```

**分页查询**：
```bash
curl -X GET "http://localhost:8789/api/v1/rag/operations?page=1&limit=20" \
  -H "Authorization: Bearer <TOKEN>"
```

### 2. 查询操作详情（包含文档列表）

```bash
curl -X GET "http://localhost:8789/api/v1/rag/operations/<operationId>" \
  -H "Authorization: Bearer <TOKEN>"
```

**响应示例**：
```json
{
  "success": true,
  "data": {
    "operationId": "op_abc123",
    "sourceId": "source_001",
    "status": "success",
    "docsCount": 15,
    "failedCount": 0,
    "createdAt": "2025-01-XXTXX:XX:XX.XXXZ",
    "completedAt": "2025-01-XXTXX:XX:XX.XXXZ",
    "metadata": {
      "version": "2025Q1",
      "lang": "ja"
    },
    "documents": [
      {
        "docId": "doc_1",
        "url": "https://example.com/doc1",
        "title": "文档标题1",
        "status": "success"
      },
      {
        "docId": "doc_2",
        "url": "https://example.com/doc2",
        "title": "文档标题2",
        "status": "success"
      }
    ]
  }
}
```

---

## 方法二：使用查询脚本

### 1. 查看所有文档

```bash
cd apps/drivequiz-api
tsx scripts/query-documents.ts
```

### 2. 按来源ID过滤

```bash
tsx scripts/query-documents.ts --sourceId=your_source_id
```

### 3. 查看特定操作

```bash
tsx scripts/query-documents.ts --operationId=op_abc123
```

### 4. 显示文档内容

```bash
tsx scripts/query-documents.ts --show-content
```

### 5. 限制数量

```bash
tsx scripts/query-documents.ts --limit=10
```

---

## 方法三：直接查询数据库

### 1. 连接数据库

```bash
# 使用 psql 连接
psql "postgresql://postgres:zKV0rtIV1QOByu89@db.cgpmpfnjzlzbakmmrj.supabase.co:5432/postgres?sslmode=require"
```

### 2. 查询文档列表

```sql
-- 查看所有文档
SELECT 
  doc_id,
  title,
  url,
  version,
  lang,
  source_id,
  vectorization_status,
  created_at
FROM rag_documents
ORDER BY created_at DESC
LIMIT 20;
```

### 3. 查询操作记录

```sql
-- 查看所有操作
SELECT 
  operation_id,
  source_id,
  status,
  docs_count,
  failed_count,
  created_at,
  completed_at
FROM rag_operations
ORDER BY created_at DESC
LIMIT 10;
```

### 4. 查询操作关联的文档

```sql
-- 查看特定操作的所有文档
SELECT 
  d.doc_id,
  d.title,
  d.url,
  d.version,
  d.lang,
  od.status as upload_status,
  od.error_code,
  od.error_message
FROM rag_operation_documents od
LEFT JOIN rag_documents d ON od.doc_id = d.doc_id
WHERE od.operation_id = 'op_abc123'
ORDER BY od.created_at;
```

### 5. 按来源ID查询

```sql
-- 查看特定来源的所有文档
SELECT 
  doc_id,
  title,
  url,
  version,
  lang,
  vectorization_status,
  created_at
FROM rag_documents
WHERE source_id = 'your_source_id'
ORDER BY created_at DESC;
```

### 6. 查看文档内容

```sql
-- 查看文档内容（前200字符）
SELECT 
  doc_id,
  title,
  url,
  LEFT(content, 200) as content_preview,
  LENGTH(content) as content_length,
  content_hash,
  created_at
FROM rag_documents
WHERE source_id = 'your_source_id'
ORDER BY created_at DESC
LIMIT 10;
```

### 7. 统计信息

```sql
-- 统计文档数量
SELECT 
  source_id,
  COUNT(*) as total_docs,
  COUNT(CASE WHEN vectorization_status = 'completed' THEN 1 END) as vectorized,
  COUNT(CASE WHEN vectorization_status = 'pending' THEN 1 END) as pending,
  COUNT(CASE WHEN vectorization_status = 'failed' THEN 1 END) as failed
FROM rag_documents
GROUP BY source_id
ORDER BY total_docs DESC;
```

---

## 方法四：使用 Node.js 脚本

创建一个简单的查询脚本：

```javascript
// query-simple.js
require('dotenv').config();
const { getDb } = require('./src/lib/db.js');

async function query() {
  const db = getDb();
  
  const docs = await db
    .selectFrom('rag_documents')
    .selectAll()
    .orderBy('created_at', 'desc')
    .limit(10)
    .execute();
  
  console.log('文档列表:');
  docs.forEach(doc => {
    console.log(`- ${doc.title} (${doc.doc_id})`);
  });
}

query().catch(console.error);
```

运行：
```bash
node query-simple.js
```

---

## 快速查询命令

### 获取 Token

首先从 `.env` 文件中获取 Token：

```bash
cd apps/drivequiz-api
grep DRIVEQUIZ_API_TOKEN_SECRET .env
```

### 查询最新操作

```bash
TOKEN=$(grep DRIVEQUIZ_API_TOKEN_SECRET .env | cut -d'=' -f2)
curl -X GET "http://localhost:8789/api/v1/rag/operations?limit=5" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### 查询操作详情

```bash
TOKEN=$(grep DRIVEQUIZ_API_TOKEN_SECRET .env | cut -d'=' -f2)
OPERATION_ID="op_abc123"  # 替换为实际的操作ID
curl -X GET "http://localhost:8789/api/v1/rag/operations/$OPERATION_ID" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

## 常见查询场景

### 1. 查看今天上传的文档

```sql
SELECT * FROM rag_documents
WHERE created_at >= CURRENT_DATE
ORDER BY created_at DESC;
```

### 2. 查看失败的文档

```sql
SELECT 
  d.*,
  od.error_code,
  od.error_message
FROM rag_documents d
JOIN rag_operation_documents od ON d.doc_id = od.doc_id
WHERE od.status = 'failed'
ORDER BY od.created_at DESC;
```

### 3. 查看未向量化的文档

```sql
SELECT * FROM rag_documents
WHERE vectorization_status IN ('pending', 'processing')
ORDER BY created_at DESC;
```

### 4. 查看重复的文档

```sql
SELECT 
  url,
  content_hash,
  version,
  COUNT(*) as count
FROM rag_documents
GROUP BY url, content_hash, version
HAVING COUNT(*) > 1;
```

---

## 提示

1. **API 查询**：适合快速查看，需要 Bearer Token
2. **脚本查询**：适合批量查看和格式化输出
3. **数据库查询**：适合复杂查询和数据分析
4. **使用 jq**：格式化 JSON 输出，`curl ... | jq .`

---

**最后更新**：2025-01-XX

