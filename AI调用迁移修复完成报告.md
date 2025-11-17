# AI 调用迁移修复完成报告

**修复日期：2025-11-17**  
**指令版本：0002**

## 一、问题诊断

### 1.1 问题现象

从日志中观察到：
```
[api/ai/ask] Deprecated route was called. It should no longer be used.
POST /api/ai/ask 410 in 87ms
```

**问题**：前端代码仍在调用废弃的 `/api/ai/ask` 路由，导致返回 410 错误，AI 调用无法正常工作。

### 1.2 根本原因

在之前的重构中，只迁移了部分前端文件：
- ✅ `AIPage.tsx` - 已迁移
- ❌ `QuestionAIDialog.tsx` - **未迁移**
- ❌ `ai/page.tsx` - **未迁移**

## 二、修复内容

### 2.1 修复 `QuestionAIDialog.tsx`

**文件位置**：`src/components/QuestionAIDialog.tsx`

**主要变更**：

1. **引入新的依赖**：
   ```typescript
   import { callAiDirect } from "@/lib/aiClient.front";
   import { getCurrentAiProvider } from "@/lib/aiProviderConfig.front";
   ```

2. **移除旧的依赖**：
   ```typescript
   // 移除了：import { apiFetch } from "@/lib/apiClient.front";
   ```

3. **添加 state**：
   ```typescript
   const [currentProvider, setCurrentProvider] = useState<"local" | "render">("render");
   const [currentModel, setCurrentModel] = useState<string | undefined>(undefined);
   ```

4. **获取 provider 配置**：
   ```typescript
   useEffect(() => {
     if (isOpen) {
       getCurrentAiProvider()
         .then((config) => {
           setCurrentProvider(config.provider);
           setCurrentModel(config.model);
         })
         .catch((err) => {
           console.warn("[QuestionAIDialog] 获取 provider 配置失败，使用默认值:", err);
           setCurrentProvider("render");
         });
     }
   }, [isOpen]);
   ```

5. **替换 API 调用**：
   ```typescript
   // 修改前
   const result = await apiFetch("/api/ai/ask", {
     method: "POST",
     body: { question, locale, questionHash, scene },
   });

   // 修改后
   const payload = await callAiDirect({
     provider: currentProvider,
     question: questionText,
     locale: language,
     scene: "question_explanation",
     model: currentModel,
   });
   ```

6. **调整响应处理**：
   - `apiFetch` 返回 `{ ok, data }` 格式
   - `callAiDirect` 也返回 `{ ok, data }` 格式
   - 响应处理逻辑基本一致，但需要调整字段访问

7. **改进错误处理**：
   - 使用 `payload.message` 显示错误信息
   - 提供更友好的错误提示

**关键点**：
- 移除了 `questionHash` 参数传递（ai-service 不处理缓存，缓存逻辑完全由前端处理）
- 保留了缓存检查逻辑（内存缓存和 localStorage 缓存）

### 2.2 修复 `ai/page.tsx`

**文件位置**：`src/app/ai/page.tsx`

**主要变更**：

1. **引入新的依赖**：
   ```typescript
   import { callAiDirect } from "@/lib/aiClient.front";
   import { getCurrentAiProvider } from "@/lib/aiProviderConfig.front";
   ```

2. **移除旧的依赖**：
   ```typescript
   // 移除了：import { apiPost } from "@/lib/apiClient.front";
   ```

3. **添加 state**：
   ```typescript
   const [currentProvider, setCurrentProvider] = useState<"local" | "render">("render");
   const [currentModel, setCurrentModel] = useState<string | undefined>(undefined);
   ```

4. **获取 provider 配置**：
   ```typescript
   useEffect(() => {
     getCurrentAiProvider()
       .then((config) => {
         setCurrentProvider(config.provider);
         setCurrentModel(config.model);
       })
       .catch((err) => {
         console.warn("[AIPage] 获取 provider 配置失败，使用默认值:", err);
         setCurrentProvider("render");
       });
   }, []);
   ```

5. **替换 API 调用**：
   ```typescript
   // 修改前
   const response = await apiPost("/api/ai/ask", {
     question: userMessage.content,
     context: context,
     locale: "zh",
   });

   // 修改后
   const payload = await callAiDirect({
     provider: currentProvider,
     question: userMessage.content,
     locale: "zh",
     scene: "chat", // context 映射到 scene
     model: currentModel,
   });
   ```

6. **调整响应处理**：
   - 使用 `payload.data?.answer` 获取回答
   - 使用 `payload.data?.sources` 获取来源

7. **改进错误处理**：
   - 检查 `payload.ok` 状态
   - 使用 `payload.message` 显示错误信息

**关键点**：
- `context` 参数映射到 `scene: "chat"`（可以根据需要扩展为不同的 scene）
- 保留了 `context` 在消息中的存储（用于 UI 显示）

### 2.3 清理注释

**文件**：`src/components/AIPage.tsx`

**变更**：
- 更新注释，将 `/api/ai/ask` 改为 `callAiDirect`

## 三、修复验证

### 3.1 代码检查

- ✅ 所有文件已通过 linter 检查
- ✅ 所有 `callAiDirect` 调用都传入 `provider` 参数
- ✅ 所有调用都使用 `getCurrentAiProvider()` 获取配置

### 3.2 调用点验证

**前端调用点**：
1. ✅ `src/components/AIPage.tsx` - 使用 `callAiDirect`
2. ✅ `src/components/QuestionAIDialog.tsx` - 使用 `callAiDirect`
3. ✅ `src/app/ai/page.tsx` - 使用 `callAiDirect`
4. ✅ `src/app/admin/ai/scenes/page.tsx` - 使用 `callAiDirect`

