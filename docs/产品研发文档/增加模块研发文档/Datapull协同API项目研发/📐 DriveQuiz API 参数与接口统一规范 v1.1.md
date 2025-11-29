非常好 ✅
以下是基于《📋 DriveQuiz API 产品需求清单 v1.1》和《🛠️ DriveQuiz API 研发规范 v1.1》
重新整理的正式研发配套文档：

---

# 📐 《DriveQuiz API 参数与接口统一规范 v1.1》

**版本**：v1.1
**发布日期**：2025-11-07
**适用范围**：DriveQuiz API 全栈研发团队
**配套文档**：《🛠️ DriveQuiz API 研发规范 v1.1》 + 《📋 DriveQuiz API 产品需求清单 v1.1》

---

## Ⅰ. 🎯 文档目的

统一 DriveQuiz API 所有核心模块的参数命名、类型结构与接口对齐规则，
确保 Datapull 上传数据与 DriveQuiz 存储、日志、向量化等环节的一致性与可追踪性。

---

## Ⅱ. 📁 文件结构

```
apps/
 └── drivequiz-api/
      ├── src/
      │    ├── types/
      │    │    ├── common.ts
      │    │    ├── document.ts
      │    │    ├── operation.ts
      │    │    └── vector.ts
      │    ├── routes/
      │    │    ├── docs.ts
      │    │    ├── docs-batch.ts
      │    │    └── operations.ts
      │    ├── services/
      │    │    ├── vectorizer.ts
      │    │    └── operation-logger.ts
      │    └── utils/
      │         ├── validator.ts
      │         ├── hasher.ts
      │         └── logger.ts
      ├── .env.example
      └── docs/
           └── drivequiz-api-parameter-spec-v1.1.md  ← 当前文档
```

---

## Ⅲ. 🧩 命名规则

| 分类    | 命名方式             | 示例                               |
| ----- | ---------------- | -------------------------------- |
| 文件名   | kebab-case       | `docs-batch.ts`                  |
| 类型/接口 | PascalCase       | `DocumentInput`, `IngestResult`  |
| 函数/变量 | camelCase        | `uploadBatch`, `createOperation` |
| 常量    | UPPER_SNAKE_CASE | `MAX_BATCH_SIZE`                 |
| 数据字段  | camelCase        | `operationId`, `contentHash`     |

---

## Ⅳ. 🧱 类型定义

### 1️⃣ 通用类型（common.ts）

```ts
/** 通用状态枚举 */
export type Status = "pending" | "processing" | "success" | "failed";

/** 时间戳（ISO8601） */
export type ISODate = string;

/** 支持语言 */
export type LangCode = "ja" | "zh" | "en";
```

---

### 2️⃣ 文档类型定义（document.ts）

```ts
/** Datapull 上传的单片文档 */
export interface DocumentInput {
  title: string;
  url: string;
  content: string;
  version: string;
  lang: LangCode;
  meta: {
    sourceId: string;
    type?: "official" | "organization" | "education";
    chunkIndex?: number;
    totalChunks?: number;
    contentHash?: string;
  };
}

/** 存储后的文档结构 */
export interface DocumentRecord {
  docId: string;
  title: string;
  url: string;
  content: string;
  version: string;
  lang: LangCode;
  contentHash: string;
  sourceId: string;
  vectorizationStatus: Status;
  createdAt: ISODate;
  updatedAt: ISODate;
}
```

---

### 3️⃣ 批量入库类型定义（operation.ts）

```ts
/** 批量上传请求 */
export interface BatchUploadRequest {
  docs: DocumentInput[];
  sourceId: string;
  batchMetadata?: {
    totalDocs: number;
    crawledAt: ISODate;
    crawlerVersion: string;
  };
}

/** 批量处理结果 */
export interface IngestResult {
  success: boolean;
  processed: number;
  failed: number;
  operationId: string;
  results: {
    docId?: string;
    index?: number;
    status: "success" | "failed";
    error?: { code: string; message: string };
  }[];
}

/** 操作记录 */
export interface OperationRecord {
  operationId: string;
  sourceId: string;
  status: Status;
  docsCount: number;
  failedCount: number;
  createdAt: ISODate;
  completedAt?: ISODate;
  metadata: {
    version: string;
    lang: LangCode;
    crawlerVersion?: string;
  };
}
```

---

### 4️⃣ 向量化任务类型（vector.ts）

```ts
/** 向量化任务请求 */
export interface VectorizeTask {
  docId: string;
  content: string;
  lang: LangCode;
  meta: {
    sourceId: string;
    contentHash: string;
  };
}

/** 向量化任务结果 */
export interface VectorizeResult {
  docId: string;
  status: "completed" | "failed";
  vectorId?: string;
  durationMs: number;
}
```

---

## Ⅴ. ⚙️ 接口参数映射表

