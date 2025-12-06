# iPhone Private 模式 · LINE OAuthCallbackError 诊断增强 v6 执行报告

## 规范对齐摘要
- 已读取：`docs/🔧指令模版/修复指令头5.2（现用）.md`、`AI板块整体架构说明.md`、`AI 服务研发规范 v1.0.md`、`AI 核心服务规范 v2.0.md`、`JSON清洗与语言过滤规范.md`、`文件结构.md`、`数据库结构_DRIVEQUIZ.md`、`数据库结构_AI_SERVICE.md`
- 边界遵守：只做诊断增强与前端文案归类；不改 `providers/line.ts`；不改其他 Provider；不改路由内部逻辑；不动 AI 模块；不涉及 DB 与文件结构
- 修改文件：`src/lib/auth.ts`、`src/app/login/page.tsx`、`src/lib/version.ts`
- 保持既有 OAuth 回调链路：`/api/auth/[...nextauth]` → `/login` 或 `/login/error`

## 现状复盘
- 触发 URL：`https://ai.zalem.app/login?error=OAuthCallbackError`
- 服务器日志：
  - `[NextAuth][Error] D: OAuth Provider returned an error. ...`
  - `type: 'OAuthCallbackError', kind: 'signIn'`
- 说明：上一轮 v5 已消除 `InvalidCheck/state` 问题；当前属于 Provider 回调阶段失败，NextAuth 收敛为 `OAuthCallbackError` 并重定向到 `/login`；具体失败原因（如 PKCE code_verifier 丢失 / token 请求 400 / userinfo 拉取失败）需要增强日志以可观测

## 修改内容
### 1) 增强 NextAuth 日志（`src/lib/auth.ts`）
- 在 `logger.error` 中增加针对 `OAUTH_CALLBACK_ERROR` 的详细打印：
  - 关键输出键：`code`、`metadata`（包含 `error`、`error_description`、`provider`、`account`、`profile` 等，视 Auth.js 实际提供而定）
  - 序列化失败时打印降级日志 `SerializeFailed`
- 在 `callbacks.redirect` 中记录带 `error=` 的跳转 URL 与 `baseUrl`，便于比对截图与实际重定向

### 2) 登录页友好文案归类（`src/app/login/page.tsx`）
- 针对 `error=OAuthCallbackError` 增加中性文案：
  - `"登录过程中出现错误，请检查网络或浏览器设置后重试，或更换登录方式。"`
  - 保持不暴露实现细节（不提及 PKCE/state/token），指引用户重试/换方式

### 3) 版本号更新（`src/lib/version.ts`）
- `BUILD_TIME` 更新为：`2025-12-07 00:10:00`

## 文件改动列表
- `src/lib/auth.ts`：增加 `redirect` 回调日志；增强 `logger.error` 针对 `OAUTH_CALLBACK_ERROR` 的详细 JSON 输出
- `src/app/login/page.tsx`：新增 `OAuthCallbackError` 文案映射项
- `src/lib/version.ts`：更新 `BUILD_TIME`

## 构建结果
- 命令：`npm run build`
- 结果：构建成功；无新增 TypeScript/ESLint error（存在若干既有 warning 与 hooks 依赖提示，保持现状，不在本次范围）

## 本地自测说明（计划）
- Mac 普通模式：
  - 模拟回调阶段错误（如配置无效或阻断回调）→ 观察服务端日志包含 `[NextAuth][LINE][OAuthCallbackError][Detail]` JSON 段
  - 访问 `/login?error=OAuthCallbackError` → 登录页出现新增的中性文案
- iPhone Safari Private：
  - 在私密模式下执行 LINE 登录，若出现 `OAuthCallbackError` → 请截图完整 URL，并采集服务器日志中 `[NextAuth][LINE][OAuthCallbackError][Detail]` 段落回传

## 下一步建议（需要产品侧配合）
- 请使用 iPhone Safari Private 模式再次尝试 LINE 登录，将出现时的：
  - 截图 URL（浏览器地址栏）
  - 服务器日志中 `[NextAuth][LINE][OAuthCallbackError][Detail]` 的完整 JSON 段
- 返回后我们将针对具体 `metadata.error/description/status` 与 `account/profile` 内容进行最终修复与兼容

---

（完）