**服务端调用点**（需要单独处理）：
1. ⚠️ `apps/question-processor/src/ai.ts` - 仍调用 `/api/ai/ask`
2. ⚠️ `src/app/api/admin/question-processing/_lib/batchProcessUtils.ts` - 可能仍调用 `/api/ai/ask`

## 四、预期修复后的行为

### 4.1 QuestionAIDialog.tsx

**修复前**：
- 调用 `/api/ai/ask` → 返回 410 错误 → AI 调用失败

**修复后**：
- 调用 `callAiDirect()` → 直接调用 ai-service → AI 调用成功
- 支持 120 秒超时
- 根据配置中心选择正确的 provider
- 缓存逻辑正常工作

### 4.2 ai/page.tsx

**修复前**：
- 调用 `/api/ai/ask` → 返回 410 错误 → AI 调用失败

**修复后**：
- 调用 `callAiDirect()` → 直接调用 ai-service → AI 调用成功
- 支持 120 秒超时
- 根据配置中心选择正确的 provider

### 4.3 日志变化

**修复前**：
```
[api/ai/ask] Deprecated route was called. It should no longer be used.
POST /api/ai/ask 410 in 87ms
```

**修复后**（预期）：
```
[callAiDirect] 调用 AI 服务: { provider: 'render', url: 'https://...', scene: 'question_explanation' }
```

## 五、测试建议

### 5.1 测试 QuestionAIDialog.tsx

1. **打开题目解析对话框**：
   - 选择一个题目
   - 点击 AI 解析按钮
   - 验证是否正常获取 AI 解析
   - 检查浏览器控制台，确认不再出现 410 错误

2. **测试追问功能**：
   - 在对话框中输入追问
   - 验证是否正常获取 AI 回答
   - 验证对话历史是否正确

3. **测试缓存功能**：
   - 验证缓存是否正常工作
   - 验证缓存来源是否正确标记

4. **测试 provider 切换**：
   - 在配置中心切换 provider（local / render）
   - 验证题目解析是否使用正确的 provider

### 5.2 测试 ai/page.tsx

1. **访问 `/ai` 页面**：
   - 输入问题
   - 验证是否正常获取 AI 回答
   - 检查浏览器控制台，确认不再出现 410 错误

2. **测试不同 context**：
   - 切换不同的 context（license, vehicle, service, general）
   - 验证是否正常工作

3. **测试 provider 切换**：
   - 在配置中心切换 provider（local / render）
   - 验证 AI 助手是否使用正确的 provider

### 5.3 验证日志

1. **确认不再出现**：
   - `[api/ai/ask] Deprecated route was called` 日志

2. **确认出现**：
   - `[callAiDirect] 调用 AI 服务` 日志
   - `[QuestionAIDialog] 使用 provider` 日志（如果添加了）

3. **验证 provider 选择**：
   - 日志中显示的 provider 应该与配置中心一致

## 六、已知限制

### 6.1 缓存逻辑变化

**变更**：
- `questionHash` 不再传递给 ai-service
- 缓存逻辑完全由前端处理

**影响**：
- ai-service 可能不再返回 `cached` 字段
- 前端需要自己判断是否使用缓存

**建议**：
- 如果 ai-service 支持缓存，可以添加 `questionHash` 参数支持
- 或者前端完全处理缓存逻辑（当前方案）

### 6.2 context 参数处理

**变更**：
- `context` 参数映射到 `scene: "chat"`

**影响**：
- 所有 context 都使用相同的 scene
- 如果需要不同的 scene，需要扩展映射逻辑

**建议**：
- 如果需要，可以创建 context → scene 的映射表
- 例如：`{ license: "license_chat", vehicle: "vehicle_chat", ... }`

### 6.3 服务端调用

**问题**：
- question-processor 和批量处理仍可能调用 `/api/ai/ask`

**建议**：
- 选项 1：创建服务端版本的 `callAiDirect` 函数
- 选项 2：服务端直接调用 ai-service（推荐）
- 选项 3：暂时保留 `/api/ai/ask` 路由用于服务端调用（不推荐）

## 七、后续优化建议

### 7.1 添加日志

**建议**：
- 在 `QuestionAIDialog.tsx` 中添加 provider 选择日志
- 在 `ai/page.tsx` 中添加 provider 选择日志

### 7.2 错误处理优化

**建议**：
- 提供更详细的错误信息
- 区分不同类型的错误（网络错误、认证错误、服务错误等）

### 7.3 性能优化

**建议**：
- 可以考虑缓存 provider 配置，减少 API 调用
- 可以考虑预加载 provider 配置

## 八、总结

### 8.1 修复完成情况

- ✅ **QuestionAIDialog.tsx** - 已修复，使用 `callAiDirect`
- ✅ **ai/page.tsx** - 已修复，使用 `callAiDirect`
- ✅ **所有前端调用** - 已迁移到 `callAiDirect`
- ⚠️ **服务端调用** - 需要单独评估和处理

### 8.2 关键改进

1. **统一调用方式**：
   - 所有前端调用都使用 `callAiDirect`
   - 支持多 provider 端点选择

2. **配置驱动**：
   - 根据配置中心选择 provider
   - 支持动态切换 provider

3. **错误处理**：
   - 更友好的错误信息
   - 更详细的日志输出

### 8.3 验证状态

- ✅ 代码已通过 linter 检查
- ⏳ 需要实际测试验证功能
- ⏳ 需要验证 provider 切换是否正常

### 8.4 下一步行动

1. ✅ **修复代码** - 已完成
2. ⏳ **测试验证** - 需要实际测试
3. ⏳ **处理服务端调用** - 需要单独评估
4. ⏳ **监控日志** - 确认不再出现 410 错误

所有前端调用已迁移完成，可以开始测试。

