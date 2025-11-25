# 多语言翻译状态说明

## 已完成的工作

1. ✅ **文件格式转换完成**
   - 已将 `questions_auto_tag.json` 从单语言格式转换为多语言格式
   - `content` 字段从 `string` 转换为 `{ zh: string, en: string, ja: string }`
   - `explanation` 字段（如果存在）也转换为多语言格式

2. ✅ **备份文件已创建**
   - 备份文件：`questions_auto_tag.json.backup`

3. ✅ **部分问题已翻译**
   - 已翻译：17/1376 个问题（1.24%）
   - 待翻译：1359 个问题（98.76%）

## 文件格式示例

```json
{
  "id": "1",
  "type": "truefalse",
  "content": {
    "zh": "1. 开车的时候，不能只考虑自己方便，要照顾到其他车辆和行人，要相互礼让驾驶。",
    "en": "1. When driving, you should not only consider your own convenience, but also take care of other vehicles and pedestrians, and drive with mutual courtesy.",
    "ja": "1. 運転する際は、自分の都合だけを考えるのではなく、他の車両や歩行者に配慮し、相互に譲り合って運転する必要があります。"
  },
  "correctAnswer": "true",
  ...
}
```

## 继续翻译的方法

### 方法1：使用项目中的翻译API

项目中有翻译服务（`apps/question-processor`），可以调用 `/translate` API来翻译内容。

### 方法2：使用批量翻译脚本

已创建的脚本：
- `scripts/batch-translate-all.js` - 批量翻译脚本框架
- `scripts/do-translate.js` - 翻译示例脚本

### 方法3：手动添加翻译映射

在 `scripts/batch-translate-all.js` 中的 `translations` 对象中添加更多翻译映射。

## 当前状态

- **总问题数**: 1376
- **已翻译**: 17 (1.24%)
- **待翻译**: 1359 (98.76%)

## 下一步

1. 继续使用翻译API或AI服务批量翻译剩余的问题
2. 或者手动添加更多翻译映射到脚本中
3. 翻译完成后，验证所有问题的格式是否正确

