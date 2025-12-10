## 执行报告：AI 页面激活跳转修复

### 修改文件
- `src/app/ai/page.tsx`

### 变更说明
- 引入会话状态 gating：`isAuthenticated = sessionStatus === "authenticated"`。
- 仅在「已登录且激活检查完成且未激活」时重定向 `/activation`；未登录/加载中不再视为未激活，也不再触发激活重定向。
- 未登录时返回空渲染，交由 AuthGuard/middleware 统一处理登录跳转。

### 自测结果
- 未登录：访问 `/ai` 不再直跳 `/activation`，由登录拦截处理。
- 已登录未激活：访问 `/ai` → 正常进入后重定向 `/activation`。
- 已登录已激活：访问 `/ai` → 直接进入 AI 页面，无弹窗/重定向。
- 构建：`npm run lint`、`npm run build` 通过（仅有历史 warning）。
