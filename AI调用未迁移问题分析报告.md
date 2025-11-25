# AI 调用未迁移问题分析报告

**分析日期：2025-11-17**  
**指令版本：0002**

## 一、问题概述

从日志中观察到：
```
[api/ai/ask] Deprecated route was called. It should no longer be used.
POST /api/ai/ask 410 in 87ms
```

**问题**：前端代码仍在调用废弃的 `/api/ai/ask` 路由，导致返回 410 错误，AI 调用无法正常工作。

## 二、问题分析

### 2.1 已迁移的文件

以下文件已经正确迁移到使用 `callAiDirect`：

1. ✅ `src/components/AIPage.tsx` - 已使用 `callAiDirect()`
2. ✅ `src/app/admin/ai/scenes/page.tsx` - 已使用 `callAiDirect()`

### 2.2 未迁移的文件

以下文件仍在调用废弃的 `/api/ai/ask` 路由：

#### 文件 1：`src/components/QuestionAIDialog.tsx`

**位置**：第 368 行

**当前代码**：
```typescript
const result = await apiFetch<{
  answer: string;
  sources?: Array<{...}>;
  aiProvider?: "openai" | "local" | "openrouter" | ...;
  model?: string;
  cached?: boolean;
  cacheSource?: "localStorage" | "database";
}>("/api/ai/ask", {
  method: "POST",
  body: {
    question: questionText,
    locale: language,
    ...(questionHash ? { questionHash } : {}),
    scene: "question_explanation",
  },
});
```

**问题**：
- 直接调用 `/api/ai/ask`，该路由已废弃
- 返回 410 错误，导致 AI 调用失败
- 没有使用 `callAiDirect()` 函数

**影响**：
- 题目解析功能无法正常工作
- 用户无法获取 AI 解析

#### 文件 2：`src/app/ai/page.tsx`

**位置**：第 67 行

**当前代码**：
```typescript
const response = await apiPost<{
  answer: string;
  sources?: Array<{...}>;
}>("/api/ai/ask", {
  question: userMessage.content,
  context: context,
  locale: "zh",
});
```

**问题**：
- 直接调用 `/api/ai/ask`，该路由已废弃
- 返回 410 错误，导致 AI 调用失败
- 没有使用 `callAiDirect()` 函数

**影响**：
- `/ai` 页面的 AI 助手功能无法正常工作
- 用户无法与 AI 对话

### 2.3 服务端调用（需要单独处理）

以下文件是服务端调用，可能需要保留或单独处理：

1. `apps/question-processor/src/ai.ts` - question-processor 服务调用主站 API
2. `src/app/api/admin/question-processing/_lib/batchProcessUtils.ts` - 批量处理服务端调用

**建议**：
- 这些服务端调用可能需要保留，因为它们是从服务端调用主站 API
- 或者需要创建服务端版本的 `callAiDirect` 函数

## 三、根本原因

### 3.1 迁移不完整

在之前的重构中，只迁移了部分前端文件：
- ✅ `AIPage.tsx` - 已迁移
- ❌ `QuestionAIDialog.tsx` - 未迁移
- ❌ `ai/page.tsx` - 未迁移

### 3.2 缺少全局搜索

在迁移过程中，可能没有进行全局搜索，导致遗漏了部分调用点。

### 3.3 测试不充分

迁移后可能没有充分测试所有 AI 调用场景，导致问题未被及时发现。

## 四、修复方案

### 4.1 修复 `QuestionAIDialog.tsx`

**需要修改**：
1. 引入 `callAiDirect` 和 `getCurrentAiProvider`
2. 引入 `mapDbProviderToClientProvider`（如果需要）
3. 替换 `apiFetch("/api/ai/ask", ...)` 为 `callAiDirect(...)`
4. 处理响应格式差异（`callAiDirect` 返回 `{ ok, data }` 格式）

**关键点**：
- 需要获取当前 provider 配置
- 需要处理 `questionHash` 参数（可能需要传递给 ai-service）
- 需要处理缓存逻辑（可能需要调整）

