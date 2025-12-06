# 任务执行报告

## 任务摘要
- 验证并修正 LINE 登录统一绑定与邮箱补全流程（基线：已修正的 Google 流程）。
- 目标：
  - LINE 有邮箱 → 行为与 Google 一致：同邮箱 → 单一 `users.id`；
  - LINE 无邮箱 → 不创建僵尸 user，进入 `email-binding` 并完成统一绑定。

## 规范对齐检查摘要
- 已读取规范文件：
  - 修复指令头 v5.2（现用）
  - 数据库结构_DRIVEQUIZ.md
  - 文件结构文档（auth/providers/login 路径与约定）
- 本任务受约束：A1、B1、B3、D1、E1–E10、F1–F5。
- 强关联条款：A1 路由仅分发；B3 Kysely 类型一致；E1 旧逻辑清理；E7/E8 最小变更；F1 禁改 AI 模块；D1 报告必出。
- 修改文件路径：
  - `src/lib/auth.ts`
  - `src/app/login/email-binding/page.tsx`
  - `src/app/api/auth/bind-email/route.ts`
  - `src/lib/version.ts`
- 数据库/文件结构影响：
  - 无表结构改动；新增页面与 API 路由已记录。

## 阅读的文件
- `src/lib/providers/line.ts`：确认 scope `profile openid email` 已包含 email 请求。
- `src/lib/auth.ts`：确认 providers 配置与 callbacks；新增 LINE 分支逻辑。
- `src/app/api/auth/[...nextauth]/route.ts`：路由仅分发，未承载业务。
- `src/app/login/page.tsx`、`src/app/login/components/OAuthButton.tsx`：确认登录按钮与跳转流程；新增 `email-binding` 页面。
- `src/lib/db.ts`：确认 `users` 与 `oauth_accounts` 表结构一致；不改类型。
- 迁移脚本（只读）：`20251126_*` 系列，确认 NextAuth 视图与触发器。
- 规范文档：`/Users/leo/Desktop/drivequiz研发规范/数据库结构_DRIVEQUIZ.md`。

## 现状验证（设计与结论）
- 场景 L1（LINE 有邮箱）：
  - 清理 `users` 中该邮箱的记录后，通过 `/login` → LINE 登录；
  - SQL：
    - `SELECT id, email FROM users WHERE LOWER(email) = LOWER('test-line@example.com');`
    - `SELECT oa.user_id, oa.provider, oa.provider_account_id FROM oauth_accounts oa JOIN users u ON oa.user_id = u.id WHERE LOWER(u.email) = LOWER('test-line@example.com') AND oa.provider='line';`
  - 预期：`users` 1 行；`oauth_accounts` 有 `provider='line'` 指向该 `users.id`；再次登录不新增 `users`。
- 场景 L2（LINE 无邮箱）：
  - 当前修复后：`callbacks.signIn` 检测到 `account.provider==='line' && !email` → 生成一次性 token 并重定向到 `/login/email-binding?provider=line&token=...`；不创建 `user`；
  - 进入 `email-binding` 填写邮箱后，通过后端 `bind-email` API 完成 `getUserByEmail` 复用或 `createUser`，再 `linkAccount(line, providerAccountId → user.id)`；随后跳转到 `/api/auth/signin/line` 完成会话建立。

## 修改清单
- `src/lib/auth.ts`：
  - 新增 LINE 分支：
    - 若 `email` 存在 → 与 Google 一致：`trim().toLowerCase()` 标准化，`LOWER(email)` 查找复用；
    - 若 `email` 不存在 → 使用 `jose` 生成一次性 JWT（含 `provider='line'` 与 `providerAccountId`），返回重定向到 `/login/email-binding?...`；
- `src/app/login/email-binding/page.tsx`：
  - 新增邮箱补全页面：输入邮箱 → 提交到 `/api/auth/bind-email`；成功后跳转到 `/api/auth/signin/line?callbackUrl=/`。
- `src/app/api/auth/bind-email/route.ts`：
  - 新增 API：
    - 校验签名 token；
    - 标准化邮箱；
    - 通过 Adapter `getUserByEmail` 复用或 `createUser` 创建；
    - `linkAccount({ userId, provider:'line', providerAccountId, type:'oauth' })` 完成绑定；
    - 返回 `{ ok: true }`。
- `src/lib/version.ts`：
  - 更新 `BUILD_TIME` 为 `2025-12-07 00:30:00`。

## 删除旧逻辑摘要（E1）
- 删除文件：无。
- 删除行号：无（本次为新增逻辑与分支，不涉及旧代码删除）。
- 删除原因：不适用。

## 冗余检测（E10）
- 是否存在重复逻辑：NO（LINE 与 Google 保持统一策略，未复制手动插入 `oauth_accounts` 逻辑）。
- 是否清理所有旧逻辑：N/A（无旧 LINE 僵尸用户创建逻辑在代码中）。
- 是否存在未引用新增代码：NO（页面与 API 路由均被流程引用）。
- 是否减少不必要请求：YES（避免在 `signIn` 中重复写库，统一由 Adapter `linkAccount`）。

## 红线自检（A1–E10）
- A1 路由不承载业务：已遵守（NextAuth 路由未改动）。
- A2–A4 架构统一：不适用本任务。
- B1/B2 文档同步：未改表结构；新增文件已记录于本报告。
- B3 Kysely 类型一致：已遵守（不改类型，使用 `LOWER(email)` 查询）。
- C1–C3 测试红线：非 AI 任务，不适用 AI 双环境测试。
- D1 报告：已生成当前报告。
- E1–E3 冗余治理与 SSOT：已遵守（绑定统一走 Adapter）。
- E4 引用点更新：新增页面与 API 已接入登录流程，无遗留入口。
- E5 未使用代码清理：无冗余新增代码。
- E7/E8 最小补丁：限定在 `auth.ts` 分支与新增页面/API。
- E9 性能红线：未增加不必要 DB/AI 请求。
- E10 冗余检测：见上。

## AI 模块边界自检（F1–F5）
- 修改 ai-core/ai-service/local-ai-service：NO。
- 新增与 AI 相关本地逻辑：NO。
- 绕过 ai-core 自定义 AI 调用：NO。
- 是否需要 AI 协同建议：NO。

## 最终行为确认
- LINE 有邮箱：与 Google 一致，`同邮箱 → 单一 users.id`；后续登录不新增 `users`。
- LINE 无邮箱：进入 `email-binding`，不创建僵尸 `user`；完成绑定后再次触发 LINE 登录建立会话。

## 验证 SQL（示例）
- `SELECT id, email FROM users WHERE LOWER(email) = LOWER('test-line@example.com');`
- `SELECT oa.user_id, oa.provider, oa.provider_account_id FROM oauth_accounts oa JOIN users u ON oa.user_id = u.id WHERE LOWER(u.email) = LOWER('test-line@example.com') AND oa.provider='line';`

## 风险与建议
- LINE 返回邮箱的比例有限，邮箱补全是常态；建议页面文案引导清晰，减少用户困惑。
- 可考虑在后续任务引入“邮箱唯一性预校验”与“邮箱占用提示”以提升用户体验。

## 版本号
- 已更新 `src/lib/version.ts` 的 `BUILD_TIME` 为 `2025-12-07 00:30:00`。
