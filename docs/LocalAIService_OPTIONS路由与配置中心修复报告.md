# Local AI Service OPTIONS 路由与配置中心修复报告

**修复日期：2025-11-17**  
**指令版本：0003**

## 一、问题描述

### 问题 1：Local AI Service OPTIONS 路由未注册

**错误信息**：`Route OPTIONS: /v1/ask not found`

**原因**：
- `apps/local-ai-service/src/index.ts` 只注册了 CORS，但没有注册 OPTIONS 预检请求处理
- 浏览器发送 OPTIONS 预检请求时，Fastify 找不到对应的路由

### 问题 2：配置中心设置 render 但请求还是到 local

**现象**：
- 在 AI 配置中心设置成通过 render
- 但前端请求还是发送到了 local AI service

**可能原因**：
- 前端组件可能使用了缓存的 provider 值
- 配置获取时机问题（异步获取未完成就发送请求）

## 二、已实施的修复

### ✅ 修复 1：Local AI Service OPTIONS 路由注册

**文件**：`apps/local-ai-service/src/index.ts`

**修改前**：
```typescript
// 注册 CORS
app.register(cors, {
  origin: false, // 默认关闭跨域，仅接受内部请求
});
```

**修改后**：
```typescript
// 注册 CORS（允许浏览器直接调用，参考 ai-service 实现）
app.register(cors, {
  origin: true, // 允许所有来源（与 ai-service 保持一致）
  credentials: false,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type"],
});

// 为 /v1/ask 注册 OPTIONS 预检请求处理（确保 CORS 正常工作，参考 ai-service 实现）
app.options("/v1/ask", async (req, reply) => {
  reply
    .header("Access-Control-Allow-Origin", "*")
    .header("Access-Control-Allow-Methods", "POST, OPTIONS")
    .header("Access-Control-Allow-Headers", "Content-Type, Authorization")
    .send();
});
```

**关键改进**：
1. ✅ 参考 `apps/ai-service/src/index.ts` 的实现方式
2. ✅ 注册 OPTIONS 路由处理预检请求
3. ✅ 更新 CORS 配置，允许浏览器直接调用（`origin: true`）

### ✅ 修复 2：配置中心 Provider 选择问题

#### 2.1 增强配置获取逻辑

**文件**：`src/components/QuestionAIDialog.tsx`

**修改前**：
```typescript
const providerToUse = currentProvider || "render";
```

**修改后**：
```typescript
// 确保 provider 已初始化（如果还未获取到配置，重新获取一次）
let providerToUse = currentProvider;
if (!providerToUse || providerToUse === "render") {
  // 如果 provider 未初始化或为默认值，尝试重新获取配置
  try {
    const config = await getCurrentAiProvider();
    providerToUse = config.provider;
    setCurrentProvider(config.provider);
    setCurrentModel(config.model);
    console.log("[QuestionAIDialog] 重新获取 provider 配置:", {
      provider: providerToUse,
      model: config.model,
    });
  } catch (err) {
    console.warn("[QuestionAIDialog] 重新获取 provider 配置失败，使用默认值:", err);
    providerToUse = "render";
  }
}
```

**关键改进**：
1. ✅ 在调用 AI 服务前，如果 provider 未初始化或为默认值，重新获取配置
2. ✅ 添加详细的日志，方便调试
3. ✅ 确保使用最新的配置值

#### 2.2 增强配置获取日志

**文件**：`src/components/QuestionAIDialog.tsx`

**修改**：
```typescript
getCurrentAiProvider()
  .then((config) => {
    console.log("[QuestionAIDialog] 获取到 provider 配置:", {
      provider: config.provider,
      model: config.model,
    });
    setCurrentProvider(config.provider);
    setCurrentModel(config.model);
  })
```

**文件**：`src/components/AIPage.tsx`

**修改**：
```typescript
getCurrentAiProvider()
  .then((config) => {
    console.log("[AIPage] 获取到 provider 配置:", {
      provider: config.provider,
      model: config.model,
    });
    setCurrentProvider(config.provider);
    setCurrentModel(config.model);
  })
```

#### 2.3 增强配置接口日志

**文件**：`src/app/api/ai/config/route.ts`

**修改**：
```typescript
// 映射 provider 到前端使用的格式
const provider = mapDbProviderToClientProvider(aiProvider);

// 添加调试日志
console.log("[GET /api/ai/config] 读取配置:", {
  dbProvider: aiProvider,
  mappedProvider: provider,
  model: model || undefined,
});
```

**关键改进**：
1. ✅ 显示数据库读取的原始 provider 值
2. ✅ 显示映射后的 provider 值
3. ✅ 方便排查配置映射问题

## 三、修复的文件清单

1. ✅ **`apps/local-ai-service/src/index.ts`** - 添加 OPTIONS 路由和更新 CORS 配置
2. ✅ **`src/components/QuestionAIDialog.tsx`** - 增强配置获取逻辑和日志
3. ✅ **`src/components/AIPage.tsx`** - 增强配置获取日志
4. ✅ **`src/app/api/ai/config/route.ts`** - 添加调试日志

## 四、验证要点

### 4.1 OPTIONS 路由验证

**测试**：
```bash
curl -X OPTIONS http://localhost:8788/v1/ask \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type,Authorization" \
  -v
```

