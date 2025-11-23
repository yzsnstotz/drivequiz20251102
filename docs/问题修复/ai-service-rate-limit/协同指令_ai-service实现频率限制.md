📌【指令头 v5.0 — 全系统研发规范 · 统一执行机制】

（适用于所有 Cursor 任务 · 不含任何业务内容 · 可直接复制）

⚠️ 使用方法：
你只需要在每次任务开头粘贴本段，后面再写任务内容即可。
⚠️ 本文件允许你自行定制：仅限修改"规范文件路径"与"结构文件路径"。
⚠️ 本文件本身不包含任务内容，全是执行规则。

🔒 ① 必读的规范文件（强制 · 不可跳过）

Cursor 在执行任何任务前，必须先阅读以下文档：

【核心架构规范】（必须遵守 · 不得忽略）

研发规范/🧩 AI 服务研发规范（ai-service 统一架构规范 v1.0）.md

研发规范/🧩 AI 核心服务规范（ai-core 统一架构规范 v2.0）.md

【数据库结构文档】（涉及字段/表更新必须同步）

研发规范/数据库结构_DRIVEQUIZ.md

研发规范/数据库结构_AI_SERVICE.md

【文件结构文档】（文件增删需同步更新）

研发规范/文件结构.md

引用文档来源：
DriveQuiz 架构与数据库来自：

最新系统架构来自：


🟥 ② 执行前置：必须先输出「规范对齐检查摘要」

每次执行任何任务前，你必须先输出 5–8 行的简短摘要，包含：

🔍 已阅读所有规范文件（路径需列出）

📘 本任务会受哪些规范约束（A、B、C、D 具体条款编号）

📌 哪些条款与本任务强关联（如 A1、A2、B1、C1）

📁 本次任务会影响哪些文件路径（只列路径，不描述内容）

⚠️ 没有这段摘要 = 任务自动失败

🧱 ③ 全局「红线规范」机制（不可违反 · 违反即失败）
🔴 A. 架构红线
编号	规则
A1	路由层禁止承载业务逻辑（业务逻辑必须在工具层 / service 层）
A2	所有核心逻辑必须写入 ai-core（如属 AI 功能）
A3	ai-service 与 local-ai-service 行为必须保持完全一致
A4	接口参数、返回结构必须保持统一（BFF / Next.js 代理 / ai-service）
🔴 B. 数据库 & 文件结构红线
编号	规则
B1	任何数据库字段、表结构、索引的修改必须同步更新数据库结构文档
B2	所有文件新增、删除、迁移必须同步更新 docs/研发规范/文件结构.md
B3	所有 Kysely 类型定义必须与数据库结构同步保持一致
B4	DriveQuiz 主库与 AI Service 库的 schema 需保持文档同步，不可自建"隐形字段"
🔴 C. 测试红线（AI 调用必须双环境测试）
编号	规则
C1	涉及 AI 功能必须同时测试：local-ai-service & 远程 ai-service
C2	必须输出测试日志摘要（请求、响应、耗时、错误）
C3	若测试失败，必须主动继续排查，不得要求用户手动重试
🔴 D. 执行报告红线（最终必须输出）
编号	规则
D1	任务结束必须按模板输出完整执行报告
D2	必须逐条对照 A1–D2，标注"已遵守 / 不适用 / 必须修复"
🛠 ④ 若涉及数据库迁移（必写）

必须在「执行报告」中包含以下内容：

迁移脚本名称（如：20250210_add_xxx.sql）

作用的数据库：DriveQuiz / AI Service

变更项（字段、新表、索引）

同步更新：

docs/研发规范/数据库结构_DRIVEQUIZ.md

docs/研发规范/数据库结构_AI_SERVICE.md

🗂 ⑤ 若涉及文件结构变更（必写）

必须同步更新：

docs/研发规范/文件结构.md

并在「执行报告」列出：

新增文件

删除文件

路径变更

目录调整

🧪 ⑥ 若任务需要脚本 / 测试（必写）

Cursor 必须自动：

自动执行脚本

自动生成测试日志

自动汇总结果

测试失败必须自动继续排查，不允许要求我手动运行

「执行报告」必须包含：

执行命令

执行日志

成果摘要

📑 ⑦ 最终输出必须包含「执行报告」（固定模板）

路径格式：

docs/问题修复/<问题文件夹>/执行报告/<任务名>_执行报告.md


执行报告必须包括：

任务摘要

修改文件列表

逐条红线规范自检（A1–D2）

测试结果（local + remote）

迁移脚本（如有）

更新后的文档（如数据库结构、文件结构等）

风险点与下一步建议

---

## 📋 任务内容：为 AI Service 实现基于配置的 Provider 频率限制

### 🎯 任务目标

1. **实现频率限制功能**：为 `/v1/ask` 端点添加基于配置的速率限制，支持不同 Provider 的独立配置
2. **从数据库读取配置**：从 AI Service 数据库的 `ai_config` 表读取频率限制配置
3. **支持动态更新**：配置更新后无需重启服务即可生效（通过定期轮询或事件机制）
4. **保持一致性**：ai-service 和 local-ai-service 必须实现完全相同的频率限制逻辑（A3 规范）

### 📝 背景说明

**前端已完成的工作**：
- ✅ 已在后台 AI 配置中心添加了 "Provider 频率限制" tab
- ✅ 已创建 `ProviderRateLimitManager` 组件，支持配置每个 Provider 的频率限制
- ✅ 已更新 API 路由 `/api/admin/ai/config`，支持频率限制配置的读写
- ✅ 配置存储在 `ai_config` 表中，key 格式为：
  - `rate_limit_{provider}_max`: 最大请求数（默认：60）
  - `rate_limit_{provider}_time_window`: 时间窗口（秒，默认：60）

