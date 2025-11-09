# 恢复正确答案脚本说明

## 功能说明

这个脚本用于从历史JSON文件中恢复正确答案到数据库。在修复过程中，如果题目的正确答案丢失了，可以使用这个脚本来恢复。

## 使用方法

### 1. 确保环境变量已配置

确保 `.env.local` 文件中已配置数据库连接信息：

```bash
DATABASE_URL=your_database_connection_string
```

### 2. 运行脚本

```bash
npx tsx scripts/restore-correct-answers.ts
```

或者：

```bash
tsx scripts/restore-correct-answers.ts
```

## 工作原理

1. **读取JSON文件**：脚本会扫描 `src/data/questions/zh/` 目录下的所有JSON文件（排除 `questions.json`）
2. **计算题目hash**：对每个题目计算其唯一标识hash（基于题目内容、选项、正确答案和图片）
3. **匹配数据库**：根据hash在数据库中查找对应的题目
4. **更新答案**：如果找到题目且答案需要更新，则更新数据库中的 `correct_answer` 字段

## 输出信息

脚本会输出以下信息：

- 处理的JSON文件数量
- 每个文件处理的题目数量
- 成功更新的题目数量
- 未找到的题目数量
- 错误信息（如果有）

## 注意事项

1. **备份数据库**：在运行脚本之前，建议先备份数据库
2. **检查JSON文件**：确保JSON文件中的 `correctAnswer` 字段格式正确
3. **题目匹配**：脚本通过计算题目的hash来匹配，如果题目内容、选项、正确答案或图片有任何变化，hash会不同，可能无法匹配

## 数据格式

JSON文件中的题目格式应该如下：

```json
{
  "questions": [
    {
      "id": 1,
      "type": "truefalse",
      "content": "题目内容",
      "correctAnswer": "true",
      "options": ["选项A", "选项B", "选项C", "选项D"],
      "image": "图片URL（可选）",
      "explanation": "解析说明（可选）"
    }
  ]
}
```

对于不同类型的题目：
- **判断题 (truefalse)**：`correctAnswer` 应该是 `"true"` 或 `"false"`
- **单选题 (single)**：`correctAnswer` 应该是字符串，如 `"A"` 或 `"选项A"`
- **多选题 (multiple)**：`correctAnswer` 应该是字符串数组，如 `["A", "B"]` 或 `["选项A", "选项B"]`

## 故障排除

如果脚本运行失败，请检查：

1. 数据库连接是否正常
2. JSON文件格式是否正确
3. 环境变量是否已正确配置
4. 是否有足够的权限访问数据库和文件系统