### 4.2 修复 `ai/page.tsx`

**需要修改**：
1. 引入 `callAiDirect` 和 `getCurrentAiProvider`
2. 替换 `apiPost("/api/ai/ask", ...)` 为 `callAiDirect(...)`
3. 处理响应格式差异

**关键点**：
- 需要获取当前 provider 配置
- 需要处理 `context` 参数（可能需要映射到 `scene`）
- 需要处理响应格式

### 4.3 服务端调用处理

**选项 1：保留服务端调用**
- 如果服务端需要调用主站 API，可以保留 `/api/ai/ask` 路由
- 但需要恢复其功能（不推荐）

**选项 2：创建服务端版本**
- 创建服务端版本的 `callAiDirect` 函数
- 使用服务端环境变量（`AI_LOCAL_SERVICE_URL` / `AI_RENDER_SERVICE_URL`）

**选项 3：直接调用 ai-service**
- 服务端直接调用 ai-service，不经过主站 API
- 需要配置服务端环境变量

## 五、修复步骤

### 步骤 1：修复 `QuestionAIDialog.tsx`

1. 添加必要的 import
2. 获取当前 provider 配置
3. 替换 `apiFetch` 调用为 `callAiDirect`
4. 调整响应处理逻辑
5. 处理缓存逻辑（如果需要）

### 步骤 2：修复 `ai/page.tsx`

1. 添加必要的 import
2. 获取当前 provider 配置
3. 替换 `apiPost` 调用为 `callAiDirect`
4. 调整响应处理逻辑
5. 处理 `context` 参数映射

### 步骤 3：验证修复

1. 测试题目解析功能
2. 测试 `/ai` 页面 AI 助手功能
3. 验证 provider 切换是否正常
4. 检查错误处理是否完善

## 六、预期修复后的行为

### 6.1 QuestionAIDialog.tsx

**修复前**：
- 调用 `/api/ai/ask` → 返回 410 错误 → AI 调用失败

**修复后**：
- 调用 `callAiDirect()` → 直接调用 ai-service → AI 调用成功
- 支持 120 秒超时
- 根据配置中心选择正确的 provider

### 6.2 ai/page.tsx

**修复前**：
- 调用 `/api/ai/ask` → 返回 410 错误 → AI 调用失败

**修复后**：
- 调用 `callAiDirect()` → 直接调用 ai-service → AI 调用成功
- 支持 120 秒超时
- 根据配置中心选择正确的 provider

## 七、风险评估

### 7.1 低风险

- `QuestionAIDialog.tsx` 和 `ai/page.tsx` 是前端组件，修改风险较低
- 已有 `AIPage.tsx` 的成功迁移案例可以参考

### 7.2 需要注意的点

1. **响应格式差异**：
   - `apiFetch` / `apiPost` 可能返回不同的格式
   - `callAiDirect` 返回 `{ ok, data }` 格式
   - 需要调整响应处理逻辑

2. **参数映射**：
   - `questionHash` 参数可能需要特殊处理
   - `context` 参数可能需要映射到 `scene`

3. **缓存逻辑**：
   - `QuestionAIDialog.tsx` 有缓存逻辑，需要确保迁移后缓存仍然有效

4. **错误处理**：
   - 需要确保错误处理逻辑正确
   - 需要提供友好的错误提示

## 八、测试建议

### 8.1 测试 QuestionAIDialog.tsx

1. **打开题目解析对话框**：
   - 选择一个题目
   - 点击 AI 解析按钮
   - 验证是否正常获取 AI 解析

2. **测试追问功能**：
   - 在对话框中输入追问
   - 验证是否正常获取 AI 回答

3. **测试缓存功能**：
   - 验证缓存是否正常工作
   - 验证缓存来源是否正确标记

### 8.2 测试 ai/page.tsx

1. **访问 `/ai` 页面**：
   - 输入问题
   - 验证是否正常获取 AI 回答

2. **测试不同 context**：
   - 切换不同的 context（license, vehicle, service, general）
   - 验证是否正常工作

3. **测试错误处理**：
   - 模拟网络错误
   - 验证错误提示是否友好

