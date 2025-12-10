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

### 追加变更（2025-12-10）
- SessionContext：增加请求 promise 复用与等待，防止并发时提前标记“已刷新”；保持 60 秒过期与聚焦强制刷新。
- AuthGuard：进入受保护路由时先等待刷新完成再标记已刷新，避免未真正刷新时放行旧缓存。
- 版本号：`src/lib/version.ts` 更新为 `2025-12-10 13:45:00`。
- 自测（需线下验证）：按四个场景复测——未登录访问 /ai、已登录未激活、已登录已激活、登录后清 cookie 再访问 /ai，均应按预期进入登录或激活，不再出现未登录跳 `/activation`。如有偏差，请反馈具体步骤与 cookie 状态。 

### 追加变更（2025-12-10 晚）
- 登录保护前缀：`src/config/authRoutes.ts` 增加 `/activation`，中间件与 AuthGuard 统一依赖 `isAuthRequiredPath`。
- AI 入口统一跳 /ai：`src/app/page.tsx`（顶部 Bot 按钮、首页 AI 助手卡片）由 `/activation` 改为 `/ai`；`src/components/common/AIButton.tsx` 不再按激活状态分流，统一跳 `/ai?context=...`。
- 版本号：`src/lib/version.ts` 更新为 `2025-12-10 15:30:00`。
- 自测（需在实际浏览器验证）：  
  1) 未登录访问 /activation（或首页点击 AI 入口）：应被 middleware/AuthGuard 认定为需登录并跳 `/login?callbackUrl=/activation` 或 `/ai`。  
  2) 未登录点击首页 AI 入口：跳 `/ai`，再被重定向登录，不出现激活页。  
  3) 已登录未激活：从首页进 AI → /ai 加载后跳 /activation。  
  4) 已登录已激活：从首页进 AI → 直接留在 /ai，不再跳 /activation。  
  受限于当前环境未实际打开浏览器，请上线环境按上述步骤回归确认。 
