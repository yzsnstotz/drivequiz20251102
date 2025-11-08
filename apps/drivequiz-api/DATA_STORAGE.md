# DriveQuiz API 数据存储说明

## ✅ 确认：上传的分片存储在 `rag_documents` 表

**是的，Datapull 上传的文档分片会存储到 `rag_documents` 表中。**

---

## 📊 数据存储流程

### 1. 单文档上传流程

当 Datapull 通过 `POST /api/v1/rag/docs` 上传单个文档时：

```
Datapull 上传
    ↓
验证文档（validator.ts）
    ↓
检查重复（rag_documents 表）
    ↓
创建操作记录（rag_operations 表）
    ↓
插入文档到 rag_documents 表 ✅
    ↓
记录操作文档映射（rag_operation_documents 表）
    ↓
触发向量化任务
```

### 2. 批量上传流程

当 Datapull 通过 `POST /api/v1/rag/docs/batch` 批量上传时：

```
Datapull 批量上传
    ↓
创建操作记录（rag_operations 表）
    ↓
并发处理每个文档
    ├─ 验证文档
    ├─ 检查重复
    ├─ 插入到 rag_documents 表 ✅
    └─ 记录操作文档映射
    ↓
更新操作状态
```

---

## 📋 数据库表结构

### `rag_documents` 表（存储文档分片）

这是**主要存储表**，每个上传的分片都会存储在这里：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | SERIAL | 主键（自增） |
| `doc_id` | VARCHAR(255) | 文档ID（唯一，格式：`doc_xxx`） |
| `title` | VARCHAR(500) | 文档标题 |
| `url` | VARCHAR(1000) | 文档原始URL |
| `content` | TEXT | **文档内容（分片内容）** ✅ |
| `content_hash` | VARCHAR(64) | 内容哈希（SHA256） |
| `version` | VARCHAR(50) | 数据版本（如 `2025Q1`） |
| `lang` | VARCHAR(10) | 语言代码（`ja`/`zh`/`en`） |
| `source_id` | VARCHAR(100) | 数据来源ID |
| `doc_type` | VARCHAR(50) | 文档类型（可选） |
| `vectorization_status` | VARCHAR(50) | 向量化状态（`pending`/`processing`/`completed`/`failed`） |
| `created_at` | TIMESTAMP | 创建时间 |
| `updated_at` | TIMESTAMP | 更新时间 |

**唯一约束**：`(url, content_hash, version)` - 防止重复文档

---

### `rag_operations` 表（存储操作记录）

记录每次上传操作：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | SERIAL | 主键 |
| `operation_id` | VARCHAR(255) | 操作ID（唯一，格式：`op_xxx`） |
| `source_id` | VARCHAR(100) | 数据来源ID |
| `status` | VARCHAR(50) | 操作状态 |
| `docs_count` | INT | 文档数量 |
| `failed_count` | INT | 失败数量 |
| `metadata` | JSONB | 元数据（版本、语言等） |
| `created_at` | TIMESTAMP | 创建时间 |
| `completed_at` | TIMESTAMP | 完成时间 |

---

### `rag_operation_documents` 表（操作与文档映射）

记录操作与文档的关联关系：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | SERIAL | 主键 |
| `operation_id` | VARCHAR(255) | 操作ID（外键） |
| `doc_id` | VARCHAR(255) | 文档ID（外键，可为空） |
| `status` | VARCHAR(50) | 上传状态（`success`/`failed`） |
| `error_code` | VARCHAR(100) | 错误代码（可选） |
| `error_message` | TEXT | 错误消息（可选） |
| `created_at` | TIMESTAMP | 创建时间 |

---

## 🔍 代码确认

### 单文档上传（docs.ts）

```typescript
// 第 120-134 行：插入文档到 rag_documents 表
await db
  .insertInto("rag_documents")
  .values({
    doc_id: docId,
    title: input.title,
    url: input.url,
    content: input.content,  // ✅ 分片内容存储在这里
    content_hash: contentHash,
    version: input.version,
    lang: input.lang,
    source_id: input.meta.sourceId,
    doc_type: input.meta.type || null,
    vectorization_status: "pending",
  })
  .execute();
```

### 批量上传（docs-batch.ts）

```typescript
// 第 212-226 行：批量插入文档到 rag_documents 表
await db
  .insertInto("rag_documents")
  .values({
    doc_id: docId,
    title: input.title,
    url: input.url,
    content: input.content,  // ✅ 分片内容存储在这里
    content_hash: contentHash,
    version: input.version,
    lang: input.lang,
    source_id: input.meta.sourceId,
    doc_type: input.meta.type || null,
    vectorization_status: "pending",
  })
  .execute();
```

---

## 📝 查询上传的分片

### 查看所有分片

```sql
SELECT 
  doc_id,
  title,
  url,
  content,  -- ✅ 分片内容
  version,
  lang,
  source_id,
  vectorization_status,
  created_at
FROM rag_documents
ORDER BY created_at DESC;
```

### 查看特定来源的分片

```sql
SELECT 
  doc_id,
  title,
  LEFT(content, 200) as content_preview,  -- 内容预览
  version,
  lang,
  created_at
FROM rag_documents
WHERE source_id = 'your_source_id'
ORDER BY created_at DESC;
```

### 查看分片内容

```sql
-- 查看完整内容
SELECT content FROM rag_documents WHERE doc_id = 'doc_xxx';

-- 查看内容预览
SELECT 
  doc_id,
  title,
  LEFT(content, 500) as content_preview,
  LENGTH(content) as content_length
FROM rag_documents
WHERE source_id = 'your_source_id'
ORDER BY created_at DESC;
```

---

## ✅ 总结

1. **✅ 是的**，上传的分片存储在 `rag_documents` 表中
2. **存储字段**：`content` 字段存储分片的完整内容
3. **每个分片**：作为一条独立的记录存储在表中
4. **关联关系**：通过 `rag_operation_documents` 表关联到操作记录

---

**最后更新**：2025-01-XX

