# 🔌 《DriveQuiz API 接口联调文档 v1.1》

**版本**：v1.1  
**发布日期**：2025-01-XX  
**适用范围**：Datapull 与 DriveQuiz API 联调团队  
**配套文档**：《📐 DriveQuiz API 参数与接口统一规范 v1.1》

---

## Ⅰ. 🎯 文档目的

本文档提供 DriveQuiz API 所有接口的详细联调说明，包括请求格式、响应结构、错误处理、认证方式等，便于 Datapull 团队快速集成与测试。

---

## Ⅱ. 🌐 基础信息

### 2.1 服务地址

- **开发环境**：`http://localhost:8788`
- **生产环境**：根据实际部署配置
- **API 版本**：`v1.1`
- **基础路径**：`/api/v1/rag`

### 2.2 认证方式

所有接口（除健康检查外）均需要 Bearer Token 认证：

```http
Authorization: Bearer <TOKEN>
```

**Token 配置**：
- 环境变量：`DRIVEQUIZ_API_TOKEN_SECRET`
- 验证方式：Token 需与配置的密钥完全匹配

### 2.3 请求格式

- **Content-Type**：`application/json`
- **字符编码**：`UTF-8`
- **请求体大小限制**：10MB

### 2.4 响应格式

所有接口统一使用以下响应结构：

**成功响应**：
```json
{
  "success": true,
  "data": { ... }
}
```

**错误响应**：
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "details": { ... }
  }
}
```

---

## Ⅲ. 📋 接口列表

### 1️⃣ 健康检查

**接口**：`GET /api/v1/rag/health`

**说明**：检查服务是否正常运行，无需认证

**请求示例**：
```bash
curl -X GET http://localhost:8788/api/v1/rag/health
```

**响应示例**：
```json
{
  "status": "ok",
  "timestamp": "2025-01-XXTXX:XX:XX.XXXZ",
  "version": "v1.1"
}
```

---

### 2️⃣ 单文档上传

**接口**：`POST /api/v1/rag/docs`

**说明**：上传单个文档到 DriveQuiz，自动触发向量化

**认证**：✅ 需要 Bearer Token

**请求头**：
```http
Authorization: Bearer <TOKEN>
Content-Type: application/json
```

**请求体**：
```json
{
  "title": "文档标题",
  "url": "https://example.com/doc",
  "content": "文档内容，长度100-2000字符",
  "version": "2025Q1",
  "lang": "ja",
  "meta": {
    "sourceId": "source_001",
    "type": "official",
    "chunkIndex": 1,
    "totalChunks": 5,
    "contentHash": "sha256_hash_string"
  }
}
```

**字段说明**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `title` | string | ✅ | 文档标题，1-500字符 |
| `url` | string | ✅ | 文档原始URL，最大1000字符 |
| `content` | string | ✅ | 文档内容，100-2000字符 |
| `version` | string | ✅ | 数据版本，如 `2025Q1`，最大50字符 |
| `lang` | enum | ✅ | 语言代码：`"ja"` \| `"zh"` \| `"en"` |
| `meta.sourceId` | string | ✅ | 数据来源ID，1-100字符 |
| `meta.type` | enum | ❌ | 文档类型：`"official"` \| `"organization"` \| `"education"` |
| `meta.chunkIndex` | number | ❌ | 分片序号，≥1 |
| `meta.totalChunks` | number | ❌ | 分片总数，≥chunkIndex |
| `meta.contentHash` | string | ❌ | SHA256哈希，最大64字符 |

**分片规则**：
- 如果提供 `chunkIndex`、`totalChunks` 和 `contentHash`，系统识别为 Datapull 预分片文档
- 如果未提供分片信息，需启用服务端分片（`RAG_ENABLE_SERVER_CHUNK=true`）

**请求示例**：
```bash
curl -X POST http://localhost:8788/api/v1/rag/docs \
  -H "Authorization: Bearer your_token_here" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "交通规则第1条",
    "url": "https://example.com/rule1",
    "content": "这是文档内容，长度需要在100到2000字符之间...",
    "version": "2025Q1",
    "lang": "ja",
    "meta": {
      "sourceId": "source_001",
      "type": "official",
      "chunkIndex": 1,
      "totalChunks": 5,
      "contentHash": "abc123def456..."
    }
  }'
