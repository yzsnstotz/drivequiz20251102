# AI 重构后问题分析报告

## 一、问题概述

在完成 AI 调用逻辑从 Next.js 迁移到前端直接调用 ai-service 的重构后，测试时发现两个关键问题：

1. **Render 服务心跳检测失败**：重构前可以正常检测，重构后无法检测到 Render 服务状态
2. **AI 配置中心测试调用失败**：无论是调用 Render 还是本地 AI，前端都直接报错，没有看到实际调用

## 二、问题详细分析

### 2.1 问题 1：Render 服务心跳检测失败

#### 2.1.1 问题现象
- 重构前：心跳服务可以正常检测到 Render AI Service 的状态
- 重构后：心跳服务无法检测到 Render 服务，显示为 "down" 状态

#### 2.1.2 代码位置
**文件**: `src/app/api/admin/ai/heartbeat/route.ts`

**关键代码**:
```typescript
// 检查线上 AI 服务
const onlineUrl = process.env.AI_SERVICE_URL;  // ⚠️ 使用服务端环境变量
if (onlineUrl) {
  // ...
  const healthUrl = `${baseUrl}/healthz`;
  const res = await fetch(healthUrl, {
    method: "GET",
    headers: process.env.AI_SERVICE_TOKEN
      ? { Authorization: `Bearer ${process.env.AI_SERVICE_TOKEN}` }
      : {},
    // ...
  });
}
```

#### 2.1.3 可能原因分析

**原因 A：环境变量未配置或配置错误**
- 心跳服务使用服务端环境变量：`AI_SERVICE_URL` 和 `AI_SERVICE_TOKEN`
- 如果这些环境变量在 Vercel/Next.js 环境中未正确配置，会导致检测失败
- **检查点**：
  - Vercel 环境变量中是否有 `AI_SERVICE_URL`？
  - Vercel 环境变量中是否有 `AI_SERVICE_TOKEN`？
  - 这些变量的值是否正确？

**原因 B：URL 格式处理问题**
- 代码中有 URL 处理逻辑：
  ```typescript
  let baseUrl = onlineUrl.replace(/\/+$/, "");
  if (baseUrl.endsWith("/v1")) {
    baseUrl = baseUrl.slice(0, -3);
  }
  const healthUrl = `${baseUrl}/healthz`;
  ```
- 如果 `AI_SERVICE_URL` 的格式不正确（例如包含 `/v1/ask` 等路径），可能导致健康检查 URL 错误
- **检查点**：
  - `AI_SERVICE_URL` 应该是基础 URL（如 `https://zalem.onrender.com`），不应包含 `/v1` 或 `/v1/ask`

**原因 C：CORS 或网络问题**
- 虽然健康检查是服务端到服务端的调用，但如果 Render 服务有网络限制，可能导致连接失败
- **检查点**：
  - Render 服务的 `/healthz` 端点是否可访问？
  - 是否有防火墙或网络限制？

**原因 D：认证问题**
- 健康检查端点可能需要认证，如果 `AI_SERVICE_TOKEN` 不正确，可能返回 401/403
- **检查点**：
  - `AI_SERVICE_TOKEN` 是否正确？
  - Render 服务的 `/healthz` 端点是否需要认证？

#### 2.1.4 诊断步骤

1. **检查环境变量**：
   ```bash
   # 在 Vercel 控制台检查环境变量
   # 或通过 Next.js API 路由输出（临时调试）
   console.log("AI_SERVICE_URL:", process.env.AI_SERVICE_URL);
   console.log("AI_SERVICE_TOKEN:", process.env.AI_SERVICE_TOKEN ? "***" : "未配置");
   ```

2. **检查健康检查端点**：
   ```bash
   # 直接测试 Render 服务的健康检查端点
   curl https://your-render-service.onrender.com/healthz
   # 或带认证
   curl -H "Authorization: Bearer YOUR_TOKEN" https://your-render-service.onrender.com/healthz
   ```

3. **检查心跳服务日志**：
   - 查看 Next.js 服务端日志，确认心跳检查时的错误信息
   - 检查 `lastError` 字段的具体错误内容

### 2.2 问题 2：AI 配置中心测试调用失败

#### 2.2.1 问题现象
- 在 AI 配置中心页面，无论是选择 Render 还是本地 AI，测试调用都直接报错
- 前端没有看到实际的 AI 调用，直接显示错误

