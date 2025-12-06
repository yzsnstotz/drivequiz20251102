# 任务执行报告

## 任务摘要
- 验证并修正 Google 登录“同邮箱单一 user 绑定逻辑”（基线 v4）。
- 目标：确保同一 email 在 `users` 仅对应一个 `users.id`；Google 首次登录创建/复用单一用户并写入 `oauth_accounts`，后续登录不再创建新 `users`。

## 规范对齐检查摘要
- 已读取规范文件：
  - 修复指令头 v5.2（现用）
  - 数据库结构_DRIVEQUIZ.md
  - 文件结构文档（路径结构与约定）
- 本任务受约束：A1、B1、B3、D1、E1–E10、F1–F5。
- 强关联条款：A1 路由不承载业务；B3 Kysely 类型一致；E1 伴随旧逻辑清理；E7/E8 最小变更；F1 禁改 AI 模块；D1 必须生成执行报告。
- 修改文件路径：
  - `src/lib/auth.ts`
  - `src/lib/version.ts`
- 数据库/文件结构影响：
  - 未改动表结构（仅读取确认）；无迁移脚本新增；文件结构仅新增本报告。

## 阅读的文件
- `src/lib/auth.ts`：NextAuth providers/callbacks/adapter 配置。
- `src/lib/auth-kysely-adapter.ts`：封装 `createPatchedKyselyAdapter` 与 `linkAccount` 行为。
- `src/app/api/auth/[...nextauth]/route.ts`：NextAuth API 路由入口（只做分发）。
- `src/lib/db.ts`：确认 `users` 与 `oauth_accounts` 的结构与 Kysely 类型。
- 迁移脚本（只读）：`20251126_*` 系列，确认 `oauth_accounts` 与 NextAuth 视图/触发器。
- 规范文档：`/Users/leo/Desktop/drivequiz研发规范/数据库结构_DRIVEQUIZ.md`。

## 验证过程（计划与可重复步骤）
- 测试 email：`test-google@example.com`（建议选择 `users` 中不存在的邮箱）。
- 场景 A：首次 Google 登录（email 尚不存在）。
  - 访问 `/login`，进行 Google OAuth。
  - SQL 验证：
    - `SELECT id, email, created_at FROM users WHERE LOWER(email) = LOWER('test-google@example.com');`
    - `SELECT oa.user_id, oa.provider, oa.provider_account_id FROM oauth_accounts oa JOIN users u ON oa.user_id = u.id WHERE LOWER(u.email) = LOWER('test-google@example.com');`
- 场景 B：第二次及以后 Google 登录（同 email）。
  - 登出后重复同账号登录。
  - SQL 验证：同上两条查询。
- 预期：
  - A/B 均应满足：`users` 仅 1 行；`oauth_accounts` 至少 1 行且 `provider='google'` 指向同一 `users.id`；后续登录不新增 `users`。

## 代码改动清单
- `src/lib/auth.ts`：
  - 在 `callbacks.signIn` 针对 `google`：
    - 提取 `profile/user` 的邮箱，做 `trim().toLowerCase()` 标准化。
    - 使用 `LOWER(email)` 进行不区分大小写查找现有用户：如存在则将 `user.email` 设为已有用户的原始邮箱值（确保后续 `getUserByEmail` 精确命中并复用该 `users.id`）；不存在则设置为标准化后的小写邮箱。
    - 移除“手动写入 oauth_accounts 并更新 users.oauth_provider”的旧逻辑，避免与 Adapter 的 `linkAccount` 重复插入导致唯一键冲突。
  - 对后续电话号码检查同样改为 `LOWER(email)` 比较，逻辑保持不变。
- `src/lib/version.ts`：
  - 更新 `BUILD_TIME` 为 `2025-12-07 00:00:00`。

## 删除旧逻辑摘要（E1 要求）
- 删除文件：无。
- 删除行号：`src/lib/auth.ts` 中 `signIn` 回调的手动 `oauth_accounts` 插入与 `users` 更新逻辑（整段移除）。
- 删除原因：避免与 `createPatchedKyselyAdapter(db).linkAccount()` 重复写入；确保单一事实来源（E3），防止唯一约束冲突；维持最小变更（E7/E8）。

## 冗余检测（E10）
- 是否存在重复逻辑：NO（手动链接逻辑已移除，统一由 Adapter 负责）。
- 是否清理所有旧逻辑：YES（关联账户手动插入段已删除）。
- 是否存在未引用新增代码：NO（仅修改现有回调逻辑，无新增未用函数）。
- 是否减少不必要请求：YES（避免双路径写 `oauth_accounts`）。

## 红线自检（A1–E10）
- A1 路由层不承载业务：已遵守（`route.ts` 未改动）。
- A2–A4 架构统一：不适用本任务。
- B1/B2 文档同步：未改表结构，报告已记录；文件结构仅新增报告。
- B3 Kysely 类型一致：已遵守（使用 `sql\`LOWER(email)\``，不改类型）。
- C1–C3 测试红线：非 AI 任务，不适用双环境 AI 测试。
- D1 报告：已生成当前报告。
- E1 伴随旧逻辑清理：已执行。
- E2/E3 单一版本/单一事实来源：已遵守。
- E4 引用点更新：旧手动插入段移除，无旧入口残留。
- E5 清理未使用代码：无新增未用；保留必要诊断日志。
- E6 禁止新增未被引用代码：已遵守。
- E7/E8 最小补丁：仅在 `signIn` 内增改少量逻辑。
- E9 性能红线：未增加额外 DB/AI 请求。
- E10 冗余检测：见上节。

## AI 模块边界自检（F1–F5）
- 修改 ai-core/ai-service/local-ai-service：NO。
- 新增与 AI 相关本地逻辑：NO。
- 绕过 ai-core 自定义 AI 调用：NO。
- 是否需要 AI 协同建议：NO（本任务与认证无关 AI）。

## 结果与结论
- 代码层面已修正：
  - Google 登录邮箱在 `signIn` 统一标准化为小写；
  - 对既有用户采用 `LOWER(email)` 查找并复用其邮箱值，确保 `getUserByEmail` 命中同一 `users.id`；
  - 移除手动 `oauth_accounts` 写入，统一由 Adapter `linkAccount` 负责。
- 预期满足目标：同邮箱 → 单一 `users.id`；后续登录不再创建新 `users`。
- 本地联测建议：按“验证过程”运行 A/B 场景，确认 SQL 结果满足预期；如遇邮箱大小写历史数据导致找不到，则以第一次登录的邮箱小写化形成“唯一事实”并继续复用。

## 迁移脚本（如有）
- 无新增迁移；不改动表/约束。

## 更新后的数据库/文件结构文档（如有）
- 无结构变更；仅新增报告文件。

## 风险点与下一步建议
- 历史数据可能存在邮箱大小写不一致：已通过 `LOWER(email)` 复用逻辑规避新建用户；建议后续统一离线任务批量 lower-case 归一化（不在本任务执行）。
- 对其他 Provider（如 LINE/Facebook）：建议复用同一标准化与复用逻辑（建议项，非本任务范围）。

## 版本号
- 已更新 `src/lib/version.ts` 的 `BUILD_TIME` 为 `2025-12-07 00:00:00`。