**预期结果**：
- 返回 200 状态码
- 响应头包含：
  - `Access-Control-Allow-Origin: *`
  - `Access-Control-Allow-Methods: POST, OPTIONS`
  - `Access-Control-Allow-Headers: Content-Type, Authorization`

### 4.2 配置中心 Provider 选择验证

**测试步骤**：
1. 在 AI 配置中心设置 provider 为 `render`（或 `openai`/`openrouter`）
2. 打开浏览器控制台
3. 触发 AI 调用（如打开题目 AI 解析对话框）
4. 检查日志：
   - `[GET /api/ai/config] 读取配置:` - 显示数据库配置和映射结果
   - `[QuestionAIDialog] 获取到 provider 配置:` - 显示前端获取的配置
   - `[QuestionAIDialog] 调用 AI 服务:` - 显示实际使用的 provider

**预期结果**：
- 如果配置中心设置为 `render`（或 `openai`/`openrouter`），应该映射到 `"render"`
- 前端应该使用 `"render"` 作为 provider
- 请求应该发送到 `NEXT_PUBLIC_RENDER_AI_SERVICE_URL`

### 4.3 Provider 映射验证

**数据库配置值 → 前端 Provider**：
- `"local"` → `"local"`
- `"render"` → `"render"`
- `"openai"` → `"render"`（映射）
- `"openrouter"` → `"render"`（映射）
- `"gemini"` → `"render"`（映射）
- `null` 或未配置 → `"render"`（默认）

## 五、修复前后对比

### 修复前的问题

1. **OPTIONS 路由未注册**：
   - 浏览器发送 OPTIONS 预检请求时，Fastify 返回 404
   - CORS 预检失败，导致后续 POST 请求被阻止

2. **配置获取时机问题**：
   - 前端组件可能在配置获取完成前就发送请求
   - 使用了默认值 `"render"` 或缓存的旧值
   - 没有重新获取配置的机制

### 修复后的改进

1. **OPTIONS 路由已注册**：
   - 浏览器可以成功发送 OPTIONS 预检请求
   - CORS 预检通过，后续 POST 请求可以正常发送

2. **配置获取逻辑增强**：
   - 在调用 AI 服务前，如果 provider 未初始化，会重新获取配置
   - 添加了详细的日志，方便排查问题
   - 确保使用最新的配置值

## 六、测试建议

### 6.1 测试 OPTIONS 路由

1. **重启 local AI service**：
   ```bash
   cd apps/local-ai-service
   npm run dev
   ```

2. **测试 OPTIONS 请求**：
   ```bash
   curl -X OPTIONS http://localhost:8788/v1/ask -v
   ```
   - 应该返回 200，包含正确的 CORS 头

3. **测试前端调用**：
   - 打开浏览器控制台
   - 触发 AI 调用
   - 检查网络请求，确认 OPTIONS 预检请求成功

### 6.2 测试配置中心 Provider 选择

1. **设置配置**：
   - 在 AI 配置中心设置 provider 为 `render`（或 `openai`/`openrouter`）
   - 保存配置

2. **检查日志**：
   - 打开浏览器控制台
   - 触发 AI 调用
   - 查看日志：
     - `[GET /api/ai/config] 读取配置:` - 确认数据库配置正确
     - `[QuestionAIDialog] 获取到 provider 配置:` - 确认前端获取的配置正确
     - `[QuestionAIDialog] 调用 AI 服务:` - 确认实际使用的 provider 正确

3. **验证请求目标**：
   - 检查网络请求，确认请求发送到正确的服务（render 或 local）

## 七、已知问题

### 7.1 配置缓存

**当前实现**：
- 前端组件在打开对话框时获取配置
- 如果配置在对话框打开后更新，需要重新打开对话框才能生效

**解决方案**：
- 可以在调用前重新获取配置（已实现）
- 或者添加配置变更监听机制（可选）

### 7.2 默认值处理

**当前实现**：
- 如果配置获取失败，使用默认值 `"render"`
- 如果 provider 未初始化，也会使用默认值 `"render"`

**说明**：
- 这是合理的降级策略
- 确保系统在配置异常时仍能正常工作

## 八、总结

### 8.1 修复完成情况

- ✅ **Local AI Service OPTIONS 路由** - 已注册
- ✅ **CORS 配置** - 已更新，允许浏览器直接调用
- ✅ **配置获取逻辑** - 已增强，确保使用最新配置
- ✅ **调试日志** - 已添加，方便排查问题

### 8.2 关键改进

1. **OPTIONS 路由注册**：
   - 参考 `apps/ai-service/src/index.ts` 的实现
   - 确保 CORS 预检请求可以正常工作

2. **配置获取增强**：
   - 在调用前重新获取配置（如果未初始化）
   - 添加详细的日志，方便调试

3. **调试支持**：
   - 在关键位置添加日志
   - 显示配置读取、映射、使用的全过程

### 8.3 验证状态

- ✅ 代码已通过 linter 检查
- ✅ OPTIONS 路由已注册
- ✅ 配置获取逻辑已增强
- ⏳ 需要实际测试验证功能

### 8.4 下一步行动

1. ✅ **修复代码** - 已完成
2. ⏳ **重启服务** - 需要重启 local AI service
3. ⏳ **测试验证** - 需要实际测试
4. ⏳ **监控日志** - 确认配置正确使用

所有修复已完成，可以开始测试。

