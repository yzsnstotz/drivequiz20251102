# ai_logs.user_id 不一致问题诊断报告

## 问题描述
- 现象：后台 AI 问答日志中，同一账户在 `ai_logs.user_id` 中出现两种不同值（UUID 与数字/`act-*` 等字符串混杂）。
- 目标：仅排查链路与来源，不改动业务代码。

## 相关表结构与文档结论
- `ai_logs.user_id`：`TEXT`，允许字符串（可能为 UUID 或其他格式），可空。见《数据库结构_AI_SERVICE.md》。
- 文档责任分工：
  - 《🧩 文件结构与方法说明 v1.0》2.3 指出 `apps/ai-service/src/routes/ask.ts` 负责记录 `ai_logs`。
  - 同文档 2.5 指出查询/统计由 `src/app/api/admin/ai/logs/route.ts`、`src/app/api/admin/ai/stats/route.ts` 等读取 `ai_logs`。

## 代码层写入点梳理
| 序号 | 文件路径 | 函数/路由 | 写入方式 | user_id 取值表达式 | 上游来源 |
| --- | --- | --- | --- | --- | --- |
| 1 | `src/app/api/ai/chat/route.ts` | `POST /api/ai/chat` | `insertAiLog`（Kysely） | `userId: input.userId ?? null` | 前端 `AIPage` 通过 `callAiViaBackend` 将 `userId` 设为 `session?.user?.id`（即 `users.id`，UUID）；匿名则为空。 |
| 2 | `apps/web/app/api/ai/chat/route.ts` | `POST /api/ai/chat`（apps/web 入口，逻辑同上） | `insertAiLog`（Kysely） | `userId: input.userId ?? null` | 同入口，依赖客户端传入 `userId`（通常来自 `session?.user?.id`）。 |
| 3 | `src/app/api/ai/log/route.ts` | `POST /api/ai/log` | `insertAiLog`（Kysely） | `const userId = body.userId ?? userInfo?.userId ?? null` | 主要由 `QuestionAIDialog.logAiConversation` 调用，传入 `getStoredUserId()`（读取 `localStorage`/`cookie` 的 `USER_ID`，来自激活流程写入的 `users.userid`，形如 `act-<id>` 或数字）；若未传则用 `getUserInfo`（Session 返回 `users.id`，JWT/激活 Token 返回 `userid`）。 |

> 备注：`apps/ai-service/src/routes/ask.ts` 当前代码中明确“日志由主路由统一写入”，未直接调用 `logAiInteraction`，因此实际落库仅发生在上述 Next.js 路由。

## userId 来源链路梳理
- `users` 表主键：`id`（UUID）；另有 `userid`（字符串，可为空），激活流程 `/api/activate` 会生成 `act-<activationId>` 并写入 `users.userid`，同时返回给前端存入 `USER_ID`。
- NextAuth Session：`session.user.id` 映射 `users.id`（UUID），不包含 `userid`。`AIPage` 使用 `session.user.id` → `/api/ai/chat` → 写入 UUID。
- 激活/非登录场景：`QuestionAIDialog` 读取 `USER_ID`（通常是 `users.userid`/`act-*`）传给 `/api/ai/log`；`getUserInfo` 在 JWT/激活 Token 模式下也以 token 中的 `userId` / `sub` 查找 `users.userid`，因此会把 `userid` 写入 `ai_logs.user_id`。
- 结果：同一用户既可能在首页聊天路径写入 `users.id`（UUID），也可能在题库/考试 AI 对话路径写入 `users.userid`（`act-*`/数字）。

## 根本原因总结
- 不同调用入口使用了不同的身份字段：
  - 首页 AI 聊天 `/api/ai/chat`：依赖 Session，写入 `users.id`（UUID）。
  - 学习/考试题目对话 `/api/ai/log`：依赖前端保存的 `USER_ID` 或 JWT `userId`，写入 `users.userid`（`act-*`/数字）。
- `ai_logs.user_id` 字段允许任意文本且未统一规范，导致同一账户产生双轨 ID（UUID 与 `userid`）混用。
- ai-service 侧未直接写日志，所有落库聚焦在 Next.js 路由，未做字段收敛/校验。

## 建议（仅文字，不执行）
- 统一 `ai_logs.user_id` 为 `users.id`（UUID），前端/后端调用均从 Session 获取，不再使用 `userid`/`USER_ID`。
- `/api/ai/log` 内对 `userId` 做校验与映射：优先 Session `users.id`，其次将 `userid` 映射回对应的 `users.id`，缺失则置空。
- 补充监控：统计 `ai_logs.user_id` 非 UUID / `act-*` 占比，便于清洗历史数据。

