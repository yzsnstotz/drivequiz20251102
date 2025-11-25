# Zalem 后台管理 · 统一参数 & 接口规范 v1.0

> 适用范围：Next.js 14（App Router）+ TypeScript + Kysely/PostgreSQL
> 模块覆盖：激活码管理 / 用户查询 / 到期自动化 / 管理员鉴权 / 前端管理界面对接

## 0) 目标一句话

补齐后台管理能力：在**不改变现有用户激活流程**的前提下，新增管理 API、数据库字段、到期规则、鉴权和前端管理界面所需的所有契约（含分页/筛选/状态机/统计）。

---

## 1) 全局规范（必须遵守）

* **命名**

  * 数据库字段：`snake_case`（例：`expires_at`）
  * API JSON 字段：`camelCase`（例：`expiresAt`）
  * 枚举存库：小写字符串（例：`enabled`）
* **时间**：全部使用 **ISO 8601 UTC**（例：`2025-12-31T23:59:59Z`）
* **分页**：`page`（默认1）`limit`（默认20，最大100）
* **鉴权**：所有 `/api/admin/**` 必须带头 `Authorization: Bearer <ADMIN_TOKEN>`
* **响应格式**

  * 成功：`{ ok: true, data, pagination? }`
  * 失败：`{ ok: false, errorCode: 'VALIDATION_FAILED', message: '...' }`（HTTP 对应 4xx/5xx）
* **排序**（可选）：支持 `sortBy` + `order`（`asc|desc`），默认 `createdAt desc`

---

## 2) 环境变量（新增/统一）

| 变量名            | 示例                                           | 说明        |
| -------------- | -------------------------------------------- | --------- |
| `DATABASE_URL` | `postgresql://user:pass@host:5432/drivequiz` | 连接串       |
| `ADMIN_TOKEN`  | `super-secret-token`                         | 管理后台鉴权    |
| `TZ`           | `UTC`                                        | 服务器时区（建议） |

> `.env.example` 请包含上述 3 项，并注明**不得提交**真实 `.env`。

---

## 3) 数据库结构（增量变更 & 统一）

> 以 Kysely/SQL 迁移脚本实现：`migrations/20251101_add_activation_admin_fields.sql`

### 3.1 表 `activation_codes`（新增字段）

| 字段            | 类型            | 约束                                                                                      | 说明            |
| ------------- | ------------- | --------------------------------------------------------------------------------------- | ------------- |
| `status`      | `varchar(20)` | `NOT NULL DEFAULT 'disabled'` + CHECK in (`'disabled','enabled','suspended','expired'`) | 状态机           |
| `expires_at`  | `timestamp`   | NULL                                                                                    | 到期时间          |
| `enabled_at`  | `timestamp`   | NULL                                                                                    | 首次启用时间（可选策略）  |
| `notes`       | `text`        | NULL                                                                                    | 备注（渠道/用途）     |
| `used_count`  | `int`         | `NOT NULL DEFAULT 0`                                                                    | 使用次数（若未存在则补充） |
| `usage_limit` | `int`         | `NOT NULL DEFAULT 1`                                                                    | 使用上限（若未存在则补充） |

**索引**

* `idx_activation_codes_status (status)`
* `idx_activation_codes_expires_at (expires_at)`

> 如已有 `used_count/usage_limit` 字段，与上述默认值对齐；否则按上表新增。

### 3.2 表 `users` / `activations`（若存在）

* 确保能追溯：用户邮箱、激活码、激活时间、IP、UA。
* 若没有独立表，请在现有承载激活记录的表中**至少保证**以下字段：
  `email (text not null)`、`activation_code (text not null)`、`activated_at (timestamp not null)`、`ip_address (text null)`、`user_agent (text null)`。

---

## 4) 后端 API 契约（最终版）

> 所有路径前缀：`/api/admin`（均需管理员鉴权）

### 4.1 GET `/api/admin/activation-codes`

**用途**：列表查询（分页/筛选/搜索/排序）

**Query**

* `page?` int ≥1（默认1）
* `limit?` int ≤100（默认20）
* `status?` in `disabled|enabled|suspended|expired`
* `code?` string（模糊匹配）
* `expiresBefore?/expiresAfter?` ISO8601
* `sortBy?` in `createdAt|enabledAt|expiresAt|usedCount|usageLimit|status`（默认 `createdAt`）
* `order?` in `asc|desc`（默认 `desc`）

**Response 200**

