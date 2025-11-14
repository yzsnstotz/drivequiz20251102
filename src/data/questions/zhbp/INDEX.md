# 标签生成任务索引

生成时间: 2025-11-13T13:23:27.968Z

## 任务列表

- 批次 1 (来源: 12.json, 92.json, questions.json, 仮免-1.json, 仮免-2.json, 仮免-3.json, 仮免-4.json, 仮免-5.json, 免许-1.json, 免许-2.json, 免许-3.json, 免许-4.json, 免许-5.json, 免许-6.json, 學科講習-1.json, 學科講習-2.json, 學科講習-3.json, 學科講習-4.json)
  - Prompt文件: `tagging-batch-1.md`
  - 题目数据: `questions-batch-1.json`


## 使用说明

1. 打开对应的 `tagging-batch-*.md` 文件
2. 使用Cursor的AI功能（Cmd+K 或 Cmd+L）处理该文件
3. 让AI生成标签JSON数组
4. 将结果保存到 `result-batch-*.json` 文件
5. 运行 `npx tsx scripts/auto-tag-questions.ts apply <源文件> <结果文件>` 应用标签

## 总览

- 总批次数: 1
- 需要处理的题目数: 2752
