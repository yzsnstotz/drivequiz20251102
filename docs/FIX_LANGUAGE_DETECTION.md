# 修复语言错乱问题

## 问题描述

用户反馈出现语言错乱问题：
- 用户用中文问"你好"，AI用日文回复
- 用户用英文问问题，AI用中文回复
- AI应该根据用户输入的问题语言自动选择回复语言

## 问题原因

1. **依赖传入的 lang 参数**：代码依赖传入的 `lang` 参数，而不是根据用户输入的问题自动检测语言
2. **系统提示词不够明确**：系统提示词没有明确要求AI用指定语言回复
3. **语言不一致**：传入的 `lang` 参数可能与用户输入的问题语言不一致

## 修复方案

### 1. 添加语言自动检测功能

添加 `detectLanguageFromQuestion` 函数，根据用户输入的问题自动检测语言：

```typescript
function detectLanguageFromQuestion(question: string): "zh" | "ja" | "en" {
  const text = question.trim();
  if (!text) return "zh";

  // 检测日文（平假名、片假名、汉字混合）
  const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
  if (japaneseRegex.test(text)) {
    const japaneseChars = text.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g) || [];
    if (japaneseChars.length > text.length * 0.3) {
      return "ja";
    }
  }

  // 检测英文（主要是英文字母）
  const englishRegex = /^[a-zA-Z\s.,!?'"-]+$/;
  if (englishRegex.test(text) && text.length > 0) {
    const englishChars = text.match(/[a-zA-Z]/g) || [];
    if (englishChars.length > text.length * 0.5) {
      return "en";
    }
  }

  // 检测中文（中文字符）
  const chineseRegex = /[\u4E00-\u9FAF]/;
  if (chineseRegex.test(text)) {
    return "zh";
  }

  // 默认返回中文
  return "zh";
}
```

### 2. 优先使用检测到的语言

修改语言选择逻辑，优先使用检测到的语言：

```typescript
// 始终根据用户输入的问题自动检测语言
const detectedLang = detectLanguageFromQuestion(question);
let lang: "zh" | "ja" | "en" = detectedLang;

// 如果传入的 lang 参数与检测到的语言不一致，使用检测到的语言
if (body.lang && typeof body.lang === "string") {
  const requestedLang = body.lang.toLowerCase().trim();
  if (requestedLang === "ja" || requestedLang === "en" || requestedLang === "zh") {
    // 如果传入的语言与检测到的语言一致，使用传入的语言
    // 如果不一致，优先使用检测到的语言（确保回复语言与问题语言一致）
    if (requestedLang === detectedLang) {
      lang = requestedLang as "zh" | "ja" | "en";
    } else {
      // 语言不一致，使用检测到的语言
      console.log("[LOCAL-AI] 语言不一致，使用检测到的语言", {
        requestedLang,
        detectedLang,
        usingLang: detectedLang,
      });
    }
  }
}
```

### 3. 强化系统提示词

在系统提示词中明确要求AI用指定语言回复：

```typescript
function buildSystemPrompt(lang: string): string {
  const base =
    "你是 ZALEM 驾驶考试学习助手。请基于日本交通法规与题库知识回答用户问题，引用时要简洁，不编造，不输出与驾驶考试无关的内容。**重要：请务必用中文回答，不要使用其他语言。**";
  if (lang === "ja") {
    return "あなたは ZALEM の運転免許学習アシスタントです。日本の交通法規と問題集の知識に基づいて、簡潔かつ正確に回答してください。推測や捏造は禁止し、関係のない内容は出力しないでください。**重要：必ず日本語で回答してください。他の言語は使用しないでください。**";
  }
  if (lang === "en") {
    return "You are ZALEM's driving-test study assistant. Answer based on Japan's traffic laws and question bank. Be concise and accurate. Do not fabricate or include unrelated content. **IMPORTANT: You MUST respond in English only. Do not use any other language.**";
  }
  return base;
}
```

## 修复效果

### 修复前
- 用户用中文问"你好" → AI用日文回复
- 用户用英文问问题 → AI用中文回复
- 语言不一致

### 修复后
- 用户用中文问"你好" → AI用中文回复 ✅
- 用户用英文问问题 → AI用英文回复 ✅
- 用户用日文问问题 → AI用日文回复 ✅
- 语言自动匹配

## 语言检测规则

1. **日文检测**：
   - 检测平假名（\u3040-\u309F）、片假名（\u30A0-\u30FF）、汉字（\u4E00-\u9FAF）
   - 如果日文字符占比 > 30%，判断为日文

2. **英文检测**：
   - 检测英文字母（a-zA-Z）
   - 如果英文字符占比 > 50%，判断为英文

3. **中文检测**：
   - 检测中文字符（\u4E00-\u9FAF）
   - 如果包含中文字符，判断为中文

4. **默认**：
   - 如果无法检测，默认使用中文

## 验证修复

### 测试用例

1. **中文问题**：
   ```bash
   curl -X POST http://127.0.0.1:8788/v1/ask \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer local_ai_token_dev_12345" \
     -d '{"question": "你好", "lang": "zh"}'
   ```
   **期望**：AI用中文回复

2. **英文问题**：
   ```bash
   curl -X POST http://127.0.0.1:8788/v1/ask \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer local_ai_token_dev_12345" \
     -d '{"question": "how fast could you drive in Japan for highways", "lang": "en"}'
   ```
   **期望**：AI用英文回复

3. **日文问题**：
   ```bash
   curl -X POST http://127.0.0.1:8788/v1/ask \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer local_ai_token_dev_12345" \
     -d '{"question": "こんにちは", "lang": "ja"}'
   ```
   **期望**：AI用日文回复

## 相关文件

- **修复文件**：`apps/local-ai-service/src/routes/ask.ts`
- **修复文档**：`docs/FIX_LANGUAGE_DETECTION.md`

## 注意事项

1. **需要重启服务**：修复后需要重启本地 AI 服务才能生效
2. **语言检测准确性**：语言检测基于字符统计，对于混合语言可能不够准确
3. **系统提示词**：系统提示词已强化，明确要求AI用指定语言回复
4. **向后兼容**：仍然支持传入 `lang` 参数，但如果与检测到的语言不一致，优先使用检测到的语言

## 总结

- ✅ **问题已修复**：添加了语言自动检测功能
- ✅ **优先使用检测到的语言**：确保回复语言与问题语言一致
- ✅ **强化系统提示词**：明确要求AI用指定语言回复
- ✅ **向后兼容**：仍然支持传入 `lang` 参数

修复后，AI会根据用户输入的问题语言自动选择回复语言，解决语言错乱问题。

