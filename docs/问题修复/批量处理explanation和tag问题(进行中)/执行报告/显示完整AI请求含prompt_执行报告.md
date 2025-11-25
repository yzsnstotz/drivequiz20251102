# 显示完整 AI 请求（含 prompt）执行报告

## 一、任务摘要

**任务标识**: 在调试页面显示完整的 AI 请求体（包括 prompt 和预期输出格式）  
**执行时间**: 2025-11-21  
**触发原因**: 用户发现调试页面显示的请求体不完整，缺少 prompt 等关键信息

**核心目标**: 在任务详情页的 "📤 AI 请求体（完整）" 中显示：
- prompt（系统提示词）
- question（格式化后的题目文本）
- outputFormat（预期输出格式）
- 所有其他参数

---

## 二、问题分析

### 之前的请求体显示

```json
{
  "type": "truefalse",
  "scene": "question_full_pipeline",
  "locale": "zh",
  "question": "Source Language: zh\nQuestion Type: truefalse\n...",
  "sourceLanguage": "zh",
  "targetLanguage": "ja",
  "questionPayload": {...},
  "targetLanguages": ["ja", "en"]
}
```

**缺少的内容**:
- ❌ prompt（系统提示词）
- ❌ sceneName（场景名称）
- ❌ outputFormat（预期输出格式）

### 根本原因

`aiRequestDebug` 构造时，没有获取 scene 的配置信息。scene 配置（包括 prompt）是在 `callAiAskInternal` → `callAiServer` 中通过 `getSceneConfig` 获取的，但保存调试数据时没有包含这些信息。

---

## 三、修复方案

### 修改内容

**文件**: `src/app/api/admin/question-processing/_lib/batchProcessUtils.ts`（第 2095-2143 行）

**修改**: 在调用 AI 前，先获取 scene 配置，然后将 prompt 等信息包含在 `aiRequestDebug` 中

```typescript
// ========== STAGE 3: CALL_AI_FULL_PIPELINE ==========
currentStage = "CALL_AI_FULL_PIPELINE";
const aiCallStartTime = Date.now();
console.log(`[processFullPipelineBatch] [Q${question.id}] STAGE 3: CALL_AI_FULL_PIPELINE | scene=question_full_pipeline`);

// 📊 获取 scene 配置（包含 prompt），用于调试数据
const sceneConfig = await getSceneConfig("question_full_pipeline", sourceLanguage);

const aiResp = await callAiAskInternal(...);

// ...

// 📊 调试日志：构造完整的 AI 请求和响应数据（包含 prompt）
const aiRequestDebug = {
  scene: "question_full_pipeline",
  sceneName: sceneConfig?.sceneName || "question_full_pipeline",
  prompt: sceneConfig?.prompt || "[无法获取 prompt]",  // ✅ 新增
  question: input,
  questionPayload: aiQuestionPayload,
  sourceLanguage,
  targetLanguage: targetLanguages[0] || sourceLanguage,
  locale: sourceLanguage,
  type,
  targetLanguages,
  outputFormat: sceneConfig?.outputFormat || null,  // ✅ 新增
};
```

---

## 四、修复后的效果

### 完整的请求体显示

现在用户在任务详情页会看到：

```json
{
  "scene": "question_full_pipeline",
  "sceneName": "一体化题目处理",
  "prompt": "你是一个专业的驾照考试题目处理助手...\n\n请按照以下要求处理题目：\n1. 理解并分析题目内容\n2. 补充完善题目解释...",
  "question": "Source Language: zh\nQuestion Type: truefalse\nTarget Languages: ja,en\nContent: 10. 图中标志表示"中央线"...\nCorrect Answer: true\nExplanation: [缺失]",
  "questionPayload": {
    "id": "11",
    "type": "truefalse",
    "options": null,
    "questionText": "10. 图中标志表示"中央线"，但是中央线未必一定设在道路的中央。",
    "correctAnswer": true,
    "sourceLanguage": "zh",
    ...
  },
  "sourceLanguage": "zh",
  "targetLanguage": "ja",
  "locale": "zh",
  "type": "truefalse",
  "targetLanguages": ["ja", "en"],
  "outputFormat": "{\"source\":{\"language\":\"zh\",\"content\":\"...\"},...}"
}
```