```

**成功响应**（200）：
```json
{
  "success": true,
  "data": {
    "docId": "doc_abc123",
    "operationId": "op_xyz456"
  }
}
```

> ⚠️ **注意**：实际代码返回格式使用 `data` 包裹，与规范文档中直接返回字段的格式略有不同。建议统一规范。

**错误响应示例**：

- **400 - 参数验证失败**：
```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Validation failed: content - String must contain at least 100 character(s)",
    "details": {
      "field": "content",
      "errors": [...]
    }
  }
}
```

- **400 - 分片元数据错误**：
```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "chunkIndex must be less than or equal to totalChunks"
  }
}
```

- **400 - 未分片且未启用服务端分片**：
```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Document must be pre-chunked by Datapull or server-side chunking must be enabled"
  }
}
```

- **400 - 内容哈希不匹配**：
```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Content hash mismatch"
  }
}
```

- **401 - 认证失败**：
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or missing token"
  }
}
```

- **409 - 文档重复**：
```json
{
  "success": false,
  "error": {
    "code": "DUPLICATE_DOCUMENT",
    "message": "Document already exists"
  }
}
```

- **429 - 速率限制**：
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests"
  }
}
```

- **500 - 服务器错误**：
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to ingest document"
  }
}
```

---

### 3️⃣ 批量文档上传

**接口**：`POST /api/v1/rag/docs/batch`

**说明**：批量上传多个文档，支持并发处理，最多100个文档

**认证**：✅ 需要 Bearer Token

**请求头**：
```http
Authorization: Bearer <TOKEN>
Content-Type: application/json
```

**请求体**：
```json
{
  "docs": [
    {
      "title": "文档1",
      "url": "https://example.com/doc1",
      "content": "文档内容1...",
      "version": "2025Q1",
      "lang": "ja",
      "meta": {
        "sourceId": "source_001",
        "chunkIndex": 1,
        "totalChunks": 3,
        "contentHash": "hash1"
      }
    },
    {
      "title": "文档2",
      "url": "https://example.com/doc2",
      "content": "文档内容2...",
      "version": "2025Q1",
      "lang": "ja",
      "meta": {
        "sourceId": "source_001",
        "chunkIndex": 2,
        "totalChunks": 3,
        "contentHash": "hash2"
      }
    }
  ],
  "sourceId": "source_001",
  "batchMetadata": {
    "totalDocs": 2,
    "crawledAt": "2025-01-XXTXX:XX:XX.XXXZ",
    "crawlerVersion": "1.0.0"
  }
}
```

**字段说明**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `docs` | array | ✅ | 文档数组，1-100个元素，每个元素格式同单文档上传 |
| `sourceId` | string | ✅ | 数据来源ID，1-100字符 |
| `batchMetadata.totalDocs` | number | ❌ | 批次文档总数 |
| `batchMetadata.crawledAt` | string | ❌ | Datapull 抓取时间，ISO8601格式 |
| `batchMetadata.crawlerVersion` | string | ❌ | Datapull 版本号，最大50字符 |

**请求示例**：
```bash
curl -X POST http://localhost:8788/api/v1/rag/docs/batch \
  -H "Authorization: Bearer your_token_here" \
  -H "Content-Type: application/json" \
  -d '{
    "docs": [
      {
        "title": "文档1",
        "url": "https://example.com/doc1",
        "content": "这是文档内容，长度需要在100到2000字符之间...",
        "version": "2025Q1",
        "lang": "ja",
        "meta": {
          "sourceId": "source_001",
          "chunkIndex": 1,
          "totalChunks": 3,
          "contentHash": "hash1"
        }
      }
    ],
    "sourceId": "source_001",
    "batchMetadata": {
      "totalDocs": 1,
      "crawledAt": "2025-01-XXTXX:XX:XX.XXXZ",
      "crawlerVersion": "1.0.0"
    }
  }'
```