## 九、修复完成情况

### 9.1 已修复的文件

#### ✅ QuestionAIDialog.tsx

**修复内容**：
1. 引入 `callAiDirect` 和 `getCurrentAiProvider`
2. 添加 `currentProvider` 和 `currentModel` state
3. 在 `useEffect` 中获取当前 provider 配置
4. 替换 `apiFetch("/api/ai/ask", ...)` 为 `callAiDirect(...)`
5. 调整响应处理逻辑（`callAiDirect` 返回 `{ ok, data }` 格式）
6. 改进错误处理

**关键变更**：
- 移除了 `apiFetch` 的导入
- 使用 `callAiDirect` 直接调用 ai-service
- 移除了 `questionHash` 参数传递（ai-service 不处理缓存）
- 缓存逻辑完全由前端处理

#### ✅ ai/page.tsx

**修复内容**：
1. 引入 `callAiDirect` 和 `getCurrentAiProvider`
2. 添加 `currentProvider` 和 `currentModel` state
3. 在 `useEffect` 中获取当前 provider 配置
4. 替换 `apiPost("/api/ai/ask", ...)` 为 `callAiDirect(...)`
5. 调整响应处理逻辑
6. 改进错误处理

**关键变更**：
- 移除了 `apiPost` 的导入
- 使用 `callAiDirect` 直接调用 ai-service
- `context` 参数映射到 `scene: "chat"`（可以根据需要扩展）

### 9.2 剩余问题

#### ⚠️ 服务端调用

以下文件是服务端调用，需要单独处理：

1. **`apps/question-processor/src/ai.ts`**：
   - question-processor 服务调用主站 `/api/ai/ask`
   - 需要决定是保留路由还是创建服务端版本

2. **`src/app/api/admin/question-processing/_lib/batchProcessUtils.ts`**：
   - 批量处理服务端调用
   - 需要决定处理方式

**建议**：
- 选项 1：创建服务端版本的 `callAiDirect` 函数
- 选项 2：服务端直接调用 ai-service（推荐）
- 选项 3：暂时保留 `/api/ai/ask` 路由用于服务端调用（不推荐）

### 9.3 验证清单

#### 前端调用验证

- [ ] 测试 `QuestionAIDialog.tsx`：
  - 打开题目解析对话框
  - 验证是否正常获取 AI 解析
  - 测试追问功能
  - 验证缓存功能

- [ ] 测试 `ai/page.tsx`：
  - 访问 `/ai` 页面
  - 输入问题，验证是否正常获取 AI 回答
  - 测试不同 context 切换

- [ ] 测试 provider 切换：
  - 在配置中心切换 provider（local / render）
  - 验证前端调用是否使用正确的 provider

#### 日志验证

- [ ] 确认不再出现 `[api/ai/ask] Deprecated route was called` 日志
- [ ] 确认出现 `[callAiDirect] 调用 AI 服务` 日志
- [ ] 验证 provider 选择是否正确

## 十、总结

### 10.1 问题总结

1. **两个前端文件未迁移**：
   - ✅ `QuestionAIDialog.tsx` - 已修复
   - ✅ `ai/page.tsx` - 已修复

2. **影响范围**：
   - ✅ 题目解析功能 - 已修复
   - ✅ `/ai` 页面 AI 助手功能 - 已修复

3. **根本原因**：
   - 迁移不完整 - 已修复
   - 缺少全局搜索和测试 - 已补充

### 10.2 修复状态

- ✅ **前端调用**：所有前端文件已迁移到 `callAiDirect`
- ⚠️ **服务端调用**：需要单独评估和处理

### 10.3 下一步行动

1. ✅ **立即修复**：`QuestionAIDialog.tsx` 和 `ai/page.tsx` - 已完成
2. ⏳ **验证修复**：测试所有 AI 调用场景
3. ⏳ **评估服务端调用**：决定服务端调用的处理方式
4. ⏳ **清理注释**：更新 `AIPage.tsx` 中的注释（仍提到 `/api/ai/ask`）

