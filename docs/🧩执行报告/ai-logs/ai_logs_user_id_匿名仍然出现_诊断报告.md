# ai_logs.user_id 仍为匿名问题诊断报告（只读分析，无代码改动）

## 背景
- 目标：ai_logs.user_id 应写入登录用户的 `users.id`（UUID）；未登录为 null。
- 实际现象：后台 AI 问答日志依然显示匿名（user_id 为空）。

## 快速排查结论
- 两个前端调用入口在发起后端 API 时均未携带认证 Cookie：
  - 首页 AI 聊天：`src/components/AIPage.tsx` → `callAiViaBackend` → `fetch("/api/ai/chat", {...})` 未设置 `credentials: "include"`。
  - 题库/考试 AI 对话：`src/components/QuestionAIDialog.tsx` → `logAiConversation` → `fetch("/api/ai/log", {...})` 未设置 `credentials: "include"`。
- 由于请求未带 Session Cookie，`auth()`/`getUserInfo(req)` 在 API 侧拿不到登录态，`resolveUserIdForLogs` 回退也无法映射，最终写入 user_id=null → 日志显示匿名。

## 证据摘录
- `src/components/AIPage.tsx`  
  `callAiViaBackend` 定义（无 credentials）：  
  ```
  157:163:src/components/AIPage.tsx
  const res = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  ```
- `src/components/QuestionAIDialog.tsx`  
  `logAiConversation`（无 credentials）：  
  ```
  343:352:src/components/QuestionAIDialog.tsx
  await fetch("/api/ai/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  ```
- 解析逻辑依赖 Session：`src/app/api/ai/_lib/logUserIdResolver.ts` 首选 `auth()`，再用 `getUserInfo(req)` 映射；请求无 Cookie 时两步皆返回空，导致 user_id=null。

## 根本原因
- 前端调用 `/api/ai/chat` 与 `/api/ai/log` 时未传递认证 Cookie，后端无法获取 Session / 用户 ID，统一解析函数落入匿名分支。

## 建议修复（未执行）
1) 在前端 fetch 请求中添加 `credentials: "include"`，确保带上登录 Cookie：  
   - `callAiViaBackend` → `fetch("/api/ai/chat", { ..., credentials: "include" })`  
   - `logAiConversation` → `fetch("/api/ai/log", { ..., credentials: "include" })`  
2) 视需要在后端增加对缺失 Session 的告警日志，便于早期发现。  
3) 修复后复测：登录用户在首页/题库/考试产生的 ai_logs 应统一为同一 UUID；未登录为 null。  

## 影响范围
- 所有通过上述前端入口触发的 AI 日志目前都会写入匿名 user_id。  
- ai-service 未改动；问题位于主站调用链路的 Cookie 透传缺失。

