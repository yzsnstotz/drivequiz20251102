## 📋 任务内容：为 AI Service 实现 CORS 来源限制和 Provider 频率限制

### 🎯 任务目标

本任务包含两个主要功能：

1. **限制 CORS 来源**：将当前允许所有来源（`origin: true`）改为通过环境变量配置允许的域名列表
2. **实现 Provider 频率限制**：为 `/v1/ask` 端点添加基于配置的速率限制，支持不同 Provider 的独立配置

### 📝 背景说明

**前端已完成的工作**：
- ✅ 已在后台 AI 配置中心添加了 "Provider 频率限制" tab
- ✅ 已创建 `ProviderRateLimitManager` 组件，支持配置每个 Provider 的频率限制
- ✅ 已更新 API 路由 `/api/admin/ai/config`，支持频率限制配置的读写
- ✅ 配置存储在 `ai_config` 表中，key 格式为：
  - `rate_limit_{provider}_max`: 最大请求数（默认：60）
  - `rate_limit_{provider}_time_window`: 时间窗口（秒，默认：60）

**支持的 Provider**（完整列表）：
- `openai` (通过 Render)
- `openai_direct` (直连)
- `openrouter` (通过 Render)
- `openrouter_direct` (直连)
- `gemini` (通过 Render) ⚠️ **重要：此 Provider 必须包含在内**
- `gemini_direct` (直连)
- `local` (本地 AI)

### 🔧 功能 1：CORS 来源限制

#### 1.1 当前状态

**apps/ai-service/src/index.ts**（第 261-268 行）：
```typescript
app.register(cors, {
  origin: true, // ❌ 允许所有来源
  credentials: false,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type", "X-AI-Provider"],
  exposedHeaders: ["Content-Type"],
  maxAge: 86400,
});
```

**apps/local-ai-service/src/index.ts**（第 28-33 行）：
```typescript
app.register(cors, {
  origin: true, // ❌ 允许所有来源（与 ai-service 保持一致）
  credentials: false,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type"],
});
```

#### 1.2 目标状态

- 通过环境变量 `ALLOWED_ORIGINS` 配置允许的域名列表（逗号分隔）
- 如果未设置环境变量，使用合理的默认值（如 `https://your-app.vercel.app`）
- 同时更新 CORS 注册、OPTIONS 预检请求处理和 `onSend` Hook
- **必须保持 ai-service 和 local-ai-service 行为完全一致**（A3 规范）

#### 1.3 环境变量格式

```bash
ALLOWED_ORIGINS=https://your-app.vercel.app,https://your-domain.com,http://localhost:3000
```

#### 1.4 实现要求

**修改文件**：
- `apps/ai-service/src/index.ts`
- `apps/local-ai-service/src/index.ts`

**需要修改的位置**：
1. CORS 注册配置（第 261-268 行，ai-service）
2. `onSend` Hook（第 271-281 行，ai-service）
3. OPTIONS 预检请求处理（第 284-293 行，ai-service）
4. local-ai-service 的对应位置

**实现示例**：
```typescript
// 从环境变量读取允许的域名列表
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['https://your-app.vercel.app', 'https://your-domain.com'];

app.register(cors, {
  origin: (origin, callback) => {
    // 允许没有 origin 的请求（如 Postman、curl）
    if (!origin) {
      return callback(null, true);
    }
    
    // 检查 origin 是否在允许列表中
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: false,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type", "X-AI-Provider"],
  exposedHeaders: ["Content-Type"],
  maxAge: 86400,
});
```

### 🔧 功能 2：Provider 频率限制

#### 2.1 安装依赖

需要安装 `@fastify/rate-limit` 插件：

```bash
cd apps/ai-service
npm install @fastify/rate-limit
```

```bash
cd apps/local-ai-service
npm install @fastify/rate-limit
```

#### 2.2 配置读取

**从数据库读取配置**：
- 从 `ai_config` 表读取频率限制配置
- 配置 key 格式：`rate_limit_{provider}_max` 和 `rate_limit_{provider}_time_window`
- **支持的 Provider**（完整列表，必须全部支持）：
  - `openai`, `openai_direct`
  - `openrouter`, `openrouter_direct`
  - `gemini`, `gemini_direct` ⚠️ **重要：必须包含 `gemini`（通过 Render）**
  - `local`
- 如果配置不存在，使用默认值：
  - `openai`, `openai_direct`, `openrouter`, `openrouter_direct`, `gemini`, `gemini_direct`: 60 次/60秒
  - `local`: 120 次/60秒

**配置刷新机制**：
- 建议实现配置缓存，每 30 秒刷新一次（避免频繁查询数据库）
- 或者使用事件监听机制（如果数据库支持）

#### 2.3 速率限制实现

**使用 `@fastify/rate-limit` 插件**：
- 为每个 Provider 创建独立的速率限制实例
- 限制策略：基于客户端 IP 地址
- 存储：使用内存存储（适合单实例部署）
- 错误响应：返回 HTTP 429，错误码 `RATE_LIMIT_EXCEEDED`（已存在）

