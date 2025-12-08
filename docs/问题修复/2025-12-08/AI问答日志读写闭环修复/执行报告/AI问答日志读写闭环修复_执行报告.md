# AI 问答日志读写闭环修复 - 执行报告（v3 实测）

**Issue ID**: AI-LOGS-20251207-FULL  
**修复日期**: 2025-12-08  
**修复人员**: AI Assistant

## 1) 问题与目标
- 首页 AI 聊天需要真实落库到 `ai_logs`，后台 `/admin/ai/logs` 可查看；此前报告未做实际 DB 验证。
- 目标：前端 → `/api/ai/chat` → `insertAiLog`（`src/lib/aiDb.ts`）→ `ai_logs` → 后台查询，全链路真实可用且日志写入单一来源。

## 2) 边界与规范
- 未修改 ai-core / ai-service / local-ai-service，未改模型选择、RAG 流程，未改数据库结构。
- 参考规范：`docs/🔧指令模版/修复指令头5.2（现用）.md`、`数据库结构_AI_SERVICE.md`、`FIX_AI_ERRORS_SUMMARY.md` 等。
- 环境检查：`node -e "console.log('AI_DATABASE_URL set:', !!process.env.AI_DATABASE_URL)"` 初始为 false；`dotenv.config({path: '.env.local'})` 后为 true（AI_DATABASE_URL/AI_SERVICE_URL 均存在）。

## 3) 链路定位（真实文件）
- 前端调用：`src/components/AIPage.tsx` → `callAiViaBackend(payload)` → `fetch("/api/ai/chat", ...)`。
- API 路由：
  - 主站：`src/app/api/ai/chat/route.ts`
  - apps/web：`apps/web/app/api/ai/chat/route.ts`
- 写入 helper：`src/lib/aiDb.ts` `insertAiLog`（唯一写入入口）。
- 后台查看：`/admin/ai/logs`（未改动，沿用既有 aiDb 查询）。

## 4) 代码改动要点
- `src/lib/aiDb.ts`
  - 新增 `cleanTextField`，对 question/answer 统一 trim 后落库，避免空白噪声。
  - 保留环境变量检查，使用 `aiDb.insertInto("ai_logs").values(...).execute()`。
- `src/app/api/ai/chat/route.ts`
  - 仍在成功拿到 AI-Service 回复后调用 `insertAiLog`，`from` 固定为 `"chat"`，写入失败只在 helper 内告警，不阻断响应；移除未使用的 `aiDb` 导入。
- `apps/web/app/api/ai/chat/route.ts`
  - 同步调用统一 helper，`from="chat"`，sources 序列化后写入；删除冗余本地写入逻辑。
- 文档：`docs/🔧问题修复/FIX_AI_ERRORS_SUMMARY.md` 更新为 v3，记录真实落库（ai_logs.id=714）和 checklist 通过；本报告更新。

