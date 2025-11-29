# 服务端 AI 调用迁移完成报告

**迁移日期：2025-11-17**  
**指令版本：0003**

## 一、任务概述

将服务端所有对 `/api/ai/ask` 的调用迁移为直接调用 ai-service，统一使用服务端 AI Client。

## 二、已完成的任务

### ✅ 任务 1：创建服务端 AI Client

**新建文件**：`src/lib/aiClient.server.ts`

**功能**：
- 提供 `callAiServer` 函数，直接调用 ai-service
- 使用服务端环境变量（`AI_LOCAL_SERVICE_URL` / `AI_RENDER_SERVICE_URL`）
- 支持超时配置（默认 120 秒）
- 统一的错误处理和响应格式

**关键代码**：
```typescript
export type ServerAiProviderKey = "local" | "render";

export async function callAiServer<T = any>(
  params: ServerAiRequest,
  options?: { timeoutMs?: number }
): Promise<ServerAiResponse<T>>
```

**特点**：
- 使用 `"server-only"` 标记，确保不会被打包到浏览器
- 支持 `local` 和 `render` 两个 provider
- 自动处理超时、网络错误、认证错误等

### ✅ 任务 2：迁移 question-processor/src/ai.ts

**文件**：`apps/question-processor/src/ai.ts`

**主要变更**：

1. **引入新的依赖**：
   ```typescript
   import { callAiServer } from "../../src/lib/aiClient.server";
   ```

2. **移除旧的逻辑**：
   - 移除了 `getMainAppUrl()` 函数
   - 移除了对 `/api/ai/ask` 的 fetch 调用

3. **替换 API 调用**：
   ```typescript
   // 修改前
   const mainAppUrl = getMainAppUrl();
   const url = `${mainAppUrl}/api/ai/ask`;
   const res = await fetch(url, { ... });

   // 修改后
   const provider: "local" | "render" = "render";
   const aiResp = await callAiServer({
     provider,
     question: body.question,
     locale: body.lang || "zh-CN",
     scene: body.scene,
     sourceLanguage: body.sourceLanguage,
     targetLanguage: body.targetLanguage,
   });
   ```

4. **调整响应处理**：
   - 使用 `aiResp.ok` 和 `aiResp.data` 处理响应
   - 改进错误处理

**影响**：
- `askAi` 函数现在直接调用 ai-service
- 不再依赖主站 `/api/ai/ask` 路由
- 默认使用 `render` provider（未来可以从配置中心获取）

### ✅ 任务 3：迁移 batchProcessUtils.ts

**文件**：`src/app/api/admin/question-processing/_lib/batchProcessUtils.ts`

**主要变更**：

1. **引入新的依赖**：
   ```typescript
   import { callAiServer, type ServerAiProviderKey } from "@/lib/aiClient.server";
   import { mapDbProviderToClientProvider } from "@/lib/aiProviderMapping";
   ```

2. **添加配置获取函数**：
   ```typescript
   async function getCurrentAiProviderConfig(): Promise<{ provider: ServerAiProviderKey; model?: string }> {
     // 从数据库读取 ai_config 配置
     // 使用 mapDbProviderToClientProvider 映射 provider
   }
   ```

3. **替换 `callAiAskInternal` 函数**：
   ```typescript
   // 修改前
   const apiUrl = `${baseUrl}/api/admin/ai/ask`;
   const response = await fetch(apiUrl, { ... });

   // 修改后
   const { provider, model } = await getCurrentAiProviderConfig();
   const aiResp = await callAiServer({
     provider,
     question: params.question,
     locale: params.locale || "zh-CN",
     scene: params.scene,
     sourceLanguage: params.sourceLanguage,
     targetLanguage: params.targetLanguage,
     model: model,
   }, { timeoutMs: singleRequestTimeout });
   ```

4. **调整错误处理**：
   - 更新 `isTemporaryRateLimit` 函数，支持 `response` 为 `null` 的情况
   - 保持原有的重试逻辑和错误处理

**影响**：
- `callAiAskInternal` 现在直接调用 ai-service
- 不再依赖 `/api/admin/ai/ask` 路由
- 从数据库读取 provider 和 model 配置

### ✅ 任务 4：更新 aiProviderMapping.ts

**文件**：`src/lib/aiProviderMapping.ts`

**主要变更**：

1. **移除 `"use client"` 标记**：
   - 现在可以在服务端和前端使用

2. **更新类型**：
   ```typescript
   import type { ServerAiProviderKey } from "./aiClient.server";
   
   export function mapDbProviderToClientProvider(
     dbProvider: string | null | undefined
   ): AiProviderKey | ServerAiProviderKey
   ```

**影响**：
- 映射函数现在可以在服务端和前端使用
- 类型兼容性更好

## 三、验证结果

### 3.1 代码检查

- ✅ 所有文件已通过 linter 检查
- ✅ 所有服务端调用已迁移到 `callAiServer`
- ✅ 不再有对 `/api/ai/ask` 的实际业务调用

### 3.2 调用点验证

**服务端调用点**：
1. ✅ `apps/question-processor/src/ai.ts` - 使用 `callAiServer`
2. ✅ `src/app/api/admin/question-processing/_lib/batchProcessUtils.ts` - 使用 `callAiServer`

**前端调用点**（已确认）：
1. ✅ `src/components/AIPage.tsx` - 使用 `callAiDirect`
2. ✅ `src/components/QuestionAIDialog.tsx` - 使用 `callAiDirect`
3. ✅ `src/app/ai/page.tsx` - 使用 `callAiDirect`
4. ✅ `src/app/admin/ai/scenes/page.tsx` - 使用 `callAiDirect`

