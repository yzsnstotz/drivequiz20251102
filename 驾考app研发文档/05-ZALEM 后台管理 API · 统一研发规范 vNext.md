# ZALEM 后台管理 API · 统一研发规范 vNext

> 适用范围：Next.js 14（App Router）+ TypeScript + PostgreSQL + Kysely 的**后端 API 与工具库**
> 目标：在多人/多窗口协作下，保证**路径、参数、类型、响应**完全一致，避免“风格漂移”和 TS 报错

---

## 1) 目录与路径规范

* 根别名：`@` 固定指向 `src/`

  * ✅ `@/lib/db`、`@/app/api/_lib/errors`
  * ❌ `@/src/...`、❌ 过深相对路径 `../../..`
* 目录结构（只列关键路径）

  * `src/lib/db.ts`：Kysely + PG 连接与类型定义（**仅导出 `db`**）
  * `src/app/api/_lib/{errors,pagination,validators,withAdminAuth}.ts`
  * `src/app/api/**/route.ts`：每个路由单文件
  * `migrations/*.sql`：数据库迁移脚本（**位于仓库根目录**，非 `src/migrations`）
* **禁止**从 `@/lib/db` 导出/导入 `Database` 类型；需要时在局部定义最小接口或使用显式 `any` 兜底。

---

## 2) 数据库与迁移

* 表/列：**snake_case**；API JSON：**camelCase**
* 统一时区：UTC；输出时间 **`toISOString()`**
* 迁移文件命名：`YYYYMMDD_<description>.sql`（例如：`20251101_add_activation_admin_fields.sql`）
* 迁移内容要求：

  * **可回滚**（若采用 SQL 静态脚本，需在文件内给出 `-- DOWN` 段或附回滚脚本）
  * 对高频筛选字段建立索引（如：`status`、`expires_at`）
  * 使用 `CHECK`/`NOT NULL`/默认值保障数据约束

---

## 3) 鉴权与安全

* 所有 `/api/admin/**` 必须使用：

  ```ts
  import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
  export const GET = withAdminAuth(async (req) => { /* ... */ });
  ```
* 认证头：`Authorization: Bearer <ADMIN_TOKEN>`
* 严禁在日志/错误中泄露 Token、数据库连接串等敏感信息
* 对所有输入做白名单校验（见 §5）

---

## 4) 响应与错误格式

* 成功：

  ```ts
  success(data, pagination?) // pagination 可选
  ```
* 错误（固定工具函数，**禁止**手写 `NextResponse.json(...)`）：

  * `badRequest()` / `unauthorized()` / `forbidden()` / `notFound()`
  * `conflict()` / `invalidState()` / `internalError()`
* 错误载荷：

  ```json
  { "ok": false, "errorCode": "VALIDATION_FAILED", "message": "..." }
  ```

---

## 5) 校验与枚举

* 统一在 `validators.ts` 处理：

  * `VALID_STATUSES` / `ActivationStatus`
  * `parseISODate(input)`：无效返回错误或 null，**不要**在查询层直接使用原始字符串
  * 数值范围（`page/limit/count/usageLimit` 等）必须显式校验
* 任何枚举入参（如 `status`, `sortBy`, `order`）**先白名单校验**，再用于 SQL/逻辑

---

## 6) 分页与排序（强制协议）

* 解析：

  ```ts
  const { page, limit, offset, sortBy, order } = parsePagination(req.nextUrl.searchParams);
  // 默认：page=1, limit=20(≤100), order='desc'
  ```
* 元信息（**对象入参版为最终标准**）：

  ```ts
  const meta = getPaginationMeta({ page, limit, total });
  ```
* 排序白名单示例（以 users 接口为例）：

  ```ts
  type UserSortKey = 'activatedAt' | 'email' | 'code';
  const SORT_WHITELIST = new Set<UserSortKey>(['activatedAt','email','code']);
  function mapSort(key: UserSortKey): 'a.activated_at' | 'a.email' | 'a.activation_code' { ... }
  ```