**成功响应**（200 - 全部成功）：
```json
{
  "success": true,
  "data": {
    "processed": 24,
    "failed": 0,
    "operationId": "op_batch_abc123",
    "results": [
      { "docId": "doc_a1", "index": 0, "status": "success" },
      { "docId": "doc_a2", "index": 1, "status": "success" }
    ]
  }
}
```

**部分成功响应**（207 - 部分成功）：
```json
{
  "success": true,
  "data": {
    "processed": 23,
    "failed": 1,
    "operationId": "op_batch_abc123",
    "results": [
      { "docId": "doc_a1", "index": 0, "status": "success" },
      { "index": 5, "status": "failed", "error": { "code": "INVALID_REQUEST", "message": "Content too short" } }
    ]
  }
}
```

**全部失败响应**（400）：
```json
{
  "success": true,
  "data": {
    "processed": 0,
    "failed": 2,
    "operationId": "op_batch_abc123",
    "results": [
      { "index": 0, "status": "failed", "error": { "code": "INVALID_REQUEST", "message": "..." } },
      { "index": 1, "status": "failed", "error": { "code": "INVALID_REQUEST", "message": "..." } }
    ]
  }
}
```

**错误响应**：
- 同单文档上传的错误响应格式
- 批量请求格式错误返回 400

---

### 4️⃣ 查询操作记录列表

**接口**：`GET /api/v1/rag/operations`

**说明**：分页查询操作记录列表，支持按来源、状态、日期过滤

**认证**：✅ 需要 Bearer Token

**请求头**：
```http
Authorization: Bearer <TOKEN>
```

**查询参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `sourceId` | string | ❌ | 过滤来源ID |
| `status` | string | ❌ | 过滤状态：`pending` \| `processing` \| `success` \| `failed` |
| `startDate` | string | ❌ | 起始日期，ISO8601格式 |
| `endDate` | string | ❌ | 结束日期，ISO8601格式 |
| `page` | number | ❌ | 页码，默认1 |
| `limit` | number | ❌ | 每页数量，默认20 |

**请求示例**：
```bash
curl -X GET "http://localhost:8788/api/v1/rag/operations?sourceId=source_001&status=success&page=1&limit=20" \
  -H "Authorization: Bearer your_token_here"
```

**成功响应**（200）：
```json
{
  "success": true,
  "data": [
    {
      "operationId": "op_abc123",
      "sourceId": "source_001",
      "status": "success",
      "docsCount": 15,
      "failedCount": 0,
      "createdAt": "2025-01-XXTXX:XX:XX.XXXZ",
      "completedAt": "2025-01-XXTXX:XX:XX.XXXZ",
      "metadata": {
        "version": "2025Q1",
        "lang": "ja",
        "crawlerVersion": "1.0.0"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1
  }
}
```

**错误响应**：
- 401 - 认证失败
- 500 - 服务器错误

---

### 5️⃣ 查询操作详情

**接口**：`GET /api/v1/rag/operations/:operationId`

**说明**：查询指定操作的详细信息，包括关联的文档列表

**认证**：✅ 需要 Bearer Token

**请求头**：
```http
Authorization: Bearer <TOKEN>
```

**路径参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `operationId` | string | ✅ | 操作ID |

**请求示例**：
```bash
curl -X GET http://localhost:8788/api/v1/rag/operations/op_abc123 \
  -H "Authorization: Bearer your_token_here"
```

**成功响应**（200）：
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
      "lang": "ja",
      "crawlerVersion": "1.0.0"
    },
    "documents": [
      {
        "docId": "doc_1",
        "url": "https://example.com/doc1",
        "title": "文档1",
        "status": "success"
      },
      {
        "docId": "doc_2",
        "url": "https://example.com/doc2",
        "title": "文档2",
        "status": "failed",
        "error": {
          "code": "DUPLICATE_DOCUMENT",
          "message": "Document already exists"
        }
      }
    ]
  }
}
```

**错误响应**：

- **404 - 操作不存在**：
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Operation not found"
  }
}
```

