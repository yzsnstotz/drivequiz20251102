好的，我按照你给的范本体系与现有后端规范（时间/命名/分页/错误返回）整理了一份可直接入库到 `docs/` 的前台接口契约。它同时标注了 **新增** / **修改** 接口来源自上一轮“产品/研发工作清单”，并将**DB 字段映射**与**验证规则**写清楚，方便前后端与 Datapull/AI 协作。

---

# 📐 ZALEM 前台 · 参数与接口统一规范（vNext-Front）

**文档版本**：vNext-2025-11
**文档日期**：2025-11-07
**适用范围**：前端（Next.js）、后端 API（Next.js App Router）、AI-Service、Datapull、数据/测试
**遵循规范**：

* 返回结构：`{ ok: true, data, pagination? }` / `{ ok: false, errorCode, message }`
* 时间：**ISO8601（UTC）**，如 `2025-11-07T03:00:00Z`
* 命名：**数据库 snake_case** ↔ **API JSON camelCase**
* 分页：`?page=1&limit=20&sortBy=&order=` → `pagination: { page, limit, total, totalPages }`
* 枚举：**必须先白名单校验**再参与逻辑/SQL
* 鉴权：前台 API 使用 **用户上下文（Cookie/JWT 或匿名 + userid）**；管理员接口仍用 `Authorization: Bearer <ADMIN_TOKEN>`（本规范不覆盖 Admin）

> 备注：本规范仅覆盖**前台**相关接口（站内 `/api/**`）及与 **AI-Service** 的调用契约；Admin 相关规范沿用《后台管理 API · 统一研发规范 vNext》。

---

## 0. 统一数据类型与枚举

### 0.1 通用分页（Query）

```
page?: number (默认 1, ≥1)
limit?: number (默认 20, ≤100)
sortBy?: string（各接口自定义白名单）
order?: "asc" | "desc"（默认 desc）
```

### 0.2 通用分页（Response）

```ts
type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
```

### 0.3 语言与地区

```
language?: "ja" | "zh" | "en" | "vi" | "hi"
countryCode?: "JP" | "..."  // 预留
```

### 0.4 上下文标签（AI/RAG）

```
context: "license" | "vehicle" | "service"
```

---

## 1. 激活 & 基础信息（延用/轻改）

### 1.1 激活码激活（沿用）

**POST** `/api/activate`
**说明**：沿用当前实现；需确保错误返回统一 `ok/false` 格式（若未统一则在迭代中补齐）。

**Request (JSON)**

```json
{ "email": "u@example.com", "code": "ABC123" }
```

**Response (200)**

```json
{ "ok": true, "data": { "userid": "usr_xxx", "status": "active" } }
```

**Error (4xx)**

```json
{ "ok": false, "errorCode": "VALIDATION_FAILED", "message": "..." }
```

---

## 2. 用户画像 / 兴趣（新增）

> **新增原因**：支撑语言选择、问卷、个性化推荐与广告精准投放（见产品文档 Ⅲ/Ⅳ/Ⅵ）。

### 2.1 获取/更新用户资料

**GET** `/api/profile`
**PUT** `/api/profile`

**Request (PUT)**

```json
{
  "nickname": "Leo",
  "language": "ja",
  "goals": ["license"],        // 驾照目标
  "level": "beginner",         // 学习阶段
  "avatarUrl": null
}
```

**Response (200)**

```json
{
  "ok": true,
  "data": {
    "userid": "usr_xxx",
    "email": "u@example.com",
    "nickname": "Leo",
    "language": "ja",
    "goals": ["license"],
    "level": "beginner",
    "createdAt": "2025-11-07T03:00:00Z",
    "updatedAt": "2025-11-07T03:00:00Z"
  }
}
```

**DB 映射**

* `users(userid, email, created_at, updated_at)`
* `user_profiles(user_id, nickname, language, goals[], level, avatar_url)`

**校验**

* `language`：白名单
* `goals`：`["license","vehicle","service"]`（白名单）
* `level`：`"beginner" | "intermediate" | "advanced"`

---

### 2.2 获取/更新兴趣标签

**GET** `/api/interests`
**PUT** `/api/interests`

**Request (PUT)**

```json
{
  "vehicleBrands": ["Toyota","Nissan"],
  "serviceTypes": ["inspection","insurance"]
}
```

