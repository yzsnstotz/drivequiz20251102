# OpenRouter 配置指南

## 概述

已成功添加 OpenRouter 作为新的 AI 服务提供商。OpenRouter 是一个统一的 AI API 网关，支持多种 AI 提供商（OpenAI、Anthropic、Google、Meta 等）。

## 配置步骤

### 1. 获取 OpenRouter API Key

1. 访问 [OpenRouter](https://openrouter.ai/)
2. 注册账号并登录
3. 前往 [API Keys](https://openrouter.ai/keys) 页面
4. 创建新的 API Key
5. 复制 API Key（格式：`sk-or-v1-xxxxx`）

### 2. 配置环境变量

在 AI Service 的环境变量中添加以下配置：

```bash
# OpenRouter API Key
OPENROUTER_API_KEY=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

# OpenRouter Base URL（必须设置为 OpenRouter 的 API 地址）
OPENAI_BASE_URL=https://openrouter.ai/api/v1

# 可选：OpenRouter 需要的额外 headers
OPENROUTER_REFERER_URL=https://zalem.app  # 你的网站 URL
OPENROUTER_APP_NAME=ZALEM  # 应用名称
```

**注意**：
- 当 `OPENAI_BASE_URL` 包含 `openrouter.ai` 时，系统会自动使用 OpenRouter
- 如果设置了 `OPENROUTER_API_KEY`，系统会优先使用它；否则使用 `OPENAI_API_KEY`
- `OPENROUTER_REFERER_URL` 和 `OPENROUTER_APP_NAME` 是 OpenRouter 要求的 headers

### 3. 运行数据库迁移

执行数据库迁移脚本以支持 openrouter provider：

```bash
# 在 AI 数据库中执行
psql $AI_DATABASE_URL -f src/migrations/20250116_add_openrouter_provider.sql
```

或者通过 Supabase Dashboard 的 SQL Editor 执行迁移脚本。

### 4. 在管理界面配置

1. 访问 AI 配置中心（`/admin/ai/config`）
2. 在 "AI 服务提供商" 下拉菜单中选择 "OpenRouter"
3. 在 "AI 模型" 下拉菜单中选择你想要的模型（例如：`openai/gpt-4o-mini`）
4. 点击 "保存配置"

## 支持的模型

OpenRouter 支持多种 AI 提供商的模型，包括：

### OpenAI 模型
- `openai/gpt-4o-mini`
- `openai/gpt-4o`
- `openai/gpt-4-turbo`
- `openai/gpt-3.5-turbo`

### Anthropic Claude 模型
- `anthropic/claude-3.5-sonnet`
- `anthropic/claude-3-opus`
- `anthropic/claude-3-haiku`

### Google Gemini 模型
- `google/gemini-pro`
- `google/gemini-pro-1.5`

### Meta Llama 模型
- `meta-llama/llama-3.1-70b-instruct`
- `meta-llama/llama-3.1-8b-instruct`

### Mistral 模型
- `mistralai/mistral-7b-instruct`
- `mistralai/mixtral-8x7b-instruct`

### Qwen 模型
- `qwen/qwen-2.5-7b-instruct`
- `qwen/qwen-2.5-72b-instruct`

更多模型请参考 [OpenRouter Models](https://openrouter.ai/models)

## 工作原理

1. **路由选择**：当在配置中心选择 "OpenRouter" 时，系统会使用与 "online" 相同的 AI Service URL
2. **服务内部**：AI Service 根据环境变量 `OPENAI_BASE_URL` 检测是否为 OpenRouter
3. **API 调用**：如果检测到 OpenRouter，系统会：
   - 使用 `OPENROUTER_API_KEY`（如果设置）或 `OPENAI_API_KEY`
   - 添加必要的 headers（`HTTP-Referer` 和 `X-Title`）
   - 使用 OpenRouter 兼容的模型名称格式（例如：`openai/gpt-4o-mini`）

## 注意事项

1. **模型名称格式**：OpenRouter 使用 `provider/model` 格式（例如：`openai/gpt-4o-mini`），而不是直接使用模型名称
2. **成本估算**：当前成本估算基于 OpenAI 定价模型，使用其他提供商时可能需要调整
3. **API 限制**：不同模型可能有不同的速率限制和配额
4. **环境变量优先级**：
   - 如果 `OPENAI_BASE_URL` 包含 `openrouter.ai`，系统会自动使用 OpenRouter
   - 如果设置了 `OPENROUTER_API_KEY`，优先使用它；否则使用 `OPENAI_API_KEY`

## 故障排查

### 问题：OpenRouter 请求失败

1. 检查 `OPENROUTER_API_KEY` 是否正确设置
2. 检查 `OPENAI_BASE_URL` 是否设置为 `https://openrouter.ai/api/v1`
3. 检查 API Key 是否有足够的余额
4. 查看 AI Service 日志以获取详细错误信息

### 问题：模型名称无效

1. 确保使用正确的模型名称格式（`provider/model`）
2. 检查模型是否在 OpenRouter 上可用
3. 参考 [OpenRouter Models](https://openrouter.ai/models) 获取最新的模型列表

## 相关文件

- `apps/ai-service/src/index.ts` - AI Service 配置
- `apps/ai-service/src/lib/openaiClient.ts` - OpenAI 客户端（支持 OpenRouter）
- `src/app/admin/ai/config/page.tsx` - AI 配置管理界面
- `src/app/api/ai/ask/route.ts` - AI 问答路由
- `src/app/api/admin/ai/config/route.ts` - AI 配置 API
- `src/components/AIPage.tsx` - AI 聊天页面
- `src/migrations/20250116_add_openrouter_provider.sql` - 数据库迁移脚本

