好的 ✅
以下是基于《📋 DriveQuiz API 产品需求清单 v1.1》重构的正式研发规范文档：

---

# 🛠️ 《DriveQuiz API 研发规范 v1.1》

**版本**：v1.1
**发布日期**：2025-11-07
**依据文档**：《📋 DriveQuiz API 产品需求清单 v1.1》
**配套文档**：《📐 参数与接口统一规范》《✅ 工作核对清单》《🧾 进度同步模板》

---

## Ⅰ. 🎯 研发目标

实现一个可扩展、可审计的 RAG 数据接收与知识入库服务，使 Datapull 系统能够高效、安全地将预分片文档上传至 DriveQuiz 知识库，并自动触发向量化任务。

DriveQuiz 不再负责分片逻辑，仅负责数据验证、存储、向量化与操作记录。

---

## Ⅱ. 🧩 系统架构

### 1️⃣ 架构层次

```
Datapull（供给层）
 └─> HTTPS 调用
DriveQuiz API（接收层）
 ├─ Validation & Auth
 ├─ Ingestion & Deduplication
 ├─ Operation Logging
 ├─ Vectorization Service
 └─ Query Interfaces
```

### 2️⃣ 模块划分

| 模块                 | 主要职责                 | 对应目录                          |
| ------------------ | -------------------- | ----------------------------- |
| **Auth**           | Bearer Token 验证 / 限流 | `/src/middlewares/auth.ts`    |
| **Validation**     | 参数验证 / 长度 / 语言检查     | `/src/utils/validator.ts`     |
| **Ingestion**      | 接收 Datapull 上传并入库    | `/src/routes/docs.ts`         |
| **BatchIngestion** | 批量上传 / 事务控制 / 并发优化   | `/src/routes/docs-batch.ts`   |
| **Operations**     | 上传记录与查询              | `/src/routes/operations.ts`   |
| **Vectorizer**     | 异步触发向量化任务            | `/src/services/vectorizer.ts` |
| **Logger**         | 结构化日志与审计             | `/src/utils/logger.ts`        |

---

## Ⅲ. ⚙️ 模块研发规范

### 1️⃣ Auth 模块

**功能**：验证所有上传请求的合法性。
**规则**：

* 默认启用 JWT Bearer Token。
* 允许后端轮换密钥（Redis 缓存校验）。
* 无 Token 或过期 → 返回 401。

**代码示例**

```ts
export function ensureAuth(req, reply) {
  const token = readBearerToken(req);
  if (!verifyToken(token)) {
    return reply.code(401).send({ success: false, error: { code: "UNAUTHORIZED", message: "Invalid token" } });
  }
}
```

---

### 2️⃣ Validation 模块

**文件**：`src/utils/validator.ts`
**目的**：保证请求格式与内容合法。
**要点**：

* content 长度 100–2000 字符；
* version、lang、meta 均必填；
* 对 Datapull 上传内容的 `meta.chunkIndex`、`meta.totalChunks`、`meta.contentHash` 进行一致性校验；
* 统一错误返回结构：

```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Missing field: content",
    "details": { "field": "content" }
  }
}
```

---

### 3️⃣ Ingestion 模块

**文件**：`src/routes/docs.ts`
**功能**：接收单文档上传。

**规范**：

1. 读取并验证 Token；
2. 校验参数；
3. **判断是否为 Datapull 预分片：**

   ```ts
   const preChunked = meta?.chunkIndex && meta?.totalChunks && meta?.contentHash;
   ```
4. 若 `preChunked=true` → 跳过服务器分片；
5. 去重校验（url + contentHash + version）；
6. 入库 + 生成 `operationId`；
7. 异步调用 Vectorizer 服务；
8. 返回 `{ success: true, docId, operationId }`。

**日志规范**

```json
{
  "event": "ingest.success",
  "sourceId": "gov_npa_driving",
  "operationId": "op_123",
  "preChunked": true
}
```

---

### 4️⃣ Batch Ingestion 模块

**文件**：`src/routes/docs-batch.ts`
**功能**：批量上传接口 `/docs/batch`。

**规范要点**：

* 每次处理 ≤ 100 文档；
* 事务包裹（成功即提交）；
* 支持部分成功（207 Multi-Status）；
* 生成批量 `operationId`；
* 并行校验与入库（p-limit 10）；
* 向量化任务异步触发；
* 写入 rag_operations、rag_operation_documents。

**返回格式**

```json
{
  "success": true,
  "processed": 24,
  "failed": 1,
  "operationId": "op_batch_20251107",
  "results": [...]
}
```

---

### 5️⃣ Operation 模块

**文件**：`src/routes/operations.ts`
**功能**：提供操作记录查询与详情页接口。

**规范要点**：

* 分页查询；
* 支持按 `sourceId/status/date` 过滤；
* 响应含分页结构；
* 对应数据库表：`rag_operations`。

---

### 6️⃣ Vectorizer 模块

**文件**：`src/services/vectorizer.ts`
**功能**：异步调用 embedding 服务。
**规范要点**：

* 使用任务队列（如 BullMQ / Node worker_threads）；
* 重试机制：指数退避 3 次；
* 任务状态：

  * `pending` → `processing` → `completed` / `failed`
* 对应字段：`vectorization_status`
* 记录日志：

  ```json
  { "event": "vectorize.start", "docId": "doc_123" }
  ```

---

### 7️⃣ Logger 模块

**文件**：`src/utils/logger.ts`
**规范要点**：

* 使用 `pino` 或 `winston`；
* 输出 JSON；
* 统一字段：

  ```
  timestamp, level, event, sourceId, operationId, duration, preChunked
  ```
* 禁止输出 Token。

---

## Ⅳ. 🧱 数据库与 Schema 规范

