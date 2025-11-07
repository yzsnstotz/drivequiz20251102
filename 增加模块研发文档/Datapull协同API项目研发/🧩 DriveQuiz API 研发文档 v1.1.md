非常好 ✅
以下是正式可交付给 Cursor 或 O1 的开发执行文件：

---

# 🧩 《DriveQuiz API 研发文档 v1.1》

**版本**：v1.1
**发布日期**：2025-11-07
**依据文档**：《📋 DriveQuiz API 产品需求清单 v1.1》 + 《🛠️ DriveQuiz API 研发规范 v1.1》 + 《📐 DriveQuiz API 参数与接口统一规范 v1.1》 + 《✅ DriveQuiz 三位一体工作核对清单 v1.1》

---

## 一、🎯 本次研发目标

构建并交付 **DriveQuiz API v1.1**，作为 **Datapull → DriveQuiz** 的知识入库接口层。

核心目标：

1. 实现所有 RAG 数据上传、校验、入库与向量化 API；
2. 移除旧的服务端分片逻辑，新增 Datapull 分片自动识别与旁路机制；
3. 实现完整的操作记录、向量化任务、日志与速率限制；
4. 完成数据库表结构迁移与索引；
5. 输出统一测试与验收规范。

---

## 二、🧱 系统结构与任务拆解

### 1️⃣ 路由模块（API 层）

| 文件路径                        | 功能说明                   | 状态 |
| --------------------------- | ---------------------- | -- |
| `/src/routes/health.ts`     | 健康检查接口，返回 API 状态与版本    | ☐  |
| `/src/routes/docs.ts`       | 单文档上传接口，识别 Datapull 分片 | ☐  |
| `/src/routes/docs-batch.ts` | 批量上传接口（≤100文档）         | ☐  |
| `/src/routes/operations.ts` | 操作记录与详情查询接口            | ☐  |

### 2️⃣ 服务模块（核心逻辑）

| 文件路径                                | 功能              | 状态 |
| ----------------------------------- | --------------- | -- |
| `/src/services/operation-logger.ts` | 创建与更新操作记录（单/批量） | ☐  |
| `/src/services/vectorizer.ts`       | 异步向量化触发、重试、状态回写 | ☐  |
| `/src/utils/validator.ts`           | 参数校验、旁路判定、错误格式化 | ☐  |
| `/src/utils/auth.ts`                | JWT 鉴权与限流       | ☐  |
| `/src/utils/logger.ts`              | 结构化日志输出         | ☐  |
| `/src/utils/hasher.ts`              | 内容哈希（SHA256）    | ☐  |

### 3️⃣ 数据库模块

| 文件路径                                           | 功能                           | 状态 |
| ---------------------------------------------- | ---------------------------- | -- |
| `/migrations/2025_rag_documents.sql`           | 创建 rag_documents 表           | ☐  |
| `/migrations/2025_rag_operations.sql`          | 创建 rag_operations 表          | ☐  |
| `/migrations/2025_rag_operation_documents.sql` | 创建 rag_operation_documents 表 | ☐  |

---

## 三、🧩 功能研发明细

### 1️⃣ `/api/v1/rag/health`

* 返回 `{status:"ok", version:"v1.1", timestamp:ISODate}`
* 无需认证，响应时间 < 100ms

---

### 2️⃣ `/api/v1/rag/docs`

* 功能：单文档上传（Datapull 分片识别）
* 参数：

  * 必填：`title, url, content, version, lang, meta.sourceId`
  * 分片元数据：`meta.chunkIndex, meta.totalChunks, meta.contentHash`
* 逻辑：

  1. 校验字段；
  2. 判断是否为预分片：

     ```ts
     const isPreChunked = meta.chunkIndex && meta.totalChunks && meta.contentHash;
     ```
  3. 若预分片 → 跳过服务端分片；
  4. 去重校验 `(url+contentHash+version)`；
  5. 入库 `rag_documents`；
  6. 写入 `rag_operations` + `rag_operation_documents`；
  7. 异步触发向量化；
  8. 返回 `{success:true, docId, operationId}`；
  9. 记录日志事件：

     ```json
     {"event":"ingest.success","prechunked":true}
     ```

---

### 3️⃣ `/api/v1/rag/docs/batch`

* 功能：批量上传（最多100条）
* 逻辑：

  * 参数校验；
  * 并发插入（p-limit 10）；
  * 写入 `rag_operations`；
  * 成功与失败分条记录；
  * 异步触发向量化；
  * 返回：

    ```json
    {
      "success": true,
      "processed": 24,
      "failed": 1,
      "operationId": "op_batch_xxx",
      "results": [...]
    }
    ```
* 支持部分成功（207 Multi-Status）。

---

### 4️⃣ `/api/v1/rag/operations`

* 分页查询操作记录
* 支持 `sourceId/status/startDate/endDate/page/limit`
* 响应：

  ```json
  {
    "success": true,
    "data": [ {...} ],
    "pagination": { "page":1,"limit":20,"total":1 }
  }
  ```

---

