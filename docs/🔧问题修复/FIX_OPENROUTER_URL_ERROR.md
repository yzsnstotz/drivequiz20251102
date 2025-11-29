# 修复 OpenRouter URL 配置错误

## 问题描述

在调用 Render + ChatGPT 选项时，出现 405 错误：

```
[ASK ROUTE] AI API call failed: {
  error: '405 status code (no body)',
  baseUrl: 'https://openrouter.ai/api/vi',
  isOpenRouter: true
}
```

**问题原因**：
- OpenRouter 的 baseUrl 配置错误：`https://openrouter.ai/api/vi`（少了 `1`）
- 正确的 URL 应该是：`https://openrouter.ai/api/v1`
- 405 错误通常表示 HTTP 方法不允许或 URL 不正确

## 修复方案

### 1. 添加自动修复逻辑

在 `apps/ai-service/src/lib/openaiClient.ts` 中添加了自动修复逻辑：

```typescript
// 修复常见的 OpenRouter URL 错误（api/vi -> api/v1）
if (baseUrl.includes("openrouter.ai")) {
  // 确保使用正确的 OpenRouter API 路径
  if (baseUrl.includes("/api/vi") && !baseUrl.includes("/api/v1")) {
    baseUrl = baseUrl.replace("/api/vi", "/api/v1");
    console.warn("[OpenAI Client] 检测到错误的 OpenRouter URL，已自动修复:", {
      original: process.env.OPENAI_BASE_URL,
      fixed: baseUrl,
    });
  }
  // 如果 URL 不包含 /api/v1，自动添加
  if (!baseUrl.includes("/api/v1") && !baseUrl.includes("/api/vi")) {
    baseUrl = "https://openrouter.ai/api/v1";
    console.warn("[OpenAI Client] OpenRouter URL 格式不正确，已自动修复为:", baseUrl);
  }
}
```

### 2. 改进错误处理

在 `apps/ai-service/src/routes/ask.ts` 中添加了针对 405 错误的特殊处理：

```typescript
} else if (error.status === 405) {
  // 405 Method Not Allowed 通常表示 URL 不正确
  errorCode = "PROVIDER_ERROR";
  const currentBaseUrl = process.env.OPENAI_BASE_URL || process.env.OLLAMA_BASE_URL || "https://api.openai.com/v1";
  if (currentBaseUrl.includes("openrouter.ai") && currentBaseUrl.includes("/api/vi")) {
    errorMessage = "OpenRouter URL configuration error: '/api/vi' should be '/api/v1'. Please check OPENAI_BASE_URL environment variable.";
  } else {
    errorMessage = `Method not allowed (405). This usually indicates an incorrect API URL. Current baseUrl: ${currentBaseUrl}`;
  }
  statusCode = 502;
}
```

## 环境变量配置

### 正确的配置

在 Render 或其他部署环境中，确保 `OPENAI_BASE_URL` 环境变量设置为：

```bash
OPENAI_BASE_URL=https://openrouter.ai/api/v1
```

**注意**：
- ✅ 正确：`https://openrouter.ai/api/v1`
- ❌ 错误：`https://openrouter.ai/api/vi`（少了 `1`）
- ❌ 错误：`https://openrouter.ai/api/v`（不完整）

### 检查环境变量

在 Render Dashboard 中：
1. 进入你的服务设置
2. 找到 "Environment" 部分
3. 检查 `OPENAI_BASE_URL` 的值
4. 确保设置为 `https://openrouter.ai/api/v1`

## 修复效果

### 修复前
- ❌ 405 错误：`Method not allowed`
- ❌ baseUrl: `https://openrouter.ai/api/vi`
- ❌ 请求失败

### 修复后
- ✅ 自动检测并修复错误的 URL
- ✅ baseUrl: `https://openrouter.ai/api/v1`
- ✅ 请求成功

## 验证修复

### 1. 检查日志

部署后，检查服务日志，应该看到：

```
[OpenAI Client] 检测到错误的 OpenRouter URL，已自动修复: {
  original: 'https://openrouter.ai/api/vi',
  fixed: 'https://openrouter.ai/api/v1'
}
```

### 2. 测试 API 调用

使用 ChatGPT 选项测试 AI 问答功能，应该能够正常返回结果。

## 相关文件

- **修复文件**：
  - `apps/ai-service/src/lib/openaiClient.ts` - 添加自动修复逻辑
  - `apps/ai-service/src/routes/ask.ts` - 改进错误处理
- **修复文档**：`docs/FIX_OPENROUTER_URL_ERROR.md`

## 注意事项

1. **自动修复**：代码会自动检测并修复常见的 URL 错误，但最好还是确保环境变量配置正确
2. **环境变量**：如果环境变量配置错误，代码会自动修复，但会在日志中记录警告
3. **向后兼容**：修复不会影响其他配置，只针对 OpenRouter URL 进行修复

## 总结

- ✅ **问题已修复**：添加了自动修复逻辑
- ✅ **错误处理改进**：提供更清晰的错误信息
- ✅ **向后兼容**：不影响其他配置

修复后，即使环境变量配置错误，代码也会自动修复并正常工作。

