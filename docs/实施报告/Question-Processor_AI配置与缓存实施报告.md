# Question-Processor AI 配置与缓存实施报告

**实施日期：2025-11-17**  
**指令版本：0003**

## 一、任务概述

为 `apps/question-processor` 增加 AI 配置模块和内存缓存支持，确保所有 AI 调用统一使用配置和缓存。

## 二、已完成的任务

### ✅ 任务 1：创建 AI 配置模块

**新建文件**：`apps/question-processor/src/aiConfig.ts`

**功能**：
- 从环境变量读取 AI Provider 配置（`QP_AI_PROVIDER`）
- 支持为不同 provider 配置不同默认模型
- 支持缓存开关和 TTL 配置

**关键代码**：
```typescript
export interface QpAiConfig {
  provider: QpAiProvider; // "local" | "render"
  renderModel: string; // 远程 Render 模型，如 "gpt-4o-mini"
  localModel: string; // 本地 Ollama 模型，如 "ollama:llama3"
  cacheEnabled: boolean;
  cacheTtlMs: number;
}

export function loadQpAiConfig(): QpAiConfig
```

**环境变量**：
- `QP_AI_PROVIDER` - 选择 provider（local / render）
- `QP_AI_RENDER_MODEL` - Render 模型（默认：gpt-4o-mini）
- `QP_AI_LOCAL_MODEL` - Local 模型（默认：ollama:llama3）
- `QP_AI_CACHE_ENABLED` - 是否启用缓存（true / false）
- `QP_AI_CACHE_TTL_MS` - 缓存有效期（毫秒，默认：300000）

### ✅ 任务 2：创建内存缓存模块

**新建文件**：`apps/question-processor/src/aiCache.ts`

**功能**：
- 提供进程内内存缓存
- 支持 TTL（缓存有效期）
- 使用 hash 构建缓存 key（避免 key 太长）

**关键代码**：
```typescript
export interface AiCacheKeyInput {
  scene: string;
  provider: string;
  model: string;
  questionText: string;
}

export function getAiCache<T>(keyInput: AiCacheKeyInput): T | null
export function setAiCache<T>(keyInput: AiCacheKeyInput, value: T, ttlMs: number): void
export function clearAiCache(): void
```

**缓存 key 构建**：
- 格式：`${scene}::${provider}::${model}::${hash}`
- 使用简单 hash 算法，避免 key 太长

### ✅ 任务 3：在 ai.ts 中接入配置与缓存

**文件**：`apps/question-processor/src/ai.ts`

**主要变更**：

1. **导入配置和缓存模块**：
   ```typescript
   import { loadQpAiConfig } from "./aiConfig";
   import { getAiCache, setAiCache } from "./aiCache";
   ```

2. **模块级加载配置**：
   ```typescript
   const qpAiConfig = loadQpAiConfig();
   
   // 启动时输出配置日志
   console.log("[question-processor] AI config:", {
     provider: qpAiConfig.provider,
     renderModel: qpAiConfig.renderModel,
     localModel: qpAiConfig.localModel,
     cacheEnabled: qpAiConfig.cacheEnabled,
     cacheTtlMs: qpAiConfig.cacheTtlMs,
   });
   ```

3. **创建统一的 AI 调用封装**：
   ```typescript
   export async function callQuestionAi(params: {
     scene: string;
     questionText: string;
     locale?: string;
     sourceLanguage?: string;
     targetLanguage?: string;
     extraPayload?: Record<string, any>;
   }): Promise<{ answer: string; explanation?: string; sources?: any[] }>
   ```

4. **统一所有 AI 调用**：
   - `translateWithPolish` - 使用 `callQuestionAi`
   - `polishContent` - 使用 `callQuestionAi`
   - `generateCategoryAndTags` - 使用 `callQuestionAi`
   - `fillMissingContent` - 使用 `callQuestionAi`
   - `askAi` - 内部调用 `callQuestionAi`（向后兼容）

**缓存逻辑**：
1. 调用前检查缓存（如果启用）
2. 如果命中缓存，直接返回并记录日志
3. 如果未命中，调用 `callAiServer`
4. 调用成功后写入缓存（如果启用）

### ✅ 任务 4：为批量处理工具接入新的封装

**文件**：`src/app/api/admin/question-processing/_lib/batchProcessUtils.ts`

**主要变更**：

