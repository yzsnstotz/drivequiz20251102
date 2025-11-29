 🛠️ 《ZALEM 前台系统 · 统一研发规范 vNext》

该文档严格参照你上传的《05-ZALEM 后台管理 API · 统一研发规范 vNext.md》的结构与语气风格，
同时结合前台的 **Next.js 15（App Router）+ TypeScript + Supabase + AI Service API 交互** 的特性。
目标是：统一代码结构、接口交互、命名、分页、国际化、组件风格、日志与安全标准，
保证多团队协作下的前台研发一致性。

---

# 🛠️ ZALEM 前台系统 · 统一研发规范 vNext

> 适用范围：Next.js 15 (App Router) + TypeScript + Tailwind CSS + Supabase API + AI Service 调用
> 目标：在多人协作及多语言前台开发中，保证**目录、接口调用、状态管理、命名、样式与错误处理完全一致**。

---

## 1️⃣ 目录与路径规范

* **根别名**：`@` 固定指向 `src/`

  * ✅ `@/lib/apiClient`、`@/components/common`
  * ❌ `@/src/...` 或 `../../../` 式相对路径
* **页面结构**（示例）

  ```
  apps/web/
  └── app/
      ├── (main)/           # 前台主模块
      │   ├── license/      # 驾照学习
      │   ├── vehicles/     # 车辆
      │   ├── services/     # 服务
      │   ├── profile/      # 我的
      │   └── ai/           # 智能助手
      ├── language/         # 语言选择页
      ├── activate/         # 激活页
      └── questionnaire/    # 用户问卷
  ```
* **组件目录**

  * `src/components/common/` ：通用组件（按钮、输入框、分页）
  * `src/components/layouts/` ：布局组件（导航、页眉、页脚）
  * `src/components/ui/` ：封装 shadcn/ui 基础组件
* **禁止** 跨层导入页面内部组件。共享组件须放在 `components/common`。

---

## 2️⃣ 状态管理与数据流

* **Pinia 或 React Context** （取决于模块）：

  * 用户状态 → `useUserStore()`
  * 语言状态 → `useLanguageStore()`
  * 主题/配置 → `useAppConfig()`
* **服务端数据**：

  * 页面默认使用 `fetch()` 带缓存策略：

    ```ts
    fetch(url, { next: { revalidate: 60 } });
    ```
  * 动态数据必须 `dynamic = "force-dynamic"`。
* **API 调用统一封装**：见 § 5。

---

## 3️⃣ 文件命名与组件规范

| 类型     | 命名规则           | 示例                       |
| ------ | -------------- | ------------------------ |
| 页面     | `page.tsx`     | `/app/vehicles/page.tsx` |
| 组件     | PascalCase     | `VehicleCard.tsx`        |
| Hook   | useXxx         | `useFetch.ts`            |
| API 封装 | camelCase      | `getVehicles.ts`         |
| 样式     | Tailwind class | `bg-gray-100 text-sm`    |

* 组件文件 **必须导出默认组件**，并带 `Props` 类型定义。
* 所有组件应具备最少注释：

  ```ts
  /** 车辆卡片组件 - 展示车辆图片与基本信息 */
  ```

---

## 4️⃣ 接口调用与 API 客户端

* **统一客户端** `src/lib/apiClient.front.ts`

  ```ts
  export async function apiGet<T>(path: string, params?: Record<string, any>): Promise<T> {}
  export async function apiPost<T>(path: string, body: any): Promise<T> {}
  ```
* 自动追加：

  * `Authorization: Bearer <token>` （若用户已登录）
  * `Accept-Language` （来自语言状态）
* 错误格式：

  ```json
  { "ok": false, "errorCode": "VALIDATION_FAILED", "message": "..." }
  ```
* 禁止在组件内直接写 `fetch('/api/...')`；必须经 apiClient 调用。

---

## 5️⃣ 接口响应与错误处理

* 成功：

  ```ts
  { ok: true, data, pagination? }
  ```
* 失败：

  ```ts
  { ok: false, errorCode, message }
  ```
* 常见 errorCode 白名单：
  `AUTH_REQUIRED | FORBIDDEN | VALIDATION_FAILED | NOT_FOUND | INTERNAL_ERROR`
* 前端处理：

  * 若 401 → 重定向登录页 `/activate`
  * 若 429 → 显示“操作过于频繁”
  * 若 500 → Toast 提示“系统繁忙”

---

## 6️⃣ 分页与排序（前端约定）

```ts
interface PaginationParams {
  page?: number;      // 默认1
  limit?: number;     // 默认20
  sortBy?: string;    // 白名单字段
  order?: 'asc'|'desc'; // 默认desc
}
```

* 分页组件统一使用 `<Pagination meta={pagination} onPageChange={...} />`
* 后端返回 `pagination: { page, limit, total, totalPages }`
* 禁止在前端自行拼接 SQL 排序参数；仅透传经验证的 sortBy / order。

---

## 7️⃣ 国际化与多语言

* **语言源**：`/src/locales/{ja,zh,en,vi,hi}.json`
* **读取方式**：

  ```ts
  import { t } from '@/lib/i18n';
  t('license.start_exam');
  ```
* **语言存储**：`user_profiles.language` 同步；
* **默认语言**：自动检测浏览器语言 → 落地确认页；
* **动态切换**：切换语言 → 刷新 locale Context 并触发重渲染。

