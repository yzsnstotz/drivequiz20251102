# ai_logs.user_id 统一为 users.id（UUID）执行报告 v1

## 任务摘要
- 目标：所有新写入 `ai_logs.user_id` 仅使用 `users.id`（UUID），匿名为 `null`，不再写入 `users.userid` / `USER_ID` / `act-*` / 数字。
- 范围：仅 Next.js 主服务 API 路由（`/api/ai/chat`、`/api/ai/log`）及共享解析逻辑，未改 ai-core / ai-service。

## 修改文件
- `src/app/api/ai/_lib/logUserIdResolver.ts`（新增统一 userId 解析）
- `src/app/api/ai/chat/route.ts`
- `apps/web/app/api/ai/chat/route.ts`
- `src/app/api/ai/log/route.ts`
- `src/lib/version.ts`

## 核心变更点
- 新增 `resolveUserIdForLogs`：仅信任 `auth()` Session 中的 `session.user.id`（UUID 正则校验），否则返回 `null`；忽略 body/header/cookie 中的任何 userId。
- `/api/ai/chat`（主站与 apps/web 两份路由）：写入 ai_logs 时统一使用 `resolveUserIdForLogs(req)`，彻底忽略请求体中的 `userId`。
- `/api/ai/log`：移除 `body.userId` / `getUserInfo` 写入，改用 `resolveUserIdForLogs(req)`，确保只写 Session UUID 或 `null`。
- 版本号：`src/lib/version.ts` `BUILD_TIME` 更新为 `2025-12-09 12:00:00`。

## 自查与验证
- 覆盖的写入入口：`/api/ai/chat`（两处）与 `/api/ai/log` 已统一使用新解析函数，无残留 `body.userId ?? userInfo.userId` 逻辑。
- 期望行为：
  - 已登录：`ai_logs.user_id` 恒为 Session `users.id`（UUID）。
  - 未登录 / 无 Session：`ai_logs.user_id = null`。
  - 不再写入 `act-*` / 数字 / `USER_ID`。
- 未改动 ai-service / ai-core，符合 F1。

## 测试
- 未执行（环境缺少 pnpm，命令 `pnpm lint` 提示 `pnpm: command not found`）。未运行 `pnpm test` / `pnpm build`。
- 建议在具备 pnpm 的环境补跑：`pnpm lint && pnpm test && pnpm build`。

## 风险与后续建议
- 现有历史数据仍含混合 user_id，本次仅影响新增写入；后续需数据清洗统一为 UUID。
- 若 Session 获取失败或 UUID 校验失败，将写入 `null`；需关注匿名比例是否异常升高。

