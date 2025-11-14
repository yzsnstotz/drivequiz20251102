# 快速开始 - 继续多语言翻译任务

## 🎯 任务概述

继续完成 `src/data/questions/zh/questions_auto_tag.json` 的多语言翻译工作。

**当前进度**：111/1376 (8.07%)  
**待翻译**：1265 个问题

## 📋 快速检查当前状态

```bash
cd /Users/leo/Desktop/kkdrivequiz
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('src/data/questions/zh/questions_auto_tag.json', 'utf-8'));
let translated = 0;
let needsTranslation = 0;
data.forEach(q => {
  if (!q.content.en.startsWith('[EN]') && !q.content.ja.startsWith('[JA]')) {
    translated++;
  } else {
    needsTranslation++;
  }
});
console.log('✅ 已翻译:', translated, '(', ((translated / data.length) * 100).toFixed(2) + '%)');
console.log('⏳ 待翻译:', needsTranslation, '(', ((needsTranslation / data.length) * 100).toFixed(2) + '%)');
"
```

## 🚀 如何继续翻译

### 方法1：使用现有脚本模式（推荐）

1. **查看待翻译的问题**：
```bash
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('src/data/questions/zh/questions_auto_tag.json', 'utf-8'));
const untranslated = data.filter(q => q.content.en.startsWith('[EN]') || q.content.ja.startsWith('[JA]'));
console.log('待翻译的问题（前10个）:');
untranslated.slice(0, 10).forEach((q, i) => {
  console.log(\`\${i+1}. ID: \${q.id}, Content: \${q.content.zh.substring(0, 60)}...\`);
});
"
```

2. **创建新的翻译脚本**（参考 `scripts/translate-batch-3.js`）：
   - 复制现有脚本
   - 添加新的翻译映射到 `translations` 对象
   - 运行脚本更新文件

3. **运行脚本**：
```bash
node scripts/translate-batch-4.js
```

### 方法2：使用项目翻译API

项目中有翻译服务，可以批量调用：
- 查看：`apps/question-processor/src/index.ts`
- API端点：`POST /translate`

## 📁 重要文件

- **主文件**：`src/data/questions/zh/questions_auto_tag.json`
- **备份文件**：`src/data/questions/zh/questions_auto_tag.json.backup` ⚠️ 不要修改
- **任务说明**：`scripts/MULTILANG_TRANSLATION_TASK.md`
- **参考脚本**：`scripts/translate-batch-3.js`

## ✅ 文件格式要求

每个问题的格式应该是：
```json
{
  "content": {
    "zh": "中文内容",
    "en": "English translation",  // 不能以 [EN] 开头
    "ja": "日本語の翻訳"           // 不能以 [JA] 开头
  },
  "explanation": {                // 可选字段
    "zh": "中文解析",
    "en": "English explanation",
    "ja": "日本語の説明"
  }
}
```

## ⚠️ 注意事项

1. **不要修改备份文件**
2. **每次翻译后保存文件**
3. **确保翻译质量**：准确、专业、自然
4. **检查格式**：content 和 explanation 都应该是对象

## 📊 完成标准

- [x] 文件格式转换（100%）
- [ ] content 字段翻译（111/1376，8.07%）
- [ ] explanation 字段翻译（如果存在）

## 🔗 详细文档

查看完整任务说明：`scripts/MULTILANG_TRANSLATION_TASK.md`

