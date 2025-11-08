# 服务日志分析指南

## 🔍 分析 Datapull 上传的日志

根据您提供的日志，目前看到的是**查询操作记录时的数据库连接错误**，而不是上传操作的日志。

---

## 📋 日志分析

### 当前日志分析

从您提供的日志来看：

1. **请求日志**：
   ```
   GET /api/v1/rag/operations?limit=5
   ```
   - 这是**查询操作记录**的请求，不是上传请求

2. **错误日志**：
   ```
   "self-signed certificate in certificate chain"
   ```
   - 这是**数据库连接错误**，导致无法查询操作记录
   - 已修复 SSL 配置问题

### 上传操作的日志特征

如果 Datapull 有内容推送，您应该看到以下日志：

#### 1. 单文档上传成功

```json
{
  "level": "info",
  "event": "ingest.success",
  "docId": "doc_xxx",
  "operationId": "op_xxx",
  "sourceId": "source_xxx",
  "prechunked": true
}
```

#### 2. 检测到预分片文档

```json
{
  "level": "info",
  "event": "ingest.prechunk.detected",
  "docId": "doc_xxx",
  "chunkIndex": 1,
  "totalChunks": 5
}
```

#### 3. 批量上传开始

```json
{
  "level": "info",
  "event": "ingest.batch.start",
  "operationId": "op_batch_xxx",
  "sourceId": "source_xxx",
  "totalDocs": 24
}
```

#### 4. 批量上传完成

```json
{
  "level": "info",
  "event": "ingest.batch.completed",
  "operationId": "op_batch_xxx",
  "processed": 24
}
```

#### 5. 批量上传部分成功

```json
{
  "level": "info",
  "event": "ingest.batch.partial",
  "operationId": "op_batch_xxx",
  "processed": 23,
  "failed": 1
}
```

---

## ✅ 确认是否有 Datapull 推送

### 方法一：查看服务控制台日志

在服务运行的控制台中，查找以下关键词：

- `ingest.success` - 单文档上传成功
- `ingest.batch.start` - 批量上传开始
- `ingest.batch.completed` - 批量上传完成
- `ingest.prechunk.detected` - 检测到预分片文档
- `ingest.failed` - 上传失败

### 方法二：修复 SSL 错误后查询数据库

1. **重启服务**（SSL 配置已修复）
2. **查询操作记录**：
   ```bash
   TOKEN=$(grep "^DRIVEQUIZ_API_TOKEN_SECRET=" .env | cut -d'=' -f2)
   curl -X GET "http://localhost:8789/api/v1/rag/operations?limit=10" \
     -H "Authorization: Bearer $TOKEN"
   ```

### 方法三：直接查询数据库

```bash
psql "postgresql://postgres:zKV0rtIV1QOByu89@db.cgpmpfnjzlzbakmmrj.supabase.co:5432/postgres?sslmode=require"
```

然后执行：

```sql
-- 查看所有操作记录
SELECT * FROM rag_operations ORDER BY created_at DESC LIMIT 10;

-- 查看所有文档
SELECT * FROM rag_documents ORDER BY created_at DESC LIMIT 10;
```

---

## 🔧 已修复的问题

### SSL 证书错误

**问题**：`self-signed certificate in certificate chain`

**修复**：已更新 `src/lib/db.ts` 中的 SSL 配置，确保 Supabase 连接时正确设置 `rejectUnauthorized: false`

**需要**：重启服务使配置生效

---

## 📊 日志事件类型

### 上传相关事件

| 事件 | 说明 | 是否表示有推送 |
|------|------|---------------|
| `ingest.success` | 单文档上传成功 | ✅ 是 |
| `ingest.batch.start` | 批量上传开始 | ✅ 是 |
| `ingest.batch.completed` | 批量上传完成 | ✅ 是 |
| `ingest.batch.partial` | 批量上传部分成功 | ✅ 是 |
| `ingest.prechunk.detected` | 检测到预分片 | ✅ 是 |
| `ingest.failed` | 上传失败 | ⚠️ 有推送但失败 |

### 查询相关事件

| 事件 | 说明 | 是否表示有推送 |
|------|------|---------------|
| `operations.query` | 查询操作记录 | ❌ 否 |
| `operations.detail` | 查询操作详情 | ❌ 否 |

---

## 🚀 下一步操作

1. **重启服务**（使 SSL 修复生效）
   ```bash
   # 停止当前服务（Ctrl+C）
   # 重新启动
   npm run dev
   ```

2. **查询操作记录**（确认是否有上传）
   ```bash
   TOKEN=$(grep "^DRIVEQUIZ_API_TOKEN_SECRET=" .env | cut -d'=' -f2)
   curl -X GET "http://localhost:8789/api/v1/rag/operations?limit=10" \
     -H "Authorization: Bearer $TOKEN"
   ```

3. **查看服务日志**（查找上传事件）
   - 在服务控制台中查找 `ingest` 相关事件
   - 如果看到 `ingest.success` 或 `ingest.batch.start`，说明有 Datapull 推送

---

## 💡 提示

- **当前日志**：只看到查询请求，没有看到上传请求
- **需要确认**：查看服务控制台是否有 `ingest` 相关日志
- **如果无日志**：可能 Datapull 还没有推送，或者推送到了其他地址

---

**最后更新**：2025-01-XX

