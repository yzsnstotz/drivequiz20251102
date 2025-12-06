# 修复指令头5.2（现用）对齐与执行报告（最终版）

## 规范边界
- 仅修改 Next.js 主服务代码；不改 `ai-core`/`ai-service`/`local-ai-service`。
- LINE 登录视作“工作正常的黑盒”，不改 `src/lib/providers/line.ts` 与 `auth.ts` 对 `createLineProvider()` 的调用与配置。
- 路由层保持瘦；绑定逻辑在 API 与 Adapter 层；layout 保持壳结构。
- 数据库变更必须有 migration；并在文档中同步结构说明。

## 已阅读文件（含数据库结构）
- `docs/🔧指令模版/修复指令头5.2（现用）.md`
- 数据库结构：`src/lib/db.ts`（类型与视图映射），`src/migrations/20251126_create_oauth_accounts.sql`、`src/migrations/20251126_alter_users_and_auth_ids_to_text.sql`、`src/migrations/20251126_create_nextauth_table_views.sql`
- 认证与适配：`src/lib/auth.ts`、`src/lib/auth-kysely-adapter.ts`
- 绑定接口：`src/app/api/auth/bind-email/route.ts`

## 数据模型：多 Provider 账号表
- 现有表：`oauth_accounts`（已存在，唯一约束 `(provider, provider_account_id)`）
- 视图：`Account` 视图（驼峰命名，与 `@auth/kysely-adapter` 对齐），`Session`、`User` 视图均已存在并在 2025-11-26 迁移中维护
- 字段要点：
  - `user_id text`（外键 `users(id)`，`ON DELETE CASCADE`）
  - `provider varchar`、`provider_account_id varchar`
  - token 相关字段保留
  - `created_at`/`updated_at` 审计字段

## NextAuth / Adapter 调整
- 适配器：`src/lib/auth-kysely-adapter.ts`
  - 使用 `OriginalKyselyAdapter` 基础能力，配合数据库视图
  - 重写 `linkAccount`：直接写入 `oauth_accounts` 底层表，避免视图字段命名不匹配
  - 其余（如 `getUserByAccount`）沿用基础适配器，通过 `Account` 视图完成读取
- Provider 策略（未改 LINE）：
  - Google/LINE 保持 `allowDangerousEmailAccountLinking` 按 email 自动合并
  - 无邮箱/占位邮箱 Provider 保持 `needsEmailBinding` 流程（不改本次）

## /api/auth/bind-email 合并逻辑
- 文件：`src/app/api/auth/bind-email/route.ts`
- 步骤：
  - 读取当前会话 `currentUserId` 与提交的 `email`
  - 若该 `email` 未被其他用户占用：直接更新当前用户 `users.email`
  - 若被 `existingUser` 占用：事务迁移
    - 将当前临时用户的所有 `oauth_accounts.user_id` 更新为 `existingUser.id`
    - 同步迁移从属表：`sessions`、`user_profiles`、`user_interests`、`user_behaviors`、`ad_logs`、`service_reviews`、`ai_logs`
    - 删除临时用户 `users(id=currentUserId)`
- 关键点：
  - 绑定关系唯一来源是 `oauth_accounts`；不再依赖 `users.oauth_provider` 推断归属
  - `users.oauth_provider` 仅作“展示/统计用”（本次未改逻辑）

## 变更文件列表
- Adapter：`src/lib/auth-kysely-adapter.ts`（已存在，保留）
- 合并接口：`src/app/api/auth/bind-email/route.ts`（已符合合并到 `accounts` 的要求）
- 数据库：`src/migrations/20251126_*`（已具备 `oauth_accounts` 与视图、类型迁移；无需新增）
- 版本号：`src/lib/version.ts`（本次更新）

## LINE 黑盒确认
- 未改动：`src/lib/providers/line.ts` 与 `auth.ts` 对 `createLineProvider()` 的注入与配置
- 本地自测：LINE 登录完成授权回跳后 `status: authenticated`、`session.user` 正常，刷新首页保持登录态，无 React 418 与 env 报错退回（参考既有修复）

## 版本号
- `BUILD_TIME` 已更新为当前时间，便于追踪本次“多 Provider 统一绑定 + DB 设计”交付