| 表名                        | 功能         | 唯一键                      | 状态字段                 |
| ------------------------- | ---------- | ------------------------ | -------------------- |
| `rag_documents`           | 存储上传文档与元数据 | url+content_hash+version | vectorization_status |
| `rag_operations`          | 记录批量操作任务   | id                       | status               |
| `rag_operation_documents` | 记录操作文档结果   | id                       | status               |

**规范要求**

* 所有表使用 `created_at`、`updated_at` 时间戳；
* 事务使用 `BEGIN/COMMIT/ROLLBACK`；
* 外键级联删除；
* 去重策略：`ON CONFLICT DO NOTHING`。

---

## Ⅴ. 🔄 分片旁路逻辑规范

| 逻辑项  | 规则                                                         |
| ---- | ---------------------------------------------------------- |
| 检测条件 | 存在 `meta.chunkIndex`、`meta.totalChunks`、`meta.contentHash` |
| 行为   | 跳过服务端分片逻辑                                                  |
| 环境变量 | `RAG_ENABLE_SERVER_CHUNK=false`（默认关闭）                      |
| 兼容模式 | 若开启且缺失 meta → 执行服务端分片                                      |
| 日志字段 | `"ingest.prechunk.detected": true`                         |
| 去重键  | `url + contentHash + version`                              |

**伪代码**

```ts
if (isPreChunked(meta)) {
  skipServerChunk();
} else if (process.env.RAG_ENABLE_SERVER_CHUNK === 'true') {
  serverSideChunk(content);
} else {
  return 400;
}
```

---

## Ⅵ. 🔐 安全规范

1. **通信协议**：仅允许 HTTPS；拒绝 HTTP。
2. **鉴权方式**：Bearer Token（JWT 格式）。
3. **日志脱敏**：不得输出 Token 或用户标识。
4. **速率限制**：

   * `/docs`：100 次 / 分钟
   * `/docs/batch`：10 次 / 分钟
   * `/operations`：200 次 / 分钟
5. **异常处理**：统一结构：

   ```json
   {
     "success": false,
     "error": { "code": "INTERNAL_ERROR", "message": "Unexpected failure" }
   }
   ```

---

## Ⅶ. 🧪 测试规范

| 测试项   | 工具              | 验收标准      |
| ----- | --------------- | --------- |
| 单元测试  | Vitest / Jest   | 覆盖率 ≥ 85% |
| 集成测试  | Supertest       | 全流程通过     |
| 压力测试  | k6 / autocannon | 100 并发正常  |
| 安全测试  | OWASP / zap-cli | 无高危漏洞     |
| 性能指标  | < 500 ms / 单请求  | ✅         |
| 向量化任务 | 自动触发 / 重试成功     | ✅         |

---

## Ⅷ. 🧮 日志与监控

| 类型   | 工具                   | 内容                                 |
| ---- | -------------------- | ---------------------------------- |
| 应用日志 | winston              | event / sourceId / opId / duration |
| 错误日志 | stderr + Sentry      | 追踪堆栈                               |
| 操作日志 | rag_operations       | 全量保存                               |
| 监控指标 | Prometheus + Grafana | QPS / Latency / Error Rate         |

---

## Ⅸ. 🧾 部署与环境变量

| 变量名                          | 说明                  |
| ---------------------------- | ------------------- |
| `RAG_ENABLE_SERVER_CHUNK`    | 是否启用服务端分片（默认 false） |
| `AI_VECTORIZE_URL`           | 向量化服务地址             |
| `DRIVEQUIZ_DB_URL`           | 数据库连接字符串            |
| `DRIVEQUIZ_API_TOKEN_SECRET` | JWT 验证密钥            |
| `LOG_LEVEL`                  | 日志级别                |
| `RATE_LIMIT_WINDOW`          | 限流时间窗口              |

---

## Ⅹ. ✅ 验收标准

| 模块            | 验收指标                  |
| ------------- | --------------------- |
| Ingestion     | 100 文档上传成功率 ≥ 99%     |
| Validation    | 参数错误响应正确率 100%        |
| Vectorizer    | 异步触发成功率 ≥ 95%         |
| Logging       | 所有 operation 均生成记录    |
| Deduplication | 相同 contentHash 无重复入库  |
| 性能            | 单文档 ≤ 500 ms，批量 ≤ 5 s |
| 安全            | HTTPS + JWT 全通过渗透测试   |

---

## Ⅺ. 🧭 版本策略

| 项目     | 内容                           |
| ------ | ---------------------------- |
| 版本标识   | `v1.major.minor`             |
| 当前版本   | `v1.1.0`                     |
| 更新频率   | 每季度评审                        |
| 发布分支   | `release/drivequiz-api-v1.1` |
| 代码仓库结构 | `/apps/drivequiz-api`        |

---

## Ⅻ. 👥 团队职责

| 角色             | 职责               |
| -------------- | ---------------- |
| PM / Tech Lead | 架构与标准制定（ChatGPT） |
| Backend Lead   | API 与数据库开发       |
| Ops            | 部署与监控配置          |
| QA             | 测试用例编写与自动化       |
| AI Service     | 向量化与模型适配         |

---

## ✅ 总结

DriveQuiz API v1.1 研发规范确立了以下关键原则：

> 🔹 **边界清晰**：不再自行分片；识别 Datapull 分片自动旁路。
> 🔹 **结构统一**：请求、响应、日志、错误结构全一致。
> 🔹 **安全可靠**：HTTPS、Token、限流全覆盖。
> 🔹 **可扩展可观测**：标准日志 + operation 记录。

系统将作为 **RAG 数据接收与知识入库的核心服务层**，为 DriveQuiz 的 AI 检索和多语言知识库提供长期稳定支撑。
