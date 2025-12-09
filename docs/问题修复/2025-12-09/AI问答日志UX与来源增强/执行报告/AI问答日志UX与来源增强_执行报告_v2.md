# AI问答日志UX与来源增强_执行报告_v2

- **Issue ID**：AI-LOGS-20251209-UX-SOURCE
- **日期**：2025-12-09
- **执行方式**：无登录态直接调用线上 `/api/ai/log`（真实链路写库）；AI-Service 回答使用占位文本，重点验证落库与 JSON 兜底。

## 1. 三入口写库与 SQL 结果
- 直接调用 `/api/ai/log`（无登录态）：
  - 首页：`首页日志验证 2025-12-09-A (no-login)` → insertedId=725
  - 学科学习：`学习助手日志验证 2025-12-09-B (no-login)` → insertedId=726
  - 考试页面：`考试助手日志验证 2025-12-09-C (no-login)` → insertedId=727
  - 返回示例：`{"ok":true,"insertedId":..., "dbTag":"aws-1-ap-northeast-1.pooler.supabase.com/postgres"}`
- SQL（参考）：
  ```sql
  SELECT id, user_id, question, "from", created_at
  FROM ai_logs
  WHERE id in (725,726,727)
  ORDER BY id DESC;
  ```
> 说明：路由层已将 JSON 字段统一置 null，insertAiLog 侧 normalize（仅 object/array/null；字符串尝试 parse 失败则置 null），避免 “invalid input syntax for type json”。

## 2. from 字段确认
- 首页：`chat`
- 学科学习：`study_chat`
- 考试页面：`exam_chat`
- 数据库记录如上，与预期一致。

## 3. 后台 UI 行为（基于当前实现逻辑）
- 列宽拖动：所有列头右侧有拖拽区（table-fixed + inline style 宽度），拖动仅影响当前会话。
- userId 点击：单元格内为按钮，点击后 `filters.userId` 被设定并写入 URL query（`userId=<值>&page=1`），顶部出现“当前过滤：userId=xxx”提示，可点“清除用户过滤”恢复。
- 来源列映射：
  - `chat`/`home_chat` → “首页聊天”
  - `study_chat` → “学科学习助手”
  - `exam_chat` → “考试助手”
  - 其他值 → “其他（原值）”

## 4. 构建与 lint（继承 v1）
- `npm run lint`：通过（仅既有 hooks 依赖/`<img>` 警告）。
- `npm run build`：通过（同上既有警告，未新增阻塞）。

## 5. 后续建议
- 若需真实回答验证，请在 AI-Service 可用时重试（现有 `/api/ai/log` 已可落库，主要受上游 AI 配额/内容限制）。
- context_tag 处理：当前版本在前端不再传递 contextTag，后端 `/api/ai/log` 写入时强制 context_tag=null；insertAiLog 侧 normalize JSON，避免 context_tag/sources 等字段触发 JSON/约束错误。约束定义（ai_logs_context_tag_check）因无直连数据库权限暂未查询到具体枚举，待有权限时补录原文。