## 5) 真实 diff
- `git diff --stat`：
```
 apps/web/app/api/ai/chat/route.ts                  |   6 +-
 docs/问题修复/2025-12-08/AI问答日志读写闭环修复/执行报告/AI问答日志读写闭环修复_执行报告.md | 135 +++++++++------------
 docs/🔧问题修复/FIX_AI_ERRORS_SUMMARY.md                      |  13 +-
 src/app/api/ai/chat/route.ts                       |   2 +-
 src/lib/aiDb.ts                                    |  13 +-
 5 files changed, 79 insertions(+), 90 deletions(-)
```
- 关键文件 diff 片段：
```diff
diff --git a/apps/web/app/api/ai/chat/route.ts b/apps/web/app/api/ai/chat/route.ts
index 9602815..772d274 100644
--- a/apps/web/app/api/ai/chat/route.ts
+++ b/apps/web/app/api/ai/chat/route.ts
@@ -1,6 +1,6 @@
 // apps/web/app/api/ai/chat/route.ts
 import { NextRequest, NextResponse } from "next/server";
-import { aiDb, insertAiLog } from "@/lib/aiDb";
+import { insertAiLog } from "@/lib/aiDb";
@@ -162,7 +162,7 @@ export async function POST(req: NextRequest) {
     // 根据需求：scene 固定为 "chat"
     const scene = "chat";
 
-    void insertAiLog({
+    await insertAiLog({
@@ -175,8 +175,6 @@ export async function POST(req: NextRequest) {
       sources: (data as AiServiceDataA).sources ? JSON.stringify((data as AiServiceDataA).sources) : null,
       aiProvider: data.aiProvider ?? null,
       cached: data.cached ?? false,
-    }).catch((e) => {
-        console.warn(`[${requestId}] ai_logs async write failed`, e);
     });
diff --git a/src/app/api/ai/chat/route.ts b/src/app/api/ai/chat/route.ts
index 9dc0127..abf6014 100644
--- a/src/app/api/ai/chat/route.ts
+++ b/src/app/api/ai/chat/route.ts
@@ -1,5 +1,5 @@
 import { NextRequest, NextResponse } from "next/server";
-import { aiDb, insertAiLog } from "@/lib/aiDb";
+import { insertAiLog } from "@/lib/aiDb";
diff --git a/src/lib/aiDb.ts b/src/lib/aiDb.ts
index 9f8c853..b4ccd8b 100644
--- a/src/lib/aiDb.ts
+++ b/src/lib/aiDb.ts
@@ -522,6 +522,12 @@ export interface AiLogEntry {
   contextTag?: string | null;
 }

+// 统一清洗文本字段，避免存储多余空白或 undefined
+function cleanTextField(text: string | null | undefined): string {
+  if (typeof text !== "string") return "";
+  return text.trim();
+}
+
@@ -542,13 +548,16 @@ export async function insertAiLog(entry: AiLogEntry): Promise<void> {
 
     console.log(`[AI-LOGS-INSERT] Starting insert for from: ${entry.from}, question: "${entry.question.substring(0, 30)}..."`);
 
+    const cleanedQuestion = cleanTextField(entry.question);
+    const cleanedAnswer = cleanTextField(entry.answer);
+
     // 严格参照数据库结构_AI_SERVICE.md 中的 ai_logs 字段名称与类型
     await aiDb
       .insertInto("ai_logs")
       .values({
         user_id: entry.userId,
-        question: entry.question,
-        answer: entry.answer,
+        question: cleanedQuestion,
+        answer: cleanedAnswer,
         from: entry.from,
         locale: entry.locale,
         model: entry.model,
```

## 6) 真实数据库验证
- 启动：`npm run dev`（Next 15.5.7，读取 .env.local）。
- 前台调用：`curl -s -X POST http://localhost:3000/api/ai/chat ... question="AI 日志写入测试 v3 - 001"` → 返回 200，`model="gemini-2.5-flash"`。
- DB 查询脚本（启用 NODE_TLS_REJECT_UNAUTHORIZED=0）：
  - SQL：`SELECT id, user_id, question, answer, "from", locale, model, created_at FROM ai_logs WHERE "from" = 'chat' ORDER BY created_at DESC LIMIT 3;`
  - 结果：最新记录 `id=714`, `question="AI 日志写入测试 v3 - 001"`, `answer="您好，我只能回答与日本驾驶考试相关的问题。"`, `from="chat"`, `locale="zh"`, `model="gemini-2.5-flash"`, `created_at=2025-12-08T21:20:14Z`（为本次调用产生）。

## 7) Lint / Build / Test
- `npm run lint` ✅（仅现有 warning，例如部分 useEffect 依赖、no-img-element）。
- `npm run build` ✅（同样仅 warning，无新增错误）。
- 其它测试：未新增自动化测试，手工链路验证 + DB 查询已完成。

## 8) 风险与回滚
- 风险：仍依赖正确的 AI_DATABASE_URL/AI_SERVICE_URL；若证书为自签名需保持 `sslmode=require` + `rejectUnauthorized:false`。
- 回滚：`git checkout <prev_commit> -- src/lib/aiDb.ts src/app/api/ai/chat/route.ts apps/web/app/api/ai/chat/route.ts docs/🔧问题修复/FIX_AI_ERRORS_SUMMARY.md docs/问题修复/2025-12-08/AI问答日志读写闭环修复/执行报告/AI问答日志读写闭环修复_执行报告.md`

## 9) 分支与提交
- 分支：main
- 提交哈希：`1bac51bf2fdd196b9d2f8a27ebde8ac9428b1fff`（fix: ensure AI chat logs persisted and verified via real DB (AI-LOGS-20251207-FULL-V3)）
