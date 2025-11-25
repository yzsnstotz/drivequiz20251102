好的 ✅
以下是根据你刚才的讨论（包括 **Datapull 接入、服务端分片旁路机制、无界面自动入库模式** 等最新共识）
重写后的正式版本：

---

# 📋 《DriveQuiz API 产品需求清单 v1.1》

**版本**：v1.1（更新：2025-11-07）
**对接项目**：Datapull 数据采集与入库服务
**系统定位**：RAG（Retrieval-Augmented Generation）知识库的后端接收与向量化引擎

---

## Ⅰ. 📘 总体定位

DriveQuiz API 负责接收 Datapull 产出的标准化分片数据，实现以下核心目标：

| 功能层      | 职责                                      |
| -------- | --------------------------------------- |
| **接收层**  | 接收 Datapull 上传的 JSON 文档分片（含 meta）       |
| **验证层**  | 参数合法性校验、Token 鉴权、重复校验                   |
| **存储层**  | 将文档存入数据库（rag_documents）并建立 operation 记录 |
| **向量化层** | 异步触发 embedding（/v1/admin/rag/ingest）    |
| **查询层**  | 提供操作记录与状态查询接口                           |

DriveQuiz 不再负责文本分片；
若检测到 Datapull 提供的分片元数据（chunkIndex / totalChunks / contentHash），
将自动**旁路自身分片逻辑**（RAG_ENABLE_SERVER_CHUNK=false）。

---

## Ⅱ. ⚙️ 核心接口规范

**Base URL**：`https://your-drivequiz-domain.com/api/v1/rag`
**认证**：`Authorization: Bearer <DRIVEQUIZ_API_TOKEN>`
**数据格式**：`application/json`
**版本号**：`v1`

---

### 1️⃣ 健康检查

**接口**：`GET /health`
**说明**：检查服务状态，用于负载均衡与监控。

**响应**：

```json
{
  "status": "ok",
  "timestamp": "2025-11-07T09:00:00Z",
  "version": "v1.1"
}
```

**验收标准**

* 响应 <100 ms；
* 无需认证；
* 状态与版本字段正确。

---

### 2️⃣ 单文档上传

**接口**：`POST /docs`
**用途**：接收单个 Datapull 分片或旧客户端文档。

**请求体示例**

