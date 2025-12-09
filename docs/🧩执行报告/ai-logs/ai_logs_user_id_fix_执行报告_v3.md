# ai_logs.user_id Cookie 透传修复执行报告 v3

## 任务摘要
- 问题：前端调用 `/api/ai/chat`、`/api/ai/log` 未带 Cookie，后端拿不到 Session，ai_logs.user_id 写成匿名。
- 目标：在前端 fetch 加 `credentials: "include"`，确保浏览器携带认证 Cookie，user_id 写入 `users.id`（UUID），未登录仍为 null。

## 修改文件
- `src/components/AIPage.tsx`：`callAiViaBackend` 的 fetch 添加 `credentials: "include"`。
- `src/components/QuestionAIDialog.tsx`：`logAiConversation` 的 fetch 添加 `credentials: "include"`。

## 核心变更
- 仅增加 Cookie 透传，不改请求体/URL/其他逻辑。
- 预期：登录用户发起 AI 聊天或题库对话时，Session 可被后端识别，`resolveUserIdForLogs` 写入 UUID；未登录仍为 null。

## 自查
- 全局搜索 `/api/ai/chat`、`/api/ai/log` 的 fetch：相关入口均已包含 `credentials: "include"`。
- 未触及 ai-core / ai-service。

## 测试
- 环境：npm。  
- `npm run lint`：仅现有 warning（Hook 依赖、no-img 等既有问题），无新增 error。  
- `npm run build`：通过。

## 风险与建议
- 若浏览器存在第三方 Cookie 限制，仍可能拿不到 Session；需在真实环境验证登录态。  
- 历史匿名数据未清洗，本次仅影响新增写入。  
- 建议在后台日志抽样确认：登录用户多条记录的 user_id 一致且为 UUID；未登录记录为 null。  