**速率限制应用范围**：
- 仅应用于 `/v1/ask` 路由
- 不影响健康检查端点（`/healthz`, `/readyz`）
- 不影响其他管理端点

#### 2.4 Provider 识别

**如何确定当前请求使用的 Provider**：
- 从请求头 `X-AI-Provider` 读取（如果存在）
- 如果不存在，从数据库配置读取当前启用的 Provider
- 根据 Provider 选择对应的速率限制配置

**速率限制应用逻辑**：
```typescript
// 伪代码
const provider = request.headers['x-ai-provider'] || await getCurrentProvider();
const rateLimitConfig = await getRateLimitConfig(provider);
// 应用对应的速率限制
```

**⚠️ 重要提示**：
- Provider 值可能是：`openai`, `openai_direct`, `openrouter`, `openrouter_direct`, `gemini`, `gemini_direct`, `local`
- **必须确保所有 Provider 都有对应的频率限制配置**，包括 `gemini`（通过 Render）

#### 2.5 错误处理

**超过限制时的响应**：
```json
{
  "ok": false,
  "errorCode": "RATE_LIMIT_EXCEEDED",
  "message": "Rate limit exceeded. Please try again later."
}
```

**HTTP 状态码**：429

**响应头**（如果 `@fastify/rate-limit` 支持）：
- `X-RateLimit-Limit`: 最大请求数
- `X-RateLimit-Remaining`: 剩余请求数
- `X-RateLimit-Reset`: 重置时间（Unix 时间戳）

### 📁 文件修改清单

#### apps/ai-service

1. **apps/ai-service/package.json**
   - 添加 `@fastify/rate-limit` 依赖

2. **apps/ai-service/src/index.ts**
   - 修改 CORS 配置（第 261-268 行）
   - 更新 `onSend` Hook（第 271-281 行）
   - 更新 OPTIONS 处理（第 284-293 行）
   - 导入 `@fastify/rate-limit`
   - 实现配置读取函数（从数据库读取频率限制配置）
   - 实现配置缓存机制（每 30 秒刷新）
   - 在 `/v1/ask` 路由注册前应用速率限制

3. **apps/ai-service/src/routes/ask.ts**（如果需要）
   - 确保 Provider 识别逻辑正确
   - 确保速率限制正确应用

#### apps/local-ai-service

1. **apps/local-ai-service/package.json**
   - 添加 `@fastify/rate-limit` 依赖

2. **apps/local-ai-service/src/index.ts**
   - 同步修改 CORS 配置（与 ai-service 保持一致）
   - 同步添加速率限制插件注册
   - 同步实现与 ai-service 相同的频率限制逻辑（A3 规范）

3. **apps/local-ai-service/src/routes/ask.ts**（如果存在）
   - 同步应用速率限制

### 🔍 实现细节

#### 配置读取函数示例

```typescript
// apps/ai-service/src/lib/rateLimitConfig.ts
import { aiDb } from './db'; // 假设有数据库连接

type RateLimitConfig = {
  max: number;
  timeWindow: number; // 秒
};

const RATE_LIMIT_CACHE = new Map<string, RateLimitConfig>();
let lastCacheUpdate = 0;
const CACHE_TTL = 30000; // 30 秒

export async function getRateLimitConfig(provider: string): Promise<RateLimitConfig> {
  // 检查缓存
  const now = Date.now();
  if (now - lastCacheUpdate < CACHE_TTL && RATE_LIMIT_CACHE.has(provider)) {
    return RATE_LIMIT_CACHE.get(provider)!;
  }

  // 从数据库读取
  const maxKey = `rate_limit_${provider}_max`;
  const timeWindowKey = `rate_limit_${provider}_time_window`;

  const configs = await (aiDb as any)
    .selectFrom('ai_config')
    .select(['key', 'value'])
    .where('key', 'in', [maxKey, timeWindowKey])
    .execute();

  const configMap: Record<string, string> = {};
  for (const row of configs) {
    configMap[row.key] = row.value;
  }

  // 默认值：根据 provider 类型设置
  const defaultMax = provider === 'local' ? 120 : 60;
  const max = Number(configMap[maxKey] || String(defaultMax));
  const timeWindow = Number(configMap[timeWindowKey] || '60');

  const config: RateLimitConfig = { max, timeWindow };
  
  // 更新缓存
  RATE_LIMIT_CACHE.set(provider, config);
  lastCacheUpdate = now;

  return config;
}
```

**⚠️ 重要**：确保 `getRateLimitConfig` 函数支持所有 Provider，包括 `gemini`（通过 Render）。

#### 速率限制注册示例

**注意**：`@fastify/rate-limit` 可能不支持动态的 `max` 和 `timeWindow`。如果不行，需要为每个 Provider 创建独立的速率限制实例，或者使用自定义中间件实现。

