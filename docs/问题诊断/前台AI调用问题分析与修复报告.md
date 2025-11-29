# 前台 AI 调用问题分析与修复报告

**分析日期：2025-11-17**  
**指令版本：0003**

## 一、问题诊断

### 1.1 用户报告的问题

1. **前台用户端进行学题 AI ask 时**：
   - 报错 `failed to fetch`
   - log 根本没有启动调用
   - 是否把后端 admin ai 放到前台使用了？

### 1.2 根本原因分析

#### 问题 1：前台调用了需要管理员认证的接口

**发现**：
- `getCurrentAiProvider()` 函数调用了 `/api/admin/ai/config`
- 该接口使用 `withAdminAuth` 中间件，需要管理员认证
- 前台用户端没有管理员 token，导致调用失败

**代码位置**：
```typescript
// src/lib/aiProviderConfig.front.ts (修复前)
const res = await fetch(`${base}/api/admin/ai/config`, {
  cache: "no-store",
  headers: token ? { Authorization: `Bearer ${token}` } : {},
});
```

**影响**：
- 虽然函数有错误处理，会返回默认值，但：
  1. 每次调用都会失败，产生不必要的错误日志
  2. 可能在某些情况下抛出未捕获的错误
  3. 违反了前后台分离的原则

#### 问题 2：网络错误处理不完善

**发现**：
- `callAiDirect` 函数没有捕获 `fetch` 的网络错误（如 CORS、连接失败等）
- 如果环境变量未配置或 URL 格式错误，会直接抛出异常

**影响**：
- 网络错误（如 CORS、连接失败）会导致未捕获的异常
- 错误信息不够友好，用户看到的是 "failed to fetch"

#### 问题 3：Provider 初始化时机问题

**发现**：
- `QuestionAIDialog` 在 `useEffect` 中异步获取 provider 配置
- 如果用户在配置获取完成前就发送消息，`currentProvider` 可能还是默认值 `"render"`
- 如果配置获取失败，可能使用错误的 provider

## 二、修复方案

### 2.1 创建公开的配置接口

**新建文件**：`src/app/api/ai/config/route.ts`

**功能**：
- 公开接口，不需要管理员认证
- 只返回 `provider` 和 `model`（不返回敏感信息）
- 供前台用户端使用

**关键代码**：
```typescript
export async function GET(_req: NextRequest): Promise<NextResponse> {
  // 从数据库读取 aiProvider 和 model 配置
  // 映射 provider 到前端使用的格式
  // 返回 { ok: true, data: { provider, model } }
}
```

### 2.2 修复 getCurrentAiProvider

**文件**：`src/lib/aiProviderConfig.front.ts`

**主要变更**：
1. 改为调用公开接口 `/api/ai/config`（不需要管理员认证）
2. 移除管理员 token 相关逻辑
3. 简化响应处理（公开接口已返回映射后的 provider）

**修改前**：
```typescript
const res = await fetch(`${base}/api/admin/ai/config`, {
  headers: token ? { Authorization: `Bearer ${token}` } : {},
});
```

**修改后**：
```typescript
// 前台用户端使用公开接口（不需要管理员认证）
const res = await fetch(`${base}/api/ai/config`, {
  cache: "no-store",
});
```

### 2.3 改进 callAiDirect 错误处理

**文件**：`src/lib/aiClient.front.ts`

**主要变更**：
1. 添加 `fetch` 网络错误的捕获
2. 提供更友好的错误信息
3. 区分不同类型的错误（网络错误、HTTP 错误等）

**关键代码**：
```typescript
let response: Response;
try {
  response = await fetch(requestUrl, { ... });
} catch (fetchError: any) {
  // 网络错误（如 CORS、连接失败等）
  return {
    ok: false,
    errorCode: "NETWORK_ERROR",
    message: `网络请求失败: ${errorMessage}。请检查：1) AI 服务是否正常运行；2) 环境变量是否正确配置；3) CORS 设置是否正确。`,
  };
}
```

### 2.4 改进 QuestionAIDialog 错误处理

**文件**：`src/components/QuestionAIDialog.tsx`

**主要变更**：
1. 添加调用前的日志输出
2. 确保 provider 已初始化（使用默认值兜底）
3. 改进错误信息显示

**关键代码**：
```typescript
// 确保 provider 已初始化（如果还未获取到配置，使用默认值）
const providerToUse = currentProvider || "render";

console.log("[QuestionAIDialog] 调用 AI 服务:", {
  provider: providerToUse,
  model: currentModel,
  scene: "question_explanation",
  questionLength: questionText.length,
  isFollowUp: isFollowUpQuestion,
});
```

## 三、前后台分离验证

### 3.1 前台调用点（应使用 callAiDirect）

✅ **已验证**：
1. `src/components/QuestionAIDialog.tsx` - 使用 `callAiDirect`
2. `src/components/AIPage.tsx` - 使用 `callAiDirect`
3. `src/app/ai/page.tsx` - 使用 `callAiDirect`
4. `src/app/admin/ai/scenes/page.tsx` - 使用 `callAiDirect`（管理后台页面，但使用前端调用方式）

### 3.2 后台调用点（应使用 callAiServer）

✅ **已验证**：
1. `src/app/api/admin/question-processing/_lib/batchProcessUtils.ts` - 使用 `callAiServer`
2. `apps/question-processor/src/ai.ts` - 使用 `callAiServer`

### 3.3 配置接口分离

✅ **已验证**：
1. **前台用户端**：`/api/ai/config` - 公开接口，不需要认证
2. **后台管理端**：`/api/admin/ai/config` - 需要管理员认证