### 新增的字段

- ✅ **prompt**: 完整的系统提示词（可能很长，包含所有指令）
- ✅ **sceneName**: 场景的中文名称（如"一体化题目处理"）
- ✅ **outputFormat**: 预期的输出格式示例

---

## 五、验证方法

1. **创建测试任务**
   ```
   题目 ID: 11
   操作: full_pipeline
   源语言: zh
   目标语言: ja, en
   ```

2. **查看任务详情**
   - 任务完成后，点击"查看详情"
   - 点击子任务的 ▶ 按钮
   - 查看 "📤 AI 请求体（完整）"

3. **验证内容**
   - ✅ 包含 `prompt` 字段（很长的文本）
   - ✅ 包含 `sceneName` 字段
   - ✅ 包含 `outputFormat` 字段
   - ✅ 包含所有原有字段

---

## 六、文件修改清单

| 文件 | 修改位置 | 修改内容 | 状态 |
|------|----------|----------|------|
| `batchProcessUtils.ts` | 第 2095-2143 行 | 获取 scene 配置，在 `aiRequestDebug` 中添加 prompt 等字段 | ✅ 已完成 |

**总计**: 1 个文件，1 处修改

---

## 七、关键技术点

### 1. getSceneConfig 函数

```typescript
async function getSceneConfig(sceneKey: string, locale: string = "zh"): Promise<{
  prompt: string;
  outputFormat: string | null;
  sceneName: string;
} | null>
```

从数据库 `ai_scene_configs` 表读取场景配置：
- `prompt`: 系统提示词
- `output_format`: 预期输出格式
- `scene_name`: 场景名称

### 2. 完整的 AI 请求流程

```
1. buildQuestionFullPipelineInput()
   ↓ 生成格式化的题目文本
2. getSceneConfig()
   ↓ 获取 scene 配置（prompt 等）
3. callAiAskInternal()
   ↓ 调用 AI，内部会拼装 prompt + question
4. 构造 aiRequestDebug
   ↓ 保存完整的请求信息（包括 prompt）
5. 显示在任务详情页
```

### 3. 为什么要在调用前获取配置

- `callAiAskInternal` 内部会调用 `getSceneConfig`，但不返回配置信息
- 为了在 `aiRequestDebug` 中包含 prompt，需要提前获取一次
- 这会产生一次额外的数据库查询，但对于调试来说是值得的

---

## 八、注意事项

### 性能影响

每次 full_pipeline 调用都会额外查询一次 scene 配置（`getSceneConfig`）。

**影响**:
- 额外的数据库查询（~1-5ms）
- 对整体性能影响很小（full_pipeline 通常需要 30-60秒）

**优化建议**（可选）:
- 可以在模块级缓存 scene 配置
- 或者只在需要调试信息时才获取

### 数据量

prompt 字段可能很长（几千字符），会增加存储空间：
- 每个 task item 的 `ai_request` 字段会变大
- JSONB 字段可以有效压缩

**建议**: 定期清理旧任务的调试数据，或者只保留最近 N 天的调试数据。

---

## 九、总结

### ✅ 已完成

- 在 `aiRequestDebug` 中添加了 prompt、sceneName、outputFormat
- 用户现在可以看到完整的 AI 请求体
- 方便排查 AI 行为问题

### 📊 对比

| 内容 | 修复前 | 修复后 |
|------|--------|--------|
| prompt | ❌ 缺失 | ✅ 完整显示 |
| sceneName | ❌ 缺失 | ✅ 显示 |
| outputFormat | ❌ 缺失 | ✅ 显示 |
| question | ✅ 有（字符串） | ✅ 有（字符串） |
| questionPayload | ✅ 有（对象） | ✅ 有（对象） |
| 其他参数 | ✅ 有 | ✅ 有 |

---

**执行报告生成时间**: 2025-11-21  
**修复状态**: ✅ 已完成  
**文件修改数量**: 1 个文件  
**Linter 状态**: ✅ 无错误  
**用户操作**: 重新执行任务即可看到完整的请求体（包括 prompt）

