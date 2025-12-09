# ai_logs.user_id 修复执行报告 v6（统一 users.userid & 路由防御 502）

## 问题背景
- 生产 `/api/ai/chat` 返回 502，前端解析 HTML 错误页报 `Unexpected token '<'`。
- 日志仅看到 `[AI_DEBUG][cookie]`，未看到 `[resolvedUserId]`，怀疑 userId 解析抛错导致 502。
- 目标：彻底简化 userId 解析为 users.userid（act-xxx/数字），并在路由层防御性降级为匿名，确保不再 502。

## 修改范围
- 仅主服务：`src/app/api/ai/_lib/logUserIdResolver.ts`
- 路由：`src/app/api/ai/chat/route.ts`、`apps/web/app/api/ai/chat/route.ts`、`src/app/api/ai/log/route.ts`
- 版本号：`src/lib/version.ts`

## 核心变更
1) 解析策略：只返回 users.userid（不再查 DB / 不判 UUID）
   - 优先级：`session.user.id` → `USER_ID` Cookie → `getUserInfo(req)?.userId`
   - 收集候选去重，取首个非空字符串；无则 null。
   - 删除所有 DB 查询、UUID 判定、id 映射。
2) 路由防御：
   - `/api/ai/chat`（主站 + apps/web）与 `/api/ai/log` 在解析 userId 外层包 try/catch，解析失败写日志并降级为 `userId=null`，避免 502。
   - 保留现有 AI 调用与 insertAiLog 逻辑，仅改 userId 来源与防御。
3) 版本号更新：`BUILD_TIME = 2025-12-10 05:30:00`。

## 代码摘录
- resolver 简化（节选）：  
  ```ts
  // 优先 session.user.id -> USER_ID Cookie -> getUserInfo(req)?.userId
  const unique = Array.from(new Set(candidates));
  if (unique.length > 0) return unique[0];
  return null;
  ```
- 路由防御（/api/ai/chat 同 /api/ai/log）：  
  ```ts
  let userId: string | null = null;
  try {
    userId = await resolveUserIdForLogs(req);
    console.debug("[AI_DEBUG][resolvedUserId]", userId);
  } catch (err) {
    console.error("[AI_ERROR][chat] Failed to resolve userId:", err);
    userId = null; // 避免 502，匿名降级
  }
  ```

## 测试
- `npm run build`：通过。
- `npm run lint`：本轮未重跑（前一轮无新增错误，仅历史 warning）。

## 预期验证
- 登录态：日志应出现 `[AI_DEBUG][cookie] ... USER_ID=act-xxx ...` 与 `[AI_DEBUG][resolvedUserId] act-xxx`，ai_logs.user_id 写入同值。
- 未登录：`resolvedUserId=null`，ai_logs.user_id 为 null（匿名）。
- 即使解析异常，路由返回 JSON，不再 502/HTML 错误页。

