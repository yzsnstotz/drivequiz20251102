## 问题诊断报告：未登录访问 AI 仍被重定向到 /activation

### 1. 现象
- 用户在“未登录”状态点击首页 AI 入口，仍然落到 `/activation`，而不是先进入登录流程。

### 2. 代码路径与当前逻辑
- 路由入口：`src/app/ai/page.tsx`
  - 取会话：`useAppSession()` → `sessionStatus`
  - 取激活：`useActivation()` → `{ status, loading }`
  - 逻辑：`isAuthenticated = sessionStatus === "authenticated"`；`isActivated = isAuthenticated && !!status?.valid`
  - `useEffect`: `if (!isAuthenticated) return; if (!loading && !isActivated) router.replace("/activation");`
  - 渲染：未登录返回 `null`（交给 AuthGuard/middleware）；已登录未激活显示 Redirecting，占位等待 /activation 跳转。
- 登录拦截：middleware/AuthGuard 已按前缀保护 `/ai`，按理未登录会被重定向到 `/login`。
- 激活上下文：`ActivationContext` 在 `sessionStatus !== "authenticated"` 时不请求激活状态，`status` 为 `null`。

### 3. 复现线索与怀疑点
- 要触发 `/activation` 重定向，`isAuthenticated` 必须为 `true` 且 `status?.valid` 为 falsy。
- 在用户自报“未登录”场景仍走 `/activation`，意味着前端判定 `sessionStatus === "authenticated"`：
  - 可能原因：
    1) 浏览器仍持有登录 cookie，/api/auth/session 返回上一登录态；用户认为“未登录”但会话未清理。
    2) `useAppSession` 缓存未刷新：`SessionContext` 缓存 `sessionFetched`，若登出流程未调用其 `update()` 清空缓存，会继续认为已登录。
    3) 客户端跳转到 `/ai` 时，middleware/AuthGuard 因已有 cookie 判定通过，页面渲染并落入“已登录但未激活”分支。
- `ActivationContext` 不再把未登录视为未激活；因此触发 `/activation` 必须来自“会话被认定为已登录”。

### 4. 影响范围
- 持有残留登录态（cookie/缓存）的用户：点击 AI 入口被视为“已登录未激活”，直接跳 `/activation`，而非 `/login`。
- 真正未登录且 cookie 已清理的用户：按理应被 middleware/AuthGuard 拦到 `/login`，需确认是否存在特定入口或客户端导航绕过。

### 5. 现有日志/可验证点
- 在 `/ai/page.tsx` 打印 `sessionStatus` 与 `status?.valid` 可验证是否被判为 authenticated。
- 检查登出流程是否调用 `SessionContext.update()` 或清理 `sessionFetched` 缓存；若无，前端可能一直认为“已登录”。
- 确认用户报告时的 cookie 状态：若 cookie 仍在，行为符合“已登录未激活”分支。

### 6. 初步结论
- `/activation` 跳转来自 `/ai/page.tsx` 对“已登录未激活”的处理；未登录用户仍被认为已登录，说明会话状态未被正确清空或仍有有效 cookie。

### 7. 后续修复方向（需另行下达执行指令）
- 确认/修正登出流程：清除 session 缓存与 cookie，确保 `sessionStatus` 变为 `unauthenticated`。
- 如需强制校验登录：在 `/ai/page.tsx` 或 AuthGuard 中增加对 `session?.user?.id` 判定，避免“空/旧 session”被视为已登录。
- 在复现环境中清理 cookie 后再次验证：应落到 `/login`，而非 `/activation`；若仍直达 `/activation`，需排查 AuthGuard/middleware 是否被绕过或缓存。 