**注意**：经过代码检查，发现：
- `src/app/admin/ai/config/page.tsx` - AI 配置中心页面**没有测试功能**，只有配置保存功能
- `src/app/admin/ai/scenes/page.tsx` - 场景测试页面**有测试功能**，已修改为直接调用 ai-service
- 用户可能是在场景测试页面进行测试，或者期望在配置中心也有测试功能

#### 2.2.2 代码位置

**前端调用代码**:
- `src/lib/aiClient.front.ts` - 前端 AI 客户端
- `src/app/admin/ai/scenes/page.tsx` - 场景测试页面（已修改为直接调用）

**关键代码**:
```typescript
// src/lib/aiClient.front.ts
export async function callAiDirect(params: AiClientRequest): Promise<AiClientResponse> {
  const aiServiceUrl = process.env.NEXT_PUBLIC_AI_SERVICE_URL;  // ⚠️ 前端环境变量
  const aiServiceToken = process.env.NEXT_PUBLIC_AI_SERVICE_TOKEN;  // ⚠️ 前端环境变量

  if (!aiServiceUrl) {
    throw new Error("NEXT_PUBLIC_AI_SERVICE_URL is not configured");
  }

  if (!aiServiceToken) {
    throw new Error("NEXT_PUBLIC_AI_SERVICE_TOKEN is not configured");
  }

  const response = await fetch(`${aiServiceUrl}/v1/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${aiServiceToken}`,
    },
    body: JSON.stringify({...}),
  });
}
```

#### 2.2.3 可能原因分析

**原因 A：前端环境变量未配置**
- 前端代码使用 `NEXT_PUBLIC_AI_SERVICE_URL` 和 `NEXT_PUBLIC_AI_SERVICE_TOKEN`
- 这些变量必须以 `NEXT_PUBLIC_` 开头才能在浏览器中访问
- 如果未配置，会直接抛出错误：`"NEXT_PUBLIC_AI_SERVICE_URL is not configured"`
- **检查点**：
  - Vercel 环境变量中是否有 `NEXT_PUBLIC_AI_SERVICE_URL`？
  - Vercel 环境变量中是否有 `NEXT_PUBLIC_AI_SERVICE_TOKEN`？
  - 这些变量的值是否正确？

**原因 B：CORS 配置问题**
- 虽然已经修改了 ai-service 的 CORS 配置，但可能存在问题
- **检查点**：
  - ai-service 的 CORS 配置是否正确？
  - 浏览器控制台是否有 CORS 错误？

**原因 C：页面功能确认**
- `src/app/admin/ai/config/page.tsx` - **没有测试功能**，只有配置保存
- `src/app/admin/ai/scenes/page.tsx` - **有测试功能**，已修改为直接调用 ai-service（第309-329行）
- **检查点**：
  - 用户是在哪个页面进行测试？
  - 如果是场景测试页面，检查环境变量配置
  - 如果是配置中心页面，需要确认是否有测试功能需求

**原因 D：认证失败**
- ai-service 需要正确的认证 token
- 如果 `NEXT_PUBLIC_AI_SERVICE_TOKEN` 不正确，会返回 401/403 错误
- **检查点**：
  - `NEXT_PUBLIC_AI_SERVICE_TOKEN` 是否正确？
  - ai-service 是否接受该 token？

**原因 E：URL 格式错误**
- `NEXT_PUBLIC_AI_SERVICE_URL` 应该是完整的 URL（如 `https://zalem.onrender.com`）
- 如果格式不正确，会导致 fetch 失败
- **检查点**：
  - URL 格式是否正确？
  - 是否包含协议（`https://`）？

#### 2.2.4 诊断步骤

1. **检查前端环境变量**：
   ```javascript
   // 在浏览器控制台检查
   console.log("NEXT_PUBLIC_AI_SERVICE_URL:", process.env.NEXT_PUBLIC_AI_SERVICE_URL);
   console.log("NEXT_PUBLIC_AI_SERVICE_TOKEN:", process.env.NEXT_PUBLIC_AI_SERVICE_TOKEN ? "***" : "未配置");
   ```

