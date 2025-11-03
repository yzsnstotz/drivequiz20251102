# 🧩 ZALEM · AI问答模块 研发文档 v1.0

> 文档角色：PM + Tech Lead（ChatGPT）
> 状态：执行中
> 更新时间：2025-11-03
> 适用项目：`Zalem Monorepo / apps/ai-service` + `apps/web`

---

## 一、系统总体架构

### 1️⃣ 技术栈与依赖

| 层级     | 技术/库                             | 用途                      |
| ------ | -------------------------------- | ----------------------- |
| 前端     | Next.js 14 + TypeScript          | 用户问答界面（分页中间项）           |
| 主后端    | Next.js App Router API           | 处理用户身份、配额、日志、转发请求       |
| AI 子服务 | Node.js + Express/Fastify        | 接收主站调用、执行 RAG 检索 + 模型调用 |
| 向量库    | Supabase Vector / pgvector       | 存储法规、题库等语料向量            |
| 模型     | GPT-4o-mini（主） + 本地 Ollama（备）    | 生成回答                    |
| 数据库    | Supabase PostgreSQL              | 问答日志 + 高频问题整合           |
| 部署     | Vercel（主站） + Render（AI-Service） | 独立扩缩容                   |

---

## 二、目录结构（Monorepo）

```
/apps
 ├─ web/                        ← 主站（Next.js）
 │   ├─ app/api/ai/ask/route.ts ← 负责转发用户问题至 ai-service
 │   └─ ...
 ├─ ai-service/                 ← 新建 AI 问答服务（Express/Fastify）
 │   ├─ src/
 │   │   ├─ index.ts            ← 入口（注册路由、鉴权）
 │   │   ├─ routes/
 │   │   │   └─ ask.ts          ← POST /v1/ask 主逻辑
 │   │   ├─ lib/
 │   │   │   ├─ rag.ts          ← 向量检索逻辑（Supabase）
 │   │   │   ├─ openaiClient.ts ← GPT-4o-mini 接口封装
 │   │   │   ├─ cache.ts        ← 缓存层（Redis 或本地 LRU）
 │   │   │   └─ safety.ts       ← 内容分类/禁答检查
 │   │   ├─ middlewares/
 │   │   │   └─ auth.ts         ← Service Token 鉴权
 │   │   └─ utils/
 │   │       └─ logger.ts       ← 请求日志与成本估算
 │   ├─ Dockerfile
 │   ├─ package.json
 │   └─ tsconfig.json
/packages
 ├─ shared-types/               ← 定义统一类型（IAiAskRequest/Response）
 └─ shared-utils/               ← 公共工具（验证、签名、格式化等）
```

---

## 三、模块功能说明

### 1️⃣ 主后端 `/api/ai/ask`

**职责：**

* 校验用户 JWT
* 检查每日调用次数（10 次）
* 检查输入长度（≤300字）
* 生成唯一 `session_id`
* 调用 `AI_SERVICE_URL/v1/ask`（携带 Service Token）
* 记录日志至主库 `user_ai_logs`

**请求示例：**

```ts
POST /api/ai/ask
{
  "question": "日本で中国免許は使えますか？"
}
```

**响应示例：**

```json
{
  "ok": true,
  "data": {
    "answer": "日本では短期滞在中は...",
    "sources": [
      {"title":"警察庁 外国免許 FAQ","url":"https://www.npa.go.jp/..."}
    ],
    "model":"gpt-4o-mini",
    "safetyFlag":"ok"
  }
}
```

---

### 2️⃣ AI-Service `/v1/ask`

**职责流程：**

```
接收请求
  ↓
校验 Service Token
  ↓
内容检查（是否禁答 / 非相关）
  ↓
RAG 检索（Top-3）
  ↓
缓存查找（命中则返回）
  ↓
GPT-4o-mini 生成回答
  ↓
记录日志（Supabase）
  ↓
返回 structured JSON
```

**核心逻辑伪代码：**

```ts
router.post("/v1/ask", async (req, res) => {
  const { userId, locale, question } = req.body;

  // 1. 内容筛查
  const safe = await checkSafety(question);
  if (!safe.ok) return res.json(safe);

  // 2. 检索知识库
  const context = await ragSearch(question, 3);

  // 3. 缓存查找
  const cached = await getCache(question);
  if (cached) return res.json(cached);

  // 4. 调用模型
  const answer = await openaiGenerate({
    model: "gpt-4o-mini",
    prompt: buildPrompt(question, context)
  });

  // 5. 保存日志 & 缓存
  await saveLog({ userId, question, answer, context, model: "gpt-4o-mini" });
  await setCache(question, answer);

  res.json({ ok: true, data: { answer, sources: context, model: "gpt-4o-mini" } });
});
```

---

## 四、数据库与数据结构

### 📋 表 1：`ai_logs`

记录每次问答调用

| 字段         | 类型            | 说明                     |
| ---------- | ------------- | ---------------------- |
| id         | bigint pk     | 自增ID                   |
| user_id    | uuid          | 用户ID                   |
| question   | text          | 用户问题                   |
| answer     | text          | 模型回答                   |
| language   | varchar(8)    | ja / zh / en           |
| model      | varchar(32)   | gpt-4o-mini / ollama 等 |
| rag_hits   | integer       | 命中条数                   |
| cost_est   | numeric(10,4) | 费用估算（USD）              |
| created_at | timestamptz   | 默认 now()               |

### 📋 表 2：`ai_vectors`

RAG 向量库（法规、题库、办事资料）

