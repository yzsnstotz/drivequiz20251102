# 多语言翻译任务说明

## 任务目标

将 `src/data/questions/zh/questions_auto_tag.json` 文件扩展为多语言格式，将所有问题的 `content` 和 `explanation` 字段翻译成英语和日语。

## 当前状态

### ✅ 已完成的工作

1. **文件格式转换完成（100%）**
   - 已将 `questions_auto_tag.json` 从单语言格式转换为多语言格式
   - 所有 1376 个问题的 `content` 字段已从 `string` 转换为 `{ zh: string, en: string, ja: string }`
   - `explanation` 字段（如果存在）也已转换为多语言格式
   - 文件格式已验证正确

2. **备份文件已创建**
   - 备份文件位置：`src/data/questions/zh/questions_auto_tag.json.backup`

3. **部分问题已翻译**
   - **已翻译：111/1376 个问题（8.07%）**
   - **待翻译：1265 个问题（91.93%）**

4. **已创建的脚本**
   - `scripts/translate-more.js` - 批量翻译脚本（已使用）
   - `scripts/translate-batch-2.js` - 第二批翻译脚本（已使用）
   - `scripts/translate-batch-3.js` - 第三批翻译脚本（已使用）
   - `scripts/TRANSLATION_STATUS.md` - 状态说明文档

## 文件格式说明

### 转换前格式
```json
{
  "id": "1",
  "type": "truefalse",
  "content": "1. 开车的时候，不能只考虑自己方便...",
  "explanation": "解析说明..."
}
```

### 转换后格式
```json
{
  "id": "1",
  "type": "truefalse",
  "content": {
    "zh": "1. 开车的时候，不能只考虑自己方便...",
    "en": "1. When driving, you should not only consider...",
    "ja": "1. 運転する際は、自分の都合だけを考えるのではなく..."
  },
  "explanation": {
    "zh": "解析说明...",
    "en": "Explanation in English...",
    "ja": "日本語の説明..."
  }
}
```

## 需要继续完成的任务

### 主要任务
1. **继续翻译剩余的问题**
   - 待翻译：1265 个问题
   - 需要翻译 `content` 字段的 `en` 和 `ja` 版本
   - 需要翻译 `explanation` 字段的 `en` 和 `ja` 版本（如果存在）

### 如何识别待翻译的问题
待翻译的问题满足以下条件之一：
- `content.en` 以 `[EN]` 开头
- `content.ja` 以 `[JA]` 开头
- `explanation.en` 以 `[EN]` 开头（如果存在）
- `explanation.ja` 以 `[JA]` 开头（如果存在）

### 验证脚本
可以使用以下命令检查进度：
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
console.log('已翻译:', translated, '(', ((translated / data.length) * 100).toFixed(2) + '%)');
console.log('待翻译:', needsTranslation, '(', ((needsTranslation / data.length) * 100).toFixed(2) + '%)');
"
```

## 继续翻译的方法

### 方法1：使用现有脚本模式

参考 `scripts/translate-batch-3.js` 的模式，创建新的翻译脚本：

1. 读取文件
2. 创建翻译映射对象 `translations`，键为中文内容，值为 `{ en: string, ja: string }`
3. 遍历所有问题，如果中文内容在映射中，则更新 `en` 和 `ja` 字段
4. 保存文件
5. 输出统计信息

### 方法2：使用项目中的翻译API

项目中有翻译服务（`apps/question-processor`），可以调用 `/translate` API：
- API路径：`/translate`
- 需要参数：`questionId` 或 `contentHash`、`from`、`to`

### 方法3：批量处理脚本

创建一个可以批量处理大量问题的脚本，使用AI翻译服务或外部翻译API。

## 翻译质量要求

1. **准确性**：翻译必须准确传达原文意思
2. **专业性**：使用驾驶考试相关的专业术语
3. **自然性**：翻译应该自然流畅，符合目标语言的表达习惯
4. **一致性**：相同术语在整个文件中应保持一致

## 文件位置

- **主文件**：`src/data/questions/zh/questions_auto_tag.json`
- **备份文件**：`src/data/questions/zh/questions_auto_tag.json.backup`
- **脚本目录**：`scripts/`

## 注意事项

1. **不要覆盖备份文件**
2. **每次翻译后保存文件**
3. **定期检查翻译进度**
4. **确保文件格式正确**（content 和 explanation 都应该是对象格式）
5. **翻译 explanation 时注意**：不是所有问题都有 explanation 字段

## 下一步行动

1. 继续创建翻译脚本，批量处理更多问题
2. 或者使用项目中的翻译API批量翻译
3. 每翻译一批后，更新进度并保存文件
4. 最终目标是完成所有 1376 个问题的翻译

## 当前进度检查

运行以下命令检查当前进度：
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
console.log('总问题数:', data.length);
console.log('已翻译:', translated, '(', ((translated / data.length) * 100).toFixed(2) + '%)');
console.log('待翻译:', needsTranslation, '(', ((needsTranslation / data.length) * 100).toFixed(2) + '%)');
"
```

## 完成标准

- [x] 文件格式转换完成
- [x] 备份文件创建
- [ ] 所有问题的 content 字段翻译完成（111/1376，8.07%）
- [ ] 所有问题的 explanation 字段翻译完成（如果存在）

---

**最后更新**：2024年（当前进度：111/1376，8.07%）