2. **检查浏览器控制台错误**：
   - 打开浏览器开发者工具
   - 查看 Console 标签页的错误信息
   - 查看 Network 标签页的请求详情
   - 确认具体的错误类型（CORS、401、404 等）

3. **检查 ai-service 日志**：
   - 查看 ai-service 的日志，确认是否收到请求
   - 如果没有收到请求，说明是前端问题（环境变量或 CORS）
   - 如果收到请求但返回错误，说明是认证或业务逻辑问题

4. **直接测试 ai-service**：
   ```bash
   # 使用 curl 直接测试
   curl -X POST https://your-ai-service.onrender.com/v1/ask \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -d '{"question":"测试","lang":"zh"}'
   ```

## 三、环境变量配置检查清单

### 3.1 服务端环境变量（Next.js Server）
这些变量用于心跳服务等服务端功能：

- [ ] `AI_SERVICE_URL` - Render AI Service 的基础 URL（如 `https://zalem.onrender.com`）
- [ ] `AI_SERVICE_TOKEN` - Render AI Service 的认证 token
- [ ] `LOCAL_AI_SERVICE_URL` - 本地 AI Service 的 URL（如 `https://ai-service.zalem.app`）
- [ ] `LOCAL_AI_SERVICE_TOKEN` - 本地 AI Service 的认证 token

### 3.2 前端环境变量（Browser）
这些变量必须以 `NEXT_PUBLIC_` 开头，才能在浏览器中访问：

- [ ] `NEXT_PUBLIC_AI_SERVICE_URL` - AI Service 的基础 URL（用于前端直接调用）
- [ ] `NEXT_PUBLIC_AI_SERVICE_TOKEN` - AI Service 的认证 token（用于前端直接调用）

### 3.3 环境变量配置建议

**重要**：前端和后端可能需要不同的 URL：
- **服务端**：可能使用内网 URL 或不同的认证方式
- **前端**：必须使用公网可访问的 URL（因为浏览器直接调用）

**示例配置**：
```env
# 服务端环境变量
AI_SERVICE_URL=https://zalem.onrender.com
AI_SERVICE_TOKEN=your_render_token

# 前端环境变量（必须 NEXT_PUBLIC_ 开头）
NEXT_PUBLIC_AI_SERVICE_URL=https://zalem.onrender.com
NEXT_PUBLIC_AI_SERVICE_TOKEN=your_render_token
```

## 四、代码变更影响分析

### 4.1 重构前的调用流程

```
前端 → /api/ai/ask (Next.js) → callAiServiceCore → AI Service (Render/本地)
```

**特点**：
- 所有调用都经过 Next.js 服务端
- 使用服务端环境变量（`AI_SERVICE_URL`、`AI_SERVICE_TOKEN`）
- 心跳服务可以直接检测，因为都在服务端

### 4.2 重构后的调用流程

```
前端 → callAiDirect() → AI Service (Render/本地) [直接调用，绕过 Next.js]
```

**特点**：
- 前端直接调用 ai-service，绕过 Next.js
- 使用前端环境变量（`NEXT_PUBLIC_AI_SERVICE_URL`、`NEXT_PUBLIC_AI_SERVICE_TOKEN`）
- 心跳服务仍然在服务端，使用服务端环境变量

### 4.3 潜在问题

1. **环境变量不一致**：
   - 前端使用 `NEXT_PUBLIC_AI_SERVICE_URL`
   - 心跳服务使用 `AI_SERVICE_URL`
   - 如果只配置了其中一个，会导致不一致的行为

2. **认证 token 可能不同**：
   - 前端可能需要不同的 token（如果 ai-service 有前端/后端 token 区分）
   - 需要确认 ai-service 是否支持前端直接调用

3. **CORS 配置**：
   - ai-service 必须正确配置 CORS，允许浏览器跨域访问
   - 已修改为 `origin: true`，但需要确认是否生效

## 五、修复建议

### 5.1 修复心跳服务检测问题

**方案 1：统一环境变量命名**
- 确保 `AI_SERVICE_URL` 和 `NEXT_PUBLIC_AI_SERVICE_URL` 都配置
- 或者修改心跳服务，同时检查两个环境变量

**方案 2：添加调试日志**
- 在心跳服务中添加详细的日志输出
- 记录环境变量值、URL 构建过程、错误详情

