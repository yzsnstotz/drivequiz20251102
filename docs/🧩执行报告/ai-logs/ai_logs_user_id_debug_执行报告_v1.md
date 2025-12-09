# ai_logs.user_id 调试日志补充执行报告 v1

## 任务摘要
- 目的：在 `/api/ai/chat` 与 `/api/ai/log`（含 apps/web 版本）添加调试输出，定位 user_id 解析为匿名的原因。
- 范围：仅 Next.js 主服务路由；未改 ai-core/ai-service/insertAiLog/resolveUserIdForLogs 逻辑。

## 修改文件
- `src/app/api/ai/chat/route.ts`
- `apps/web/app/api/ai/chat/route.ts`
- `src/app/api/ai/log/route.ts`
- `src/lib/version.ts`（BUILD_TIME 更新时间戳）

## 关键改动
- 在 POST 处理内新增调试日志：
  - `console.debug("[AI_DEBUG][cookie]", req.headers.get("cookie"));`
  - 解析完成后：`console.debug("[AI_DEBUG][resolvedUserId]", userId);`
- 仅输出，不影响现有业务与落库逻辑。

## 代码片段示例
- `/api/ai/chat`（主站与 apps/web 同步）：  
  ```
  console.debug("[AI_DEBUG][cookie]", req.headers.get("cookie"));
  const userId = await resolveUserIdForLogs(req);
  console.debug("[AI_DEBUG][resolvedUserId]", userId);
  ```
- `/api/ai/log`：同样位置添加上述两条调试输出。

## 自查
- 未改 insertAiLog/resolveUserIdForLogs；仅增加 console.debug。
- apps/web 路由 `/api/ai/chat` 已同步添加；无 apps/web 版本的 `/api/ai/log`。

## 测试
- `npm run lint`：仅既有 warning，无新增 error。
- `npm run build`：通过。

## 后续验证建议
- 登录态触发 `/api/ai/chat`、`/api/ai/log`，查看日志输出：
  - `[AI_DEBUG][cookie]` 应显示携带的 Session Cookie。
  - `[AI_DEBUG][resolvedUserId]` 应为 UUID；若 null，继续排查 Cookie/Session 是否缺失或失效。
- 未登录时 `resolvedUserId` 为 null 属预期。  