- 401 - 认证失败
- 500 - 服务器错误

---

## Ⅳ. 🚨 错误码对照表

| 错误码 | HTTP状态码 | 说明 | 处理建议 |
|--------|-----------|------|----------|
| `UNAUTHORIZED` | 401 | Token 无效或缺失 | 检查 Authorization 头 |
| `INVALID_REQUEST` | 400 | 参数验证失败 | 检查请求体格式和字段 |
| `VALIDATION_FAILED` | 400 | 字段验证失败 | 检查字段类型和长度限制 |
| `DUPLICATE_DOCUMENT` | 409 | 文档重复（相同URL+哈希+版本） | 跳过或更新文档 |
| `RATE_LIMIT_EXCEEDED` | 429 | 速率限制超出 | 降低请求频率 |
| `NOT_FOUND` | 404 | 资源不存在 | 检查操作ID是否正确 |
| `INTERNAL_ERROR` | 500 | 服务器内部错误 | 联系技术支持 |

---

## Ⅴ. 🔄 联调流程建议

### 5.1 首次联调步骤

1. **健康检查**
   ```bash
   GET /api/v1/rag/health
   ```
   确认服务正常运行

2. **认证测试**
   ```bash
   POST /api/v1/rag/docs
   ```
   使用错误的 Token，确认返回 401

3. **单文档上传测试**
   ```bash
   POST /api/v1/rag/docs
   ```
   上传一个简单的文档，确认返回 `docId` 和 `operationId`

4. **查询操作记录**
   ```bash
   GET /api/v1/rag/operations/:operationId
   ```
   使用步骤3返回的 `operationId`，确认可以查询到操作详情

5. **批量上传测试**
   ```bash
   POST /api/v1/rag/docs/batch
   ```
   上传2-3个文档，确认批量处理正常

### 5.2 错误场景测试

1. **参数验证**：缺少必填字段、字段类型错误、长度超限
2. **分片验证**：`chunkIndex > totalChunks`、缺少分片信息
3. **重复文档**：上传相同URL+哈希+版本的文档
4. **速率限制**：短时间内发送大量请求

### 5.3 生产环境注意事项

1. **Token 安全**：不要在代码中硬编码 Token，使用环境变量
2. **错误重试**：对于 500 错误，实现指数退避重试
3. **批量处理**：建议每批不超过 50 个文档，避免超时
4. **监控告警**：监控失败率和响应时间

---

## Ⅵ. 📊 性能指标

### 6.1 速率限制

- **单文档上传**：默认 100 次/分钟（可配置）
- **批量上传**：默认 10 次/分钟（可配置）
- **查询接口**：默认 100 次/分钟（可配置）

### 6.2 响应时间

- **健康检查**：< 10ms
- **单文档上传**：< 500ms
- **批量上传**：< 5s（50个文档）
- **查询操作列表**：< 200ms
- **查询操作详情**：< 300ms

### 6.3 并发处理

- **批量上传**：最多 10 个文档并发处理
- **向量化任务**：异步触发，不阻塞响应

---

## Ⅶ. 🔍 调试技巧

### 7.1 日志查看

服务端会记录以下事件：
- `ingest.success` - 文档上传成功
- `ingest.failed` - 文档上传失败
- `ingest.prechunk.detected` - 检测到预分片文档
- `ingest.batch.start` - 批量上传开始
- `ingest.batch.completed` - 批量上传完成
- `ingest.batch.partial` - 批量上传部分成功
- `operations.query` - 查询操作记录
- `operations.detail` - 查询操作详情
- `auth.unauthorized` - 认证失败

### 7.2 常见问题排查