```json
{
  "ok": true,
  "data": [
    {
      "id": 123,
      "code": "ABCD12",
      "status": "enabled",
      "usageLimit": 1,
      "usedCount": 0,
      "expiresAt": "2026-12-31T23:59:59Z",
      "enabledAt": "2025-01-01T00:00:00Z",
      "createdAt": "2025-01-01T00:00:00Z",
      "notes": "渠道A"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 1000, "totalPages": 50 }
}
```

### 4.2 POST `/api/admin/activation-codes`

**用途**：批量生成激活码

**Body**

```json
{
  "count": 100,
  "usageLimit": 1,
  "status": "disabled",
  "expiresAt": "2026-12-31T23:59:59Z",
  "notes": "首批兑换码"
}
```

**校验**：`1 ≤ count ≤ 10000`，`usageLimit ≥ 1`，`status in disabled|enabled|suspended|expired`（建议生成时禁止 `expired`）
**Response 200**

```json
{
  "ok": true,
  "data": [
    { "id": 1, "code": "X7K9...", "status": "disabled", "usageLimit": 1, "usedCount": 0, "expiresAt": null, "enabledAt": null, "createdAt": "..." }
  ]
}
```

### 4.3 PUT `/api/admin/activation-codes/:id`

**用途**：编辑激活码（不可把 `expired` 改回其它状态）

**Body**（至少一个字段）

```json
{
  "usageLimit": 5,
  "status": "enabled",                 // 仅允许 disabled|enabled|suspended
  "expiresAt": "2026-12-31T23:59:59Z",
  "notes": "渠道B"
}
```

**Response 200**：返回更新后的对象；
**错误**：非法状态流转 → `409 CONFLICT`（`errorCode: 'INVALID_STATE_TRANSITION'`）

### 4.4 DELETE `/api/admin/activation-codes/:id`

**用途**：删除激活码

* MVP：硬删，若已使用则禁止删除（返回 409）。
* 若需审计，后续可改为软删 `deleted_at` 字段。

**Response 200**

```json
{ "ok": true, "data": { "deleted": 1 } }
```

### 4.5 GET `/api/admin/activation-codes/stats`

**用途**：统计（状态分布、已用/未用、使用率）

**Response 200**

```json
{
  "ok": true,
  "data": {
    "total": 10000,
    "enabled": 5000,
    "disabled": 3000,
    "expired": 1500,
    "suspended": 500,
    "used": 8000,
    "unused": 2000,
    "usageRate": 0.8
  }
}
```

### 4.6 GET `/api/admin/users`

**用途**：按邮箱/激活码查询用户（分页）

**Query**

* `email?` string
* `code?` string
* `page?`、`limit?`、`sortBy?=activatedAt|email|code`（默认 `activatedAt desc`）

**Response 200**

```json
{
  "ok": true,
  "data": [
    {
      "id": 1,
      "email": "user@example.com",
      "activationCode": "ABCD12",
      "activatedAt": "2025-01-15T10:30:00Z",
      "codeStatus": "enabled",
      "codeExpiresAt": "2026-12-31T23:59:59Z",
      "ipAddress": "203.0.113.5",
      "userAgent": "..."
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 }
}
```

### 4.7 POST `/api/admin/tasks/sweep-expired`

**用途**：批量扫描过期（`expires_at < now()`）并置 `expired`
**Response 200**

```json
{ "ok": true, "data": { "affected": 358 } }
```

> **共享规则：** 在任意读/用码路径调用 `ensureCodeFresh(codeRow)`：若过期则原子更新为 `expired` 并据此处理。

---

## 5) 现有用户激活接口的对齐（只补逻辑，不改契约）

**路径**：`POST /api/activate`（已存在）
**新增校验序（伪码）**

1. 若 `status == 'suspended'` → 拒绝（403）
2. 若 `now() > expires_at` → 将状态写回 `expired` 并拒绝（409）
3. 可选策略：首用时将 `disabled → enabled`，并写 `enabled_at = now()`（若你希望“启用即首用”，则开启；默认不开启）
4. 校验 `used_count < usage_limit`，通过后 `used_count + 1`（事务）

---

## 6) 错误码对照（统一）

| errorCode                  | HTTP | 场景                    |
| -------------------------- | ---- | --------------------- |
| `AUTH_REQUIRED`            | 401  | 缺少/非法管理员 Token        |
| `FORBIDDEN`                | 403  | 权限不足                  |
| `VALIDATION_FAILED`        | 400  | 参数非法                  |
| `NOT_FOUND`                | 404  | 资源不存在                 |
| `INVALID_STATE_TRANSITION` | 409  | 非法状态流转（如把 expired 改回） |
| `CONFLICT`                 | 409  | 业务冲突（如已使用码的硬删）        |
| `INTERNAL_ERROR`           | 500  | 未分类的服务器错误             |