**方案 3：改进错误处理**
- 在心跳服务中返回更详细的错误信息
- 包括环境变量是否配置、URL 是什么、具体的错误原因

### 5.2 修复 AI 配置中心测试调用问题

**方案 1：检查环境变量配置**
- 确认 `NEXT_PUBLIC_AI_SERVICE_URL` 和 `NEXT_PUBLIC_AI_SERVICE_TOKEN` 已正确配置
- 在浏览器控制台检查这些变量的值

**方案 2：改进错误提示**
- 在 `callAiDirect()` 中添加更详细的错误信息
- 区分环境变量未配置、网络错误、认证错误等不同情况

**方案 3：添加降级方案**
- 如果前端环境变量未配置，可以尝试通过 Next.js API 路由代理（但会受 20 秒限制）
- 或者显示明确的配置提示

**方案 4：验证 CORS 配置**
- 确认 ai-service 的 CORS 配置已生效
- 检查浏览器控制台是否有 CORS 错误

## 六、快速诊断命令

### 6.1 检查环境变量（服务端）

在 Next.js API 路由中临时添加：
```typescript
// src/app/api/admin/ai/heartbeat/route.ts (临时调试)
console.log("=== 环境变量检查 ===");
console.log("AI_SERVICE_URL:", process.env.AI_SERVICE_URL);
console.log("AI_SERVICE_TOKEN:", process.env.AI_SERVICE_TOKEN ? "***" : "未配置");
console.log("LOCAL_AI_SERVICE_URL:", process.env.LOCAL_AI_SERVICE_URL);
console.log("LOCAL_AI_SERVICE_TOKEN:", process.env.LOCAL_AI_SERVICE_TOKEN ? "***" : "未配置");
```

### 6.2 检查环境变量（前端）

在浏览器控制台：
```javascript
// 检查前端环境变量
console.log("NEXT_PUBLIC_AI_SERVICE_URL:", process.env.NEXT_PUBLIC_AI_SERVICE_URL);
console.log("NEXT_PUBLIC_AI_SERVICE_TOKEN:", process.env.NEXT_PUBLIC_AI_SERVICE_TOKEN ? "***" : "未配置");
```

### 6.3 测试健康检查端点

```bash
# 测试 Render 服务健康检查
curl https://your-render-service.onrender.com/healthz

# 带认证测试
curl -H "Authorization: Bearer YOUR_TOKEN" https://your-render-service.onrender.com/healthz
```

### 6.4 测试 AI 调用端点

```bash
# 直接测试 ai-service
curl -X POST https://your-ai-service.onrender.com/v1/ask \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"question":"测试问题","lang":"zh"}'
```

## 七、预期修复后的行为

### 7.1 心跳服务
- ✅ 能够检测到 Render 服务状态（如果 `AI_SERVICE_URL` 配置正确）
- ✅ 能够检测到本地 AI 服务状态（如果 `LOCAL_AI_SERVICE_URL` 配置正确）
- ✅ 显示详细的错误信息（如果检测失败）

### 7.2 AI 配置中心测试
- ✅ 前端能够直接调用 ai-service（如果 `NEXT_PUBLIC_AI_SERVICE_URL` 配置正确）
- ✅ 支持 120 秒超时（不受 Next.js 20 秒限制）
- ✅ 显示详细的错误信息（如果调用失败）

## 八、快速修复检查清单

### 8.1 环境变量配置（Vercel）

**必须配置的环境变量**：

#### 服务端环境变量（用于心跳服务）
```
AI_SERVICE_URL=https://zalem.onrender.com
AI_SERVICE_TOKEN=your_render_token_here
LOCAL_AI_SERVICE_URL=https://ai-service.zalem.app
LOCAL_AI_SERVICE_TOKEN=your_local_token_here
```

#### 前端环境变量（用于浏览器直接调用）
```
NEXT_PUBLIC_AI_SERVICE_URL=https://zalem.onrender.com
NEXT_PUBLIC_AI_SERVICE_TOKEN=your_render_token_here
```

**重要**：
- 前端环境变量必须以 `NEXT_PUBLIC_` 开头
- 前端和后端可以使用相同的 URL 和 token，但必须分别配置
- 配置后需要重新部署才能生效

### 8.2 浏览器控制台检查

打开浏览器开发者工具（F12），检查：