1. **创建共享配置和缓存模块**：
   - `src/lib/qpAiConfig.ts` - 与 question-processor 保持一致的配置逻辑
   - `src/lib/qpAiCache.ts` - 与 question-processor 保持一致的缓存逻辑

2. **在 batchProcessUtils 中接入配置和缓存**：
   ```typescript
   import { loadQpAiConfig } from "@/lib/qpAiConfig";
   import { getAiCache, setAiCache } from "@/lib/qpAiCache";
   
   const qpAiConfig = loadQpAiConfig();
   ```

3. **修改 `callAiAskInternal`**：
   - 优先使用环境变量配置（`QP_AI_PROVIDER`）
   - 添加缓存检查逻辑
   - 添加缓存写入逻辑

4. **修改 `getCurrentAiProviderConfig`**：
   - 优先使用环境变量配置
   - 如果没有环境变量，从数据库读取（向后兼容）

**关键改进**：
- 批量处理工具现在使用与 question-processor 相同的配置和缓存逻辑
- 可以通过环境变量统一控制 provider 和模型
- 缓存可以加速重复的 AI 调用

## 三、环境变量设计

### 3.1 Question-Processor 环境变量

**必需环境变量**（用于 AI 服务连接）：
- `AI_LOCAL_SERVICE_URL` - 本地 AI 服务地址
- `AI_LOCAL_SERVICE_TOKEN` - 本地 AI 服务 token
- `AI_RENDER_SERVICE_URL` - Render AI 服务地址
- `AI_RENDER_SERVICE_TOKEN` - Render AI 服务 token

**可选环境变量**（用于配置和缓存）：
- `QP_AI_PROVIDER` - 选择 provider（`local` / `render`，默认：`render`）
- `QP_AI_RENDER_MODEL` - Render 模型（默认：`gpt-4o-mini`）
- `QP_AI_LOCAL_MODEL` - Local 模型（默认：`ollama:llama3`）
- `QP_AI_CACHE_ENABLED` - 是否启用缓存（`true` / `false`，默认：`false`）
- `QP_AI_CACHE_TTL_MS` - 缓存有效期（毫秒，默认：`300000`，即 5 分钟）

### 3.2 Next.js 批量处理工具环境变量

**与 question-processor 使用相同的环境变量**：
- `QP_AI_PROVIDER`
- `QP_AI_RENDER_MODEL`
- `QP_AI_LOCAL_MODEL`
- `QP_AI_CACHE_ENABLED`
- `QP_AI_CACHE_TTL_MS`

**注意**：
- 这些环境变量只在服务端使用，不会暴露到前端
- OpenAI / Ollama 的真正密钥依然只配置在 ai-service 那边

## 四、架构验证

### 4.1 Question-Processor 架构

```
apps/question-processor
  ↓
loadQpAiConfig() → 读取环境变量
  ↓
callQuestionAi() → 检查缓存 → callAiServer() → ai-service
  ↓
setAiCache() → 写入缓存
```

### 4.2 Next.js 批量处理工具架构

```
src/app/api/admin/question-processing/_lib/batchProcessUtils.ts
  ↓
loadQpAiConfig() → 读取环境变量（与 question-processor 一致）
  ↓
callAiAskInternal() → 检查缓存 → callAiServer() → ai-service
  ↓
setAiCache() → 写入缓存
```

### 4.3 统一配置和缓存

- ✅ **配置统一**：question-processor 和 batchProcessUtils 使用相同的环境变量
- ✅ **缓存统一**：两个模块使用相同的缓存逻辑（但缓存实例独立）
- ✅ **调用统一**：都通过 `callAiServer` 调用 ai-service

## 五、代码验证

### 5.1 文件创建

- ✅ `apps/question-processor/src/aiConfig.ts` - 已创建
- ✅ `apps/question-processor/src/aiCache.ts` - 已创建
- ✅ `src/lib/qpAiConfig.ts` - 已创建（共享版本）
- ✅ `src/lib/qpAiCache.ts` - 已创建（共享版本）

### 5.2 代码修改

- ✅ `apps/question-processor/src/ai.ts` - 已修改，所有函数使用 `callQuestionAi`
- ✅ `src/app/api/admin/question-processing/_lib/batchProcessUtils.ts` - 已修改，接入配置和缓存

### 5.3 Linter 检查

- ✅ 所有新文件已通过 linter 检查
- ✅ 所有修改的文件已通过 linter 检查

## 六、日志输出

### 6.1 启动日志