**废弃路由**：
- ✅ `/api/ai/ask` - 仅作为废弃提示，返回 410 错误

### 3.3 环境变量要求

**服务端环境变量**（必需）：
- `AI_LOCAL_SERVICE_URL` - 本地 AI 服务地址
- `AI_LOCAL_SERVICE_TOKEN` - 本地 AI 服务 token
- `AI_RENDER_SERVICE_URL` - Render AI 服务地址
- `AI_RENDER_SERVICE_TOKEN` - Render AI 服务 token

**前端环境变量**（必需）：
- `NEXT_PUBLIC_LOCAL_AI_SERVICE_URL` - 本地 AI 服务地址
- `NEXT_PUBLIC_LOCAL_AI_SERVICE_TOKEN` - 本地 AI 服务 token
- `NEXT_PUBLIC_RENDER_AI_SERVICE_URL` - Render AI 服务地址
- `NEXT_PUBLIC_RENDER_AI_SERVICE_TOKEN` - Render AI 服务 token

## 四、架构变化

### 4.1 迁移前

```
前端 → /api/ai/ask (Next.js) → AI Service
服务端 → /api/ai/ask (Next.js) → AI Service
```

### 4.2 迁移后

```
前端 → callAiDirect → AI Service (直接调用)
服务端 → callAiServer → AI Service (直接调用)
/api/ai/ask → 410 Gone (废弃提示)
```

## 五、关键改进

### 5.1 统一调用方式

- **前端**：使用 `callAiDirect`，从 `aiClient.front.ts`
- **服务端**：使用 `callAiServer`，从 `aiClient.server.ts`
- **统一接口**：两个函数都接受 `provider` 参数，支持 `local` 和 `render`

### 5.2 配置驱动

- **前端**：从配置中心获取 provider（`getCurrentAiProvider`）
- **服务端**：从数据库获取 provider（`getCurrentAiProviderConfig`）
- **映射层**：使用 `mapDbProviderToClientProvider` 统一映射

### 5.3 错误处理

- **统一错误码**：`AUTH_REQUIRED`, `FORBIDDEN`, `AI_SERVICE_ERROR`, `AI_SERVICE_TIMEOUT`, `AI_SERVICE_NETWORK_ERROR`
- **详细日志**：记录 provider、URL、错误信息等
- **重试机制**：批量处理保留原有的重试逻辑

## 六、测试建议

### 6.1 测试 question-processor

1. **测试翻译功能**：
   - 运行 question-processor
   - 验证翻译是否正常工作
   - 检查日志，确认使用 `callAiServer`

2. **测试其他功能**：
   - 测试润色、分类标签、填漏等功能
   - 验证所有场景配置是否正常工作

### 6.2 测试批量处理

1. **测试批量翻译**：
   - 在管理后台启动批量处理任务
   - 验证是否正常调用 AI
   - 检查日志，确认使用 `callAiServer`

2. **测试 provider 切换**：
   - 在配置中心切换 provider（local / render）
   - 验证批量处理是否使用正确的 provider

### 6.3 验证环境变量

1. **检查服务端环境变量**：
   - 确认 `AI_LOCAL_SERVICE_URL` / `AI_LOCAL_SERVICE_TOKEN` 已配置
   - 确认 `AI_RENDER_SERVICE_URL` / `AI_RENDER_SERVICE_TOKEN` 已配置

2. **检查前端环境变量**：
   - 确认 `NEXT_PUBLIC_LOCAL_AI_SERVICE_URL` / `NEXT_PUBLIC_LOCAL_AI_SERVICE_TOKEN` 已配置
   - 确认 `NEXT_PUBLIC_RENDER_AI_SERVICE_URL` / `NEXT_PUBLIC_RENDER_AI_SERVICE_TOKEN` 已配置

## 七、已知限制

### 7.1 question-processor provider 配置

**当前实现**：
- 默认使用 `render` provider
- 硬编码在代码中

**未来优化**：
- 可以从配置中心获取 provider
- 或者从环境变量读取

### 7.2 批量处理配置获取

**当前实现**：
- 每次调用都从数据库读取配置
- 没有缓存机制

**未来优化**：
- 可以添加配置缓存
- 减少数据库查询

## 八、总结

### 8.1 迁移完成情况

- ✅ **服务端 AI Client**：已创建 `aiClient.server.ts`
- ✅ **question-processor**：已迁移到 `callAiServer`
- ✅ **批量处理**：已迁移到 `callAiServer`
- ✅ **映射层**：已更新，支持服务端使用
- ✅ **废弃路由**：`/api/ai/ask` 仅作为废弃提示

### 8.2 关键改进

1. **统一架构**：
   - 前端和服务端都直接调用 ai-service
   - 不再经过 Next.js 路由

2. **配置驱动**：
   - 从配置中心/数据库获取 provider
   - 支持动态切换 provider

3. **错误处理**：
   - 统一的错误码和错误处理
   - 详细的日志记录

### 8.3 验证状态

- ✅ 代码已通过 linter 检查
- ✅ 所有调用点已迁移
- ⏳ 需要实际测试验证功能

### 8.4 下一步行动

1. ✅ **迁移代码** - 已完成
2. ⏳ **测试验证** - 需要实际测试
3. ⏳ **监控日志** - 确认不再出现 `/api/ai/ask` 调用
4. ⏳ **环境变量配置** - 确认所有环境变量已正确配置

所有服务端调用已迁移完成，可以开始测试。