## 四、修复完成情况

### ✅ 已修复的问题

1. **创建公开配置接口**：
   - ✅ 新建 `src/app/api/ai/config/route.ts`
   - ✅ 不需要管理员认证
   - ✅ 只返回必要的配置信息

2. **修复 getCurrentAiProvider**：
   - ✅ 改为调用公开接口 `/api/ai/config`
   - ✅ 移除管理员 token 相关逻辑
   - ✅ 简化响应处理

3. **改进 callAiDirect 错误处理**：
   - ✅ 添加网络错误捕获
   - ✅ 提供更友好的错误信息
   - ✅ 区分不同类型的错误

4. **改进 QuestionAIDialog**：
   - ✅ 添加调用前的日志输出
   - ✅ 确保 provider 已初始化
   - ✅ 改进错误信息显示

## 五、架构验证

### 5.1 前台架构（浏览器 → ai-service）

```
前台用户端
  ↓
getCurrentAiProvider() → /api/ai/config (公开接口)
  ↓
callAiDirect() → ai-service (直接调用)
  ↓
NEXT_PUBLIC_LOCAL_AI_SERVICE_URL / NEXT_PUBLIC_RENDER_AI_SERVICE_URL
```

### 5.2 后台架构（Next.js → ai-service）

```
后台服务端
  ↓
getCurrentAiProviderConfig() → 数据库读取
  ↓
callAiServer() → ai-service (直接调用)
  ↓
AI_LOCAL_SERVICE_URL / AI_RENDER_SERVICE_URL
```

### 5.3 前后台完全分离

✅ **前台**：
- 使用 `callAiDirect`（前端函数）
- 使用 `NEXT_PUBLIC_*` 环境变量
- 使用 `/api/ai/config`（公开接口）

✅ **后台**：
- 使用 `callAiServer`（服务端函数）
- 使用 `AI_*` 环境变量（不带 `NEXT_PUBLIC_`）
- 从数据库直接读取配置

## 六、测试建议

### 6.1 测试前台用户端

1. **测试配置获取**：
   - 打开浏览器控制台
   - 访问前台页面（如学题页面）
   - 验证是否成功调用 `/api/ai/config`
   - 验证是否不再出现 401/403 错误

2. **测试 AI 调用**：
   - 打开题目解析对话框
   - 点击 AI 解析按钮
   - 验证是否出现 `[QuestionAIDialog] 调用 AI 服务` 日志
   - 验证是否出现 `[callAiDirect] 调用 AI 服务` 日志
   - 验证是否不再出现 "failed to fetch" 错误

3. **测试错误处理**：
   - 如果环境变量未配置，验证错误信息是否友好
   - 如果 AI 服务不可用，验证错误信息是否清晰

### 6.2 测试环境变量

**前台环境变量**（必需）：
- `NEXT_PUBLIC_LOCAL_AI_SERVICE_URL`
- `NEXT_PUBLIC_LOCAL_AI_SERVICE_TOKEN`
- `NEXT_PUBLIC_RENDER_AI_SERVICE_URL`
- `NEXT_PUBLIC_RENDER_AI_SERVICE_TOKEN`

**后台环境变量**（必需）：
- `AI_LOCAL_SERVICE_URL`
- `AI_LOCAL_SERVICE_TOKEN`
- `AI_RENDER_SERVICE_URL`
- `AI_RENDER_SERVICE_TOKEN`

### 6.3 验证日志

**前台调用日志**（预期）：
```
[QuestionAIDialog] 调用 AI 服务: { provider: 'render', model: 'gpt-4o-mini', ... }
[callAiDirect] 调用 AI 服务: { provider: 'render', url: 'https://...', ... }
```

**不应出现的日志**：
- `[getCurrentAiProvider] 配置读取失败`（如果环境变量正确配置）
- `[callAiDirect] 网络请求失败`（如果 AI 服务正常运行）

## 七、已知限制

### 7.1 配置接口缓存

**当前实现**：
- 每次调用都从数据库读取配置
- 没有缓存机制

**未来优化**：
- 可以添加配置缓存（如 5 分钟）
- 减少数据库查询

### 7.2 错误信息国际化

**当前实现**：
- 错误信息使用中文
- 没有国际化支持

**未来优化**：
- 可以根据用户语言返回对应的错误信息

## 八、总结

### 8.1 修复完成情况

- ✅ **创建公开配置接口** - 已完成
- ✅ **修复 getCurrentAiProvider** - 已完成
- ✅ **改进 callAiDirect 错误处理** - 已完成
- ✅ **改进 QuestionAIDialog** - 已完成
- ✅ **前后台分离验证** - 已完成

### 8.2 关键改进

1. **前后台完全分离**：
   - 前台使用公开接口 `/api/ai/config`
   - 后台使用管理员接口 `/api/admin/ai/config`
   - 前台使用 `callAiDirect`，后台使用 `callAiServer`

2. **错误处理改进**：
   - 网络错误有明确的错误码和错误信息
   - 错误信息更友好，包含排查建议

3. **日志改进**：
   - 添加调用前的日志输出
   - 便于排查问题

### 8.3 验证状态

- ✅ 代码已通过 linter 检查
- ✅ 前后台调用已完全分离
- ⏳ 需要实际测试验证功能

### 8.4 下一步行动

1. ✅ **修复代码** - 已完成
2. ⏳ **测试验证** - 需要实际测试
3. ⏳ **检查环境变量** - 确认所有环境变量已正确配置
4. ⏳ **监控日志** - 确认不再出现认证错误和网络错误

所有修复已完成，可以开始测试。