**Question-Processor 启动时**：
```
[question-processor] AI config: {
  provider: 'render',
  renderModel: 'gpt-4o-mini',
  localModel: 'ollama:llama3',
  cacheEnabled: true,
  cacheTtlMs: 300000
}
```

**Next.js 批量处理工具加载时**：
```
[batchProcessUtils] AI config: {
  provider: 'render',
  renderModel: 'gpt-4o-mini',
  localModel: 'ollama:llama3',
  cacheEnabled: true,
  cacheTtlMs: 300000
}
```

### 6.2 缓存命中日志

**Question-Processor**：
```
[question-processor] AI cache hit: question_translation render gpt-4o-mini
```

**Next.js 批量处理工具**：
```
[batchProcessUtils] AI cache hit: question_translation render gpt-4o-mini
```

## 七、测试建议

### 7.1 测试配置切换

1. **测试 provider 切换**：
   ```bash
   # 设置为 local
   export QP_AI_PROVIDER=local
   # 重启 question-processor
   # 验证日志输出 provider: 'local'
   # 验证 AI 调用使用 localModel
   ```

2. **测试模型切换**：
   ```bash
   # 设置不同的模型
   export QP_AI_RENDER_MODEL=gpt-4o
   export QP_AI_LOCAL_MODEL=ollama:llama3.2
   # 重启 question-processor
   # 验证日志输出正确的模型名称
   ```

### 7.2 测试缓存功能

1. **测试缓存启用**：
   ```bash
   # 启用缓存
   export QP_AI_CACHE_ENABLED=true
   export QP_AI_CACHE_TTL_MS=300000
   # 重启 question-processor
   # 执行相同的 AI 调用两次
   # 验证第二次出现缓存命中日志
   ```

2. **测试缓存 TTL**：
   ```bash
   # 设置较短的 TTL
   export QP_AI_CACHE_TTL_MS=10000
   # 执行 AI 调用
   # 等待 11 秒后再次执行相同调用
   # 验证第二次没有缓存命中（已过期）
   ```

### 7.3 测试批量处理工具

1. **测试批量处理使用配置**：
   - 在 Next.js 中执行批量处理任务
   - 验证日志输出 `[batchProcessUtils] AI config:`
   - 验证使用正确的 provider 和 model

2. **测试批量处理缓存**：
   - 启用缓存
   - 执行批量处理任务
   - 验证缓存命中日志

## 八、已知限制

### 8.1 缓存实例独立

**当前实现**：
- question-processor 和 batchProcessUtils 使用独立的缓存实例
- 两个进程之间的缓存不共享

**影响**：
- 如果同一个问题在两个进程中调用，不会共享缓存
- 这是预期的行为，因为它们是不同的进程

### 8.2 配置优先级

**当前实现**：
- question-processor：只使用环境变量
- batchProcessUtils：优先使用环境变量，如果没有则从数据库读取

**未来优化**：
- 可以统一配置优先级策略
- 或者完全移除数据库读取逻辑

## 九、总结

### 9.1 实施完成情况

- ✅ **创建 AI 配置模块** - 已完成
- ✅ **创建内存缓存模块** - 已完成
- ✅ **在 ai.ts 中接入配置与缓存** - 已完成
- ✅ **为批量处理工具接入新的封装** - 已完成
- ✅ **环境变量设计** - 已完成

### 9.2 关键改进

1. **统一配置**：
   - question-processor 和 batchProcessUtils 使用相同的环境变量
   - 支持通过环境变量切换 provider 和模型

2. **内存缓存**：
   - 支持进程内缓存，加速重复调用
   - 支持 TTL 配置
   - 缓存 key 包含 scene、provider、model、questionText

3. **统一封装**：
   - 所有 AI 调用都通过 `callQuestionAi`（question-processor）或 `callAiAskInternal`（batchProcessUtils）
   - 内部使用 `callAiServer`，确保只调用 ai-service

### 9.3 验证状态

- ✅ 代码已通过 linter 检查
- ✅ 所有 AI 调用已统一使用配置和缓存
- ⏳ 需要实际测试验证功能

### 9.4 下一步行动

1. ✅ **实施代码** - 已完成
2. ⏳ **配置环境变量** - 需要在实际环境中配置
3. ⏳ **测试验证** - 需要实际测试
4. ⏳ **监控日志** - 确认配置和缓存正常工作

所有任务已完成，可以开始测试。

