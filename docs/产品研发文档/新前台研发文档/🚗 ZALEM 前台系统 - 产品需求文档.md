# 🚗 ZALEM 前台系统 - 产品需求文档（vNext）

**文档版本**: vNext-2025-11
**文档日期**: 2025-11-07
**适用范围**: 产品经理 / 前端研发 / 后端研发 / 数据组 / AI组
**参考依据**:

* 《project-structure-report.md》
* 新版前台规划讨论（2025-11）
* 《ZALEM 后台管理 · 统一参数 & 接口规范 v1.0》
* 《ZALEM 后台管理 API · 统一研发规范 vNext》

---

## 📋 一、产品总体目标

构建面向**在日学习驾驶与汽车生活用户**的一站式智能平台，融合「驾照学习」「汽车服务」「AI推荐」「商业化广告」于一体。

**目标：**

1. 让用户以母语学习日本驾照考试。
2. 让车主获取购车、保险、维修、驾校等生活信息。
3. 让AI成为智能教练与车主顾问。
4. 支撑多语言、多数据源、可扩展的统一架构。

---

## 二、系统总体结构

| 模块             | 技术栈 / 部署                            | 数据来源                        | 说明             |
| -------------- | ----------------------------------- | --------------------------- | -------------- |
| **Web 前端**     | Next.js 15 (Vercel)                 | Supabase API / AI Service   | 前台用户界面         |
| **AI Service** | Fastify 5 (Render)                  | RAG / 向量库                   | AI 问答与推荐       |
| **Datapull**   | Node + Cheerio (Cron)               | JAF / MLIT / 汽车网站           | 数据抓取入库         |
| **数据库**        | PostgreSQL 16 (Supabase + pgvector) | drivequiz 主库 + ai_service 库 | 主体数据与语义检索      |
| **后台管理**       | Next.js App Router (Admin)          | Supabase                    | 广告 / 商户 / 用户配置 |

---

## 三、用户初始流程

### 3.1 语言选择页

* 首次进入自动检测系统语言 → 弹窗确认
* 支持：日语 / 中文 / 英语 / 越南语 / 印地语
* 结果写入 `user_profiles.language`

### 3.2 激活页

* 用户输入激活码或邮箱 → 生成 `users.userid`
* 调用 `/api/activate` 接口

### 3.3 用户问卷页

* 收集：国籍 / 驾照目标 / 学习阶段 / 车辆兴趣 / 服务偏好
* 写入 `user_profiles` 与 `user_interests`

---

## 四、主导航模块（四大板块）

### 4.1 驾照 (License)

| 子类                          | 说明        |
| --------------------------- | --------- |
| 仮免 / 本免 / 外国免許切替 / 二種 / 再取得 | 支持多驾照分类题库 |

**功能点**

* 学科学习 (`/study/[set]`)
* 模拟考试 (`/exam/[set]`)
* 错题本 (`/mistakes`)
* AI 解析 （题内 → `/api/ai/ask`）
* 历史记录
* 数据表：`exam_sets`、`exam_questions`、`exam_progress`、`exam_history`、`exam_mistakes`

---

### 4.2 车辆 (Vehicle)

| 页面    | 功能           |
| ----- | ------------ |
| 列表页   | 支持品牌/价格/类型筛选 |
| 详情页   | 车辆配置与参数      |
| AI推荐页 | 语义检索匹配最合适车型  |
| 收藏页   | 用户收藏记录       |

**数据流**

* Datapull → `vehicles`、`vehicle_types` → `vehicle_vectors`
* 向量索引 pgvector (768d)
* AI context =`vehicle` → 推荐车型/报价/对比

---

### 4.3 服务 (Services)

| 类别                                 | 示例        |
| ---------------------------------- | --------- |
| 车检 / 保险 / 维修 / 洗车 / 驾校 / 停车 / 交通违法 | 对应商家及流程内容 |

**功能点**

* 内容页：服务流程/常识介绍
* 商家列表：`merchants`、`merchant_categories`
* AI 推荐：基于地理位置与偏好匹配本地商家
* 新表：`services`、`service_categories`、`service_vectors`、`service_reviews`

---

### 4.4 我的 (Profile)

| 功能     | 数据表                             |
| ------ | ------------------------------- |
| 基本信息管理 | `users`、`user_profiles`         |
| 兴趣与偏好  | `user_interests`                |
| 学习与积分  | `user_behaviors`、`exam_history` |
| 设置与推送  | `user_settings`（后续扩展）           |

---

## 五、AI × Datapull 联动逻辑

| 阶段        | 说明                                              |
| --------- | ----------------------------------------------- |
| **数据抓取**  | Datapull 爬取 JAF/MLIT/汽车/服务网站                    |
| **分块向量化** | OpenAI Embeddings 或 Ollama 生成向量，写入 `ai_vectors` |
| **标签化索引** | `tags = vehicle / service / license`            |
| **RAG检索** | 前台 `/api/ai/ask` 按 tag 检索向量并回答                  |
| **日志汇总**  | 所有问答写入 `ai_logs` → `ai_daily_summary` 每日聚合      |

---

## 六、商业化与数据分析

