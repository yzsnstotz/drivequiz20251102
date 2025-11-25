# AI Provider 多端点支持实施报告

**指令版本：0001**

## 一、实施概述

本次重构实现了 AI Provider 多端点支持，前端可以根据配置中心的选择，自动切换到对应的服务端点（local / render）。环境变量改为分别存储各 provider 的地址和 token，不再使用统一的入口。

## 二、已完成的任务

### ✅ 任务 1：前端 AI 客户端 - 按 provider 选择不同服务端点

**文件**: `src/lib/aiClient.front.ts`

**主要变更**：
1. 新增 `AiProviderKey` 类型：`"local" | "render"`
2. 新增 `resolveAiEndpoint()` 函数：根据 provider 解析对应的 URL 和 TOKEN
3. 修改 `callAiDirect()` 函数：必须接受 `provider` 参数，内部根据 provider 选择端点
4. 环境变量映射：
   - `local` → `NEXT_PUBLIC_LOCAL_AI_SERVICE_URL` / `NEXT_PUBLIC_LOCAL_AI_SERVICE_TOKEN`
   - `render` → `NEXT_PUBLIC_RENDER_AI_SERVICE_URL` / `NEXT_PUBLIC_RENDER_AI_SERVICE_TOKEN`

**关键代码**：
```typescript
function resolveAiEndpoint(provider: AiProviderKey): { url: string; token: string } {
  const endpoints = {
    local: {
      url: process.env.NEXT_PUBLIC_LOCAL_AI_SERVICE_URL,
      token: process.env.NEXT_PUBLIC_LOCAL_AI_SERVICE_TOKEN,
    },
    render: {
      url: process.env.NEXT_PUBLIC_RENDER_AI_SERVICE_URL,
      token: process.env.NEXT_PUBLIC_RENDER_AI_SERVICE_TOKEN,
    },
  } as const;
  // ... 验证和错误处理
}
```

### ✅ 任务 2：前端各页面 - 从配置中心获取 provider + model

**文件**: `src/lib/aiProviderConfig.front.ts`（新建）

**功能**：
- 新增 `getCurrentAiProvider()` 函数：从配置中心 API 获取当前配置的 provider 和 model
- 将数据库中的 provider 值（`local` / `openai` / `openrouter` 等）映射到前端使用的 provider（`local` / `render`）

**文件**: `src/components/AIPage.tsx`

**主要变更**：
1. 新增 state：`currentProvider` 和 `currentModel`
2. 在 `useEffect` 中调用 `getCurrentAiProvider()` 获取配置
3. 调用 `callAiDirect()` 时传入 `provider` 和 `model` 参数

**文件**: `src/app/admin/ai/scenes/page.tsx`

**主要变更**：
1. 在测试场景时，调用 `getCurrentAiProvider()` 获取当前配置
2. 使用新的 `callAiDirect()` 函数，传入 `provider` 和 `model`
3. 简化响应处理逻辑（不再需要手动解析 response）

### ✅ 任务 3：心跳接口 - 同时检测 local / render 两个服务

**文件**: `src/app/api/admin/ai/heartbeat/route.ts`

**主要变更**：
1. 重写心跳检查逻辑，同时检查 `local` 和 `render` 两个服务
2. 新增 `getServerEndpoint()` 函数：根据 provider 获取服务端环境变量
3. 新增 `checkProviderHealth()` 函数：检查单个 provider 的健康状态
4. 使用 `Promise.all()` 并行检查所有 provider
5. 环境变量映射：
   - `local` → `AI_LOCAL_SERVICE_URL` / `AI_LOCAL_SERVICE_TOKEN`
   - `render` → `AI_RENDER_SERVICE_URL` / `AI_RENDER_SERVICE_TOKEN`

**关键代码**：
```typescript
function getServerEndpoint(provider: HeartbeatProvider) {
  if (provider === "local") {
    return {
      url: process.env.AI_LOCAL_SERVICE_URL,
      token: process.env.AI_LOCAL_SERVICE_TOKEN,
    };
  }
  return {
    url: process.env.AI_RENDER_SERVICE_URL,
    token: process.env.AI_RENDER_SERVICE_TOKEN,
  };
}
```

### ✅ 任务 4：清理不再需要的直连逻辑

**已更新的文件**：
1. `src/lib/aiStatsClient.ts` - 更新为使用新的环境变量命名，支持按 provider 选择服务
2. `src/app/api/admin/ai/summary/rebuild/route.ts` - 更新为使用 `AI_RENDER_SERVICE_URL` / `AI_RENDER_SERVICE_TOKEN`

