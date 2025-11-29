# Render Provider JSON 格式输出问题报告

**报告日期**: 2025-11-18  
**问题类型**: AI 服务返回格式不符合预期  
**影响范围**: 批量处理任务（翻译、润色、填漏、标签）  
**严重程度**: 🔴 高

---

## 📋 问题现象汇总

### 1. 翻译场景（question_translation）

**问题描述**: AI 返回纯文本解释性内容，而非 JSON 格式的翻译结果

**示例 1 - 中译日**:
- **输入**: `Content: 19. 在如图所示道路上，A车超B车时，不得超出中央线在右侧部分行驶。`
- **预期输出**: `{"content": "図示された道路上で、A車がB車を追い越す際、中央線を越えて右側部分を走行してはならない。", "options": null, "explanation": null}`
- **实际输出**: `A車がB車を追い越す際には、中央線を越えて右側部分での走行は認められていません。これは、追い越しを行う際の安全を確保するための規則です。追い越しを行う場合は、十分な視界と安全を確認し、中央線を越えることが許可されている場合に限り行う必要があります。`

**示例 2 - 中译英**:
- **输入**: `Content: 19. 在如图所示道路上，A车超B车时，不得超出中央线在右侧部分行驶。`
- **预期输出**: `{"content": "On the road shown in the figure, when vehicle A overtakes vehicle B, it must not cross the center line to drive on the right side.", "options": null, "explanation": null}`
- **实际输出**: `在日本的交通法中，车辆在超车时必须遵守道路标线的规定。如果道路上有中央线，超车时不得越过中央线进入对向车道。因此，A车在超越B车时，确实不得超出中央线在右侧部分行驶。`

**错误日志**:
```
[translateWithPolish] AI response is not JSON format, treating as plain text. Response length: 232
[translateWithPolish] Response preview: この規則は、他の車両が前方の車両が転換または車道を変える際に急ブレーキや急角度で方向盤を回すことをしないようにすることであると言っているようです。
```

### 2. 润色场景（question_polish）

**问题描述**: AI 返回纯文本解释性内容，而非 JSON 格式的润色结果

**示例**:
- **输入**: `Language: zh-CN\nContent: 19. 在如图所示道路上，A车超B车时，不得超出中央线在右侧部分行驶。`
- **预期输出**: `{"content": "在如图所示道路上，A车超B车时，不得超出中央线在右侧部分行驶。", "options": null, "explanation": null}`
- **实际输出**: `在日本交通法规中，车辆在超车时必须遵守中央线的相关规定。具体来说，超车时不得越过中央线进入对向车道，除非有明确的标志或道路条件允许这样做。因此，A车在超B车时，不得超出中央线在右侧部分行驶，这是为了确保行车安全。`

**错误日志**:
```
[polishContent] Failed to parse AI response. Full response length: 106
[polishContent] Response preview: 在日本交通法规中，车辆在超车时必须遵守中央线的相关规定。具体来说，超车时不得越过中央线进入对向车道，除非有明确的标志或道路条件允许这样做。因此，A车在超B车时，不得超出中央线在右侧部分行驶，这是为了确保行车安全。
```

### 3. 填漏场景（question_fill_missing）

**问题描述**: AI 返回纯文本解释性内容，而非 JSON 格式的填漏结果

**示例**:
- **输入**: `Content: 19. 在如图所示道路上，A车超B车时，不得超出中央线在右侧部分行驶。\nQuestion Type: True/False (判断题，不需要选项，options 字段应设为 null 或空数组 [])`
- **预期输出**: `{"content": "在如图所示道路上，A车超B车时，不得超出中央线在右侧部分行驶。", "options": null, "explanation": "..."}`
- **实际输出**: `正确。在日本交通法规中，超车时不得越过中央线，必须在自己的车道内行驶。`

**错误日志**:
```
[fillMissingContent] Failed to parse AI response. Full response length: 35
[fillMissingContent] Response preview: 正确。在日本交通法规中，超车时不得越过中央线，必须在自己的车道内行驶。
```

### 4. 标签场景（question_category_tags）

**问题描述**: AI 返回纯文本解释性内容，而非 JSON 格式的标签结果

**示例**:
- **输入**: `Content: 19. 在如图所示道路上，A车超B车时，不得超出中央线在右侧部分行驶。`
- **预期输出**: `{"licenseTypeTag": ["ordinary"], "stageTag": "provisional", "topicTags": ["overtake_lane_change"]}`
- **实际输出**: `根据日本交通法规，在超车时，车辆不得越过中央线。如果在如图所示的道路上，A车超B车时，必须保持在自己的车道内，不能超出中央线进入右侧部分行驶。这是为了确保行车安全，避免发生交通事故。`