| 模块        | 数据表                                   | 说明                      |
| --------- | ------------------------------------- | ----------------------- |
| 广告系统      | `ad_slots`、`ad_contents`、`ad_logs`    | 各模块预留广告位，后台可配置图/链/权重/到期 |
| 个性化推荐     | `user_interests`、`user_behaviors`     | 支撑AI和广告的精准投放            |
| 行为埋点      | `page_view`、`ai_chat`、`exam_complete` | 统一记录至 `user_behaviors`  |
| Dashboard | 聚合 ad 曝光与点击 + 用户行为 分析                 | 提供可视化管理界面               |

---

## 七、数据库迁移规划（阶段性）

| 分类                  | 动作                                                 | 目标       |
| ------------------- | -------------------------------------------------- | -------- |
| **核心库 drivequiz**   | 新增 `user_profiles` 与 `user_interests` 表            | 支撑问卷与个性化 |
| **驾照题库**            | 扩展 `exam_*` 结构                                     | 多驾照类型兼容  |
| **广告系统**            | 新建 `ad_*` 表群                                       | 支撑前台广告   |
| **AI 库 ai_service** | 新增 `vehicle_vectors`、`service_vectors` + `tags` 字段 | 支撑语义检索   |
| **Datapull**        | 新增 `sources.json` 配置与 `metadata.json` 输出           | 统一数据来源定义 |

---

## 八、前台页面结构规划

| 模块            | 页面路径                                     | 功能摘要    |
| ------------- | ---------------------------------------- | ------- |
| License       | `/study/[set]` `/exam/[set]` `/mistakes` | 题库学习与考试 |
| Vehicle       | `/vehicles` `/vehicles/[id]`             | 车辆列表与详情 |
| Services      | `/services` `/services/[id]`             | 服务列表与详情 |
| Profile       | `/profile` `/settings`                   | 用户资料与设置 |
| Activation    | `/activate`                              | 激活页     |
| Language      | `/language`                              | 首次语言选择  |
| Questionnaire | `/questionnaire`                         | 用户问卷    |
| AI Chat       | `/ai`                                    | AI 助手入口 |

---

## 九、数据接口与交互规范（摘要）

| 类型    | 示例路径                  | 说明       |
| ----- | --------------------- | -------- |
| 驾照题库  | `/api/exam/[set]`     | 获取题目集    |
| 车辆数据  | `/api/vehicles`       | 查询车辆信息   |
| 服务数据  | `/api/services`       | 查询服务项目   |
| 商户数据  | `/api/merchants`      | 获取本地商户   |
| AI 问答 | `/api/ai/ask`         | RAG 语义检索 |
| 用户行为  | `/api/user-behaviors` | 埋点上报     |
| 广告拉取  | `/api/ads`            | 动态广告位加载  |

**统一格式**

```json
{ "ok": true, "data": {...}, "pagination": {...} }
```

错误：

```json
{ "ok": false, "errorCode": "VALIDATION_FAILED", "message": "..." }
```

---

## 十、优先级任务清单（vNext Sprint 1）

| 优先级 | 任务                                         | 模块                 |
| --- | ------------------------------------------ | ------------------ |
| P0  | 导出 DriveQuiz 现有 `exam_*` 结构                | License            |
| P0  | 设计 `user_profiles` + `user_interests` 迁移脚本 | Core               |
| P1  | 车辆/服务 schema 与 向量字段设计                      | Vehicle / Services |
| P1  | 新前台导航 + 语言选择页原型                            | Web UI             |
| P2  | Datapull 车辆与服务 爬取器扩展                       | Datapull           |
| P2  | 广告位配置 + 后台管理                               | Admin              |
| P3  | 数据埋点 与 统计 Dashboard                        | Analytics          |

---

## 十一、非功能需求

| 类别       | 要求                           |
| -------- | ---------------------------- |
| **可用性**  | 响应时间 < 2 s；多语言自动适配；错误提示明确    |
| **可靠性**  | 数据库事务 一致；AI调用 容错；离线缓存        |
| **可维护性** | 统一命名规范；接口日志化；完整文档            |
| **扩展性**  | 模块化组件；新增语言与题库 零侵入            |
| **安全性**  | 用户数据 GDPR 合规；日志脱敏；Token 安全存储 |

---

## 十二、验收标准

### 功能验收

* [ ] 语言选择 → 问卷 → 首页流程可闭环
* [ ] `/api/ai/ask` 能按标签 RAG 检索
* [ ] 车辆 与 服务模块 数据可展示
* [ ] 用户行为埋点 成功写入 `user_behaviors`
* [ ] 广告位 可配置 并 可统计 曝光/点击

### 性能验收

* [ ] 首屏 < 2 s
* [ ] 向量查询 < 300 ms
* [ ] Datapull 日更新 ≤ 6 h 周期

### 安全验收

* [ ] 所有 API 采用 统一 `ok/data` 结构
* [ ] AI Service 调用需 Service Token
* [ ] 用户数据 加密 / 脱敏 存储

---

## 十三、后续版本展望（vNext + 1）

1. **积分系统** → 题库学习 + AI 互动 奖励机制
2. **车主社区** → 本地经验 与 AI 点评结合
3. **语音助手模式** → 驾驶场景语音问答
4. **订阅与会员功能** → AI 深度解析 + 广告免打扰

---

**文档维护者** : 产品团队
**最后更新** : 2025-11-07
**状态** : 需求已确认，进入 vNext 前端研发阶段 🚀