**保留的文件**（这些文件可能仍在使用，需要进一步确认）：
- `src/app/api/ai/ask/route.ts` - 已废弃，但保留用于向后兼容
- 文档文件中的旧说明（不影响功能）

## 三、环境变量配置变更

### 前端环境变量（浏览器可访问）

**旧配置**（已废弃）：
```
NEXT_PUBLIC_AI_SERVICE_URL=...
NEXT_PUBLIC_AI_SERVICE_TOKEN=...
```

**新配置**（必须配置）：
```
# Local AI Service
NEXT_PUBLIC_LOCAL_AI_SERVICE_URL=https://ai-service.zalem.app
NEXT_PUBLIC_LOCAL_AI_SERVICE_TOKEN=your_local_token

# Render AI Service
NEXT_PUBLIC_RENDER_AI_SERVICE_URL=https://zalem.onrender.com
NEXT_PUBLIC_RENDER_AI_SERVICE_TOKEN=your_render_token
```

### 服务端环境变量（Next.js Server）

**旧配置**（已废弃）：
```
AI_SERVICE_URL=...
AI_SERVICE_TOKEN=...
LOCAL_AI_SERVICE_URL=...
LOCAL_AI_SERVICE_TOKEN=...
```

**新配置**（必须配置）：
```
# Local AI Service
AI_LOCAL_SERVICE_URL=https://ai-service.zalem.app
AI_LOCAL_SERVICE_TOKEN=your_local_token

# Render AI Service
AI_RENDER_SERVICE_URL=https://zalem.onrender.com
AI_RENDER_SERVICE_TOKEN=your_render_token
```

## 四、代码变更清单

### 新建文件
1. `src/lib/aiProviderConfig.front.ts` - Provider 配置客户端

### 修改文件
1. `src/lib/aiClient.front.ts` - 支持多 provider 端点选择
2. `src/components/AIPage.tsx` - 使用新的 callAiDirect 签名
3. `src/app/admin/ai/scenes/page.tsx` - 使用新的 callAiDirect 签名
4. `src/app/api/admin/ai/heartbeat/route.ts` - 同时检查 local / render
5. `src/lib/aiStatsClient.ts` - 支持按 provider 选择服务
6. `src/app/api/admin/ai/summary/rebuild/route.ts` - 使用新的环境变量命名

## 五、测试检查清单

### 前端测试
- [ ] 配置中心选择 `local` 时，前端调用 local 服务
- [ ] 配置中心选择 `render` 时，前端调用 render 服务
- [ ] 场景测试页面可以正常测试
- [ ] AIPage 可以正常调用 AI 服务

### 心跳服务测试
- [ ] 心跳接口可以同时检测 local 和 render 两个服务
- [ ] 如果某个服务未配置，显示正确的错误信息
- [ ] 如果某个服务不可用，显示正确的状态

### 环境变量测试
- [ ] 前端环境变量正确配置后，可以正常调用
- [ ] 服务端环境变量正确配置后，心跳服务可以正常工作
- [ ] 缺少环境变量时，显示清晰的错误提示

## 六、向后兼容性

### 已废弃但保留
- `src/app/api/ai/ask/route.ts` - 返回 410 Gone 错误，提示使用新的调用方式

### 需要迁移
- 所有前端调用必须更新为使用新的 `callAiDirect()` 签名（必须传入 `provider` 参数）
- 所有环境变量必须更新为新的命名

## 七、已知问题

1. **配置中心页面提示**：`src/app/admin/ai/config/page.tsx` 中的提示文本仍使用旧的命名，但不影响功能
2. **文档更新**：部分文档文件仍包含旧的说明，需要后续更新

## 八、下一步行动

1. ✅ **立即配置环境变量**：在 Vercel 中配置所有新的环境变量
2. ✅ **测试前端调用**：验证前端可以正常调用 local 和 render 服务
3. ✅ **测试心跳服务**：验证心跳接口可以同时检测两个服务
4. ⏳ **更新文档**：更新相关文档，移除旧的说明
5. ⏳ **清理旧代码**：确认 `src/app/api/ai/ask/route.ts` 可以完全删除

## 九、总结

本次重构成功实现了 AI Provider 多端点支持，前端可以根据配置中心的选择自动切换到对应的服务端点。所有代码已通过 linter 检查，可以开始测试。

**关键改进**：
- ✅ 前端支持多 provider 端点选择
- ✅ 心跳服务同时检测 local / render
- ✅ 环境变量改为分别存储各 provider 的配置
- ✅ 代码结构更清晰，易于维护