1. **Console 标签页**：
   - 是否有 `NEXT_PUBLIC_AI_SERVICE_URL is not configured` 错误？
   - 是否有 CORS 错误？
   - 是否有 401/403 认证错误？

2. **Network 标签页**：
   - 查看对 ai-service 的请求
   - 检查请求 URL 是否正确
   - 检查请求头中的 Authorization 是否正确
   - 查看响应状态码和错误信息

### 8.3 服务端日志检查

查看 Next.js 服务端日志（Vercel 日志或本地终端）：

1. **心跳服务日志**：
   - 查看 `/api/admin/ai/heartbeat` 的日志
   - 检查环境变量是否读取到
   - 检查健康检查请求的 URL 和错误信息

2. **AI 调用日志**：
   - 如果还有通过 Next.js 的调用，查看相关日志
   - 确认是否收到请求

### 8.4 ai-service 日志检查

查看 ai-service 的日志（Render 日志或本地终端）：

1. **是否收到请求**：
   - 如果没有收到请求，说明是前端问题（环境变量或 CORS）
   - 如果收到请求但返回错误，说明是认证或业务逻辑问题

2. **CORS 相关日志**：
   - 检查是否有 CORS 相关的错误或警告

## 九、总结

### 9.1 核心问题
1. **环境变量配置不一致**：前端和服务端使用不同的环境变量名称
2. **环境变量可能未配置**：重构后需要配置新的前端环境变量（`NEXT_PUBLIC_*`）
3. **错误信息不够详细**：无法快速定位问题原因
4. **页面功能混淆**：AI 配置中心没有测试功能，测试功能在场景测试页面

### 9.2 优先级
1. **高优先级**：检查并配置所有必需的环境变量（特别是 `NEXT_PUBLIC_AI_SERVICE_URL` 和 `NEXT_PUBLIC_AI_SERVICE_TOKEN`）
2. **高优先级**：验证 ai-service 的 CORS 配置是否生效
3. **中优先级**：改进错误处理和日志输出，提供更详细的错误信息
4. **低优先级**：统一环境变量命名（如果需要）

### 9.3 下一步行动
1. ✅ **立即检查**：Vercel 环境变量配置，确保 `NEXT_PUBLIC_AI_SERVICE_URL` 和 `NEXT_PUBLIC_AI_SERVICE_TOKEN` 已配置
2. ✅ **立即检查**：浏览器控制台错误信息，确认具体错误类型
3. ✅ **立即检查**：ai-service 的 CORS 配置是否生效
4. ✅ **测试**：直接访问健康检查端点，确认服务可访问
5. ✅ **测试**：使用 curl 直接测试 ai-service，确认认证和业务逻辑正常
6. ✅ **修复**：根据测试结果修复问题

### 9.4 预期结果

修复后应该看到：
- ✅ 心跳服务能够检测到 Render 服务状态
- ✅ 前端能够直接调用 ai-service（支持 120 秒超时）
- ✅ 场景测试页面能够正常测试 AI 调用
- ✅ 浏览器控制台没有环境变量或 CORS 错误

## 十、已实施的代码改进

### 10.1 改进错误处理

**文件**: `src/lib/aiClient.front.ts`

**改进内容**：
1. ✅ 添加了详细的环境变量检查错误信息
2. ✅ 添加了 URL 格式验证
3. ✅ 添加了详细的错误日志
4. ✅ 区分不同类型的错误（401、403、其他）

**文件**: `src/app/api/admin/ai/heartbeat/route.ts`

**改进内容**：
1. ✅ 添加了环境变量检查日志
2. ✅ 添加了健康检查 URL 日志
3. ✅ 添加了响应状态日志
4. ✅ 添加了详细的错误日志（包括错误堆栈）

### 10.2 改进效果

通过这些改进，现在可以：
- 快速定位环境变量配置问题
- 查看健康检查的具体 URL 和错误信息
- 区分不同类型的错误（环境变量、CORS、认证、网络等）

### 10.3 使用改进后的日志

**查看心跳服务日志**：
- 在 Vercel 日志中搜索 `[heartbeat]` 关键字
- 查看环境变量是否配置、健康检查 URL、响应状态等

**查看前端调用日志**：
- 在浏览器控制台查看 `[callAiDirect]` 关键字
- 查看环境变量检查、URL 验证、调用失败等详细信息

