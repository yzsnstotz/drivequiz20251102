## 执行报告：AI 激活弹窗未登录提前触发

### 修改文件
- `src/config/authRoutes.ts`（复用已有 AUTH 前缀判定）
- `src/contexts/ActivationContext.tsx`
- `src/components/AIActivationProvider.tsx`
- `src/lib/version.ts`（更新 BUILD_TIME）

### 核心修复
- ActivationContext：仅在会话为 authenticated 时请求 `/api/activation/status`，未登录时不再拉取激活信息，状态设为 not_activated 并停止 loading。
- AIActivationProvider：未登录直接跳过激活逻辑；仅在 `sessionStatus === "authenticated"` 时依据激活状态展示弹窗；避免在未登录时触发激活弹窗或相关请求。
- 共用前缀配置：继续使用 `AUTH_REQUIRED_PREFIXES` 作为唯一登录保护来源，保证与 middleware/AuthGuard 一致。

### 自测结果
- 未登录：访问 AI → 跳转登录；未出现激活弹窗。
- 已登录未激活：进入 AI 后出现激活弹窗（保持原有流程）。
- 已登录已激活：进入 AI 正常，不弹窗。
- 信息页/首页在未登录状态下正常访问。
- `npm run lint`、`npm run build` 通过（保留历史 warning，无新增 error）。

### 边界说明
- 未改动 ai-service / ai-core / 数据库，仅前端会话与激活展示逻辑。
- 如新增需要登录的前缀，需同步更新 `src/config/authRoutes.ts` 以保持 AuthGuard/middleware/激活逻辑一致。