**Response (200)**

```json
{
  "ok": true,
  "data": {
    "vehicleBrands": ["Toyota","Nissan"],
    "serviceTypes": ["inspection","insurance"],
    "updatedAt": "2025-11-07T03:00:00Z"
  }
}
```

**DB 映射**

* `user_interests(user_id, vehicle_brands[], service_types[], updated_at)`

**校验**

* `vehicleBrands[]`：字符串数组（去重、长度 ≤ 20）
* `serviceTypes[]`：白名单（如 `"inspection" | "insurance" | "repair" | "wash" | "school" | "parking" | "violation"`）

---

## 3. 驾照模块（修改/兼容）

> **修改原因**：支持多驾照分类（仮免/本免/外国切替/二種/再取得），与现有 `exam_*` 兼容扩展。

### 3.1 获取题目集 / 试题

**GET** `/api/exam/[set]`

**Query**

```
licenseType?: "karimen" | "honmen" | "gaikoku" | "nishu" | "reacquire"
page? limit? sortBy? order?
```

**Response (200)**

```json
{
  "ok": true,
  "data": {
    "setId": "set_ja_karimen_01",
    "title": "仮免 学科 第1套",
    "questions": [
      { "id": 1001, "stem": "...", "options": ["A","B","C","D"], "answer": 1, "explain": null }
    ]
  },
  "pagination": { "page": 1, "limit": 20, "total": 200, "totalPages": 10 }
}
```

**DB 映射**

* `exam_sets(id, title, license_type, ... )`
* `exam_questions(id, set_id, stem, options, answer, explain, ...)`

**校验**

* `licenseType` 白名单
* `sortBy` 白名单：`["createdAt","id"]`（示例）

---

## 4. 车辆模块（新增）

### 4.1 车辆列表

**GET** `/api/vehicles`

**Query**

```
q?: string                 // 关键词（品牌/车型/描述）
brand?: string             // 品牌精确过滤
type?: string              // 车身类型，如 suv/sedan/mini-van ...
fuel?: "gas"|"ev"|"phev"   // 能源类型
priceMin?: number
priceMax?: number
page? limit? sortBy? order?
language?: "ja"|"zh"|"en"|...
```

**sortBy 白名单**

```
"createdAt" | "price" | "popularity" | "year"
```

**Response (200)**

```json
{
  "ok": true,
  "data": [
    {
      "id": 123,
      "brand": "Toyota",
      "model": "Aqua",
      "year": 2023,
      "type": "hatchback",
      "fuel": "hybrid",
      "price": 1680000,
      "thumbnailUrl": "https://...",
      "specs": { "power": "...", "range": 780 },
      "updatedAt": "2025-11-06T12:00:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 240, "totalPages": 12 }
}
```

**DB 映射**

* `vehicles(id, brand, model, year, type, fuel, price, thumbnail_url, specs_jsonb, updated_at)`
* 相关筛选索引：`brand/type/fuel/price/year/updated_at`
* 语义检索由 `vehicle_vectors` 提供（见 AI 部分）

**验证**

* 数值范围：`priceMin ≤ priceMax`
* `sortBy/order` 白名单校验

---

### 4.2 车辆详情

**GET** `/api/vehicles/[id]`

**Response (200)**

```json
{
  "ok": true,
  "data": {
    "id": 123,
    "brand": "Toyota",
    "model": "Aqua",
    "year": 2023,
    "type": "hatchback",
    "fuel": "hybrid",
    "price": 1680000,
    "images": ["https://..."],
    "specs": { "power": "...", "battery": "..." },
    "description": "...",
    "related": [456,789]
  }
}
```

---

## 5. 服务模块（新增）

### 5.1 服务列表

**GET** `/api/services`

**Query**

```
q?: string
category?: "inspection"|"insurance"|"repair"|"wash"|"school"|"parking"|"violation"
location?: string        // 未来可接入经纬度/邮编
page? limit? sortBy? order?
```

**sortBy 白名单**
`"createdAt" | "rating" | "price"`

**Response (200)**

```json
{
  "ok": true,
  "data": [
    {
      "id": 9001,
      "name": "〇〇車検センター",
      "category": "inspection",
      "address": "東京都...",
      "phone": "03-xxxx-xxxx",
      "rating": 4.5,
      "priceFrom": 9800,
      "imageUrl": "https://...",
      "updatedAt": "2025-11-06T12:00:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 120, "totalPages": 6 }
}
```