**错误日志**:
```
[generateCategoryAndTags] Failed to parse AI response. Full response length: 91
[generateCategoryAndTags] Response preview: 根据日本交通法规，在超车时，车辆不得越过中央线。如果在如图所示的道路上，A车超B车时，必须保持在自己的车道内，不能超出中央线进入右侧部分行驶。这是为了确保行车安全，避免发生交通事故。
[generateCategoryAndTags] Parse error: SyntaxError: Unexpected token '根', "根据日本交通法规，在"... is not valid JSON
```

---

## 🔍 问题根本原因分析

### 1. 实现路径

批量处理任务的调用链如下：

```
前端批量处理请求
  ↓
POST /api/admin/question-processing/batch-process
  ↓
processBatchAsync() [src/app/api/admin/question-processing/batch-process/route.ts]
  ↓
调用业务函数:
  - translateWithPolish() [batchProcessUtils.ts]
  - polishContent() [batchProcessUtils.ts]
  - fillMissingContent() [batchProcessUtils.ts]
  - generateCategoryAndTags() [batchProcessUtils.ts]
  ↓
callAiAskInternal() [batchProcessUtils.ts]
  ↓
callAiServer() [src/lib/aiClient.server.ts]
  ↓
POST https://zalem.onrender.com/v1/ask [apps/ai-service]
  ↓
askRoute() [apps/ai-service/src/routes/ask.ts]
  ↓
getSceneConfig() - 从数据库读取场景配置
  ↓
replacePlaceholders() - 替换 prompt 中的占位符
  ↓
openai.chat.completions.create() - 调用 OpenAI API
  ↓
返回 answer 字段
```

### 2. 关键代码位置

#### 2.1 场景配置读取

**文件**: `apps/ai-service/src/routes/ask.ts`

```typescript:149:222:apps/ai-service/src/routes/ask.ts
async function getSceneConfig(
  sceneKey: string,
  locale: string,
  config: ServiceConfig
): Promise<{ prompt: string; outputFormat: string | null } | null> {
  // ... 从 Supabase 读取场景配置
  // 返回 { prompt, outputFormat }
  return {
    prompt: finalPrompt,
    outputFormat: sceneConfig.output_format,  // ⚠️ 读取了 outputFormat，但未使用
  };
}
```

**问题**: 虽然读取了 `outputFormat`，但在调用 OpenAI API 时**未使用**该参数。

#### 2.2 OpenAI API 调用

**文件**: `apps/ai-service/src/routes/ask.ts`

```typescript:452:462:apps/ai-service/src/routes/ask.ts
completion = await openai.chat.completions.create({
  model: model,
  temperature: 0.4,
  messages: [
    { role: "system", content: sys },
    {
      role: "user",
      content: `${userPrefix} ${question}\n\n${refPrefix}\n${reference || "（無/None）"}`,
    },
  ],
  // ⚠️ 缺少 response_format 参数
});
```

**问题**: 
1. **未添加 `response_format: { type: "json_object" }` 参数**，导致 AI 模型不强制输出 JSON 格式
2. 虽然 prompt 中要求输出 JSON，但模型可能忽略该要求，返回纯文本解释

#### 2.3 场景配置使用

**文件**: `apps/ai-service/src/routes/ask.ts`

```typescript:411:432:apps/ai-service/src/routes/ask.ts
if (scene) {
  const sceneConfig = await getSceneConfig(scene, promptLocale, config);
  if (sceneConfig) {
    sys = replacePlaceholders(sceneConfig.prompt, sourceLanguage || undefined, targetLanguage || undefined);
    // ⚠️ 使用了 prompt，但未使用 outputFormat
  } else {
    sys = buildSystemPrompt(defaultPromptLang);
  }
}
```

**问题**: 虽然读取了 `sceneConfig.outputFormat`，但**未传递给 OpenAI API**。

### 3. 问题根源

1. **缺少 JSON 格式强制参数**: OpenAI API 支持 `response_format: { type: "json_object" }` 参数来强制模型输出 JSON 格式，但代码中未使用
2. **Prompt 约束不足**: 虽然 prompt 中要求输出 JSON，但模型（特别是 gpt-4o-mini）可能不严格遵守，返回解释性文本
3. **outputFormat 未使用**: 虽然从数据库读取了 `output_format` 字段，但未在 API 调用中使用

---

## 🛠️ 解决方案

### 方案 1: 添加 response_format 参数（推荐）

在调用 OpenAI API 时，如果场景配置要求 JSON 格式，添加 `response_format` 参数：

