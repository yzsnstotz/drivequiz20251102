# ai_logs.user_id 统一使用 users.userid（act-xxx）执行报告 v5

## 任务摘要
- 目标：ai_logs.user_id 不再使用 UUID / DB 映射，统一写入 users.userid（如 act-xxx / 数字）；未登录为 null。
- 范围：仅修改 `resolveUserIdForLogs`；路由调用与 insertAiLog 未改。

## 修改文件
- `src/app/api/ai/_lib/logUserIdResolver.ts`

## 核心变更
- 移除所有 UUID 判定与数据库映射。
- 解析策略（返回第一个非空字符串，否则 null）：
  1) `session.user.id`（直接视为 users.userid）
  2) `USER_ID` Cookie
  3) `getUserInfo(req)?.userId`
- 不再 import / 查询数据库；不做格式校验。

## 代码要点
- 去除 `isLikelyUuid` 与 DB 查询。
- 仅收集候选 userid，去重后返回首个；无候选则 null。

## 测试
- `npm run build`：通过。
- `npm run lint`：未重新执行，本次未改前端；沿用上一轮无错误但有既有 warning 的结果。

## 预期行为
- 登录态：`resolveUserIdForLogs` 返回 users.userid（含 act-*），ai_logs.user_id 写入同值。
- 未登录：返回 null，日志显示匿名。

## 验证建议
- 登录发送 AI 请求，观察 `[AI_DEBUG][cookie]` / `[AI_DEBUG][resolvedUserId]` 日志应出现 act-*；后台 ai_logs 应写入同一 act-*。
- 未登录请求则 resolvedUserId=null，ai_logs user_id 为 null。