| 字段           | 类型           | 说明   |
| ------------ | ------------ | ---- |
| id           | bigint pk    |      |
| doc_id       | varchar(64)  | 文档标识 |
| content      | text         | 原文片段 |
| embedding    | vector(1536) | 向量   |
| source_title | text         | 来源标题 |
| source_url   | text         | 来源链接 |
| updated_at   | timestamptz  |      |

### 📋 表 3：`ai_daily_summary`

每日整合结果

| 字段            | 类型      | 说明        |
| ------------- | ------- | --------- |
| date          | date pk |           |
| total_calls   | integer | 当日总调用     |
| avg_cost      | numeric | 平均成本      |
| top_questions | jsonb   | 高频问题（前10） |
| new_topics    | jsonb   | 新增问题主题聚类  |

**每日整合逻辑：**

* 通过 `pg_cron` 或 `Edge Function` 每晚 0:00 聚合 `ai_logs` → `ai_daily_summary`
* 任务脚本 `/apps/ai-service/src/tasks/dailySummarize.ts`

---

## 五、核心算法与中间件

### 🔍 RAG 检索

* 使用 Supabase Vector (pgvector)
* 相似度算法：cosine similarity
* top_k = 3
* 最小相似度阈值 = 0.75
* 检索结果拼接到 prompt：

  ```
  参考以下资料，用日语简短回答用户问题：
  {context_1}
  {context_2}
  {context_3}
  用户问题：{question}
  ```

### 🧠 模型调用

* 默认使用 GPT-4o-mini（OpenAI 官方 API）
* 若本地环境启用 `AI_PROVIDER=ollama` 则调用本地模型（兼容 OpenAI 接口）

### 🧾 缓存层

* 优先级：Memory LRU → Redis（可选）
* 缓存 key = sha256(question + locale)
* 过期时间：24h
* 热点问题命中率预期：70%+

### 🔒 安全与禁答逻辑

* 规则表：`ai_filters`
* 关键词匹配 + 模型分类（isDrivingRelated / notDrivingRelated / sensitive）
* 非相关则返回：

  ```json
  { "ok": false, "errorCode": "NOT_RELEVANT", "message": "質問内容が運転に関係していません。" }
  ```

---

## 六、管理后台接口（主站 `/api/admin/ai/*`）

| 接口                       | 方法       | 功能               |
| ------------------------ | -------- | ---------------- |
| `/api/admin/ai/logs`     | GET      | 分页查看AI日志         |
| `/api/admin/ai/summary`  | GET      | 获取每日汇总           |
| `/api/admin/ai/filters`  | GET/POST | 查看/设置禁答关键词       |
| `/api/admin/ai/rag/docs` | POST     | 上传新法规文档（触发向量化）   |
| `/api/admin/ai/config`   | GET/PUT  | 修改AI配置（限额/模型/缓存） |

---

## 七、安全与权限设计

| 层级               | 权限机制                              |
| ---------------- | --------------------------------- |
| 用户端              | JWT + dailyLimit middleware       |
| 主后端 → AI-Service | Bearer Service Token              |
| 管理后台             | JWT + Role(admin)                 |
| AI-Service 内部    | 仅允许 whitelisted origins & token   |
| Supabase RLS     | Service Role Key 仅供 AI-Service 调用 |

---

## 八、部署与环境变量

**Vercel（主站）**

```
AI_SERVICE_URL=https://ai.zalem.app
AI_SERVICE_TOKEN=svc_xxx
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
```

**Render（AI-Service）**

```
OPENAI_API_KEY=sk-xxx
AI_MODEL=gpt-4o-mini
SUPABASE_URL=https://xyz.supabase.co
SUPABASE_SERVICE_KEY=...
AI_CACHE_REDIS_URL=redis://...
SERVICE_TOKENS=svc_xxx
PORT=10000
```

**CI/CD 要点**

* 主站与 AI-Service 分别独立部署
* Render 通过 `render.yaml` 一键创建 Web 服务和 Cron 作业
* Auto Deploy 开启时，每次 push 自动触发部署
* 健康检查路径：`/healthz`，就绪检查路径：`/readyz`

---

## 九、任务分配（对 O1 开发）

| 模块                     | 负责人        | 任务内容                            |
| ---------------------- | ---------- | ------------------------------- |
| 主站 `/api/ai/ask`       | O1-FE      | 完成接口转发与限流逻辑                     |
| AI-Service `/v1/ask`   | O1-BE      | 编写主逻辑、缓存、RAG、日志                 |
| Supabase Vector Schema | O1-DB      | 创建 `ai_vectors`、`ai_logs`       |
| 日整合任务                  | O1-BE      | 编写 `dailySummarize.ts` 并配置 cron |
| 管理后台                   | O1-FE      | 增加“AI监控”页面                      |
| ChatGPT（PM）            | 产品、接口、规范维护 |                                 |

---

## 十、风险控制与监测

* 🔄 **请求失败重试机制**：3 次退避重试（指数退避）
* 🚨 **异常告警**：OpenAI error rate >5% 或 cost spike 时，触发 Discord/Webhook 通知
* 🧩 **日志留存**：至少 30 天，用于审计与复核
* 🧠 **人工抽检**：每日汇总后人工抽查 Top 10 高频问答

---

## 十一、扩展预留（V2+）

* 多语言回答（多语 prompt 选择）
* 模型自动切换（RAG命中率低时换本地模型）
* AI内容二次利用（生成传播用卡片）
* GraphQL API for Analytics（前端图表）
* 语音问答接口（STT + TTS）


