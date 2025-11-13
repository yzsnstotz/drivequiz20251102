# Question Processor AI 服务配置

## 概述

question-processor 现在通过调用主站的 `/api/ai/ask` 路由来使用 AI 服务，这样可以自动使用数据库中的 `aiProvider` 配置（openai/openrouter/local）。

## 配置要求

### 1. 主站 URL 配置

question-processor 需要知道主站的 URL 才能调用 `/api/ai/ask`。请配置以下环境变量之一：

**优先级顺序：**
1. `MAIN_APP_URL` - 首选（明确配置）
2. `NEXT_PUBLIC_APP_URL` - 备用
3. `VERCEL_URL` - Vercel 自动提供（如果部署在 Vercel）

**示例：**
```bash
# 生产环境
MAIN_APP_URL=https://drivequiz20251102-app.vercel.app

# 或使用 Vercel 自动提供的 URL
# VERCEL_URL 会自动设置为当前部署的 URL
```

### 2. 数据库配置

question-processor 会自动使用数据库中的 `ai_config` 表的 `aiProvider` 配置：

- `openai` - 使用 OpenAI API
- `openrouter` - 使用 OpenRouter API
- `local` - 使用本地 Ollama 服务
- `openrouter_direct` - 直连 OpenRouter

**配置方式：**
在 AI 配置中心（`/admin/ai/config`）设置 `aiProvider`，question-processor 会自动使用该配置。

## 工作流程

```
question-processor
  ↓
调用主站 /api/ai/ask
  ↓
主站路由读取数据库 ai_config.aiProvider
  ↓
根据配置选择 AI 服务：
  - openai → AI Service (Render) → OpenAI
  - openrouter → AI Service (Render) → OpenRouter
  - local → 本地 Ollama 服务
  - openrouter_direct → 直连 OpenRouter
```

## 优势

1. **统一配置**：所有 AI 调用都使用同一个 `aiProvider` 配置
2. **自动切换**：在 AI 配置中心修改 `aiProvider` 后，question-processor 会自动使用新配置
3. **简化部署**：不需要在 question-processor 中单独配置 AI Service URL 和 Token
4. **支持匿名请求**：question-processor 作为内部服务，使用匿名模式调用主站 API

## 环境变量清单

### question-processor 服务需要配置：

- `MAIN_APP_URL` 或 `NEXT_PUBLIC_APP_URL` 或 `VERCEL_URL` - 主站 URL
- `QUESTION_PROCESSOR_DATABASE_URL` 或 `DATABASE_URL` - 数据库连接（用于读取题目和保存翻译）

### 主站需要配置：

- `ai_config` 表中的 `aiProvider` - AI 服务提供商配置
- `AI_SERVICE_URL` / `LOCAL_AI_SERVICE_URL` - AI 服务 URL（根据 `aiProvider` 选择）
- `AI_SERVICE_TOKEN` / `LOCAL_AI_SERVICE_TOKEN` - AI 服务 Token

## 故障排查

### 问题 1：找不到主站 URL

**错误信息：**
```
Missing MAIN_APP_URL/NEXT_PUBLIC_APP_URL/VERCEL_URL. Please configure the main app URL for question-processor.
```

**解决方案：**
在 question-processor 的环境变量中配置 `MAIN_APP_URL`。

### 问题 2：主站 API 返回错误

**检查：**
1. 确认主站 URL 正确
2. 确认主站 `/api/ai/ask` 路由正常工作
3. 查看主站日志了解具体错误

### 问题 3：AI 服务选择不正确

**检查：**
1. 在 AI 配置中心（`/admin/ai/config`）检查 `aiProvider` 配置
2. 确认主站能正确读取数据库配置
3. 查看主站日志了解 AI 服务选择逻辑

## 相关文件

- `apps/question-processor/src/ai.ts` - AI 调用逻辑
- `src/app/api/ai/ask/route.ts` - 主站 AI API 路由
- `src/app/admin/ai/config/page.tsx` - AI 配置中心

