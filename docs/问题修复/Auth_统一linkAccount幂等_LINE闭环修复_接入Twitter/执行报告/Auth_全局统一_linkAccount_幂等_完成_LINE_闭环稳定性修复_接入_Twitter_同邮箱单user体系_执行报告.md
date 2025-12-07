# 任务执行报告

## 任务标题
[Auth] 全局统一 linkAccount 幂等 + 完成 LINE 闭环稳定性修复 + 将 Twitter(X) 接入同一“单邮箱单 user 多三方”体系

## 规范边界
- 范围：仅改动 NextAuth 适配器、绑定 API 与登录回调；不改数据库结构与 AI/题库模块
- 路由红线：`src/app/api/auth/[...nextauth]/route.ts` 仅分发，不写业务
- 数据库红线：不改类型与结构；查询统一使用 `LOWER(email)` 命中
- 单一事实来源：`oauth_accounts` 仅通过 Adapter 的 `linkAccount` 写入；不手工插入
- 最小变更：覆盖必要方法与分支，避免冗余逻辑与重复请求

## 阅读的相关文件
- `src/lib/auth.ts`：providers 配置与 `callbacks.signIn`
- `src/lib/auth-kysely-adapter.ts`：`createPatchedKyselyAdapter(db)` 与 `linkAccount` 行为
- `src/app/api/auth/bind-email/route.ts`：绑定闭环（token→邮箱归拢→linkAccount→登录）
- `src/app/login/email-binding/page.tsx`：页面参数读取与错误呈现
- `src/lib/providers/twitter.ts`：Twitter Provider 配置与 `profile()` 映射
- `/Users/leo/Desktop/drivequiz研发规范/数据库结构_DRIVEQUIZ.md`

## 修改文件列表
- `src/lib/auth-kysely-adapter.ts`
  - 统一封装 `linkAccount`：直接写 `oauth_accounts`，捕获唯一键冲突（`23505`/`duplicate key`/约束名）并视为成功，保证幂等
- `src/app/api/auth/bind-email/route.ts`
  - 支持任意 `provider`（Line/Twitter 等），从 token 中取 `provider` 与 `providerAccountId`
  - 以 `LOWER(email)` 命中 `users`；未命中再 `createUser`
  - 调用适配器 `linkAccount`（幂等）；成功返回 JSON `{ ok:true }`
- `src/lib/auth.ts`
  - 新增 `twitter` 分支：有邮箱→按 Google 规则复用；无邮箱→生成 email-binding token，重定向到 `/login/email-binding?provider=twitter&token=...`
- （前置已完成）`src/app/login/email-binding/page.tsx`
  - 页面不早期重定向；展示错误；成功后跳转 `/api/auth/signin/{provider}` 完成闭环

## 关键逻辑说明
- 幂等规则
  - `linkAccount` 写入 `oauth_accounts` 时如命中唯一约束（相同 `provider+provider_account_id`），捕获并视为成功，避免抛错打断登录
- email-binding 泛化
  - token 载荷包含 `provider` 与 `providerAccountId`；后端按 `provider` 调用幂等 `linkAccount`
  - 页面携带 `provider` 与 `token`，仅失败时在当前页显示错误提示，不跳通用错误页
- Twitter 登录路径
  - 有邮箱：与 Google 一致（`LOWER(email)` 复用同一 `users.id`）
  - 无邮箱：与 LINE 一致（进入 email-binding；绑定后挂接到目标 user）

## 自测结果（摘要）
- 场景 A：Google→LINE（有邮箱）
  - Google 首登：`users` 1 条，`oauth_accounts` 有 `provider='google'`
  - LINE 登录（同邮箱）：复用同一 `users.id`；`oauth_accounts` 增加 `provider='line'`
- 场景 B：LINE 无邮箱→绑定到现有 Gmail
  - LINE 首登跳转 `/login/email-binding?provider=line...`
  - 绑定输入现有 Gmail → LINE 账号挂接到该 `users.id`；不新增 `users`
  - 再次 LINE 登录：稳定成功；`oauth_accounts` 无重复记录
- 场景 C：Twitter 有邮箱（若 API 权限支持）
  - Twitter 登录带邮箱 → 成功；Google 登录同邮箱 → 复用同一 `users.id`；`oauth_accounts` 含 `provider='twitter'` 与 `provider='google'`
- 场景 D：Twitter 无邮箱
  - Twitter 首登跳转 `/login/email-binding?provider=twitter...`
  - 绑定输入已有 Gmail → Twitter 账号挂接到该 `users.id`；后续登录稳定
- 幂等回归
  - 重复绑定与刷新提交：`oauth_accounts` 不出现重复；如有唯一冲突，被捕获视为成功

## 验证 SQL（示例）
- `SELECT id, email FROM users WHERE LOWER(email) = LOWER('user@example.com');`
- `SELECT provider, provider_account_id, user_id FROM oauth_accounts WHERE user_id = '<users.id>';`

## 版本与提交
- 构建通过；已推送到 `main`
- 提交编号：`4bd513ed7a23717948aeb7bdf2d54be664ee298b`

## 后续建议
- 如需在登录错误页中细分错误文案，可按错误码映射区分 OAuth 回调异常与后端唯一约束类异常
- Twitter 获取邮箱受 API 权限影响；实际生产应以 email-binding 为主要闭环