* **禁止**：在未校验的情况下直接拼接 `orderBy` 字符串

---

## 7) 查询构造（Kysely 规则 · 红线）

> 目标：避免重载/方言引发的 TS 报错与运行时不一致

* **K-1** 禁止嵌套 where：不允许 `where((eb)=> eb.where(...))`
* **K-2** 计数查询独立构造：与主查询**应用相同过滤**；结果 `Number(row.count)`
* **K-3** 排序字段必须来自白名单映射到**合格列名字符串**（或 `sql.ref()`）
* **K-4** 时间比较：将 `Date` 转 ISO，并以参数化方式传入（必要时使用 `sql<Date>\`${date.toISOString()}::timestamp``）
* **K-5（方言操作符统一）**
  凡涉及 `ILIKE` / `ANY` / 数组比较 / `@>` 等**方言或扩展操作符**，**一律**使用 SQL 模板表达式：

  ```ts
  import { sql } from "kysely";
  // 示例：大小写不敏感搜索
  q = q.where(sql<boolean>`${sql.ref('a.email')} ILIKE ${'%' + email + '%'}`);
  // 或跨方言写法
  q = q.where(sql<boolean>`LOWER(a.email) LIKE LOWER(${'%' + email + '%'})`);
  ```

  **禁止**：`where("a.email", "ilike", ...)`（易触发 `Expected 0-1 arguments` 报错）
* **K-6** 聚合结果统一 `Number()`；禁止泛型参数滥用（如 `fn.count<number>` 可保留或在映射层统一 `Number`）
* **K-7** 不导入 `Database` 类型；查询结果映射层允许 `(r: any)` 显式兜底，**禁止隐式 any**

---

## 8) 时间与格式

* API 输出时间：**一律 ISO8601（UTC）**；空值返回 `null`
* 入参日期：用 `parseISODate()` 校验；失败 → `badRequest('VALIDATION_FAILED', '...')`

---

## 9) TypeScript / Lint / 提交规范

* `npx tsc --noEmit` 必须通过（**无隐式 any**、无未使用变量）
* ESLint：无阻断级别错误；遵循项目 `.eslintrc` 与 Prettier
* 只在**必要层**使用 `any`（映射边界），并给出注释说明
* 严禁 `as any` 逃逸整体查询结果类型

---

## 10) CI/审查红线（必查清单）

* 分页库签名统一：`getPaginationMeta({ page, limit, total })`（若仓库仍有旧版，必须在同迭代内完成全量替换）
* 禁用模式：

  * `where("...", "ilike", ...)`、`eb.where(...)`、`where((eb)=> eb.where(...))`
  * `@/src/...`、相对路径层层上跳
  * 直接 `NextResponse.json(...)` 返回错误
* 排序/过滤：

  * 是否存在**白名单校验**（`sortBy`, `order`, `status` 等）
  * `orderBy` 的列名来自映射函数，不是任意字符串
* 计数一致性：`count(*)` 与主查询过滤一致
* 输出字段：**camelCase**；时间 `toISOString()`

---

## 11) 观测与日志

* 记录：路由名、方法、耗时、分页入参与页数据量（不含隐私）
* 错误：记录 `errorCode` 与堆栈摘要（屏蔽敏感信息）

---

## 12) 文档与示例

* API 文档中的**路径**、**查询参数名**、**字段命名**与实现必须一致
* 示例 `curl` 必须带鉴权头（如需）
* 文档中涉及迁移路径的示例必须指向 `migrations/`（而非 `src/migrations/`）

---

## 13) 兼容性与演进

* 若需修改公共工具（如 `pagination.ts` 签名），**先合并工具变更**，再在同迭代内**全量替换调用**；期间**不得**引入新旧两种写法并存的 PR
* 数据库变更遵循“**先向后兼容**（新增列/索引）→ 清理旧列/路径”的两步式


