# 修复指令：local-ai-service 添加全局错误处理器

## 问题描述

当 `local-ai-service` 作为 AI 提供者时，`aichat` 和 `aiask` 功能出现错误：
```
[callAiDirect] AI service 调用失败: {}
```

**根本原因**：`local-ai-service` 缺少全局错误处理器（`setErrorHandler`），导致认证失败等错误无法正确返回 JSON 响应体，前端收到空响应 `{}`。

## 修复内容

### 文件：`apps/local-ai-service/src/index.ts`

#### 1. 添加类型导入

在文件顶部添加 `FastifyRequest` 和 `FastifyReply` 类型导入：

```typescript
// 修改前：
import Fastify, { FastifyInstance } from "fastify";

// 修改后：
import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
```

#### 2. 添加全局错误处理器

在 `buildServer` 函数中，在 CORS 配置之后、健康检查之前，添加全局错误处理器：

```typescript
  // 为 /v1/ask 注册 OPTIONS 预检请求处理（确保 CORS 正常工作，参考 ai-service 实现）
  app.options("/v1/ask", async (req, reply) => {
    reply
      .header("Access-Control-Allow-Origin", "*")
      .header("Access-Control-Allow-Methods", "POST, OPTIONS")
      .header("Access-Control-Allow-Headers", "Content-Type, Authorization")
      .send();
  });

  // 统一错误处理（与 ai-service 保持一致）
  // 注意：这确保所有未捕获的错误（如认证失败）都能正确返回响应体
  app.setErrorHandler((err: Error & { statusCode?: number }, _req: FastifyRequest, reply: FastifyReply) => {
    const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
    const message = status === 500 ? "Internal Server Error" : err.message || "Bad Request";
    reply.code(status).send({
      ok: false,
      errorCode:
        status === 400
          ? "VALIDATION_FAILED"
          : status === 401
          ? "AUTH_REQUIRED"
          : status === 403
          ? "FORBIDDEN"
          : status === 429
          ? "RATE_LIMIT_EXCEEDED"
          : "INTERNAL_ERROR",
      message,
    });
  });

  // 健康检查
  app.get("/healthz", async (_req, reply) => {
    // ... 原有代码
  });
```

## 完整修改后的代码位置

修改位置：`apps/local-ai-service/src/index.ts` 第 1 行和第 44-63 行

### 第 1 行（导入部分）：
```typescript
import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
```

### 第 44-63 行（buildServer 函数内）：
```typescript
  // 统一错误处理（与 ai-service 保持一致）
  // 注意：这确保所有未捕获的错误（如认证失败）都能正确返回响应体
  app.setErrorHandler((err: Error & { statusCode?: number }, _req: FastifyRequest, reply: FastifyReply) => {
    const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
    const message = status === 500 ? "Internal Server Error" : err.message || "Bad Request";
    reply.code(status).send({
      ok: false,
      errorCode:
        status === 400
          ? "VALIDATION_FAILED"
          : status === 401
          ? "AUTH_REQUIRED"
          : status === 403
          ? "FORBIDDEN"
          : status === 429
          ? "RATE_LIMIT_EXCEEDED"
          : "INTERNAL_ERROR",
      message,
    });
  });
```

## 修改原因

1. **与 ai-service 保持一致**：`ai-service` 已有全局错误处理器，`local-ai-service` 应该保持一致
2. **修复空响应问题**：当认证失败（如 token 无效）时，`ensureServiceAuth` 中间件会抛出错误，但如果没有全局错误处理器，Fastify 无法正确格式化响应，导致前端收到空响应体 `{}`
3. **统一错误格式**：确保所有错误都返回统一的 JSON 格式：`{ ok: false, errorCode: "...", message: "..." }`

## 验证方法

修复后，重启 `local-ai-service`，然后：

1. **测试认证失败场景**：
   ```bash
   curl -X POST http://localhost:8788/v1/ask \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer invalid-token" \
     -d '{"question":"test","scene":"chat"}'
   ```
   应该返回：
   ```json
   {
     "ok": false,
     "errorCode": "AUTH_REQUIRED",
     "message": "Invalid service token"
   }
   ```
   而不是空响应或 HTML 错误页面。

2. **测试正常请求**：
   使用正确的 token，应该能正常返回 AI 响应。

3. **前端测试**：
   在配置中心选择 `ollama (local-ai-service)`，测试 `aichat` 和 `aiask` 功能，应该不再出现 `{}` 错误。

## 相关文件

- `apps/ai-service/src/index.ts` - 参考实现（第 217-235 行）
- `apps/local-ai-service/src/middlewares/auth.ts` - 认证中间件（抛出错误的地方）

## 注意事项

- 此修改不影响现有功能，只是确保错误能正确返回
- 错误处理逻辑与 `ai-service` 完全一致，保持架构统一
- 修改后需要重启服务才能生效

