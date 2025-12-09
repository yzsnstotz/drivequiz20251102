# ai_logs.user_id 修复执行报告 v6.1（userid-only，路由防御 502）

## 任务摘要
- 统一以 `users.userid`（如 act-xxx/数字）写入 ai_logs.user_id；不再解析/映射 UUID 或访问数据库。
- 路由 `/api/ai/chat`（主站+apps/web）与 `/api/ai/log` 增强防御：userId 解析失败降级匿名，始终返回 JSON，不再 502/返回 HTML。
- 版本号更新：`2025-12-10 06:20:00`。

## 修改文件
- `src/app/api/ai/_lib/logUserIdResolver.ts`
- `src/app/api/ai/chat/route.ts`
- `apps/web/app/api/ai/chat/route.ts`
- `src/app/api/ai/log/route.ts`
- `src/lib/version.ts`

## 核心变更
1) resolver（userid-only）  
   - 仅收集候选：`session.user.id`、`USER_ID` Cookie、`getUserInfo(req)?.userId`。  
   - 去重取首个非空字符串；无候选返回 null。  
   - 移除 UUID 判定与 DB 查询/映射。
2) 路由防御  
   - 解析 body 用 try/catch，失败返回 `{ success: false, error: "Invalid request body" }` 400。  
   - 解析 userId 用 try/catch，失败记录 `[AI_ERROR][resolveUserId]` 并设 userId=null。  
   - 最外层 catch 返回 `{ success: false, error: "AI service unavailable", detail }` 500，避免 HTML/502。  
3) 调试输出  
   - 保留 `[AI_DEBUG][cookie]` 与 `[AI_DEBUG][resolvedUserId]`。

## 自查
- resolver 中无 UUID 校验、无 DB 查询、无 users.id 映射。  
- 路由使用 resolver 返回值写入 ai_logs.user_id，不再引用 body.userId 或其他来源。  
- apps/web 路由已同步。  

## 测试
- `npm run build`：通过。  
- `npm run lint`：本轮未重跑（上一轮仅有历史 warning）。  

## 预期验证
- 登录态：日志出现 `[AI_DEBUG][cookie] ... USER_ID=act-xxx ...` 与 `[AI_DEBUG][resolvedUserId] act-xxx`，ai_logs.user_id 写入同值。  
- 未登录：`resolvedUserId=null`，ai_logs.user_id 为 null。  
- 即使解析异常，路由返回 JSON，不再 502/HTML。  

