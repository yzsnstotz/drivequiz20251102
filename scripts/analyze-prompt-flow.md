# Prompt 流程分析

## 问题：首页AI助手en和ja均回复【Error】lang is not defined

## 代码流程分析

### 1. 前端调用流程
- `src/components/AIPage.tsx` → `callAiDirect` → `src/lib/aiClient.front.ts`
- 传递参数：`locale: "en-US"` 或 `"ja-JP"`, `scene: "chat"`

### 2. 后端接收流程
- `apps/ai-service/src/routes/ask.ts` → `parseAndValidateBody`
- 解析 `lang` 参数（从 `locale` 转换）
- 调用 `runScene` 执行场景

### 3. 场景执行流程（sceneRunner.ts）

#### 3.1 读取场景配置
- `getSceneConfig(sceneKey, locale, config)`
- 通过 Supabase REST API 查询：`/rest/v1/ai_scene_config?scene_key=eq.chat&enabled=eq.true`
- 根据 `locale` 选择对应的 prompt：
  - `locale.startsWith("ja")` → `system_prompt_ja`
  - `locale.startsWith("en")` → `system_prompt_en`
  - 否则 → `system_prompt_zh`

#### 3.2 替换占位符
- `replacePlaceholders(prompt, sourceLanguage, targetLanguage)`
- **只支持**：`{sourceLanguage}`, `{源语言}`, `{targetLanguage}`, `{目标语言}`
- **不支持**：`{lang}`, `{language}`

#### 3.3 构建消息
- `buildMessages({ sysPrompt, userPrefix, question, refPrefix, reference, sceneKey })`
- 对于 `chat` 场景，构建格式：
  ```
  [
    { role: "system", content: sysPrompt },
    { role: "user", content: `${userPrefix} ${question}\n\n${refPrefix}\n${reference}` }
  ]
  ```

#### 3.4 调用AI模型
- `callModelWithProvider` → OpenAI API
- 直接传递 `messages` 数组，不做任何修改

## 关键发现

### ✅ 代码中没有引入 {lang} 的地方
1. `getSceneConfig` - 直接从数据库读取，不做修改
2. `replacePlaceholders` - 只替换 `{sourceLanguage}` 和 `{targetLanguage}`
3. `buildMessages` - 直接使用 `sysPrompt`，不做修改
4. `callModelWithProvider` - 直接传递消息，不做修改

### ⚠️ 可能的问题点

#### 可能性1：数据库实际配置与查询结果不一致
- 本地查询显示配置正常
- 但生产环境可能不同
- **需要查看生产环境日志确认**

#### 可能性2：Supabase REST API 返回的数据不同
- `getSceneConfig` 通过 Supabase REST API 查询
- 可能返回的数据与直接数据库查询不同
- **需要检查 Supabase 配置或缓存**

#### 可能性3：日志显示的内容与实际发送的不同
- 代码中有日志记录，但可能日志记录的是修改前的数据
- **需要查看完整的日志流程**

## 诊断建议

### 1. 查看生产环境日志
查看以下关键日志：
- `[SCENE-RUNNER] 读取场景配置` - 确认从 Supabase 读取的原始数据
- `[SCENE-RUNNER] 场景配置读取成功` - 确认选择的 prompt
- `[SCENE-RUNNER] 替换占位符前` - 确认替换前的 prompt
- `[SCENE-RUNNER] 替换占位符后` - 确认替换后的 prompt
- `[SCENE-RUNNER] 准备调用模型` - 确认最终发送的 sysPrompt

### 2. 检查 Supabase 配置
- 确认 Supabase 项目配置
- 检查是否有 RLS (Row Level Security) 策略影响查询结果
- 检查是否有视图或触发器修改数据

### 3. 对比本地和生产环境
- 确认本地和生产环境连接的是同一个数据库
- 确认环境变量配置一致