| DriveQuiz 字段                   | 来自 Datapull   | 说明                |
| ------------------------------ | ------------- | ----------------- |
| `title`                        | `title`       | 文档标题              |
| `url`                          | `url`         | 原文链接              |
| `content`                      | `content`     | 文档内容（100–2000 字）  |
| `version`                      | `version`     | 数据版本号（如 `2025Q1`） |
| `lang`                         | `lang`        | 语言代码              |
| `meta.sourceId`                | `sourceId`    | 数据来源 ID           |
| `meta.type`                    | `type`        | 文档类型              |
| `meta.chunkIndex`              | `chunkIndex`  | 分片序号              |
| `meta.totalChunks`             | `totalChunks` | 分片总数              |
| `meta.contentHash`             | `contentHash` | SHA256 哈希         |
| `batchMetadata.totalDocs`      | —             | 批次文档总数            |
| `batchMetadata.crawledAt`      | —             | Datapull 抓取时间     |
| `batchMetadata.crawlerVersion` | —             | Datapull 版本号      |

---

## Ⅵ. ☁️ API 规范与返回结构

### 1️⃣ `POST /api/v1/rag/docs`

| 字段               | 类型     | 是否必填 | 说明                  |   |      |
| ---------------- | ------ | ---- | ------------------- | - | ---- |
| title            | string | ✅    | 文档标题                |   |      |
| url              | string | ✅    | 文档原始地址              |   |      |
| content          | string | ✅    | 文本内容                |   |      |
| version          | string | ✅    | 数据版本（如 `2025Q1`）    |   |      |
| lang             | "ja"   | "zh" | "en"                | ✅ | 语言代码 |
| meta.sourceId    | string | ✅    | 来源标识                |   |      |
| meta.contentHash | string | ✅    | 内容哈希（Datapull 自动生成） |   |      |
| meta.chunkIndex  | number | ✅    | 分片索引                |   |      |
| meta.totalChunks | number | ✅    | 总分片数                |   |      |
| meta.type        | string | ❌    | 文档类型                |   |      |
| operationId      | string | 自动生成 | 系统操作标识              |   |      |

**响应**

```json
{
  "success": true,
  "docId": "doc_abc123",
  "operationId": "op_xyz456"
}
```

---

### 2️⃣ `POST /api/v1/rag/docs/batch`

| 字段                           | 类型              | 是否必填 | 说明           |
| ---------------------------- | --------------- | ---- | ------------ |
| docs                         | DocumentInput[] | ✅    | 文档数组（≤100）   |
| sourceId                     | string          | ✅    | 来源 ID        |
| batchMetadata.totalDocs      | number          | ✅    | 批次数量         |
| batchMetadata.crawledAt      | string          | ✅    | 抓取时间         |
| batchMetadata.crawlerVersion | string          | ✅    | Datapull 版本号 |

**响应**

```json
{
  "success": true,
  "processed": 24,
  "failed": 1,
  "operationId": "op_batch_20251107",
  "results": [
    { "docId": "doc_a1", "status": "success" },
    { "index": 5, "status": "failed", "error": { "code": "INVALID_CONTENT", "message": "Too short" } }
  ]
}
```

---

### 3️⃣ `GET /api/v1/rag/operations`

**查询参数**

| 参数        | 类型     | 必填 | 说明          |
| --------- | ------ | -- | ----------- |
| sourceId  | string | ❌  | 过滤来源        |
| status    | string | ❌  | 过滤状态        |
| startDate | string | ❌  | 起始日期        |
| endDate   | string | ❌  | 结束日期        |
| page      | number | ❌  | 页码（默认 1）    |
| limit     | number | ❌  | 每页数量（默认 20） |

**响应**

```json
{
  "success": true,
  "data": [ { "operationId": "...", "status": "success" } ],
  "pagination": { "page": 1, "limit": 20, "total": 1 }
}
```

---

### 4️⃣ `GET /api/v1/rag/operations/{operationId}`

**响应**

```json
{
  "success": true,
  "data": {
    "operationId": "op_123",
    "status": "success",
    "docsCount": 15,
    "failedCount": 0,
    "documents": [ { "docId": "doc_1", "url": "...", "status": "success" } ]
  }
}
```

---

## Ⅶ. 🧠 分片识别与旁路参数规则

| 参数                                  | 说明                 | 必填       | 备注          |
| ----------------------------------- | ------------------ | -------- | ----------- |
| `meta.chunkIndex`                   | Datapull 分片序号      | ✅        | ≥1          |
| `meta.totalChunks`                  | 分片总数               | ✅        | ≥chunkIndex |
| `meta.contentHash`                  | 分片哈希               | ✅        | 唯一标识        |
| 环境变量 `RAG_ENABLE_SERVER_CHUNK`      | 控制是否启用服务端分片        | 默认 false | 仅旧客户端兼容     |
| 响应日志字段 `"ingest.prechunk.detected"` | 标记 Datapull 分片识别结果 | 自动写入日志   | 仅服务端        |

