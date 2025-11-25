# 前台 AI 调用失败诊断报告

**日期：2025-11-17**  
**问题：前台报错 "网络请求失败: Failed to fetch"，local AI service 没有收到任何请求**

## 一、问题描述

1. **错误信息**：`网络请求失败: Failed to fetch`
2. **现象**：local AI service 没有收到任何请求
3. **环境变量检查**：
   - `NEXT_PUBLIC_LOCAL_AI_SERVICE_URL=https://ai-service.zalem.app/`（注意：这是远程服务，不是本地服务）
   - `NEXT_PUBLIC_RENDER_AI_SERVICE_URL=https://zalem.onrender.com/v1`

## 二、可能原因分析

### 2.1 环境变量配置问题

**问题**：`NEXT_PUBLIC_LOCAL_AI_SERVICE_URL` 指向的是远程服务 `https://ai-service.zalem.app/`，而不是本地服务（如 `http://localhost:8788`）。

**影响**：
- 如果用户期望使用本地服务，但环境变量指向远程服务，请求会发送到远程服务
- 如果远程服务不可用或 CORS 配置不正确，会导致 "Failed to fetch" 错误

**解决方案**：
1. 检查用户是否真的想使用本地服务
2. 如果是，将 `NEXT_PUBLIC_LOCAL_AI_SERVICE_URL` 改为 `http://localhost:8788`（或实际本地服务地址）
3. 确保本地服务正在运行

### 2.2 CORS 配置问题

**问题**：虽然已经配置了 CORS，但可能存在以下问题：
1. OPTIONS 预检请求可能没有正确注册
2. CORS 配置可能不完整
3. 浏览器可能阻止了跨域请求

**检查点**：
1. 浏览器控制台是否有 CORS 错误？
2. OPTIONS 预检请求是否成功？
3. CORS 响应头是否正确？

### 2.3 网络连接问题

**问题**：请求可能根本没有发送到服务器，或者服务器不可达。

**可能原因**：
1. 服务未运行
2. 防火墙/代理阻止
3. URL 配置错误
4. DNS 解析失败

### 2.4 URL 拼接问题

**问题**：虽然已经使用 `joinUrl`，但可能仍有问题。

**检查点**：
1. 最终拼接的 URL 是否正确？
2. 是否有双斜杠、空格等问题？

## 三、已实施的修复

### 3.1 增强错误日志

**文件**：`src/lib/aiClient.front.ts`

**改进**：
1. 添加详细的请求日志（包括 baseUrl、requestUrl、token 长度等）
2. 增强错误信息，区分不同类型的错误（CORS、连接、配置等）
3. 提供更详细的错误提示

**代码示例**：
```typescript
console.log("[callAiDirect] 调用 AI 服务:", {
  provider,
  baseUrl: url,
  requestUrl,
  hasToken: !!token,
  tokenLength: token?.length || 0,
  scene: rest.scene,
  model: rest.model,
  questionLength: rest.question?.length || 0,
});
```

### 3.2 增强端点解析日志

**文件**：`src/lib/aiEndpoint.ts`

**改进**：
1. 添加详细的端点解析日志
2. 验证 URL 格式时输出详细信息
3. 提供更清晰的错误信息

**代码示例**：
```typescript
console.log("[resolveAiEndpoint] 解析端点:", {
  provider,
  hasUrl: !!ep?.url,
  hasToken: !!ep?.token,
  urlPreview: ep?.url ? `${ep.url.substring(0, 50)}...` : "undefined",
  tokenPreview: ep?.token ? `${ep.token.substring(0, 10)}...` : "undefined",
});
```

### 3.3 改进错误处理

**文件**：`src/lib/aiClient.front.ts`

**改进**：
1. 区分不同类型的网络错误
2. 提供针对性的错误提示
3. 包含诊断信息（URL、错误类型等）

## 四、诊断步骤

### 4.1 检查浏览器控制台

1. 打开浏览器开发者工具（F12）
2. 查看 Console 标签页
3. 查找以下日志：
   - `[resolveAiEndpoint] 解析端点:`
   - `[callAiDirect] 调用 AI 服务:`
   - `[callAiDirect] 网络请求失败:`

### 4.2 检查网络请求

1. 打开浏览器开发者工具（F12）
2. 查看 Network 标签页
3. 触发 AI 调用
4. 检查：
   - 是否有 OPTIONS 预检请求？
   - OPTIONS 请求是否成功（200）？
   - POST 请求是否发送？
   - POST 请求的状态码是什么？
   - 请求的 URL 是什么？

