# iPhone Private 模式 · LINE OAuthCallbackError 全量日志 v7 执行报告

## 规范对齐摘要
- 修改边界：仅 `src/lib/auth.ts`（logger + redirect 日志），允许必要的轻量 util；不改 Provider、不改 `/api/auth/[...nextauth]`、不改页面业务逻辑、AI 模块与数据库结构不变
- 红线遵守：A1 路由不承载业务；E1/E7/E8 最小变更集；D1 输出完整执行报告
- 保持既有链路：`/api/auth/[...nextauth]` → `/login` 或 `/login/error`

## 已阅读文件
- `docs/🔧指令模版/修复指令头5.2（现用）.md`
- `/Users/leo/Desktop/drivequiz研发规范/AI板块整体架构说明.md`
- `/Users/leo/Desktop/drivequiz研发规范/🧩 AI 服务研发规范（ai-service 统一架构规范 v1.0）.md`
- `/Users/leo/Desktop/drivequiz研发规范/🧩 AI 核心服务规范（ai-core 统一架构规范 v2.0）.md`
- `/Users/leo/Desktop/drivequiz研发规范/JSON清洗与语言过滤规范.md`
- `/Users/leo/Desktop/drivequiz研发规范/文件结构.md`
- 数据库结构（确认无变更）：`/Users/leo/Desktop/drivequiz研发规范/数据库结构_DRIVEQUIZ.md`、`/Users/leo/Desktop/drivequiz研发规范/数据库结构_AI_SERVICE.md`
- 认证相关：`src/lib/auth.ts`、`src/app/login/page.tsx`

## 现状复盘
- 生产日志：`[NextAuth][Error] D: OAuth Provider returned an error. type: 'OAuthCallbackError' kind: 'signIn'`
- v6 期望的详细 `metadata` JSON 未出现 → 说明生产环境未走自定义 logger（可能被默认 logger 覆盖或条件过滤）

## 修改内容
- 强制覆盖 NextAuth `logger`（生产可见）：统一输出 `Debug/Warn/Error`，并在 `Error` 中追加两段 JSON：
  - `[NextAuth][Error][Detail]`：`{ code, metadata }` 的完整 JSON
  - 针对 `OAuthCallbackError` 再输出：`[NextAuth][LINE][OAuthCallbackError][Detail]`
- `callbacks.redirect`：无条件打印 `[NextAuth][Redirect] { url, baseUrl }`
- 不改其它 callbacks 与 Provider 配置；不改页面流程（仅确认 `error` 参数读取）

## 文件改动列表
- `src/lib/auth.ts`：
  - 增强 `logger.debug/warn/error`（生产启用、完整 JSON、不折叠、不过滤）
  - 增强 `callbacks.redirect` 打印完整 URL
- `src/lib/version.ts`：更新 `BUILD_TIME = "2025-12-07 00:20:00"`

## 构建结果
- 命令：`npm run build`
- 结果：构建成功；无新增 TS/ESLint error（保留既有 warning）

## 本地自测计划
- 构造 `OAuthCallbackError`：停用 LINE 或断网或无效回调
- 观察服务端日志：应出现以下四段输出：
  - `[NextAuth][Error][Raw]`
  - `[NextAuth][Error][Detail]`（含 `code/metadata` 完整 JSON）
  - `[NextAuth][LINE][OAuthCallbackError][Detail]`
  - `[NextAuth][Redirect] { url, baseUrl }`
- 登录页：`/login?error=OAuthCallbackError` 显示中性失败提示（v6 已处理）

## 红线与边界自检
- 路由不承载业务（A1）：已遵守
- 最小变更（E1/E7/E8）：仅 `auth.ts` 与版本号；无冗余新增、无重复实现
- 执行报告（D1）：已输出
- AI 模块边界（F1–F5）：未改动任何 ai-core/ai-service/local-ai-service；未绕过统一管线

## 下一步协作
- 请在 iPhone Safari Private 模式下重试 LINE 登录；将出现的日志段落 `[NextAuth][Error][Detail]` 与 `[NextAuth][LINE][OAuthCallbackError][Detail]` 完整 JSON 回传（含 `error/description/status/code_verifier/token` 等字段），用于最终定位并修复私密模式下的回调失败

## 版本号
- `BUILD_TIME = 2025-12-07 00:20:00`

---

（完）