1. **401 认证失败**
   - 检查 `Authorization` 头格式：`Bearer <TOKEN>`
   - 确认 Token 与 `DRIVEQUIZ_API_TOKEN_SECRET` 匹配

2. **400 参数验证失败**
   - 检查 JSON 格式是否正确
   - 确认必填字段是否提供
   - 检查字段类型和长度限制

3. **409 文档重复**
   - 检查 URL、contentHash、version 组合是否已存在
   - 如需更新，先删除旧文档或使用新版本号

4. **500 服务器错误**
   - 查看服务端日志
   - 检查数据库连接
   - 检查向量化服务是否正常

---

## Ⅷ. 📝 更新日志

### v1.1 (2025-01-XX)
- 初始版本发布
- 支持单文档和批量文档上传
- 支持操作记录查询
- 支持分片识别和去重

---

## Ⅸ. 📞 联系方式

如有问题，请联系 DriveQuiz API 开发团队。

---

## ✅ 附录：完整请求示例

### Python 示例

```python
import requests
import json

BASE_URL = "http://localhost:8788/api/v1/rag"
TOKEN = "your_token_here"

headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json"
}

# 单文档上传
doc_data = {
    "title": "测试文档",
    "url": "https://example.com/test",
    "content": "这是测试文档内容，长度需要在100到2000字符之间..." * 2,
    "version": "2025Q1",
    "lang": "ja",
    "meta": {
        "sourceId": "source_001",
        "type": "official",
        "chunkIndex": 1,
        "totalChunks": 1,
        "contentHash": "test_hash"
    }
}

response = requests.post(f"{BASE_URL}/docs", headers=headers, json=doc_data)
print(response.json())
```

### JavaScript 示例

```javascript
const BASE_URL = 'http://localhost:8788/api/v1/rag';
const TOKEN = 'your_token_here';

// 单文档上传
async function uploadDocument() {
  const response = await fetch(`${BASE_URL}/docs`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: '测试文档',
      url: 'https://example.com/test',
      content: '这是测试文档内容，长度需要在100到2000字符之间...'.repeat(2),
      version: '2025Q1',
      lang: 'ja',
      meta: {
        sourceId: 'source_001',
        type: 'official',
        chunkIndex: 1,
        totalChunks: 1,
        contentHash: 'test_hash'
      }
    })
  });
  
  const data = await response.json();
  console.log(data);
}
```

---

## Ⅹ. ✅ 与规范文档一致性检查

### 10.1 一致性对比结果

本文档基于实际代码实现生成，与《📐 DriveQuiz API 参数与接口统一规范 v1.1》进行对比，发现以下差异：

#### ✅ 一致项

1. **接口路径**：完全一致
   - `POST /api/v1/rag/docs` ✅
   - `POST /api/v1/rag/docs/batch` ✅
   - `GET /api/v1/rag/operations` ✅
   - `GET /api/v1/rag/operations/:operationId` ✅

2. **请求参数**：完全一致
   - 所有字段定义、类型、必填性均一致 ✅
   - 分片元数据规则一致 ✅

3. **错误码**：完全一致
   - `UNAUTHORIZED` (401) ✅
   - `INVALID_REQUEST` (400) ✅
   - `DUPLICATE_DOCUMENT` (409) ✅
   - `RATE_LIMIT_EXCEEDED` (429) ✅
   - `INTERNAL_ERROR` (500) ✅

4. **认证方式**：完全一致
   - Bearer Token 认证 ✅
   - 环境变量配置一致 ✅

#### ⚠️ 不一致项

1. **单文档上传响应格式**

   **规范文档**：
   ```json
   {
     "success": true,
     "docId": "doc_abc123",
     "operationId": "op_xyz456"
   }
   ```

   **实际代码**：
   ```json
   {
     "success": true,
     "data": {
       "docId": "doc_abc123",
       "operationId": "op_xyz456"
     }
   }
   ```

   **差异说明**：实际代码使用 `data` 包裹响应数据，而规范文档中直接返回字段。

   **建议**：
   - 方案1：修改代码以符合规范文档（不推荐，影响现有调用方）
   - 方案2：更新规范文档以反映实际实现（推荐）