```json
{
  "title": "警察庁 外国免許 FAQ #1",
  "url": "https://www.npa.go.jp/",
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

**逻辑说明**

* 若检测到 `meta.chunkIndex / totalChunks / contentHash` → 视为 **Datapull 预分片**：

  * 跳过内部分片；
  * 校验去重键（url + contentHash + version）；
  * 直接入库并异步向量化。
* 若缺少分片元数据：

  * 当 `RAG_ENABLE_SERVER_CHUNK=true` → 启用旧分片逻辑；
  * 否则返回 `400 INVALID_REQUEST`。

**成功响应**

```json
{
  "success": true,
  "docId": "doc_abc123",
  "operationId": "op_xyz789"
}
```

**错误响应**

| code                 | 含义          |
| -------------------- | ----------- |
| `UNAUTHORIZED`       | Token 无效或缺失 |
| `CONTENT_TOO_SHORT`  | 内容 <100 字符  |
| `DUPLICATE_DOCUMENT` | 去重键重复       |
| `INVALID_REQUEST`    | 缺少必须字段      |
| `INTERNAL_ERROR`     | 系统异常        |

---

### 3️⃣ 批量上传

**接口**：`POST /docs/batch`
**说明**：批量接收 ≤100 条文档分片。Datapull 默认使用此接口。

**请求示例**

```json
{
  "docs": [ ...100以内... ],
  "sourceId": "gov_npa_driving",
  "batchMetadata": {
    "totalDocs": 24,
    "crawledAt": "2025-11-07T08:55:00Z",
    "crawlerVersion": "1.0.0"
  }
}
```

**响应示例**

```json
{
  "success": true,
  "processed": 24,
  "failed": 0,
  "operationId": "op_batch_9876",
  "results": [
    { "docId": "doc_a1", "status": "success" },
    { "docId": "doc_a2", "status": "success" }
  ]
}
```

**功能要求**

* 并发验证与事务一致性；
* 部分成功时返回 207 Multi-Status；
* 每批返回 operationId；
* 触发异步向量化任务。

---

### 4️⃣ 操作记录查询

**接口**：`GET /operations`
**参数**：`sourceId`、`status`、`page`、`limit`、`startDate`、`endDate`
**说明**：分页查看 Datapull 上传任务的执行结果。

**响应**

```json
{
  "success": true,
  "data": [
    {
      "operationId": "op_batch_9876",
      "sourceId": "gov_npa_driving",
      "status": "success",
      "docsCount": 24,
      "failedCount": 0,
      "createdAt": "2025-11-07T08:55:00Z",
      "completedAt": "2025-11-07T08:57:00Z",
      "metadata": { "version": "2025Q1", "lang": "ja" }
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 1 }
}
```

---

### 5️⃣ 操作详情查询

**接口**：`GET /operations/{operationId}`
**说明**：查看单次批量任务详情（含文档列表与状态统计）。

---

### 6️⃣ 向量化触发（内部）

**接口**：`POST /v1/admin/rag/ingest`
**触发方式**：由上传成功事件自动调用（异步任务）。
**说明**：

* 支持 `docId` 可选；
* 支持 `lang`、`meta`；
* 超时 ≤ 60 s；
* 自动重试 3 次 (指数退避)；
* 记录日志 `ingest.start/completed/failed`。

---

## Ⅲ. 🧠 分片旁路逻辑（v1.1新增）

| 项目   | 规则                                          |
| ---- | ------------------------------------------- |
| 判定条件 | 存在 `chunkIndex`、`totalChunks`、`contentHash` |
| 结果   | 视为 Datapull 预分片，跳过服务端分片                     |
| 环境变量 | `RAG_ENABLE_SERVER_CHUNK`（默认 false）         |
| 日志字段 | `"ingest.prechunk.detected": true`          |
| 去重键  | `url + contentHash + version`               |
| 响应行为 | 已分片数据 → 正常入库；缺少元数据 → 若未开启服务端分片则报错 400       |

---

## Ⅳ. 🗄️ 数据库结构

### 1. rag_documents

* 存储上传文档与元数据
* 唯一约束：`(url, content_hash, version)`
* 向量状态字段：`vectorization_status` (`pending | processing | completed | failed`)

### 2. rag_operations

* 记录批量上传任务（operationId、状态、统计信息）

### 3. rag_operation_documents

* 映射 operation ↔ documents，保存每个文档上传结果及错误。

---

## Ⅴ. 🔐 安全与性能

| 项目         | 要求                               |
| ---------- | -------------------------------- |
| 鉴权         | Bearer Token 或 JWT               |
| HTTPS      | 强制；HTTP 请求拒绝                     |
| Token 生命周期 | 可配置过期与撤销                         |
| 日志脱敏       | 不输出 Token                        |
| 速率限制       | 单文档 100/min；批量 10/min；查询 200/min |
| 响应时间       | 单文档 < 500 ms；批量 (100 文档) < 5 s   |
| 并发支持       | ≥ 10 并发                          |

---

## Ⅵ. 🧪 测试与验收

| 测试项      | 目标                | 验收 |
| -------- | ----------------- | -- |
| 健康检查     | 服务可访问             | ✅  |
| 单文档上传    | 识别 Datapull 分片    | ✅  |
| 批量上传     | 100 文档 < 5 s      | ✅  |
| 去重逻辑     | 相同 contentHash 拒绝 | ✅  |
| 分片旁路     | 含 meta → 不再分片     | ✅  |
| Token 校验 | 无效 Token → 401    | ✅  |
| 性能测试     | 响应时间达标            | ✅  |
| 向量化      | 异步触发 / 重试 3 次     | ✅  |

---

## Ⅶ. 🧩 系统边界与联动

| 模块                | 职责                                        | 触发 |
| ----------------- | ----------------------------------------- | -- |
| **Datapull**      | 抓取 → 提取 → 清洗 → 分片 → 上传                    | 主动 |
| **DriveQuiz API** | 验证 → 存储 → 向量化 → 记录                        | 被动 |
| **交互协议**          | HTTPS + Bearer Token                      | —  |
| **调用路径**          | Datapull → DriveQuiz (`/docs` / `/batch`) | 单向 |

---

## Ⅷ. 🧭 扩展规划（后续版本）

| 功能        | 描述                        | 优先级 |
| --------- | ------------------------- | --- |
| Web 控制台   | Datapull 源配置与上传任务监控       | P2  |
| 向量化监控页    | 后台展示 pending/completed 数量 | P2  |
| 版本替换接口    | 替换旧版本文档                   | P3  |
| 异步队列分布式执行 | RabbitMQ 或 BullMQ         | P3  |

---

## Ⅸ. 📄 交付清单

| 类别    | 文件 / 模块            | 验收标准   |
| ----- | ------------------ | ------ |
| API   | `/api/v1/rag/*`    | 全部测试通过 |
| 数据库   | 3 张 RAG 表结构        | 创建成功   |
| Token | JWT 验证与轮换机制        | 可用     |
| 向量化   | 异步任务 + 重试机制        | 稳定     |
| 日志    | 结构化 JSON 输出 + 脱敏   | 合格     |
| 文档    | 本文件 + OpenAPI Spec | 齐备     |

---

### ✅ 总结

DriveQuiz API 在 v1.1 后成为一个**纯粹的接收与知识入库层**：

> Datapull 负责分片与上传；DriveQuiz 负责校验、存储、向量化与检索。
> 已分片数据将被自动识别并旁路服务端分片逻辑，
> 确保系统一致性、高性能与可追踪性。