---

## 8️⃣ 样式与 UI 规范

* **Tailwind CSS** 基础色板遵循：

  * 主色：`primary = blue-600`
  * 警告：`warning = amber-500`
  * 成功：`success = emerald-500`
  * 错误：`error = red-500`
* **圆角与阴影**：

  * 卡片：`rounded-2xl shadow-md p-4`
  * 按钮：`rounded-xl px-4 py-2`
* **动效**：

  * 使用 Framer Motion 统一动画；
  * 过渡时间 150 – 250 ms；
* **图标**：

  * 统一使用 `lucide-react`；
  * 命名与语义一致：`<IconCar />`, `<IconUser />`

---

## 9️⃣ 组件通信与属性规范

* **Props** 命名 camelCase，明确类型。
* 所有可选属性须显式 `?`。
* 父→子通信使用 props；子→父用 回调事件（`onChange`、`onSelect` 等）。
* 禁止跨模块直接调用其他模块的内部 state。

---

## 10️⃣ 安全与隐私

* **用户识别**：仅使用 `userid` 标识；禁止直接使用邮箱。
* **日志脱敏**：AI 问答、行为日志不记录个人信息。
* **存储安全**：

  * LocalStorage → 仅保存 token 与 language；
  * 敏感字段需加密 (若后续接入支付)。
* **CSRF/注入防护**：前端统一使用 `fetch` 携带 Origin + Header 验证。

---

## 11️⃣ 测试与类型要求

* **类型检查**：`npx tsc --noEmit` 必须通过；无隐式 any。
* **Lint**：ESLint / Prettier 无阻断错误。
* **测试覆盖**：

  * 组件 → Jest + @testing-library/react
  * API 客户端 → Vitest mock 测试
* **快照测试**：关键组件（LanguageSelector, LicenseCard）应保留快照。

---

## 12️⃣ 日志与观测

* 页面级埋点：

  * `usePageAnalytics()` 自动上报 view 事件。
  * 事件写入 `/api/user-behaviors`。
* 错误日志：

  * 捕获 `window.onerror` → 上报 `error` 行为。
* AI 会话：

  * 每次 `/api/ai/ask` 成功 → 记录 `ai_chat` 行为。
* 禁止上传完整堆栈与敏感文本。

---

## 13️⃣ 部署与构建

* **构建命令**：`npm run build` → Vercel 自动化。
* **环境变量**（前端读取前缀）：

  * `NEXT_PUBLIC_SUPABASE_URL`
  * `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  * `NEXT_PUBLIC_AI_SERVICE_URL`
* **静态缓存**：图片使用 Next Image 优化；API 60 秒 revalidate。
* **Vercel Preview** 用于测试分支；主线 Main 仅部署 Production。

---

## 14️⃣ 代码提交规范（Git）

| 类型  | 前缀        | 示例                                        |
| --- | --------- | ----------------------------------------- |
| 新功能 | feat:     | `feat: add vehicles list page`            |
| 修复  | fix:      | `fix: pagination meta mismatch`           |
| 文档  | docs:     | `docs: update frontend api spec`          |
| 重构  | refactor: | `refactor: unify apiClient error handler` |
| 样式  | style:    | `style: adjust button colors`             |

* 每个 commit ≤ 300 行变更；
* 每个 PR 必须关联 Issue 或 任务编号；
* 禁止 `console.log` 残留。

---

## 15️⃣ CI / 审查红线 （前台）

| 项目         | 要求                        |
| ---------- | ------------------------- |
| ✅ 文件命名     | 全部 camelCase / PascalCase |
| ✅ 路径引用     | 统一 `@` 别名                 |
| ✅ 接口调用     | 仅经 apiClient 封装           |
| ✅ 分页组件     | 使用统一 `Pagination`         |
| ✅ i18n key | 存在于 locales JSON 中        |
| ✅ 响应结构     | `{ ok, data }` 格式         |
| ✅ 时间格式     | ISO UTC                   |
| ✅ 安全校验     | token 与语言头正确              |
| ❌ 禁止       | 直接访问数据库、硬编码URL、随意fetch    |

---

## 16️⃣ 演进与兼容策略

* **向后兼容**：

  * 保留旧 `/api/activate` 接口；
  * 新增接口全部向后兼容，不破坏旧功能。
* **版本迭代**：

  * vNext → 统一导航、多模块、多语言；
  * vNext + 1 → 积分系统 + 订阅；
  * vNext + 2 → 语音与移动端支持。
* **规范更新**：任何全局工具签名修改（如 pagination、apiClient）必须在同迭代完成全量替换。

---

## 17️⃣ 文档与示例要求

* 所有新 API 与组件须更新至：

  * `docs/frontend-api-reference.md`
  * `docs/frontend-component-guide.md`
* 示例 curl 或 截图须可直接运行；
* 示例 Props 示范：

  ```tsx
  <VehicleCard
    id={123}
    brand="Toyota"
    model="Aqua"
    price={1680000}
    onSelect={() => openDetail(123)}
  />
  ```

---

**维护者**：前台研发组（Web Lead）
**最后更新**：2025-11-07
**状态**：✅ 已批准执行，用于 vNext 开发基线。