### 4.3 检查环境变量

1. 在浏览器控制台执行：
   ```javascript
   console.log("LOCAL URL:", process.env.NEXT_PUBLIC_LOCAL_AI_SERVICE_URL);
   console.log("RENDER URL:", process.env.NEXT_PUBLIC_RENDER_AI_SERVICE_URL);
   ```
2. 确认环境变量值是否正确

### 4.4 检查本地服务

1. 确认本地 AI 服务正在运行
2. 测试本地服务是否可访问：
   ```bash
   curl http://localhost:8788/healthz
   ```
3. 如果使用远程服务，测试远程服务是否可访问：
   ```bash
   curl https://ai-service.zalem.app/healthz
   ```

### 4.5 检查 CORS 配置

1. 测试 OPTIONS 预检请求：
   ```bash
   curl -X OPTIONS https://ai-service.zalem.app/v1/ask \
     -H "Origin: http://localhost:3000" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type,Authorization" \
     -v
   ```
2. 检查响应头是否包含：
   - `Access-Control-Allow-Origin: *`
   - `Access-Control-Allow-Methods: POST, OPTIONS`
   - `Access-Control-Allow-Headers: Content-Type, Authorization`

## 五、常见问题与解决方案

### 5.1 问题：环境变量指向错误的 URL

**症状**：
- `NEXT_PUBLIC_LOCAL_AI_SERVICE_URL` 指向远程服务
- 用户期望使用本地服务

**解决方案**：
1. 修改 `.env.local` 文件：
   ```bash
   NEXT_PUBLIC_LOCAL_AI_SERVICE_URL=http://localhost:8788
   NEXT_PUBLIC_LOCAL_AI_SERVICE_TOKEN=your_local_token
   ```
2. 重启 Next.js 开发服务器

### 5.2 问题：CORS 预检请求失败

**症状**：
- 浏览器控制台显示 CORS 错误
- OPTIONS 请求返回 404 或错误

**解决方案**：
1. 确认 `apps/ai-service/src/index.ts` 中已注册 OPTIONS 路由
2. 确认 CORS 配置正确
3. 检查 Fastify CORS 插件是否正常工作

### 5.3 问题：服务未运行

**症状**：
- 请求失败，错误信息包含 "ECONNREFUSED" 或 "ENOTFOUND"
- 服务日志中没有收到请求

**解决方案**：
1. 启动本地 AI 服务：
   ```bash
   cd apps/ai-service
   npm run dev
   ```
2. 确认服务监听在正确的端口（默认 8788）

### 5.4 问题：URL 拼接错误

**症状**：
- 请求 URL 包含双斜杠或空格
- 请求 URL 格式不正确

**解决方案**：
1. 确认使用 `joinUrl` 函数拼接 URL
2. 检查环境变量中的 URL 是否包含尾部斜杠（`joinUrl` 会自动处理）

## 六、下一步行动

1. ✅ **增强日志** - 已完成
2. ⏳ **用户检查** - 需要用户：
   - 检查浏览器控制台日志
   - 检查网络请求
   - 确认环境变量配置
   - 确认服务是否运行
3. ⏳ **根据日志诊断** - 根据用户提供的日志进一步诊断

## 七、预期日志输出

修复后，应该看到以下日志：

```
[resolveAiEndpoint] 解析端点: {
  provider: "local",
  hasUrl: true,
  hasToken: true,
  urlPreview: "http://localhost:8788...",
  tokenPreview: "local_ai_t..."
}

[callAiDirect] 调用 AI 服务: {
  provider: "local",
  baseUrl: "http://localhost:8788",
  requestUrl: "http://localhost:8788/v1/ask",
  hasToken: true,
  tokenLength: 20,
  scene: "question_explanation",
  model: "ollama:llama3",
  questionLength: 100
}
```

如果出现错误，应该看到详细的错误信息，包括：
- 错误类型（CORS、连接、配置等）
- 请求的 URL
- 错误堆栈（前 200 字符）

## 八、总结

已实施的修复：
1. ✅ 增强错误日志和诊断信息
2. ✅ 改进错误处理，提供更详细的错误提示
3. ✅ 添加端点解析日志

需要用户配合：
1. 检查浏览器控制台日志
2. 检查网络请求
3. 确认环境变量配置
4. 确认服务是否运行

根据用户提供的日志，可以进一步诊断问题。