```typescript
// apps/ai-service/src/routes/ask.ts

// 在 getSceneConfig 调用后
const sceneConfig = await getSceneConfig(scene, promptLocale, config);
let responseFormat: { type: "json_object" } | undefined = undefined;

if (sceneConfig?.outputFormat) {
  // 如果 outputFormat 包含 "json" 或 "JSON"，强制 JSON 格式
  if (sceneConfig.outputFormat.toLowerCase().includes("json")) {
    responseFormat = { type: "json_object" };
  }
}

// 在调用 OpenAI API 时
completion = await openai.chat.completions.create({
  model: model,
  temperature: 0.4,
  messages: [
    { role: "system", content: sys },
    {
      role: "user",
      content: `${userPrefix} ${question}\n\n${refPrefix}\n${reference || "（無/None）"}`,
    },
  ],
  ...(responseFormat && { response_format: responseFormat }), // ✅ 添加 JSON 格式强制参数
});
```

### 方案 2: 增强 Prompt 约束

在 prompt 中更加强调 JSON 格式要求，添加示例：

```markdown
**CRITICAL**: You MUST output ONLY valid JSON. Do not include any explanatory text before or after the JSON.

Example output format:
```json
{"content": "...", "options": [...], "explanation": "..."}
```

**DO NOT** output explanations like "This question is about..." or "According to Japanese traffic laws...". Output ONLY the JSON object.
```

### 方案 3: 后处理验证和重试

在解析 AI 响应时，如果检测到非 JSON 格式，可以：
1. 记录详细错误日志
2. 尝试从响应中提取 JSON（如果包含代码块）
3. 如果完全无法解析，抛出明确的错误信息

**当前实现**: `batchProcessUtils.ts` 中已有部分后处理逻辑，但无法处理完全非 JSON 的响应。

---

## 📊 影响范围

### 受影响的功能

1. ✅ **翻译功能** (`question_translation`): 完全失败，无法获取翻译结果
2. ✅ **润色功能** (`question_polish`): 完全失败，无法获取润色结果
3. ✅ **填漏功能** (`question_fill_missing`): 完全失败，无法获取填漏结果
4. ✅ **标签功能** (`question_category_tags`): 完全失败，无法获取标签结果

### 受影响的环境

- ✅ **Render Provider** (`https://zalem.onrender.com`): 确认受影响
- ❓ **Local Provider** (`https://ai-service.zalem.app`): 需要进一步测试

### 测试数据

- **测试题目数量**: 4 题（题目 46-49）
- **失败操作数**: 16 个操作（4 题 × 4 个操作）
- **成功率**: 0%

---

## 🔧 修复优先级

| 优先级 | 修复项 | 预计工作量 | 影响 |
|--------|--------|------------|------|
| 🔴 P0 | 添加 `response_format` 参数 | 1-2 小时 | 解决所有 JSON 格式问题 |
| 🟡 P1 | 增强 Prompt 约束 | 1 小时 | 提高模型遵守率 |
| 🟢 P2 | 改进错误处理和日志 | 1 小时 | 便于调试和监控 |

---

## 📝 建议的修复步骤

1. **立即修复**（P0）:
   - 修改 `apps/ai-service/src/routes/ask.ts`
   - 在 `getSceneConfig` 调用后检查 `outputFormat`
   - 如果要求 JSON，添加 `response_format: { type: "json_object" }` 参数
   - 测试所有场景（翻译、润色、填漏、标签）

2. **增强 Prompt**（P1）:
   - 更新数据库中的场景配置 prompt
   - 添加更明确的 JSON 格式要求和示例
   - 强调"仅输出 JSON，不要添加解释性文本"

3. **改进错误处理**（P2）:
   - 在 `batchProcessUtils.ts` 中增强错误日志
   - 提供更详细的错误信息，便于快速定位问题

---

## 🔗 相关文件

- `apps/ai-service/src/routes/ask.ts` - AI 服务主路由
- `apps/ai-service/src/lib/openaiClient.ts` - OpenAI 客户端封装
- `src/app/api/admin/question-processing/_lib/batchProcessUtils.ts` - 批量处理工具函数
- `src/lib/aiClient.server.ts` - 服务端 AI 客户端
- `src/migrations/20251117_improve_translation_prompt.sql` - 翻译场景 prompt 更新

---

## 📌 总结

**核心问题**: `ai-service` 在调用 OpenAI API 时未使用 `response_format: { type: "json_object" }` 参数，导致模型返回纯文本而非 JSON 格式。

**解决方案**: 在 `apps/ai-service/src/routes/ask.ts` 中添加 `response_format` 参数，当场景配置要求 JSON 格式时强制模型输出 JSON。

**预计修复时间**: 1-2 小时

**测试要求**: 修复后需要测试所有场景（翻译、润色、填漏、标签）的 JSON 格式输出。