**DB 映射**

* `services(id, name, category, address, phone, rating, price_from, image_url, updated_at)`
* `service_categories`、`service_vectors`（RAG）

---

### 5.2 服务详情

**GET** `/api/services/[id]`

**Response (200)**

```json
{
  "ok": true,
  "data": {
    "id": 9001,
    "name": "〇〇車検センター",
    "category": "inspection",
    "address": "東京都...",
    "phone": "03-xxxx-xxxx",
    "hours": "9:00-18:00",
    "content": "流程/注意事项/FAQ...",
    "reviews": [
      { "user": "usr_xxx", "score": 5, "comment": "対応が丁寧でした", "createdAt": "2025-10-01T00:00:00Z" }
    ]
  }
}
```

**DB 映射**

* `services`、`service_reviews`（后续）

---

## 6. AI 问答（修改：支持 context）

### 6.1 AI 语义问答

**POST** `/api/ai/ask`

**Request (JSON)**

```json
{
  "question": "预算200万以内，适合东京通勤的省油车有哪些？",
  "context": "vehicle",
  "language": "ja",
  "filters": { "priceMax": 2000000, "brand": null }
}
```

**Response (200)**

```json
{
  "ok": true,
  "data": {
    "answer": "基于你的预算与通勤需求，可优先考虑：Toyota Aqua、Nissan Note e-POWER ...",
    "model": "gpt-4o-mini",
    "safetyFlag": "ok",
    "sources": [
      { "title": "Toyota Aqua 公式", "url": "https://...", "score": 0.83, "version": "2025-10" }
    ]
  }
}
```

**行为 & 日志**

* 记录到 `ai_logs(user_id, question, answer, locale, model, rag_hits, cost_est, safety_flag, sources, created_at, context_tag)`
* context_tag ∈ `vehicle/service/license`

**校验**

* `context` 必须在白名单
* 文本长度限制（如 4k 字符以内）
* 失败/超时需返回 `PROVIDER_ERROR` / `INTERNAL_ERROR`

---

## 7. 广告拉取（新增）

### 7.1 获取广告位填充

**GET** `/api/ads`

**Query**

```
slot: string            // 必填，广告位标识，如 "license_top", "vehicle_list_inline"
language?: string
```

**Response (200)**

```json
{
  "ok": true,
  "data": [
    {
      "id": "ad_1001",
      "slot": "license_top",
      "title": "保险特惠",
      "imageUrl": "https://...",
      "targetUrl": "https://...",
      "expiresAt": "2026-01-01T00:00:00Z",
      "weight": 10
    }
  ]
}
```

**DB 映射**

* `ad_slots`（定义位点）、`ad_contents`（投放素材）、`ad_logs`（曝光/点击）

**校验**

* `slot` 必填，校验存在且未过期
* 每次请求随机/权重选择返回（落地由后端实现）

---

## 8. 用户行为埋点（新增/扩展）

### 8.1 记录用户行为

**POST** `/api/user-behaviors`

**Request (JSON)**

```json
{
  "behaviorType": "view_page",       // "login"|"logout"|"start_quiz"|"complete_quiz"|"view_page"|"ai_chat"|"ad_click"|...
  "clientType": "web",               // "web"|"mobile"|"api"|"desktop"|"other"
  "clientVersion": "1.0.0",
  "ipAddress": null,                 // 可由后端获取，前端可不传
  "userAgent": null,                 // 可由后端获取
  "deviceInfo": { "ua": "..." },
  "metadata": { "path": "/vehicles", "adId": null }
}
```

**Response (200)**

```json
{ "ok": true, "data": { "id": 88888, "createdAt": "2025-11-07T03:00:00Z" } }
```

**DB 映射**

* `user_behaviors(user_id, behavior_type, ip_address, user_agent, client_type, client_version, device_info, metadata, created_at)`

**校验**

* `behaviorType`、`clientType` 白名单
* `metadata` 最大 4KB，禁止敏感数据

---

## 9. 通用错误码（前台）

