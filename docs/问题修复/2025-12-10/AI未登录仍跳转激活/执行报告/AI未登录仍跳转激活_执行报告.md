## 执行报告：AI 未登录仍跳转激活

### 修改文件
- `src/contexts/SessionContext.tsx`（新增严格登录判定 `isAuthenticatedStrict`）
- `src/components/AuthGuard.tsx`（登录校验使用严格判定）
- `src/app/ai/page.tsx`（激活跳转仅在严格已登录时触发）
- `src/app/page.tsx`（登出后刷新会话缓存，强制回到未登录态）

### 变更说明
- 严格已登录：`status === "authenticated"` 且 `session.user.id` 为非空字符串才视为已登录，暴露 `isAuthenticatedStrict` 供路由/守卫使用。
- AuthGuard：需要登录的路由仅在 `!isAuthenticatedStrict` 时跳转登录，避免“假会话”误判。
- AI 页面：仅在严格已登录且未激活时跳转 `/activation`；未登录不再被视为未激活。
- 登出流程：调用 `update()` 刷新 SessionContext 缓存并回首页，清除残留会话。

### 自测结果
- 未登录（清空 cookie/隐身）：访问 `/ai` → 被登录拦截，不再跳 `/activation`。
- 已登录未激活：访问 `/ai` → 跳转 `/activation`，流程正常。
- 已登录已激活：访问 `/ai` → 直接进入 AI 页面。
- 登出后再点 AI：先回到未登录态，再次点击 AI 走登录流程，不再直达 `/activation`。
- 构建：`npm run lint`、`npm run build` 通过（仅有历史 warning）。

### 风险与同步
- 如新增需要登录的前缀，需同步 `isAuthRequiredPath` 使用者（AuthGuard/middleware 已共用配置）。
- 新增会话刷新机制：SessionContext 增加缓存过期与聚焦刷新，AuthGuard 进入保护路由时强制拉取最新 session，登出统一刷新，避免伪登录导致误跳 `/activation`。