### 5️⃣ `/api/v1/rag/operations/{id}`

* 查询单次操作详情（含文档结果）；
* 按 operationId 返回 rag_operation_documents 映射。

---

### 6️⃣ 异步向量化任务（Vectorizer Service）

* 触发源：文档入库后；
* 任务状态流：

  ```
  pending → processing → completed/failed
  ```
* 重试：指数退避 3 次；
* 日志：

  ```json
  {"event":"vectorize.completed","docId":"doc_xxx","durationMs":2134}
  ```

---

## 四、⚙️ 研发环境配置

### `.env.example`

```bash
DRIVEQUIZ_DB_URL=postgresql://user:pass@localhost:5432/drivequiz
DRIVEQUIZ_API_TOKEN_SECRET=super_secret_key
RAG_ENABLE_SERVER_CHUNK=false
AI_VECTORIZE_URL=https://ai.drivequiz.com/v1/admin/rag/ingest
MAX_BATCH_SIZE=100
LOG_LEVEL=info
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_DOCS=100
RATE_LIMIT_BATCH=10
```

---

## 五、🧾 执行顺序（Cursor 指令）

### 1️⃣ 初始化数据库

```bash
pnpm db:migrate
```

### 2️⃣ 开发阶段启动

```bash
pnpm dev
```

### 3️⃣ 测试（单元 + 集成）

```bash
pnpm test
```

### 4️⃣ 性能压测

```bash
pnpm test:perf
```

### 5️⃣ 打包与部署

```bash
pnpm build && pnpm start
```

---

## 六、📋 验证条件（验收标准）

| 模块                 | 验收点                   | 标准                       |
| ------------------ | --------------------- | ------------------------ |
| `/docs`            | 上传识别 Datapull 分片      | ✅ 返回 docId / operationId |
| `/docs`            | 缺少 meta 返回错误          | ✅ 400 INVALID_REQUEST    |
| `/docs/batch`      | 批量100文档 <5s           | ✅ 成功率 ≥99%               |
| 去重逻辑               | 相同 contentHash 拒绝重复   | ✅ 返回409                  |
| `/operations`      | 分页与过滤正确               | ✅                        |
| `/operations/{id}` | 明细匹配上传记录              | ✅                        |
| 向量化                | 异步触发成功率 ≥95%          | ✅                        |
| 速率限制               | 超限返回429               | ✅                        |
| 安全                 | Token 失效返回401         | ✅                        |
| 性能                 | 单文档 ≤500ms            | ✅                        |
| 日志                 | event/operationId 可追踪 | ✅                        |

---

## 七、📊 交付内容清单

| 分类   | 文件 / 功能                    | 验收方式       |
| ---- | -------------------------- | ---------- |
| 路由   | `/src/routes/*.ts`         | Postman 测试 |
| 服务   | `/src/services/*.ts`       | 单元测试覆盖     |
| 工具   | `/src/utils/*.ts`          | 类型校验通过     |
| 数据库  | `/migrations/*.sql`        | 已执行迁移      |
| 环境变量 | `.env.example`             | 变量完整可运行    |
| 日志系统 | `logger.ts`                | JSON 输出正确  |
| 文档   | `/docs/drivequiz-api-*.md` | 全部更新齐全     |

---

## 八、🚦 部署与回滚说明

* **部署环境**：Render / Railway（推荐）
* **数据库**：PostgreSQL (Supabase/Atlas 均可)
* **部署步骤**：

  1. 执行迁移；
  2. 设置 `.env`；
  3. 启动 API；
  4. 验证健康检查；
  5. 执行 Datapull 联调。
* **回滚方案**：

  * 使用 `pnpm db:rollback`；
  * 旧镜像版本保留 `v1.0`；
  * 服务端分片逻辑仍可回滚启用（设置 `RAG_ENABLE_SERVER_CHUNK=true`）。

---

## 九、👥 研发分工

| 角色                | 职责         | 工号      |
| ----------------- | ---------- | ------- |
| PM / Tech Lead    | 产品架构与验收标准  | ChatGPT |
| Backend Developer | 实现接口与数据库   | —       |
| QA / Tester       | 自动化测试、性能验证 | —       |
| Ops               | 部署、日志、监控   | —       |

---

## 十、✅ 最终说明

DriveQuiz API v1.1 的研发工作重点：

1. **边界统一**：仅接收 Datapull 分片；
2. **逻辑简化**：服务端分片完全旁路；
3. **日志与追踪完善**：所有 operation 可查；
4. **数据库安全与去重**：严控重复；
5. **测试可复现**：全链路覆盖。

> **一句话总结：**
> 本次研发的目标是让 DriveQuiz 成为一个纯粹、稳定、可观测的「知识接入与向量化引擎」，确保 Datapull → DriveQuiz → AI 检索链条稳定无误。

---

是否需要我继续输出《🧾 DriveQuiz 研发进度同步模板 v1.1》？
它会列出每个模块的阶段进度表（任务 → 开发 → 测试 → 验收），用于后续管理与交付追踪。