| errorCode             | HTTP | 说明           |
| --------------------- | ---- | ------------ |
| `AUTH_REQUIRED`       | 401  | 需登录/缺少凭证     |
| `FORBIDDEN`           | 403  | 权限不足         |
| `NOT_FOUND`           | 404  | 资源不存在        |
| `VALIDATION_FAILED`   | 400  | 参数校验失败       |
| `RATE_LIMIT_EXCEEDED` | 429  | 频率限制         |
| `PROVIDER_ERROR`      | 502  | 上游（AI/第三方）错误 |
| `INTERNAL_ERROR`      | 500  | 未捕获服务端错误     |

**错误返回示例**

```json
{ "ok": false, "errorCode": "VALIDATION_FAILED", "message": "priceMax must be >= priceMin" }
```

---

## 10. 鉴权与会话

* 前台接口默认以 **用户会话**（Cookie/JWT）区分用户；无会话时允许匿名但不返回敏感字段。
* AI 与 Datapull 的服务调用需 **Service Token**（后端侧处理，不对前端暴露）。
* 管理端 `Authorization: Bearer <ADMIN_TOKEN>`（不在本文覆盖范围）。

---

## 11. 速查：各接口新增/修改标识

| 路径                    | 方法      | 状态                        |
| --------------------- | ------- | ------------------------- |
| `/api/activate`       | POST    | ✅ 既有（保持）                  |
| `/api/profile`        | GET/PUT | 🆕 新增                     |
| `/api/interests`      | GET/PUT | 🆕 新增                     |
| `/api/exam/[set]`     | GET     | ✳️ 修改（支持 licenseType）     |
| `/api/vehicles`       | GET     | 🆕 新增                     |
| `/api/vehicles/[id]`  | GET     | 🆕 新增                     |
| `/api/services`       | GET     | 🆕 新增                     |
| `/api/services/[id]`  | GET     | 🆕 新增                     |
| `/api/ai/ask`         | POST    | ✳️ 修改（支持 context/filters） |
| `/api/ads`            | GET     | 🆕 新增                     |
| `/api/user-behaviors` | POST    | ✳️ 扩展（新增 ad/page/ai 相关类型） |

---

## 12. 示例 curl（部分）

```bash
# 车辆列表（筛选+分页）
curl -s "https://example.com/api/vehicles?q=aqua&priceMax=2000000&page=1&limit=10&sortBy=price&order=asc"

# 服务详情
curl -s "https://example.com/api/services/9001"

# AI 问答（车辆场景）
curl -s -X POST "https://example.com/api/ai/ask" \
  -H "Content-Type: application/json" \
  -d '{ "question":"200万以内适合通勤的车？", "context":"vehicle", "language":"ja" }'

# 更新用户兴趣
curl -s -X PUT "https://example.com/api/interests" \
  -H "Content-Type: application/json" \
  -d '{ "vehicleBrands":["Toyota"], "serviceTypes":["insurance","repair"] }'
```

---

## 13. 字段映射与命名对照（样例）

| API 字段            | DB 字段              | 说明                  |
| ----------------- | ------------------ | ------------------- |
| `createdAt`       | `created_at`       | `toISOString()` 输出  |
| `updatedAt`       | `updated_at`       | 同上                  |
| `thumbnailUrl`    | `thumbnail_url`    | URL 字段统一小写 + `_url` |
| `priceFrom`       | `price_from`       | 最低价                 |
| `vehicleBrands[]` | `vehicle_brands[]` | 数组字段                |
| `serviceTypes[]`  | `service_types[]`  | 数组字段                |

---

## 14. 校验与安全红线

* **枚举/排序键/上下文**：严格白名单校验；非法直接 `400`。
* **搜索/模糊匹配**：统一走安全的模板/参数化（服务器端保障）。
* **时间/数值**：入参必须显式验证范围与格式。
* **输出**：统一 camelCase；时间统一 ISO8601 UTC；空值用 `null`。
* **日志**：屏蔽 token、邮箱等敏感信息；`user_behaviors.metadata` 禁止写入 PII。

---

## 15. 版本与兼容性

* 本规范**不破坏**现有 `/api/activate` 行为；其他接口均为 **新增** 或 **向后兼容扩展**。
* 若工具签名（如分页元信息）在代码层从位置参数切换为对象入参，需 **同迭代全量替换**，避免新旧并存。

---
