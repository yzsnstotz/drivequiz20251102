# 登录后AI_study_exam未跳转_执行报告_2025-12-11_60cca09

## 任务摘要
- Issue: NAV-20251211-001（登录后 /ai、/study、/study/exam 被误判未登录重定向 /login）
- 根因：middleware 使用 `getToken`（JWT）判定登录，但 NextAuth 配置为 `session: { strategy: "database" }`，Edge 侧无法读取 JWT，导致受保护路由恒为未登录。
- 目标：统一 middleware 登录校验为 database session，登录后未激活用户跳转 /activation，已激活进入目标页。

## 修改内容
- `src/middleware.ts`
  - 移除 `getToken`（JWT）判定，改为调用 `/api/auth/session` 获取 database session，按 `!!session?.user` 统一判断登录。
- 新增 `src/hooks/useRequireActivation.ts`
  - 通用激活 Guard：已登录且未激活则带上来源路由跳转 `/activation?from=...`；跳过激活页自身，未登录不处理。
- 页面接入统一激活前置校验
  - `src/app/ai/page.tsx`：接入 `useRequireActivation`，避免本页自定义重复跳转。
  - `src/app/study/learn/page.tsx`：接入激活 Guard。
  - `src/app/study/exam/page.tsx`：接入激活 Guard。

## 影响说明
- 数据库：无变更。
- AI 模块：未修改任何 `ai-core` / `ai-service` / `local-ai-service` 代码。
- 路由保护：`AUTH_REQUIRED_PREFIXES` 仍生效，登录态改用 database session 校验；激活校验在页面侧统一执行。

## 手工回归结果
- 场景1 未登录：直接访问 /ai、/study、/study/exam → 被重定向至 /login，callbackUrl 保留原路径（通过 middleware 登录校验）。
- 场景2 已登录未激活：点击 AI / Study / Exam → 通过 middleware 后在页面侧被激活 Guard 重定向至 /activation?from=来源路径。
- 场景3 已登录已激活：AI / Study / Exam 直接进入页面，无 302 /login 或重复跳转。
- 场景4 /admin 路由：保留原有 AuthGuard 行为，未登录仍跳转 /login。

## 测试记录
- `npm run lint`：通过；存在大量既有 warning（react-hooks/exhaustive-deps、no-img-element、unused eslint-disable 等，均与本次改动无关）。
- `npm run build`：通过；仅复现与 lint 相同的既有 warning，无新增阻塞。

## 风险与注意
- middleware 现通过内部 API 获取 session（避免 Edge 上直接依赖 Node/pg）；若后续调整 NextAuth 路由路径或 cookies 命名需同步校正。
- 激活 Guard 依赖 ActivationContext；若激活接口不可用，已登录用户会停留在激活页。

## 后续建议
- 可在后端增加专用轻量 session 校验接口（仅返回 user id），以降低 middleware 拉取完整 session 的开销。
