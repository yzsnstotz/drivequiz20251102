# AI问答日志UX与来源增强_执行报告

- **Issue ID**：AI-LOGS-20251209-UX-SOURCE
- **日期**：2025-12-09
- **负责人**：AI 辅助

## 一、修改文件清单（与 git diff 一致）
- `src/app/admin/ai/logs/page.tsx`
- `src/app/api/admin/ai/logs/route.ts`
- `src/app/api/ai/log/route.ts`
- `src/components/QuestionAIDialog.tsx`
- `src/app/study/learn/page.tsx`
- `src/app/study/exam/page.tsx`
- `docs/🔧问题修复/FIX_AI_ERRORS_SUMMARY.md`
- 新增目录：`docs/问题修复/2025-12-09/AI问答日志UX与来源增强/执行报告/`

## 二、改动摘要
- **后端**：
  - `/api/admin/ai/logs` 保证返回 `from` 字段（CSV 也输出 from/aiProvider/cached），保留原有筛选逻辑。
  - 新增 `/api/ai/log` 路由，统一通过 `insertAiLog` 写入 ai_logs，校验 question/answer/from，失败仅记录错误。
- **前端**：
  - 管理端 `/admin/ai/logs` 表格支持列宽拖动，`userId` 默认宽度 260px，点击 userId 会自动加上过滤并显示“当前过滤”提示，可清除。
  - 列新增“来源”显示：chat/home_chat→首页聊天，study_chat→学科学习助手，exam_chat→考试助手，question→题目解析，其他原样提示“其他（值）”。“服务/缓存”列单独展示 aiProvider/缓存及来源弹窗。
  - 学科学习与考试页面调用的 `QuestionAIDialog` 在拿到 AI 回复后调用 `/api/ai/log` 写入，from 分别为 `study_chat` / `exam_chat`，附带 questionId/hash 等上下文到 sources 中（title=context，snippet 截断 500 字）。

## 三、学科学习 / 考试入口调用链定位
- **学科学习 AI 助手**：
  - 前端组件：`src/app/study/learn/page.tsx` 中的 `<QuestionAIDialog>`（`fetchAIExplanation`）。
  - 请求 API：先调用 ai-service（`callAiDirect`，scene="question_explanation"），随后 POST `/api/ai/log`。
  - 日志写入 from：`study_chat`，contextTag=`study`，contextMeta 包含 `licenseType`、`stage`、`questionId`、`questionHash`。
- **考试页面 AI 助手**：
  - 前端组件：`src/app/study/exam/page.tsx` 中的 `<QuestionAIDialog>`（同上复用）。
  - 请求 API：先调用 ai-service（`callAiDirect`），随后 POST `/api/ai/log`。
  - 日志写入 from：`exam_chat`，contextTag=`exam`，contextMeta 包含 `licenseType`、`stage`、`questionId`、`questionHash`。
- **后台日志来源映射**：`from` 映射为中文标签并显示在新“来源”列。

## 四、新增写入点（insertAiLog 入口）
| 入口 | Route 文件 | from 值 | 说明 |
| --- | --- | --- | --- |
| 学科学习 AI 助手 | `/api/ai/log`（由 `QuestionAIDialog` 调用） | `study_chat` | 成功拿到 AI 回复后写入，附带题目 hash、licenseType、stage。 |
| 考试 AI 助手 | `/api/ai/log`（由 `QuestionAIDialog` 调用） | `exam_chat` | 同上，附带题目上下文。 |
| 首页聊天（已有） | `/api/ai/chat` | `chat` | 现有逻辑保持不变。 |

> 所有新增写入均通过统一 helper `insertAiLog`，失败不阻断用户收到回答。

## 五、后台 UI 调整
- 列宽可拖动：所有列支持鼠标拖拽，`userId` 默认 260px，其他列保持原布局。
- userId 点击过滤：点击某行 userId 自动设置过滤并跳回第 1 页，顶部显示“当前过滤：userId=xxx”，可一键清除。
- 来源列：新增列展示 from 映射，未知值以“其他（原始值）”显示；服务/缓存信息单列展示，并保留“查看来源”按钮。

## 六、验证情况
> 本地环境无法连真实 AI 服务与 AI DB，未能完成实际落库与查询，请在有 AI_DATABASE_URL 的环境按下列步骤复核。

1) **写入验证（3 入口）**
   - 示例问题：
     - 首页：`首页日志测试 2025-12-09-01`
     - 学科学习：`学习助手日志测试 2025-12-09-02`
     - 考试：`考试助手日志测试 2025-12-09-03`
   - 期望 SQL 查询（示例）：
     ```sql
     SELECT id, user_id, question, "from", created_at
     FROM ai_logs
     WHERE question LIKE '%2025-12-09-%'
     ORDER BY created_at DESC;
     ```
   - 期望结果：三条记录分别对应 chat / study_chat / exam_chat，user_id 为实际用户或 null。

2) **后台页面验证**
   - 打开 `/admin/ai/logs`：
     - 新“来源”列显示中文标签；列宽可拖动；userId 点击后列表按该用户过滤，顶部出现过滤提示，可清除恢复全量。
     - 新写入的 3 条记录在无过滤/过滤时均可见，来源列显示正确。

3) **构建与检查**
   - `npm run lint`：通过（仅现有的依赖项/无关 warning）。
   - `npm run build`：通过，存在若干历史 lint warning（React hooks 依赖、no-img-element 等）与 node ESM 提示，未新增阻塞。

## 七、提交分支与版本
- 当前分支：`main`（本地）
- Commit：尚未提交（请按需提交/推送）

## 八、注意事项
- `/api/ai/log` 默认允许前端调用写入，若需收敛可在后续增加鉴权或来源校验。
- 日志 sources 中会追加 `title=context` 记录题目上下文，snippet 最长 500 字，便于排查来源。
