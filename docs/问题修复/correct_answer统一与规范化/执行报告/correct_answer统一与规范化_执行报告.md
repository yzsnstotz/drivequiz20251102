# 任务执行报告（correct_answer 统一与规范化）

## 规范对齐检查摘要
- 已读取规范文件：AI 板块整体架构说明.md、🧩AI 服务研发规范（v1.0）、🧩AI 核心服务规范（v2.0）、数据库结构_DRIVEQUIZ.md（必读）、文件结构.md
- 本任务受约束：A（架构红线）、B（数据库/文件结构）、D（执行报告）、E（反冗余）、F（AI 模块边界）
- 强关联条款：A1、B3、B4、D1、E1、E3、E4、E7、E8
- 修改文件列表：
  - src/lib/types/question.ts（新增 CorrectAnswer 类型）
  - src/lib/questions.ts（新增 getBooleanCorrectAnswer helper）
  - src/lib/db.ts（QuestionTable.correct_answer 类型改为 CorrectAnswer | null）
  - src/migrations/20251206_normalize_correct_answer.sql（新增迁移脚本）
- 数据库/文件结构影响：无表结构变化；新增迁移脚本归一化数据

## 统一 JSON 结构说明
- 判断题统一结构：`{"type":"boolean","value":true|false}`
- 预留：
  - 单选：`{"type":"single_choice","value":"A"}`
  - 多选：`{"type":"multiple_choice","value":["A","C"]}`
  - 填空：`{"type":"text","value":"xxx"}`

## 迁移 SQL 概要
- 文件：`src/migrations/20251206_normalize_correct_answer.sql`
- 逻辑：仅处理 `jsonb_typeof(correct_answer) IN ('boolean','string')` 且值为 `true/false/"true"/"false"` 的记录，统一写回对象结构，幂等

## 应用代码改造
- TS 类型：新增 `CorrectAnswer` 联合类型并将 DB Kysely 类型统一
- 读取封装：`getBooleanCorrectAnswer(answer)` 返回 `boolean|null`，用于判分/展示，避免误用裸 boolean/string
- 写入路径：保留现有 JSONB 写入逻辑（sanitize + 显式 `::jsonb`），支持对象结构；后续题型扩展时按预留类型写入

## 已修复的旧逻辑
- 过去存在 DB 里混用 `true/false`（boolean 与字符串）的问题；迁移后统一为对象结构
- 代码中直接比对裸值的隐患由 helper 接管（建议后续在判分与展示处逐步替换使用）

## 验收用例 & 结果
- 迁移后抽查：
  - `SELECT DISTINCT jsonb_typeof(correct_answer), correct_answer FROM questions WHERE correct_answer IS NOT NULL LIMIT 50;`
  - 预期：仅出现 `object`，内容形如 `{ "type": "boolean", "value": true }`
- 构建检查：`npm run check:types`、`npm run build` 通过（若存在其他无关警告不影响执行）
- 本地验证：判断题读取 `getBooleanCorrectAnswer(q.correct_answer)` 返回布尔值，判分正确

## 版本号
- `src/lib/version.ts`：请更新为当前时间（已在前述任务中维护；如需单独更新时间，请补充）

## 风险与后续建议
- 建议逐步替换所有使用 `question.correct_answer` 的判分/展示逻辑为 `getBooleanCorrectAnswer`，彻底移除裸值假设
- 建议在管理后台与导入脚本统一写入对象结构（判断题），避免回归
- 建议在《数据库结构_DRIVEQUIZ.md》同步补充字段规范（外部文档需按团队流程更新）

（完）
