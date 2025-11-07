# DriveQuiz API v1.1

DriveQuiz API v1.1 是作为 **Datapull → DriveQuiz** 的知识入库接口层，负责接收 Datapull 产出的标准化分片数据，实现数据验证、存储、向量化与操作记录。

## 功能特性

- ✅ 接收 Datapull 预分片文档
- ✅ 自动识别 Datapull 分片并旁路服务端分片逻辑
- ✅ 单文档和批量文档上传（最多100条）
- ✅ 完整的操作记录与查询接口
- ✅ 异步向量化任务触发
- ✅ 速率限制与认证保护
- ✅ 结构化日志输出

## 快速开始

### 1. 安装依赖

```bash
cd apps/drivequiz-api
npm install
```

### 2. 配置环境变量

创建 `.env` 文件（参考 `.env.example`）：

```bash
# 数据库连接
DRIVEQUIZ_DB_URL=postgresql://user:pass@host:5432/drivequiz

# 认证密钥
DRIVEQUIZ_API_TOKEN_SECRET=your-secret-token

# 向量化服务地址
AI_VECTORIZE_URL=https://ai.drivequiz.com/v1/admin/rag/ingest

# 其他配置
RAG_ENABLE_SERVER_CHUNK=false
MAX_BATCH_SIZE=100
LOG_LEVEL=info
PORT=8789
```

### 3. 执行数据库迁移

```bash
npm run db:migrate
```

### 4. 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm run build
npm start
```

## API 接口

### Base URL

```
https://your-drivequiz-domain.com/api/v1/rag
```

### 认证

所有接口（除健康检查外）都需要 Bearer Token 认证：

```
Authorization: Bearer <DRIVEQUIZ_API_TOKEN>
```

### 接口列表

#### 1. 健康检查

```http
GET /api/v1/rag/health
```

**响应：**
```json
{
  "status": "ok",
  "timestamp": "2025-11-07T09:00:00Z",
  "version": "v1.1"
}
```

#### 2. 单文档上传

```http
POST /api/v1/rag/docs
Content-Type: application/json
Authorization: Bearer <token>
```

**请求体：**
```json
{
  "title": "文档标题",
  "url": "https://example.com/doc",
  "content": "文档内容（100-2000字符）",
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

**响应：**
```json
{
  "success": true,
  "data": {
    "docId": "doc_abc123",
    "operationId": "op_xyz789"
  }
}
```

#### 3. 批量上传

```http
POST /api/v1/rag/docs/batch
Content-Type: application/json
Authorization: Bearer <token>
```

**请求体：**
```json
{
  "docs": [
    {
      "title": "文档1",
      "url": "https://example.com/doc1",
      "content": "内容1",
      "version": "2025Q1",
      "lang": "ja",
      "meta": {
        "sourceId": "gov_npa_driving",
        "chunkIndex": 1,
        "totalChunks": 3,
        "contentHash": "sha256:abc123..."
      }
    }
  ],
  "sourceId": "gov_npa_driving",
  "batchMetadata": {
    "totalDocs": 24,
    "crawledAt": "2025-11-07T08:55:00Z",
    "crawlerVersion": "1.0.0"
  }
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "processed": 24,
    "failed": 0,
    "operationId": "op_batch_20251107",
    "results": [
      {
        "docId": "doc_a1",
        "status": "success"
      }
    ]
  }
}
```

#### 4. 查询操作记录

```http
GET /api/v1/rag/operations?sourceId=gov_npa_driving&page=1&limit=20
Authorization: Bearer <token>
```

**响应：**
```json
{
  "success": true,
  "data": [
    {
      "operationId": "op_batch_20251107",
      "sourceId": "gov_npa_driving",
      "status": "success",
      "docsCount": 24,
      "failedCount": 0,
      "createdAt": "2025-11-07T08:55:00Z",
      "completedAt": "2025-11-07T08:57:00Z",
      "metadata": {
        "version": "2025Q1",
        "lang": "ja"
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

#### 5. 查询操作详情

```http
GET /api/v1/rag/operations/{operationId}
Authorization: Bearer <token>
```

## 分片旁路机制

DriveQuiz API v1.1 支持自动识别 Datapull 预分片文档：

- **检测条件**：存在 `meta.chunkIndex`、`meta.totalChunks`、`meta.contentHash`
- **行为**：自动旁路服务端分片逻辑
- **环境变量**：`RAG_ENABLE_SERVER_CHUNK=false`（默认关闭）
- **日志标记**：`"ingest.prechunk.detected": true`

## 错误码

| 错误码 | HTTP 状态码 | 说明 |
|--------|------------|------|
| `UNAUTHORIZED` | 401 | Token 无效或缺失 |
| `INVALID_REQUEST` | 400 | 参数错误 |
| `CONTENT_TOO_SHORT` | 400 | 内容长度不足 |
| `DUPLICATE_DOCUMENT` | 409 | 文档重复（contentHash） |
| `RATE_LIMIT_EXCEEDED` | 429 | 速率限制超出 |
| `INTERNAL_ERROR` | 500 | 服务器错误 |

## ⚠️ 重要限制说明

**为避免过度调用导致问题，请务必了解以下限制：**

### API 调用频率限制
- **默认限制**：100 请求/分钟
- **可配置**：通过 `RATE_LIMIT_DOCS` 环境变量调整
- **超出限制**：返回 `429 RATE_LIMIT_EXCEEDED` 错误

### 批量上传限制
- **最大批次大小**：100 条文档/批次
- **并发处理数**：10 个文档同时处理
- **可配置**：通过 `MAX_BATCH_SIZE` 环境变量调整批次大小

### 请求体大小限制
- **最大请求体**：10MB
- **建议**：单批次总大小控制在 5-8MB 以内

### 文档内容限制
- **内容长度**：100-2000 字符
- **超出限制**：返回 `400 CONTENT_TOO_SHORT` 错误

### Local AI Service Embedding 限制
- **输入长度限制**：3000 字符（自动截断）
- **建议**：确保分片内容不超过 3000 字符

**📖 详细限制说明请查看：[限制与约束文档](./LIMITS_AND_CONSTRAINTS.md)**

## 开发

### 项目结构

```
apps/drivequiz-api/
├── src/
│   ├── types/          # 类型定义
│   ├── routes/         # API 路由
│   ├── services/       # 业务逻辑
│   ├── utils/          # 工具函数
│   ├── lib/            # 数据库配置
│   └── index.ts        # 入口文件
├── migrations/         # 数据库迁移
├── scripts/            # 脚本工具
└── package.json
```

### 测试

```bash
# 类型检查
npm run type-check

# 运行测试（待实现）
npm test
```

## 部署

### 环境变量

确保在生产环境中设置以下环境变量：

**必需配置：**
- `DRIVEQUIZ_DB_URL` - 数据库连接字符串
- `DRIVEQUIZ_API_TOKEN_SECRET` - API 认证密钥
- `AI_VECTORIZE_URL` - 向量化服务地址

**可选配置：**
- `RAG_ENABLE_SERVER_CHUNK` - 是否启用服务端分片（默认 false）
- `RATE_LIMIT_DOCS` - 每分钟最大请求数（默认 100）
- `RATE_LIMIT_WINDOW` - 速率限制时间窗口，毫秒（默认 60000）
- `MAX_BATCH_SIZE` - 批量上传最大批次大小（默认 100）
- `LOG_LEVEL` - 日志级别（默认 info）
- `PORT` - 服务端口（默认 8789）

### 数据库迁移

部署前执行数据库迁移：

```bash
npm run db:migrate
```

## 许可证

私有项目

