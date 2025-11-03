🛠️ 《ZALEM · AI问答模块 研发规范 v1.0》

> **角色**：PM + Tech Lead（ChatGPT）
> **目标**：保障 AI 模块研发、运行过程中的一致性、安全性与可扩展性
> **适用范围**：`apps/ai-service`、`apps/web`（主站）及其后端接口层

---

## 一、系统安全规范

### 1️⃣ 鉴权与密钥管理

| 项目         | 规范                                                                                                   |
| ---------- | ---------------------------------------------------------------------------------------------------- |
| **API 鉴权** | 前端 → 主站：用户 JWT<br>主站 → AI-Service：Service Token（仅白名单）                                                |
| **环境变量**   | 所有密钥（`OPENAI_API_KEY`, `SERVICE_TOKENS`, `SUPABASE_KEY`）必须放在 `.env` 或 Vercel / Render 环境配置中，严禁提交到仓库 |
| **密钥更新**   | 每季度更换 Service Token；如泄露立即失效并通知团队                                                                     |
| **日志脱敏**   | 日志中不可记录 token / email / phone / license number 等敏感字段                                                 |

---

### 2️⃣ 请求与访问控制

* 主站 `/api/ai/ask`：必须验证登录态（JWT）
* AI-Service `/v1/ask`：仅允许携带合法 Service Token 的主站调用
  → 实现：`Authorization: Bearer <SERVICE_TOKEN>`，服务端比对白名单
* 禁止任何用户端直接访问 AI-Service 外网端口
* **CORS**：AI-Service 默认关闭跨域，仅接受内部请求
* **速率限制**：

  * 用户级：10次/日
  * IP级：60次/分钟（防刷保护）
  * Service Token：QPS ≤ 30（单节点）

---

### 3️⃣ 敏感与禁答内容过滤

* 启动阶段使用**关键词规则表 `ai_filters`**：

  * `type=not-driving`：非在日驾驶/车辆类（例：选举/签证/医疗）
  * `type=sensitive`：隐私与法律敏感信息（例：免许番号/个人信息）
* 禁答策略：
  ① 先规则匹配 → 拦截
  ② 再小模型分类 → 判断“驾驶相关度”
  ③ 输出拦截提示：

  ```
  この質問は運転に関係していません。申し訳ございませんが回答できません。
  ```
* 对模糊问题（命中灰区）输出带**官方来源引导**的安全回答。

---

## 二、代码与目录规范

### 1️⃣ 文件组织

```
/apps
 ├─ web/
 │   └─ app/api/ai/ask/route.ts
 ├─ ai-service/
 │   ├─ src/
 │   │   ├─ routes/
 │   │   │   └─ ask.ts
 │   │   ├─ lib/
 │   │   │   ├─ openaiClient.ts
 │   │   │   ├─ rag.ts
 │   │   │   ├─ cache.ts
 │   │   │   └─ safety.ts
 │   │   ├─ middlewares/
 │   │   │   ├─ auth.ts
 │   │   │   └─ limiter.ts
 │   │   ├─ tasks/
 │   │   │   └─ dailySummarize.ts
 │   │   └─ utils/
 │   │       └─ logger.ts
 ├─ packages/
 │   ├─ shared-types/
 │   └─ shared-utils/
```

### 2️⃣ 命名规范

| 项目          | 规则                                       |
| ----------- | ---------------------------------------- |
| **文件名**     | 全小写 + 中划线，例如：`openai-client.ts`          |
| **函数名/变量**  | `camelCase`                              |
| **类名/类型**   | `PascalCase`                             |
| **数据库表名**   | 复数、`snake_case`                          |
| **字段名**     | `snake_case`                             |
| **接口 JSON** | `camelCase`                              |
| **环境变量**    | 全大写 + 下划线，如 `AI_MODEL`, `SERVICE_TOKENS` |

---

### 3️⃣ 提交与格式化

* 使用 **Prettier + ESLint**（项目根已统一配置）
* 禁止提交 ESLint 报错文件
* 所有异步函数必须显式使用 `try/catch`
* 所有 API 返回值必须包裹 `{ ok: true|false }` 结构
* 禁止 `console.log`（使用统一 logger）

---

## 三、数据与日志规范

### 1️⃣ 日志存储

表：`ai_logs`

* 存储每次调用的：

  * `user_id`, `question`, `answer`, `locale`
  * `model`, `rag_hits`, `safety_flag`, `cost_est`
  * `created_at`
* **脱敏要求**：自动过滤邮箱、URL 参数中的个人信息
* **留存周期**：至少 30 天

### 2️⃣ 成本估算与监控

* `openaiClient.ts` 计算 `inputTokens`, `outputTokens`, `approxUsd`
* 每 100 次请求统计平均 cost → 存入 `ai_costs` 汇总表
* 超出预设阈值（¥15,000/月）时触发通知（Discord / Slack Webhook）

### 3️⃣ 每日整合任务

* 脚本：`/src/tasks/dailySummarize.ts`
* 执行：

  * 每天 00:00 UTC（使用 Render Cron 作业或 `pg_cron`）
  * 聚合字段：

    ```
    total_calls, avg_cost_usd, cache_hit_rate, rag_hit_rate, top_questions
    ```
  * 写入表：`ai_daily_summary`
* 执行结果记录在 `system_tasks_log`

---

## 四、RAG（检索增强生成）规范

### 1️⃣ 向量生成

