# DriveQuiz RAG Ingestion API 规范

## 概述

本文档定义了 datapull 项目与 drivequiz 项目之间的 API 接口规范，用于批量上传抓取的网页/文档内容到 RAG 知识库。

**Base URL**: `https://your-drivequiz-domain.com/api/v1/rag`

**API Version**: `v1`

---

## 认证机制

### 方式 1: Bearer Token（推荐）

所有 API 请求需要在 HTTP Header 中包含认证信息：

```
Authorization: Bearer {API_TOKEN}
```

### 方式 2: API Key（可选）

```
X-API-Key: {API_KEY}
```

**Token 生成**：在 drivequiz 管理后台生成，用于 datapull 服务调用。

---

## API 端点

### 1. 健康检查

**GET** `/health`

检查 API 服务是否可用。

**响应**:
```json
{
  "status": "ok",
  "timestamp": "2025-01-06T12:00:00Z",
  "version": "v1"
}
```

---

### 2. 单文档上传

**POST** `/docs`

上传单个文档分片到 RAG 数据库。

**请求头**:
```
Content-Type: application/json
Authorization: Bearer {API_TOKEN}
```

**请求体**:
```json
{
  "title": "警察庁 外国免許 FAQ #1",
  "url": "https://www.npa.go.jp/bureau/traffic/license/",
  "content": "外国免許を日本で使用する場合...",
  "version": "2025Q1",
  "lang": "ja",
  "meta": {
    "sourceId": "gov_npa_driving",
    "type": "official",
    "chunkIndex": 1,
    "totalChunks": 3,
    "contentHash": "sha256:abc123..."
  }
}
```

**字段说明**:
- `title` (string, required): 文档标题
- `url` (string, required): 源 URL
- `content` (string, required): 文档内容（500-800 字符）
- `version` (string, required): 版本标识（如 "2025Q1"）
- `lang` (string, required): 语言代码（"ja" | "zh" | "en"）
- `meta` (object, optional): 元数据
  - `sourceId`: 源标识符
  - `type`: 文档类型（"official" | "organization" | "education"）
  - `chunkIndex`: 分片索引
  - `totalChunks`: 总分片数
  - `contentHash`: 内容哈希（用于去重）

**响应** (200 OK):
```json
{
  "success": true,
  "docId": "doc_abc123",
  "message": "Document ingested successfully",
  "operationId": "op_xyz789"
}
```

**响应** (400 Bad Request):
```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Missing required field: content",
    "details": {
      "field": "content",
      "reason": "content is required and must be non-empty"
    }
  }
}
```

**响应** (401 Unauthorized):
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired token"
  }
}
```

---

### 3. 批量文档上传

**POST** `/docs/batch`

批量上传多个文档分片（推荐用于大量数据）。

**请求头**:
```
Content-Type: application/json
Authorization: Bearer {API_TOKEN}
```

**请求体**:
```json
{
  "docs": [
    {
      "title": "警察庁 外国免許 FAQ #1",
      "url": "https://www.npa.go.jp/bureau/traffic/license/",
      "content": "外国免許を日本で使用する場合...",
      "version": "2025Q1",
      "lang": "ja",
      "meta": {
        "sourceId": "gov_npa_driving",
        "type": "official",
        "chunkIndex": 1,
        "totalChunks": 3
      }
    },
    {
      "title": "警察庁 外国免許 FAQ #2",
      "url": "https://www.npa.go.jp/bureau/traffic/license/",
      "content": "免許証の更新手続きについて...",
      "version": "2025Q1",
      "lang": "ja",
      "meta": {
        "sourceId": "gov_npa_driving",
        "type": "official",
        "chunkIndex": 2,
        "totalChunks": 3
      }
    }
  ],
  "sourceId": "gov_npa_driving",
  "batchMetadata": {
    "totalDocs": 2,
    "crawledAt": "2025-01-06T12:00:00Z",
    "crawlerVersion": "1.0.0"
  }
}
```

**字段说明**:
- `docs` (array, required): 文档数组（最多 100 个）
- `sourceId` (string, optional): 批次源标识
- `batchMetadata` (object, optional): 批次元数据

**响应** (200 OK):
```json
{
  "success": true,
  "processed": 2,
  "failed": 0,
  "operationId": "op_batch_xyz789",
  "results": [
    {
      "docId": "doc_abc123",
      "status": "success"
    },
    {
      "docId": "doc_def456",
      "status": "success"
    }
  ]
}
```

**响应** (207 Multi-Status):
```json
{
  "success": true,
  "processed": 1,
  "failed": 1,
  "operationId": "op_batch_xyz789",
  "results": [
    {
      "docId": "doc_abc123",
      "status": "success"
    },
    {
      "index": 1,
      "status": "failed",
      "error": {
        "code": "INVALID_CONTENT",
        "message": "Content too short"
      }
    }
  ]
}
```

---

### 4. 操作记录查询

**GET** `/operations`

查询历史操作记录。

**查询参数**:
- `sourceId` (string, optional): 按源 ID 过滤
- `status` (string, optional): 按状态过滤（"success" | "failed" | "pending"）
- `startDate` (string, optional): 开始日期（ISO 8601）
- `endDate` (string, optional): 结束日期（ISO 8601）
- `page` (number, optional): 页码（默认 1）
- `limit` (number, optional): 每页数量（默认 20，最大 100）

**响应** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "operationId": "op_xyz789",
      "sourceId": "gov_npa_driving",
      "status": "success",
      "docsCount": 15,
      "createdAt": "2025-01-06T12:00:00Z",
      "completedAt": "2025-01-06T12:05:00Z",
      "duration": 300,
      "metadata": {
        "version": "2025Q1",
        "lang": "ja"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

---

### 5. 操作详情查询

**GET** `/operations/{operationId}`

查询单个操作的详细信息。

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "operationId": "op_xyz789",
    "sourceId": "gov_npa_driving",
    "status": "success",
    "docsCount": 15,
    "failedCount": 0,
    "createdAt": "2025-01-06T12:00:00Z",
    "completedAt": "2025-01-06T12:05:00Z",
    "duration": 300,
    "metadata": {
      "version": "2025Q1",
      "lang": "ja",
      "crawlerVersion": "1.0.0"
    },
    "documents": [
      {
        "docId": "doc_abc123",
        "title": "警察庁 外国免許 FAQ #1",
        "url": "https://www.npa.go.jp/bureau/traffic/license/",
        "status": "success",
        "ingestedAt": "2025-01-06T12:00:05Z"
      }
    ]
  }
}
```

