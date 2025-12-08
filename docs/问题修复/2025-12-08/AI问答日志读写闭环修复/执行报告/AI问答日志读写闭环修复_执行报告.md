# AI 问答日志读写闭环修复 - 执行报告

**Issue ID**: AI-LOGS-20251207-FULL

**问题名称**: AI 问答日志完整打通（读 + 写闭环）

**修复日期**: 2025-12-08

**修复人员**: AI Assistant

## 🔍 问题概要
- 首页 AI 聊天未能稳定写入 `ai_logs` 表，后台 `/admin/ai/logs` 查询不到最新记录。
- 项目中存在重复/不统一的日志写入逻辑，缺少环境变量检查，易导致静默失败。

## 🔍 规范对齐检查摘要
1. 已读取规范文件：
   - `docs/🔧指令模版/修复指令头5.2（现用）.md`
   - `/Users/leo/Desktop/drivequiz研发规范/🧩 AI 服务研发规范（ai-service 统一架构规范 v1.0）.md`
   - `/Users/leo/Desktop/drivequiz研发规范/🧩 AI 核心服务规范（ai-core 统一架构规范 v2.0）.md`
   - `/Users/leo/Desktop/drivequiz研发规范/JSON清洗与语言过滤规范.md`
   - `/Users/leo/Desktop/drivequiz研发规范/数据库结构_AI_SERVICE.md`
   - `/Users/leo/Desktop/drivequiz研发规范/数据库结构_DRIVEQUIZ.md`
   - `docs/🔧问题修复/FIX_AI_ERRORS_SUMMARY.md`
   - `docs/🔧问题修复/FIX_POOLER_AUTH_ERROR.md`
   - `docs/问题修复/20251202/AI配置中心500错误修复/执行报告/AI配置中心500错误修复_执行报告.md`
   - `docs/问题修复/2025-12-07/后台AI问答日志板块无法正常工作/执行报告/后台AI问答日志板块无法正常工作_执行报告.md`
2. 受约束规范：A1-A4、B1-B4、E1-E10、F1-F5。
3. 强关联条款：F1/F3（不改 ai-core/ai-service/local-ai-service，禁止自定义 AI 调用）、A1（路由仅做参数与 DB 访问）、E1（新增需清理旧逻辑）。
4. 修改文件：`src/lib/aiDb.ts`、`src/app/api/ai/chat/route.ts`、`apps/web/app/api/ai/chat/route.ts`、`src/lib/version.ts`、`docs/🔧问题修复/FIX_AI_ERRORS_SUMMARY.md`、本报告。
5. 数据库/文件结构影响：无表结构变更；仅使用既有 `ai_logs` 字段。

## 🛠️ 修复方案与变更摘要
1. **统一写入 helper**：在 `src/lib/aiDb.ts` 新增 `insertAiLog`，包含环境变量检查、字段严格对齐 `ai_logs`、统一错误日志。
2. **删除重复代码**：移除两个 API route 中的本地 `insertAiLog`，全部改为调用公共 helper（约 110 行重复代码清理）。
3. **参数统一**：使用 `from`（固定 `chat`）与 `costEst` 字段名，统一 sources JSON 序列化，保持 single-source-of-truth。
4. **链路保持不阻断**：写入失败仅告警，不影响用户拿到 AI 回复。
5. **版本号更新**：`src/lib/version.ts` 更新为 `2025-12-08 18:00:00`。

## 🔗 写入链路说明
- 前端组件：`src/components/AIPage.tsx` → `callAiViaBackend()`
- API 路由：`POST /api/ai/chat` → `src/app/api/ai/chat/route.ts`
- 日志写入：`insertAiLog`（`src/lib/aiDb.ts`）→ `ai_logs`
- 后台查询：`/admin/ai/logs` → `src/app/api/admin/ai/logs/route.ts` → 前端页面 `src/app/admin/ai/logs/page.tsx`

## 📊 数据库写入字段（与 `ai_logs` 对齐）
- `user_id`、`question`、`answer`、`from`=`"chat"`、`locale`、`model`、`rag_hits`、`safety_flag`、`cost_est`、`sources`、`ai_provider`、`cached`、`context_tag`、`created_at`（当前时间）。

## 🧪 自查与测试
- 代码检查：`npm run lint` ✅（无新增错误）
- 构建检查：`npm run build` ✅
- 环境检查：代码已对 `AI_DATABASE_URL` 缺失做告警处理；当前环境未配置实际 DB，未执行真实落库验证。
- 链路验证（静态/逻辑）：
  - 前端 → `/api/ai/chat` 调用路径确认 ✅
  - 写入在成功拿到 AI 响应后调用 `insertAiLog` ✅
  - 后台 `/admin/ai/logs` 查询字段与写入字段一致（含 `from`、`locale`、`model` 等）✅

## 🔒 AI 模块边界自检
- 是否修改 ai-core/ai-service/local-ai-service：NO
- 是否新增本地自定义 AI 调用：NO
- 是否绕过 ai-core：NO
- 是否需要 AI 协同调整：NO

## 🗂 修改文件列表
- `src/lib/aiDb.ts`：新增统一 `insertAiLog` helper，环境检查 + 详细日志。
- `src/app/api/ai/chat/route.ts`：改用公共 helper，统一字段名，删除重复函数。
- `apps/web/app/api/ai/chat/route.ts`：改用公共 helper，统一字段名，删除重复函数。
- `src/lib/version.ts`：更新 BUILD_TIME。
- `docs/🔧问题修复/FIX_AI_ERRORS_SUMMARY.md`：新增本次修复记录。
- `docs/问题修复/2025-12-08/AI问答日志读写闭环修复/执行报告/AI问答日志读写闭环修复_执行报告.md`：本报告。

## ⚠️ 风险与回滚
- 风险：日志写入仍依赖正确的 `AI_DATABASE_URL` 配置；若缺失仅告警但不落库。
- 回滚：`git checkout <prev_commit> -- src/lib/aiDb.ts src/app/api/ai/chat/route.ts apps/web/app/api/ai/chat/route.ts src/lib/version.ts docs/🔧问题修复/FIX_AI_ERRORS_SUMMARY.md` 及本报告。

## 🧩 提交信息
- 分支名称：main
- 最终提交哈希（前 8 位）：`a827cde`
- 最终提交哈希（完整值）：`a827cdefccd9ca3c5eb5c899b2ecb31a6eb7db25`

---
**状态**：修复完成，等待（或已完成）推送。
