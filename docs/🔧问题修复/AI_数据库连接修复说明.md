# AI 数据库连接修复说明

## 问题诊断

### 发现的问题
1. ❌ AI 数据库连接失败：SSL 证书错误（self-signed certificate in certificate chain）
2. ❌ 代码逻辑问题：直连模式（openrouter_direct）仍然检查 AI_SERVICE_URL
3. ✅ AI 数据库配置存在：`AI_DATABASE_URL` 已正确配置

## 修复内容

### 1. 修复 AI 数据库 SSL 连接

**文件**: `src/lib/aiDb.ts`

**修复**:
- 在开发环境中，设置 `NODE_TLS_REJECT_UNAUTHORIZED = '0'` 以接受自签名证书
- 确保 SSL 配置正确应用

```typescript
// 在开发环境中，也设置全局环境变量以确保 SSL 连接成功
if (process.env.NODE_ENV === 'development' && !process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}
```

### 2. 修复 AI Service 配置检查逻辑

**文件**: `src/app/api/ai/ask/route.ts`

**修复**:
- 直连模式（openrouter_direct/openai_direct/gemini_direct）不再需要 AI_SERVICE_URL
- 只有在使用 AI Service 时才检查 AI_SERVICE_URL 和 AI_SERVICE_TOKEN

**修复前**:
```typescript
} else {
  if (!AI_SERVICE_URL || !AI_SERVICE_TOKEN) {
    // 错误：即使使用直连模式也会检查
    return err("INTERNAL_ERROR", "AI service is not configured.", 500);
  }
  if (aiProviderFromDb === "openrouter_direct") {
    // ...
  }
}
```

**修复后**:
```typescript
} else {
  // 直连模式不需要 AI Service
  if (aiProviderFromDb === "openrouter_direct") {
    aiServiceMode = "openrouter_direct";
    // 不需要检查 AI_SERVICE_URL
  } else {
    // 只有非直连模式才需要 AI Service
    if (!AI_SERVICE_URL || !AI_SERVICE_TOKEN) {
      return err("INTERNAL_ERROR", "AI service is not configured.", 500);
    }
  }
}
```

## 当前配置状态

### AI 数据库
- ✅ `AI_DATABASE_URL` 已配置
- ✅ 连接测试成功
- ✅ `ai_config` 表可访问
- ✅ `aiProvider` 配置：`openrouter_direct`

### AI Service 配置
- ⚠️ 当前使用 `openrouter_direct` 模式，不需要 `AI_SERVICE_URL`
- ⚠️ 需要配置 `OPENROUTER_API_KEY` 才能使用直连模式

## 需要的环境变量

### 如果使用 openrouter_direct 模式（当前配置）

需要在 `.env.local` 中添加：

```bash
# OpenRouter API Key（必需）
OPENROUTER_API_KEY=sk-or-v1-xxx...

# OpenRouter 配置（可选，有默认值）
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_REFERER_URL=https://zalem.app
OPENROUTER_APP_NAME=Zalem AI
```

### 如果使用 AI Service 模式

需要在 `.env.local` 中添加：

```bash
# AI Service 配置（必需）
AI_SERVICE_URL=https://your-ai-service-url.com
AI_SERVICE_TOKEN=your-service-token
```

## 验证结果

### AI 数据库连接
```bash
✅ AI 数据库连接成功
✅ ai_config 表查询成功
✅ aiProvider 配置: openrouter_direct
```

### 当前错误
```
OPENROUTER_API_KEY is not set
```

**解决方案**: 在 `.env.local` 中添加 `OPENROUTER_API_KEY`

## 下一步

1. ✅ AI 数据库连接已修复
2. ✅ 代码逻辑已修复（直连模式不再需要 AI Service）
3. ⚠️ 需要配置 `OPENROUTER_API_KEY` 才能使用 AI 功能

## 测试建议

配置 `OPENROUTER_API_KEY` 后，测试：
```bash
curl -X POST http://localhost:3000/api/ai/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "测试问题", "locale": "zh"}'
```

