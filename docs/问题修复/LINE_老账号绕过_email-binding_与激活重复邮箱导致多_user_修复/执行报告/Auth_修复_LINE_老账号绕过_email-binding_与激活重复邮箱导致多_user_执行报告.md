# 任务执行报告

## 任务摘要
- 修复：
  - LINE 登录不再使用伪造邮箱；callbacks.signIn 严格区分“真实邮箱 vs 无邮箱”，无邮箱必走 `/login/email-binding`。
  - 激活流程在写 `users.email` 前做唯一性检查，若邮箱已被其他用户占用，返回明确错误“邮箱已被绑定”，避免生成第二个账号。

## 规范对齐检查摘要
- 已阅读：修复指令头 v5.2（现用）、数据库结构_DRIVEQUIZ.md、文件结构文档。
- 约束遵守：A1 路由不承载业务；B3 Kysely 类型一致；E1–E10 冗余治理与最小变更；F1–F5 AI 模块边界。
- 修改文件：
  - `src/lib/auth.ts`（LINE 分支已在上个任务实现，继续保持严格邮箱分支）
  - `src/app/api/activate/route.ts`（新增邮箱唯一性检查与错误返回）
  - `src/lib/version.ts`（更新版本号）
- 数据库影响：无结构修改；仅逻辑校验。

## 阅读的文件
- `src/lib/auth.ts`（callbacks.signIn 中 provider 分支）
- `src/lib/providers/line.ts`（scope 请求 `profile openid email`）
- `src/app/api/activate/route.ts`（激活流程逻辑）
- `src/lib/db.ts`（确认 `users`、`activations` 表结构与唯一约束）

## 现状验证与问题点
- LINE 登录：历史上可能使用占位邮箱或在无邮箱场景直接创建用户，导致僵尸 user。
- 激活流程：在当前登录用户补写 `email` 时未进行“邮箱是否已被其他用户使用”的预检查，可能触发唯一约束错误或产生多用户绑定同邮箱的异常行为。

## 修复方案与改动
- LINE 登录（保持与上个任务一致）：
  - 有邮箱：`trim().toLowerCase()` 标准化，`LOWER(email)` 查找复用，`user.email` 对齐 DB 实际值。
  - 无邮箱：不创建 user，生成一次性 token 并重定向到 `/login/email-binding?provider=line&token=...`，在该页面与 API 完成邮箱补全与统一绑定。
- 激活流程：
  - 在 `src/app/api/activate/route.ts` 的“当前登录用户补写邮箱”分支中，新增：
    - 查询 `LOWER(email)` 是否被其他 user 占用（`id != currentUserId`）。
    - 若已占用 → 返回 `{ ok:false, errorCode:"EMAIL_ALREADY_BOUND", message:"该邮箱已被其他账号绑定", status:409 }`。
    - 否则 → 安全写入 `users.email`。
- 版本号：更新 `src/lib/version.ts` 为 `2025-12-07 01:00:00`。

## 验证步骤
- LINE 登录：
  - 无邮箱账号 → 访问 `/login`，选择 LINE；应跳转至 `/login/email-binding?...`；填写邮箱后绑定成功，再次登录不产生新 user。
- 激活流程：
  - 情景1：登录用户无邮箱，尝试补写为已被其他 user 使用的邮箱 → 返回 409 错误，提示“邮箱已被其他账号绑定”。
  - 情景2：登录用户无邮箱，补写为未使用邮箱 → 成功写入并完成激活更新。

## 红线自检（A1–E10）
- A1 路由不承载业务：已遵守（NextAuth 路由未改）。
- B3 类型一致：查询使用 `LOWER(email)` 且不改类型。
- E1–E3 冗余治理与 SSOT：绑定与校验在统一位置处理，无重复入口。
- E7/E8 最小补丁：仅在必要分支增改。
- E9 性能红线：未增加不必要请求。

## 风险与建议
- 历史数据中大小写不一致可能导致人工期望与唯一约束冲突；建议后续离线统一 lower-case 归一化与数据审计。
- email-binding 页面与 API 已涵盖无邮箱绑定路径，建议在 UI 文案中明确提示“邮箱唯一性规则”。

## 版本号
- `src/lib/version.ts` → `2025-12-07 01:00:00`。