**支持的 Provider**：
- `openai` (通过 Render)
- `openai_direct` (直连)
- `openrouter` (通过 Render)
- `openrouter_direct` (直连)
- `gemini_direct` (直连)
- `local` (本地 AI)

### 🔧 技术实现要求

#### 1. 安装依赖

需要安装 `@fastify/rate-limit` 插件：

```bash
cd apps/ai-service
npm install @fastify/rate-limit
```

```bash
cd apps/local-ai-service
npm install @fastify/rate-limit
```

#### 2. 配置读取

**从数据库读取配置**：
- 从 `ai_config` 表读取频率限制配置
- 配置 key 格式：`rate_limit_{provider}_max` 和 `rate_limit_{provider}_time_window`
- 如果配置不存在，使用默认值：
  - `openai`, `openai_direct`, `openrouter`, `openrouter_direct`, `gemini_direct`: 60 次/60秒
  - `local`: 120 次/60秒

**配置刷新机制**：
- 建议实现配置缓存，每 30 秒刷新一次（避免频繁查询数据库）
- 或者使用事件监听机制（如果数据库支持）

#### 3. 速率限制实现

**使用 `@fastify/rate-limit` 插件**：
- 为每个 Provider 创建独立的速率限制实例
- 限制策略：基于客户端 IP 地址
- 存储：使用内存存储（适合单实例部署）
- 错误响应：返回 HTTP 429，错误码 `RATE_LIMIT_EXCEEDED`（已存在）

**速率限制应用范围**：
- 仅应用于 `/v1/ask` 路由
- 不影响健康检查端点（`/healthz`, `/readyz`）
- 不影响其他管理端点

#### 4. Provider 识别

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

#### 5. 错误处理

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

  const max = Number(configMap[maxKey] || (provider === 'local' ? '120' : '60'));
  const timeWindow = Number(configMap[timeWindowKey] || '60');

  const config: RateLimitConfig = { max, timeWindow };
  
  // 更新缓存
  RATE_LIMIT_CACHE.set(provider, config);
  lastCacheUpdate = now;

  return config;
}
```

#### 速率限制注册示例

```typescript
// apps/ai-service/src/index.ts
import rateLimit from '@fastify/rate-limit';
import { getRateLimitConfig } from './lib/rateLimitConfig';

// 在注册路由前
app.register(async function (app) {
  // 为 /v1/ask 注册速率限制
  app.register(rateLimit, {
    max: async (request) => {
      // 动态获取当前 Provider 的配置
      const provider = request.headers['x-ai-provider'] || await getCurrentProvider();
      const config = await getRateLimitConfig(provider);
      return config.max;
    },
    timeWindow: async (request) => {
      const provider = request.headers['x-ai-provider'] || await getCurrentProvider();
      const config = await getRateLimitConfig(provider);
      return config.timeWindow * 1000; // 转换为毫秒
    },
    keyGenerator: (request) => {
      // 基于 IP 地址生成 key
      return request.ip || request.socket.remoteAddress || 'unknown';
    },
    errorResponseBuilder: (request, context) => {
      return {
        ok: false,
        errorCode: 'RATE_LIMIT_EXCEEDED',
        message: `Rate limit exceeded. Please try again after ${Math.ceil(context.ttl / 1000)} seconds.`,
      };
    },
  });
});
```

**注意**：`@fastify/rate-limit` 可能不支持动态的 `max` 和 `timeWindow`。如果不行，需要为每个 Provider 创建独立的速率限制实例，或者使用自定义中间件实现。

#### 自定义速率限制中间件（如果插件不支持动态配置）

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

1. ✅ 速率限制正常工作，超过限制返回 429 错误
2. ✅ 不同 Provider 使用独立的频率限制配置
3. ✅ 配置从数据库读取，支持动态更新（30 秒内生效）
4. ✅ ai-service 和 local-ai-service 行为完全一致（A3）
5. ✅ 错误响应格式与现有系统保持一致
6. ✅ 健康检查端点不受速率限制影响
7. ✅ 速率限制基于客户端 IP 地址

### 🧪 测试要求

**必须执行以下测试**（C1、C2 规范）：

1. **速率限制测试**：
   - 测试正常请求可以成功
   - 测试快速发送超过限制的请求，验证返回 429 错误
   - 测试时间窗口后请求恢复正常
   - 测试不同 Provider 使用不同的限制配置

2. **配置动态更新测试**：
   - 在后台修改频率限制配置
   - 验证 30 秒内新配置生效
   - 验证配置更新后速率限制行为改变

3. **双环境测试**（C1）：
   - 同时测试 local-ai-service（本地）
   - 同时测试 ai-service（远程 Render）

**测试命令示例**：
```bash
# 测试速率限制（发送 65 次请求，应该在第 61 次开始返回 429）
for i in {1..65}; do
  curl -X POST http://localhost:8788/v1/ask \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -H "X-AI-Provider: openai" \
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

1. **性能影响**：速率限制使用内存存储，注意内存使用情况。建议定期清理过期的记录。
2. **配置同步**：确保配置读取逻辑与前端配置中心使用的 key 格式完全一致。
3. **错误处理**：速率限制错误必须使用现有的错误处理机制（`RATE_LIMIT_EXCEEDED`）。
4. **向后兼容**：如果配置不存在，应使用合理的默认值，避免破坏现有部署。

### 📄 执行报告要求

执行报告必须包含：
1. 速率限制实现详情（插件安装、配置读取、中间件应用）
2. 配置缓存机制说明
3. Provider 识别逻辑说明
4. 测试结果（local + remote）
5. 红线规范自检（A1-D2）
6. 性能影响分析（内存使用、响应时间）

---

**任务开始前，请先输出「规范对齐检查摘要」**

