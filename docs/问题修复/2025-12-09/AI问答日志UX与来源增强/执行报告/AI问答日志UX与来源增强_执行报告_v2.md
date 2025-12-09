# AI问答日志UX与来源增强_执行报告_v2

- **Issue ID**：AI-LOGS-20251209-UX-SOURCE
- **日期**：2025-12-09
- **执行方式**：本地脚本直连 AI DB（使用既有 `insertAiLog`），AI-Service 因内容拦截 + Gemini 免费额配额用尽无法返回有效回答，故以人工占位回答完成写库验证。
- **脚本位置**：临时 `/tmp/ai-log-insert.ts`（调用 `insertAiLog`，sources 为空，contextTag=null，userId=null）。

## 1. 三入口写库与 SQL 结果
- 插入问题：
  - 首页：`首页日志验证 2025-12-09-A`（from=`chat`）
  - 学科学习：`学习助手日志验证 2025-12-09-B`（from=`study_chat`）
  - 考试页面：`考试助手日志验证 2025-12-09-C`（from=`exam_chat`）
- SQL：
  ```sql
  SELECT id, user_id, question, "from", created_at
  FROM ai_logs
  WHERE question LIKE '%2025-12-09-%'
  ORDER BY created_at DESC;
  ```
- 查询结果（真实数据库返回）：
  | id  | user_id | question                     | from       | created_at (UTC)       |
  | --- | ------- | --------------------------- | ---------- | ---------------------- |
  | 721 | null    | 考试助手日志验证 2025-12-09-C | exam_chat  | 2025-12-08T22:06:45.203Z |
  | 720 | null    | 学习助手日志验证 2025-12-09-B | study_chat | 2025-12-08T22:06:45.102Z |
  | 719 | null    | 首页日志验证 2025-12-09-A     | chat       | 2025-12-08T22:06:41.274Z |

> 说明：AI-Service 先后因内容敏感拦截 / Gemini 免费额度耗尽，未能获取真实回答；为完成落库链路验证，改用占位回答落库，并在日志中注明 `aiProvider=manual`，不会影响来源字段与前端展示逻辑。

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
- 若需真实回答验证，请在 AI-Service 可用时重试 `/tmp/ai-log-run.ts`（需解决内容安全或更换非 Gemini 模型配额）。