---

### 6. 版本管理

**POST** `/docs/versions/{version}/replace`

用新版本替换旧版本的所有文档。

**请求体**:
```json
{
  "sourceIds": ["gov_npa_driving", "org_jaf_guideline"],
  "dryRun": false
}
```

**响应** (200 OK):
```json
{
  "success": true,
  "operationId": "op_replace_xyz789",
  "replacedCount": 150,
  "message": "Version replacement initiated"
}
```

---

### 7. 文档查询（调试用）

**GET** `/docs`

查询已上传的文档（仅用于调试和验证）。

**查询参数**:
- `sourceId` (string, optional)
- `url` (string, optional)
- `version` (string, optional)
- `page` (number, optional)
- `limit` (number, optional)

**响应** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "docId": "doc_abc123",
      "title": "警察庁 外国免許 FAQ #1",
      "url": "https://www.npa.go.jp/bureau/traffic/license/",
      "version": "2025Q1",
      "lang": "ja",
      "createdAt": "2025-01-06T12:00:05Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150
  }
}
```

---

## 错误码定义

| 错误码 | HTTP 状态码 | 说明 |
|--------|------------|------|
| `UNAUTHORIZED` | 401 | 认证失败 |
| `FORBIDDEN` | 403 | 权限不足 |
| `INVALID_REQUEST` | 400 | 请求参数错误 |
| `INVALID_CONTENT` | 400 | 内容格式错误 |
| `CONTENT_TOO_SHORT` | 400 | 内容过短（< 100 字符） |
| `CONTENT_TOO_LONG` | 400 | 内容过长（> 2000 字符） |
| `DUPLICATE_DOCUMENT` | 409 | 文档已存在（基于 contentHash） |
| `RATE_LIMIT_EXCEEDED` | 429 | 请求频率超限 |
| `INTERNAL_ERROR` | 500 | 服务器内部错误 |
| `SERVICE_UNAVAILABLE` | 503 | 服务暂时不可用 |

---

## 速率限制

- **单文档上传**: 100 次/分钟
- **批量上传**: 10 次/分钟
- **查询操作**: 200 次/分钟

响应头包含速率限制信息：
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704542400
```

---

## 数据去重策略

drivequiz 应该基于以下字段组合进行去重：

1. **主要去重键**: `url` + `contentHash` + `version`
2. **更新策略**: 如果文档已存在，可选择：
   - **跳过**（默认）：不更新已存在的文档
   - **覆盖**：更新已存在的文档（需要显式指定 `replace: true`）

---

## 向量化触发

文档上传后，drivequiz 应该：

1. **自动触发向量化**（推荐）
2. **异步处理**：不阻塞 API 响应
3. **状态追踪**：通过操作记录查询向量化状态

---

## 安全建议

1. **HTTPS 必须**：所有 API 调用必须使用 HTTPS
2. **Token 轮换**：定期轮换 API Token
3. **IP 白名单**（可选）：限制允许调用 API 的 IP 地址
4. **请求签名**（可选）：对敏感操作使用请求签名验证

---

## 示例代码

### cURL 示例

```bash
# 单文档上传
curl -X POST https://your-drivequiz-domain.com/api/v1/rag/docs \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "测试文档",
    "url": "https://example.com",
    "content": "这是测试内容...",
    "version": "2025Q1",
    "lang": "ja"
  }'

# 批量上传
curl -X POST https://your-drivequiz-domain.com/api/v1/rag/docs/batch \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "docs": [
      {
        "title": "文档1",
        "url": "https://example.com/1",
        "content": "内容1...",
        "version": "2025Q1",
        "lang": "ja"
      }
    ]
  }'
```

---

## 版本历史

- **v1.0.0** (2025-01-06): 初始版本

---

## 联系方式

如有问题或建议，请联系 drivequiz 开发团队。