**自定义速率限制中间件（推荐）**：
```typescript
// apps/ai-service/src/lib/rateLimit.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { getRateLimitConfig } from './rateLimitConfig';

type RateLimitStore = Map<string, { count: number; resetAt: number }>;

const stores = new Map<string, RateLimitStore>();

export async function rateLimitMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // 仅对 /v1/ask 应用
  if (request.url !== '/v1/ask' && !request.url.startsWith('/v1/ask?')) {
    return;
  }

  const provider = (request.headers['x-ai-provider'] as string) || await getCurrentProvider();
  const config = await getRateLimitConfig(provider);
  const clientIp = request.ip || request.socket.remoteAddress || 'unknown';

  // 获取或创建该 Provider 的存储
  if (!stores.has(provider)) {
    stores.set(provider, new Map());
  }
  const store = stores.get(provider)!;

  const now = Date.now();
  const windowMs = config.timeWindow * 1000;
  const key = `${provider}:${clientIp}`;
  const record = store.get(key);

  if (!record || now >= record.resetAt) {
    // 创建新记录或重置
    store.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (record.count >= config.max) {
    // 超过限制
    const retryAfter = Math.ceil((record.resetAt - now) / 1000);
    reply.code(429).send({
      ok: false,
      errorCode: 'RATE_LIMIT_EXCEEDED',
      message: `Rate limit exceeded. Please try again after ${retryAfter} seconds.`,
    });
    return;
  }

  // 增加计数
  record.count++;
  
  // 设置响应头
  reply.header('X-RateLimit-Limit', String(config.max));
  reply.header('X-RateLimit-Remaining', String(config.max - record.count));
  reply.header('X-RateLimit-Reset', String(Math.ceil(record.resetAt / 1000)));
}
```

### ✅ 验收标准

#### CORS 限制验收标准

1. ✅ CORS 配置通过环境变量控制，不再允许所有来源
2. ✅ 允许的域名可以正常访问
3. ✅ 不允许的域名被拒绝（浏览器控制台应有 CORS 错误）
4. ✅ OPTIONS 预检请求正常工作
5. ✅ ai-service 和 local-ai-service 行为完全一致（A3）

#### 频率限制验收标准

1. ✅ 速率限制正常工作，超过限制返回 429 错误
2. ✅ 不同 Provider 使用独立的频率限制配置
3. ✅ **所有 Provider 都支持频率限制，包括 `gemini`（通过 Render）**
4. ✅ 配置从数据库读取，支持动态更新（30 秒内生效）
5. ✅ ai-service 和 local-ai-service 行为完全一致（A3）
6. ✅ 错误响应格式与现有系统保持一致
7. ✅ 健康检查端点不受速率限制影响
8. ✅ 速率限制基于客户端 IP 地址

### 🧪 测试要求

**必须执行以下测试**（C1、C2 规范）：

#### CORS 测试

1. 测试允许的域名可以正常访问
2. 测试不允许的域名被拒绝（浏览器控制台应有 CORS 错误）
3. 测试 OPTIONS 预检请求正常工作

#### 频率限制测试

1. 测试正常请求可以成功
2. 测试快速发送超过限制的请求，验证返回 429 错误
3. 测试时间窗口后请求恢复正常
4. **测试不同 Provider 使用不同的限制配置（包括 `gemini` 通过 Render）**
5. 测试配置动态更新（在后台修改频率限制配置，验证 30 秒内新配置生效）

#### 双环境测试（C1）

1. 同时测试 local-ai-service（本地）
2. 同时测试 ai-service（远程 Render）

**测试命令示例**：
```bash
# 测试 CORS
curl -H "Origin: https://allowed-domain.com" -X OPTIONS http://localhost:8788/v1/ask

# 测试频率限制（发送 65 次请求，应该在第 61 次开始返回 429）
for i in {1..65}; do
  curl -X POST http://localhost:8788/v1/ask \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -H "X-AI-Provider: gemini" \
    -d '{"question":"test"}' \
    -w "\nStatus: %{http_code}\n"
  sleep 0.1
done
```

### 📚 相关规范约束

- **A3**：ai-service 与 local-ai-service 行为必须保持完全一致
- **A4**：接口参数、返回结构必须保持统一
- **C1**：必须同时测试 local-ai-service & 远程 ai-service
- **C2**：必须输出测试日志摘要

### 🚨 注意事项

1. **向后兼容**：如果环境变量未设置，应使用合理的默认值，避免破坏现有部署
2. **性能影响**：速率限制使用内存存储，注意内存使用情况。建议定期清理过期的记录。
3. **配置同步**：确保配置读取逻辑与前端配置中心使用的 key 格式完全一致。
4. **错误处理**：速率限制错误必须使用现有的错误处理机制（`RATE_LIMIT_EXCEEDED`）。
5. **⚠️ Provider 完整性**：必须确保所有 Provider 都支持频率限制，包括 `gemini`（通过 Render）。如果配置不存在，应使用默认值。

### 📄 执行报告要求

执行报告必须包含：
1. CORS 配置修改详情（ai-service 和 local-ai-service）
2. 速率限制实现详情（插件安装、配置读取、中间件应用）
3. 配置缓存机制说明
4. Provider 识别逻辑说明
5. **所有支持的 Provider 列表（必须包含 `gemini` 通过 Render）**
6. 测试结果（local + remote）
7. 红线规范自检（A1-D2）
8. 性能影响分析（内存使用、响应时间）
9. 部署注意事项（环境变量设置）

---

**任务开始前，请先输出「规范对齐检查摘要」**