* 模型：`text-embedding-3-small`（OpenAI）
* 向量长度：1536
* 分片：每片 500–800 字符
* 每文档存：

  * `doc_id`, `content`, `embedding`, `source_title`, `source_url`, `version`

### 2️⃣ 检索规则

* `top_k = 3`
* 相似度算法：Cosine similarity
* 阈值：≥0.75
* 结果拼接格式：

  ```
  以下は日本の運転や交通に関する公式情報です。
  {source_1}
  {source_2}
  {source_3}
  上記を参考に300文字以内で回答してください。
  ```
* 若无命中（score<0.75）→ fallback 调 GPT，标记 `rag_hits=0`

### 3️⃣ 知识库更新

* 管理后台上传文档后，AI-Service 触发向量化流程
* 新版本 `version` 自动标记时间戳（如 `2025Q4`）
* 旧版本逻辑删除（`is_active=false`）

---

## 五、缓存与性能规范

| 项目        | 规则                                     |
| --------- | -------------------------------------- |
| **缓存层**   | 优先使用 LRU（内存），生产使用 Redis                |
| **Key**   | `sha256(normalize(question) + locale)` |
| **TTL**   | 24小时                                   |
| **清理策略**  | 热度LRU，最大1000项（无Redis）                  |
| **命中率目标** | ≥70%                                   |
| **预热机制**  | 每日高频问题 Top10 自动预缓存                     |

---

## 六、测试与验证规范

### 1️⃣ 单元测试

* 覆盖率要求 ≥ 80%
* 必测模块：

  * `ragSearch()`
  * `checkSafety()`
  * `openaiGenerate()`
  * `cache` 命中逻辑
  * API 路由响应格式

### 2️⃣ 集成测试

* 跑通完整流程（含 Service Token 鉴权、RAG→GPT→日志落库）
* 伪造 10 条问答样例，验证：

  * 限流逻辑
  * 缓存命中
  * 禁答规则触发
  * 成本估算字段存在

### 3️⃣ 预发布验证

* 运行脚本：

  ```
  npm run test:ai
  ```

  成功条件：

  * 所有接口返回 200 且 `ok: true`
  * 统计命中率 ≥ 60%
  * 无敏感词命中

---

## 七、部署与运维规范

| 项目       | 说明                                                          |
| -------- | ----------------------------------------------------------- |
| **部署平台** | Vercel（主站）+ Render（AI-Service）                             |
| **构建配置** | `render.yaml`（Render）或 `Dockerfile`（可选）                     |
| **自动部署** | Render Auto Deploy（通过 render.yaml）+ GitHub Actions（主站） |
| **监控**   | Render Dashboard + Supabase Log + OpenAI Usage Dashboard   |
| **异常处理** | OpenAI API 报错重试3次，指数退避：0.5s, 1s, 2s                         |
| **灾备**   | 若 OpenAI 故障，自动切换到本地 Ollama（Qwen2.5:3B）                      |
| **日志回滚** | 日志写入失败不阻断请求（写警告级别）                                          |

---

## 八、审计与合规规范

| 类别          | 内容                            |
| ----------- | ----------------------------- |
| **隐私保护**    | 用户问题原文仅用于统计，不向外部共享            |
| **数据保留**    | 问答日志保存30天，汇总数据长期保留            |
| **人工复核**    | 每日Top10问答抽查人工确认正确性            |
| **RAG资料来源** | 仅使用公开法规、官方文件或内部原创内容           |
| **免责声明**    | 所有回答结尾自动附：“本回答仅供参考，请以官方信息为准。” |
| **模型透明度**   | 回答结构中返回 `model` 字段以标明使用模型     |

---

## 九、开发协作与提交规范

| 项目            | 要求                                                       |
| ------------- | -------------------------------------------------------- |
| **分支策略**      | `main`（稳定） + `dev`（开发） + feature 分支                      |
| **提交规范**      | `feat: xxx` / `fix: xxx` / `refactor: xxx` / `docs: xxx` |
| **PR 审核**     | 每个 PR 需另一人 Code Review（或 AI Review 通过）                   |
| **发布流程**      | ① 合并 main → ② CI/CD 自动构建 → ③ 发布前运行 smoke test            |
| **版本号**       | 采用语义化版本：`v1.0.x`                                         |
| **Changelog** | 每次发布附变更说明（格式：时间 + 模块 + 描述）                               |

---

## 十、风险控制与监测清单

| 风险点    | 预防措施                       |
| ------ | -------------------------- |
| 模型成本飙升 | 成本统计 + 阈值报警（Slack webhook） |
| 过度调用   | 用户限流 + 缓存命中率优化             |
| 法规更新滞后 | 定期更新知识库（每季度）               |
| 模型误答   | 人工抽检机制 + 错答统计              |
| 安全滥用   | 内容过滤 + Token 鉴权 + 日志审计     |
| 系统不可用  | 本地模型兜底 + 异常重试              |

---

## 十一、后续演进计划（V2+）

| 模块       | 目标                    |
| -------- | --------------------- |
| 多语言支持    | 同一问题可中日双回答            |
| 内容复用     | 高频问答自动生成“内容卡片”        |
| 知识库管理    | 支持文档批量上传 + 自动摘要       |
| 分析可视化    | 管理后台展示调用量、成本、趋势图      |
| A/B 模型对比 | 引入 GPT-4o 与本地模型精度比较机制 |

---

✅ **本规范文件目标**

* 约束研发行为、确保安全与一致性；
* 明确各层边界，方便 O1 与后续 AI 窗口协作；
* 保证系统具备持续运维、审计、合规能力。