---

## Ⅷ. 💾 数据库存储映射

| API 字段              | 数据库字段                | 表名             | 类型            |
| ------------------- | -------------------- | -------------- | ------------- |
| title               | title                | rag_documents  | VARCHAR(500)  |
| url                 | url                  | rag_documents  | VARCHAR(1000) |
| content             | content              | rag_documents  | TEXT          |
| contentHash         | content_hash         | rag_documents  | VARCHAR(64)   |
| version             | version              | rag_documents  | VARCHAR(50)   |
| lang                | lang                 | rag_documents  | VARCHAR(10)   |
| sourceId            | source_id            | rag_documents  | VARCHAR(100)  |
| meta.type           | doc_type             | rag_documents  | VARCHAR(50)   |
| vectorizationStatus | vectorization_status | rag_documents  | VARCHAR(50)   |
| operationId         | id                   | rag_operations | VARCHAR(255)  |
| docsCount           | docs_count           | rag_operations | INT           |
| failedCount         | failed_count         | rag_operations | INT           |
| metadata            | metadata             | rag_operations | JSONB         |

---

## Ⅸ. 🧾 错误码与返回格式

**统一结构**

```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Missing required field: content",
    "details": { "field": "content" }
  }
}
```

**错误码表**

| code                | HTTP | 含义                |
| ------------------- | ---- | ----------------- |
| UNAUTHORIZED        | 401  | Token 无效或缺失       |
| INVALID_REQUEST     | 400  | 参数错误              |
| CONTENT_TOO_SHORT   | 400  | 内容长度不足            |
| DUPLICATE_DOCUMENT  | 409  | 文档重复（contentHash） |
| RATE_LIMIT_EXCEEDED | 429  | 速率限制超出            |
| INTERNAL_ERROR      | 500  | 服务器错误             |

---

## Ⅹ. 🔐 环境变量参数表（.env.example）

```bash
# === Database ===
DRIVEQUIZ_DB_URL=postgresql://user:pass@host:5432/drivequiz
SUPABASE_URL=https://example.supabase.co
SUPABASE_SERVICE_KEY=service_key_here

# === Authentication ===
DRIVEQUIZ_API_TOKEN_SECRET=supersecretjwt
TOKEN_EXPIRATION_HOURS=72

# === RAG Configuration ===
RAG_ENABLE_SERVER_CHUNK=false
AI_VECTORIZE_URL=https://ai.drivequiz.com/v1/admin/rag/ingest
MAX_BATCH_SIZE=100

# === Logging ===
LOG_LEVEL=info
LOG_PATH=./logs/drivequiz.log

# === Rate Limiting ===
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_DOCS=100
RATE_LIMIT_BATCH=10
```

---

## Ⅺ. ✅ 验收清单（接口匹配验证）

| 模块            | 测试内容    | 验收标准                           |
| ------------- | ------- | ------------------------------ |
| docs.ts       | 单文档上传   | 返回 `docId` 与 `operationId`     |
| docs-batch.ts | 批量上传    | 返回 processed 数量                |
| operations.ts | 查询操作记录  | 返回分页结果                         |
| validator.ts  | 缺字段测试   | 返回 400 错误码                     |
| vectorizer.ts | 向量化任务   | 触发成功率 ≥ 95%                    |
| 去重逻辑          | 重复上传    | 返回 409                         |
| 分片识别          | meta 正确 | 日志 `"prechunk.detected": true` |

---

## Ⅻ. 🧭 版本与维护

| 项目   | 内容                           |
| ---- | ---------------------------- |
| 当前版本 | v1.1.0                       |
| 上一版本 | v1.0.0                       |
| 变更摘要 | 删除服务端分片逻辑，新增 Datapull 分片识别规则 |
| 维护周期 | 每季度评审一次                      |
| 仓库路径 | `/apps/drivequiz-api/`       |

---

## ✅ 最终总结

DriveQuiz API v1.1 的参数与接口规范确立以下标准：

> * **统一接口结构**：与 Datapull 参数一一对应。
> * **分片旁路识别**：通过 meta 元数据自动判定是否已分片。
> * **严格字段校验**：长度、语言、版本、来源 ID 均需合法。
> * **一致的响应格式**：所有接口均使用 `{ success, error?, data? }`。
> * **可扩展的 Schema**：JSONB 元字段允许未来多语言扩展与文档分类。

---

是否希望我接着输出配套的《✅ DriveQuiz 三位一体工作核对清单（接口 × 数据库 × 服务）》？
它会列出每个接口的开发任务、数据库依赖和对应服务文件，以便直接交付给 Cursor 测试。
