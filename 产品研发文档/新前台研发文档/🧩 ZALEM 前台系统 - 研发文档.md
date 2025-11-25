

# 🧩 ZALEM 前台系统 - 研发文档（开发工作清单 vNext）

**文档版本**: vNext-2025-11
**文档日期**: 2025-11-07
**适用范围**: 开发团队（Web / API / Datapull / AI / DB）
**参考依据**:

* 《ZALEM 前台产品需求文档 vNext》
* 《project-structure-report.md》
* 《ZALEM 后台管理 · 统一参数 & 接口规范 v1.0》
* 《ZALEM 后台管理 API · 统一研发规范 vNext》

---

## 📋 目录

1. [总体说明与开发原则](#1-总体说明与开发原则)
2. [项目结构调整项](#2-项目结构调整项)
3. [核心功能模块研发任务](#3-核心功能模块研发任务)

   * 3.1 驾照模块 (License)
   * 3.2 车辆模块 (Vehicle)
   * 3.3 服务模块 (Services)
   * 3.4 我的模块 (Profile)
4. [AI 与 Datapull 联动](#4-ai-与-datapull-联动)
5. [广告与分析系统](#5-广告与分析系统)
6. [数据库变更清单](#6-数据库变更清单)
7. [API 接口清单与任务说明](#7-api-接口清单与任务说明)
8. [前端页面与组件任务](#8-前端页面与组件任务)
9. [测试与验收项](#9-测试与验收项)
10. [后续迭代建议](#10-后续迭代建议)

---

## 1️⃣ 总体说明与开发原则

* 本次版本代号：**vNext-Front 2025-11**
* 目标：保持原有设计风格，整合旧 DriveQuiz 功能 → 新版多语言 + AI 驱动驾照学习与车主服务平台
* 执行周期：**3 周**（数据库与 AI 服务调整同步）
* 主要变更点：

  1. 前台从单一题库网站 → 「多板块门户 + 智能助手」
  2. 新增车辆 / 服务模块及对应 Datapull 抓取逻辑
  3. 新建用户画像与兴趣表（Supabase）
  4. 与 AI-Service 深度整合（RAG 检索 + 个性化推荐）

---

## 2️⃣ 项目结构调整项

| 目录                 | 当前状态                     | 调整目标                                                | 具体任务                                                                  |
| ------------------ | ------------------------ | --------------------------------------------------- | --------------------------------------------------------------------- |
| `/apps/web`        | 已包含 `/admin` 后台          | 新增前台多模块导航结构                                         | 新建 `/app/(main)/` 子树，包含 `/license` `/vehicles` `/services` `/profile` |
| `/apps/ai-service` | Fastify 路由 `/v1/ask` 已存在 | 扩展支持 context 参数 (`vehicle` / `service` / `license`) | 修改 `/routes/ask.ts` 请求参数解析与向量检索逻辑                                     |
| `/apps/datapull`   | 已爬取 AI 知识与题库             | 新增车辆 / 服务站点爬取器                                      | 新建 `tasks/vehicles.ts`、`tasks/services.ts`；输出 `metadata.json`         |
| `/docs`            | 后台文档已齐全                  | 新建前台开发文档与接口规范                                       | 新增 `docs/frontend-api-reference.md`                                   |
| `/src/lib/`        | 工具库仅含后台                  | 补充前台 hooks / API 客户端 / i18n 工具                      | 新建 `/src/lib/apiClient.front.ts`、`/src/lib/i18n.ts`                   |

---

## 3️⃣ 核心功能模块研发任务

### 3.1 驾照模块（License）

**修改前：**
仅支持单一 `exam_sets`，用于仮免题库。

**修改后：**
支持多驾照类型（仮免 / 本免 / 外国切替 / 二種 / 再取得），与 AI 学习分析结合。

**研发任务**

| 类型  | 文件 / 表                       | 任务说明                                                     |
| --- | ---------------------------- | -------------------------------------------------------- |
| DB  | `exam_sets` `exam_questions` | 新增字段 `license_type VARCHAR(20)`；创建索引                     |
| API | `/api/exam/[set]`            | 增加 `licenseType` 参数；支持多题库查询                              |
| 前端  | `/app/license`               | 新建入口页 → 分类导航；子页 `/study/[set]` `/exam/[set]` `/mistakes` |
| AI  | `/api/ai/ask`                | 若来源为 `license`，context 加入 “题目 + 解释” 向量检索                 |

---

### 3.2 车辆模块（Vehicle）

**修改前：**
无此模块。

**新增目标：**
车辆信息检索 / 详情展示 / AI 推荐购车方案。

**研发任务**

| 层级       | 任务                                                | 文件路径或表                                       |
| -------- | ------------------------------------------------- | -------------------------------------------- |
| DB       | 创建 `vehicles`, `vehicle_types`, `vehicle_vectors` | 定义基本字段 + 向量字段 (pgvector 768d)                |
| API      | `/api/vehicles` `/api/vehicles/[id]`              | 列表查询、详情获取、AI 推荐过滤参数                          |
| AI       | `/v1/ask`                                         | 支持 `context=vehicle` → 检索 `vehicle_vectors`  |
| Datapull | `apps/datapull/tasks/vehicles.ts`                 | 爬取日系品牌（Toyota/Nissan 等）基本信息，生成 metadata.json |
| 前端       | `/app/vehicles`                                   | 列表 + 详情页；AI 推荐对话（引导购车问答）                     |

---

### 3.3 服务模块（Services）

**修改前：**
无此模块。

**新增目标：**
提供车检、保险、维修、驾校等本地化服务信息。

**研发任务**

| 层级       | 任务                                                                        | 文件/表                            |
| -------- | ------------------------------------------------------------------------- | ------------------------------- |
| DB       | 创建 `services`, `service_categories`, `service_vectors`, `service_reviews` | 支撑内容 + 语义检索 + 用户评分              |
| API      | `/api/services` `/api/services/[id]`                                      | 支持 `category`、`location` 筛选     |
| Datapull | `apps/datapull/tasks/services.ts`                                         | 抓取 JAF/MLIT 服务商与价格              |
| AI       | `/v1/ask`                                                                 | context=`service` 检索本地服务向量      |
| 前端       | `/app/services`                                                           | 列表 / 详情页 / AI 推荐附近商家（调用定位 + AI） |

---

### 3.4 我的模块（Profile）

**修改前：**
仅有用户激活逻辑 (`/api/activate`)，无画像/兴趣存储。

**修改后：**
用户可编辑信息、查看学习记录、偏好与积分。

**研发任务**

| 层级  | 任务                                  | 文件 / 表                                |
| --- | ----------------------------------- | ------------------------------------- |
| DB  | 新增 `user_profiles`、`user_interests` | 迁移脚本 `20251110_add_user_profiles.sql` |
| API | `/api/profile` `/api/interests`     | 用户信息 CRUD                             |
| 前端  | `/app/profile` `/app/settings`      | 显示昵称、语言、兴趣；支持编辑                       |

---

## 4️⃣ AI 与 Datapull 联动

| 模块               | 修改前           | 修改后                                        | 研发任务                                                |
| ---------------- | ------------- | ------------------------------------------ | --------------------------------------------------- |
| Datapull → AI 向量 | 仅 ingest 题库文档 | ingest 车辆与服务网站                             | 新建任务：`datapull/ingestVehicles()`、`ingestServices()` |
| 向量索引             | 单一 ai_vectors | 扩展 `tags` 字段支持多分类检索                        | 修改 `ai_vectors` 结构与 RAG 查询逻辑                        |
| AI 问答            | 通用问答          | context-aware（license / vehicle / service） | 更新 `apps/ai-service/src/routes/ask.ts`              |
| 日志               | 仅存问答文本        | 增加字段 `context_tag`                         | 修改 `ai_logs` 表结构                                    |
| 每日汇总             | AI summary    | 增加 `context` 维度分析                          | 修改 `apps/ai-service/src/tasks/dailySummarize.ts`    |

---

## 5️⃣ 广告与分析系统

| 层级        | 当前状态  | 调整目标                                    | 任务说明                                     |
| --------- | ----- | --------------------------------------- | ---------------------------------------- |
| DB        | 无广告表  | 新建 `ad_slots`, `ad_contents`, `ad_logs` | `migrations/20251112_create_ads.sql`     |
| 后台        | 无配置界面 | 后台可配置广告内容                               | 在 `/admin/ads` 新建管理页                     |
| 前台        | 无展示   | 各模块插槽加载广告                               | 新建组件 `<AdSlot position="license_top" />` |
| Analytics | 无埋点   | 增加 `user_behaviors` 记录曝光与点击             | 修改 `/api/user-behaviors`                 |

---

## 6️⃣ 数据库变更清单

| 库            | 动作 | 新/改 表                                | 主要字段                                                  |
| ------------ | -- | ------------------------------------ | ----------------------------------------------------- |
| `drivequiz`  | 新建 | `user_profiles`                      | `user_id`, `language`, `goals`, `level`, `created_at` |
| `drivequiz`  | 新建 | `user_interests`                     | `user_id`, `vehicle_brands[]`, `service_types[]`      |
| `drivequiz`  | 新建 | `ad_slots`, `ad_contents`, `ad_logs` | 支撑广告位配置与统计                                            |
| `drivequiz`  | 修改 | `exam_sets`                          | + `license_type`                                      |
| `ai_service` | 新建 | `vehicle_vectors`, `service_vectors` | + `tags`                                              |
| `ai_service` | 修改 | `ai_logs`                            | + `context_tag`                                       |
| `ai_service` | 修改 | `ai_daily_summary`                   | + `context_distribution` JSONB                        |

---

## 7️⃣ API 接口清单与任务说明

| 状态    | 路由                    | 修改前   | 修改后           | 任务说明                            |
| ----- | --------------------- | ----- | ------------- | ------------------------------- |
| 🟢 已有 | `/api/activate`       | 激活码校验 | 保持不变          | 已完成                             |
| 🆕 新增 | `/api/profile`        | 无     | 获取/更新用户资料     | GET/PUT                         |
| 🆕 新增 | `/api/interests`      | 无     | 获取/更新兴趣标签     | GET/PUT                         |
| 🆕 新增 | `/api/vehicles`       | 无     | 获取车辆列表        | 支持过滤、分页                         |
| 🆕 新增 | `/api/services`       | 无     | 获取服务项目列表      | 支持分类与位置                         |
| 🆕 新增 | `/api/ai/ask`         | 通用问答  | 增加 context 参数 | 车辆/服务/驾照                        |
| 🆕 新增 | `/api/ads`            | 无     | 拉取广告内容        | ad_slots 查询                     |
| 🆕 新增 | `/api/user-behaviors` | 部分存在  | 增加曝光/点击埋点     | 类型区分 page_view/ai_chat/ad_click |

---

## 8️⃣ 前端页面与组件任务

| 页面               | 类型 | 修改前            | 修改后                               | 任务说明                    |
| ---------------- | -- | -------------- | --------------------------------- | ----------------------- |
| `/language`      | 新建 | 无              | 语言选择页                             | 检测语言 → 写入 user_profiles |
| `/activate`      | 保留 | 单页面            | 样式优化 + 接口复用                       |                         |
| `/questionnaire` | 新建 | 无              | 用户问卷页                             | 填写国籍/目标等 → 写入 Supabase  |
| `/license/*`     | 重构 | 旧 DriveQuiz 页面 | 新布局 + 多驾照分类导航                     |                         |
| `/vehicles`      | 新建 | 无              | 列表 + AI 推荐                        |                         |
| `/services`      | 新建 | 无              | 本地服务 + 商家列表                       |                         |
| `/profile`       | 新建 | 无              | 用户资料展示与编辑                         |                         |
| `/ai`            | 新建 | 无              | 聊天助手（多 context）                   |                         |
| 公共组件             | 新建 | 无              | Header, NavTabs, AdSlot, AIButton | 统一导航与交互组件               |

---

## 9️⃣ 测试与验收项

| 类别    | 目标                      | 验收条件                                |
| ----- | ----------------------- | ----------------------------------- |
| 单元测试  | API 与工具函数               | 所有新 API 返回 `{ok,data}` 结构           |
| 集成测试  | Datapull → AI 向量        | 执行一次车辆抓取后可被 RAG 检索命中                |
| 前端测试  | 导航与语言选择                 | 语言选择页成功写入数据库                        |
| AI 测试 | context=vehicle/service | AI 能给出匹配推荐结果                        |
| 性能测试  | `/api/vehicles` 响应      | < 500ms                             |
| 埋点测试  | 行为记录                    | user_behaviors 正确写入 type + metadata |

---

## 🔟 后续迭代建议

1. **积分与徽章系统**：与 user_behaviors 联动，激励用户活跃度。
2. **车辆价格追踪服务**：通过 Datapull 定期更新报价并触发推送。
3. **AI 会话历史与收藏**：将用户 AI 问答与兴趣整合为长期画像。
4. **多语言内容中心**：驱动 Datapull 生成日文+中文+英文三语文档。
5. **订阅体系**：解锁高级 AI 分析与免广告模式。

---

**文档维护者**: 技术研发组（前台负责人）
**最后更新**: 2025-11-07
**状态**: 核心功能立项完成，准备进入开发阶段 🚀