---

## 7) 前端管理界面约定（与接口对齐）

* 根路由：`/admin`（登录后进入）
* 登录：`/admin/login`（仅前端输入 `ADMIN_TOKEN`，持久化至 `localStorage`，请求拦截统一加 `Authorization` 头）
* 页面 & 对应接口

  * `/admin/activation-codes` → `GET /activation-codes`（含筛选/分页/排序/编辑/删除）
  * `/admin/activation-codes/new` → `POST /activation-codes`
  * `/admin/users` → `GET /users`
  * `/admin/stats` → `GET /activation-codes/stats`
  * `/admin/tasks` → `POST /tasks/sweep-expired`

**统一组件参数**

* `PaginationProps`: `{ page: number; limit: number; total: number; onChange(page,limit): void }`
* `FilterBarProps (ActivationCodes)`: `{ status?: string; code?: string; expiresAfter?: string; expiresBefore?: string; sortBy?: string; order?: 'asc'|'desc'; onChange: (payload)=>void }`

---

## 8) 校验与安全

* `zod`/轻量校验器统一入口：`src/app/api/_lib/validators.ts`
* 管理员鉴权中间件：`src/app/api/_lib/withAdminAuth.ts`
* 事务要求：`POST /activation-codes`（批量）、`PUT`、`DELETE`、`sweep-expired`
* 速率限制（可选增强）：对 `/api/admin` 组设定基本频控（例如 IP 级别 60 rpm）

---

## 9) 目录与文件（新增/改动清单）

> 你可以决定是由 Cursor 执行，还是我直接输出完整文件内容。

**必改/新增（后端）**

* `migrations/20251101_add_activation_admin_fields.sql`（新增）
* `src/lib/db.ts`（补全类型：`activation_codes` 新字段；若使用 Kysely，更新 Database 类型）
* `src/app/api/_lib/withAdminAuth.ts`（新增）
* `src/app/api/_lib/validators.ts`（新增）
* `src/app/api/_lib/pagination.ts`（新增）
* `src/app/api/_lib/errors.ts`（新增）
* `src/app/api/admin/activation-codes/route.ts`（GET、POST）
* `src/app/api/admin/activation-codes/[id]/route.ts`（PUT、DELETE）
* `src/app/api/admin/activation-codes/stats/route.ts`（GET）
* `src/app/api/admin/users/route.ts`（GET）
* `src/app/api/admin/tasks/sweep-expired/route.ts`（POST）
* `src/app/api/activate/route.ts`（仅补充状态与过期校验逻辑）

**前端（管理界面）**

* `src/app/admin/layout.tsx`（新增）
* `src/app/admin/page.tsx`（新增：仪表盘）
* `src/app/admin/login/page.tsx`（新增）
* `src/app/admin/activation-codes/page.tsx`（新增：列表）
* `src/app/admin/activation-codes/new.tsx`（新增：表单）
* `src/app/admin/users/page.tsx`（新增）
* `src/app/admin/stats/page.tsx`（新增）
* `src/app/admin/tasks/page.tsx`（新增）
* `src/components/admin/*`（分页/筛选/对话框等）
* `src/lib/apiClient.ts`（前端：统一带鉴权头的 fetch 封装）

**文档与配置**

* `docs/后台管理-统一参数与接口规范.md`（即本文）
* `.env.example`（含 `DATABASE_URL`、`ADMIN_TOKEN`、`TZ=UTC`）

---

## 10) 验收清单（QA）

* 迁移成功、可回滚，无数据损坏
* 所有 `/api/admin/**` 无 Token 访问得到 401/403
* 列表分页/筛选/排序正确；编辑/删除遵循状态机约束
* 生成接口 count 上限与字段校验生效
* `sweep-expired` 返回受影响行数，并且在列表/激活接口中能即时感知过期
* 用户查询能按邮箱/激活码过滤，联表输出码状态与到期时间
* 前端页面在本地连云端库可全流程操作（不需本地 DB）

---

### 你的下一步

1. 确认是否采用“**首用自动启用**”（`disabled → enabled` 并写 `enabled_at`）策略（默认**不开启**）。
2. 告诉我：上面**文件清单**由我直接生成实现，还是交给 Cursor 执行。我会立刻按该规范落地代码。