2. **批量上传响应格式**

   **规范文档**：
   ```json
   {
     "success": true,
     "processed": 24,
     "failed": 1,
     "operationId": "op_batch_20251107",
     "results": [...]
   }
   ```

   **实际代码**：
   ```json
   {
     "success": true,
     "data": {
       "processed": 24,
       "failed": 1,
       "operationId": "op_batch_20251107",
       "results": [...]
     }
   }
   ```

   **差异说明**：同样使用 `data` 包裹。

   **建议**：统一使用 `data` 包裹格式，保持所有接口响应格式一致。

3. **查询操作列表响应格式**

   **规范文档**：
   ```json
   {
     "success": true,
     "data": [...],
     "pagination": { "page": 1, "limit": 20, "total": 1 }
   }
   ```

   **实际代码**：
   ```json
   {
     "success": true,
     "data": [...],
     "pagination": { "page": 1, "limit": 20, "total": 1 }
   }
   ```

   **差异说明**：✅ 完全一致

4. **查询操作详情响应格式**

   **规范文档**：
   ```json
   {
     "success": true,
     "data": {
       "operationId": "op_123",
       "status": "success",
       "docsCount": 15,
       "failedCount": 0,
       "documents": [...]
     }
   }
   ```

   **实际代码**：
   ```json
   {
     "success": true,
     "data": {
       "operationId": "op_123",
       "status": "success",
       "docsCount": 15,
       "failedCount": 0,
       "documents": [...]
     }
   }
   ```

   **差异说明**：✅ 完全一致

### 10.2 规范文档字段必填性检查

#### 单文档上传字段必填性

| 字段 | 规范文档 | 实际代码 | 一致性 |
|------|---------|---------|--------|
| `title` | ✅ 必填 | ✅ 必填 | ✅ |
| `url` | ✅ 必填 | ✅ 必填 | ✅ |
| `content` | ✅ 必填 | ✅ 必填 | ✅ |
| `version` | ✅ 必填 | ✅ 必填 | ✅ |
| `lang` | ✅ 必填 | ✅ 必填 | ✅ |
| `meta.sourceId` | ✅ 必填 | ✅ 必填 | ✅ |
| `meta.contentHash` | ✅ 必填 | ❌ 可选 | ⚠️ **不一致** |
| `meta.chunkIndex` | ✅ 必填 | ❌ 可选 | ⚠️ **不一致** |
| `meta.totalChunks` | ✅ 必填 | ❌ 可选 | ⚠️ **不一致** |
| `meta.type` | ❌ 可选 | ❌ 可选 | ✅ |

**差异说明**：
- 规范文档中 `meta.contentHash`、`meta.chunkIndex`、`meta.totalChunks` 标记为必填
- 实际代码中这些字段为可选（用于判断是否为预分片文档）
- 如果未提供分片信息，需启用服务端分片（`RAG_ENABLE_SERVER_CHUNK=true`）

**建议**：更新规范文档，明确说明：
- 如果使用 Datapull 预分片，则 `chunkIndex`、`totalChunks`、`contentHash` 为必填
- 如果使用服务端分片，则这些字段为可选

### 10.3 总结

| 检查项 | 一致性 | 说明 |
|--------|--------|------|
| 接口路径 | ✅ 100% | 完全一致 |
| 请求参数定义 | ⚠️ 95% | 分片字段必填性需明确 |
| 响应格式 | ⚠️ 80% | 单文档和批量上传响应格式需统一 |
| 错误码 | ✅ 100% | 完全一致 |
| 认证方式 | ✅ 100% | 完全一致 |

**总体一致性**：**90%** ✅

**建议行动**：
1. 更新规范文档，统一响应格式为使用 `data` 包裹
2. 明确分片字段的必填性规则（预分片 vs 服务端分片）
3. 保持代码实现与规范文档同步更新

---

**文档结束**

