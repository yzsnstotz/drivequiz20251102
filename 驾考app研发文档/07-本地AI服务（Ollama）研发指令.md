# 🚀 本地AI服务（Ollama）研发指令

**创建时间**: 2025-01-15  
**执行窗口**: 下一个开发窗口  
**状态**: 待执行  
**重要**: ⚠️ **仅输出指令，不要在当前窗口执行**

---

## 📋 执行前必读

### 核心原则

1. **独立架构**：本地AI服务必须完全独立，不与现有的 `apps/ai-service`（在线AI服务）耦合
2. **不修改现有代码**：不要修改 `apps/ai-service` 的任何代码
3. **独立部署**：本地AI服务可以独立运行，不依赖 Render 等云端服务
4. **完全本地化**：使用 Ollama 本地模型，无需 OpenAI API

---

## 🏗️ 架构设计

### 架构对比

#### 当前架构（在线AI服务）

```
用户浏览器
    ↓
Vercel (主站) - apps/web
    ↓ /api/ai/ask
Render (AI-Service) - apps/ai-service
    ↓
OpenAI API (云端)
```

#### 新架构（本地AI服务 - 独立）

```
用户浏览器
    ↓
本地 Next.js (主站) - apps/web
    ↓ /api/ai/ask  (修改现有路由，支持无缝切换)
本地AI服务 - apps/local-ai-service (新服务)
    ↓
本地 Ollama (localhost:11434)
```

### 架构特点

1. **完全独立**：
   - 新服务：`apps/local-ai-service`
   - 新端口：`8788`（与 `apps/ai-service` 的 8787 区分）
   - 修改现有路由：`/api/ai/ask`（支持通过环境变量无缝切换）
   - 独立配置：`.env.local` 独立环境变量

2. **不耦合现有服务**：
   - ✅ 不引用 `apps/ai-service` 的代码
   - ✅ 不共享配置文件
   - ✅ 不共用数据库表（可选，或使用独立表）
   - ✅ 独立的路由和中间件

3. **技术栈**：
   - 框架：Fastify（与现有保持一致，但独立实现）
   - Chat模型：`llama3.2:3b`（Ollama）
   - Embedding模型：`nomic-embed-text`（Ollama，768维）
   - 向量数据库：Supabase pgvector（768维）

---

## 📦 方案细节

### 方案：轻量级本地AI服务

#### 1. 模型配置

```bash
# Chat 模型（生成回答）
模型名称: llama3.2:3b
内存占用: ~2-3GB
用途: 根据问题和检索到的文档生成回答

# Embedding 模型（RAG检索）
模型名称: nomic-embed-text
向量维度: 768
内存占用: ~500MB
用途: 将问题和文档转换为向量，用于相似度搜索
```

#### 2. 目录结构

```
/Users/leo/Desktop/kkdrivequiz/
├── apps/
│   ├── ai-service/          # 现有在线AI服务（不修改）
│   └── local-ai-service/    # 新服务（独立创建）
│       ├── package.json
│       ├── tsconfig.json
│       ├── .env.local       # 独立环境变量
│       └── src/
│           ├── index.ts
│           ├── lib/
│           │   ├── ollamaClient.ts    # Ollama客户端
│           │   ├── rag.ts             # RAG检索（768维）
│           │   ├── logger.ts
│           │   └── config.ts
│           ├── routes/
│           │   └── ask.ts             # /v1/ask 路由
│           └── middlewares/
│               └── auth.ts
├── src/
│   └── migrations/
│       └── 20250115_migrate_to_ollama_768d.sql  # 数据库迁移（如果还没执行）
└── apps/web/
    └── app/
        └── api/
            └── ai/
                └── ask/
                    └── route.ts       # 修改现有路由支持服务切换
```

#### 3. 环境变量配置

**`apps/local-ai-service/.env.local`**:
```bash
# Ollama 配置
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_API_KEY=ollama  # 任意值，Ollama不需要真实key

# 模型配置
AI_MODEL=llama3.2:3b
EMBEDDING_MODEL=nomic-embed-text

# 服务配置
PORT=8788
HOST=0.0.0.0
NODE_ENV=development
SERVICE_TOKENS=local_ai_token_xxx  # 独立token，不与ai-service共用

# 数据库配置
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_key
```

**项目根目录 `.env.local`（主站配置）**:
```bash
# 本地AI服务地址（新增）
LOCAL_AI_SERVICE_URL=http://localhost:8788
LOCAL_AI_SERVICE_TOKEN=local_ai_token_xxx

# 现有配置保持不变
AI_SERVICE_URL=https://ai.zalem.app  # 在线AI服务（保留）
AI_SERVICE_TOKEN=svc_token_xxx       # 在线AI Token（保留）
```

#### 4. 数据库迁移

**前提**：数据库为空或可以安全迁移

**迁移脚本**：`src/migrations/20250115_migrate_to_ollama_768d.sql`

**执行位置**：Supabase SQL Editor 或通过 psql

**迁移内容**：
- 将 `ai_vectors` 表的 `embedding` 列从 `vector(1536)` 改为 `vector(768)`
- 更新 `match_documents` 函数参数从 `vector(1536)` 改为 `vector(768)`
- 重建向量索引（ivfflat）

---

## 📝 执行顺序

### 阶段1：环境准备（15分钟）

#### 步骤1.1：安装和启动 Ollama

```bash
# 1. 检查 Ollama 是否已安装
ollama --version

# 2. 如果未安装，执行安装
# macOS:
brew install ollama

# 或使用官方安装脚本:
curl -fsSL https://ollama.com/install.sh | sh

# 3. 启动 Ollama 服务
ollama serve

# 4. 验证 Ollama 运行
curl http://localhost:11434/api/tags
```

#### 步骤1.2：拉取模型

```bash
# 拉取 Chat 模型
ollama pull llama3.2:3b

# 拉取 Embedding 模型
ollama pull nomic-embed-text

# 验证模型
ollama list
```

**预期结果**：
- ✅ Ollama 服务运行在 `localhost:11434`
- ✅ 两个模型都已下载（`llama3.2:3b` 和 `nomic-embed-text`）

---

### 阶段2：数据库迁移（10分钟）

#### 步骤2.1：执行迁移脚本

**位置**：Supabase Dashboard → SQL Editor

**脚本路径**：`src/migrations/20250115_migrate_to_ollama_768d.sql`

**执行方式**：
1. 打开 Supabase Dashboard
2. 进入 SQL Editor
3. 复制迁移脚本内容
4. 执行脚本

**或使用命令行**：
```bash
psql $DATABASE_URL -f src/migrations/20250115_migrate_to_ollama_768d.sql
```

#### 步骤2.2：验证迁移

```sql
-- 检查表结构
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'ai_vectors' AND column_name = 'embedding';

-- 预期结果: vector(768)

-- 检查函数参数
SELECT pg_get_function_arguments(oid) 
FROM pg_proc 
WHERE proname = 'match_documents';

-- 预期结果: query_embedding vector(768), ...
```

**预期结果**：
- ✅ `ai_vectors.embedding` 列类型为 `vector(768)`
- ✅ `match_documents` 函数参数为 `vector(768)`
- ✅ 向量索引已重建

---

### 阶段3：创建本地AI服务（30分钟）

#### 步骤3.1：创建目录结构

```bash
cd /Users/leo/Desktop/kkdrivequiz/apps
mkdir -p local-ai-service/src/{lib,routes,middlewares}
```

#### 步骤3.2：创建 package.json

**文件**：`apps/local-ai-service/package.json`

```json
{
  "name": "local-ai-service",
  "version": "1.0.0",
  "description": "本地AI问答服务 - 基于Ollama",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@fastify/cors": "^10.0.1",
    "dotenv": "^17.2.3",
    "fastify": "^5.1.0",
    "pino": "^9.6.0",
    "pino-pretty": "^13.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsx": "^4.7.0",
    "typescript": "^5.5.3"
  }
}
```

#### 步骤3.3：创建 tsconfig.json

**文件**：`apps/local-ai-service/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

#### 步骤3.4：创建 Ollama 客户端

**文件**：`apps/local-ai-service/src/lib/ollamaClient.ts`

```typescript
/**
 * Ollama 客户端封装
 * 提供统一的 Ollama API 调用接口
 */

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1";
const AI_MODEL = process.env.AI_MODEL || "llama3.2:3b";
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "nomic-embed-text";

/**
 * 调用 Ollama Chat API
 */
export async function callOllamaChat(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  temperature = 0.4
): Promise<string> {
  const response = await fetch(`${OLLAMA_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages,
      temperature,
    }),
  });

  if (!response.ok) {
    const error = await response.text().catch(() => "Unknown error");
    throw new Error(`Ollama Chat API 调用失败: ${error}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

/**
 * 调用 Ollama Embedding API
 */
export async function callOllamaEmbedding(text: string): Promise<number[]> {
  const response = await fetch(`${OLLAMA_BASE_URL}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      prompt: text.slice(0, 3000), // 限制长度
    }),
  });

  if (!response.ok) {
    const error = await response.text().catch(() => "Unknown error");
    throw new Error(`Ollama Embedding API 调用失败: ${error}`);
  }

  const data = await response.json();
  const embedding = data.embedding;

  if (!Array.isArray(embedding) || embedding.length !== 768) {
    throw new Error(`Embedding 维度错误: 期望 768 维，实际 ${embedding.length} 维`);
  }

  return embedding as number[];
}
```

#### 步骤3.5：创建 RAG 检索模块

**文件**：`apps/local-ai-service/src/lib/rag.ts`

```typescript
/**
 * RAG 检索模块（Supabase pgvector，768维）
 * 使用 Ollama nomic-embed-text 生成向量
 */

import { callOllamaEmbedding } from "./ollamaClient.js";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
const DEFAULT_MATCH_COUNT = 5;
const CONTEXT_CHAR_LIMIT = 4000;

type RagHit = {
  content: string;
  source_title?: string | null;
  source_url?: string | null;
  similarity?: number | null;
};

/**
 * 调用 Supabase RPC：match_documents（768维）
 */
async function callSupabaseMatch(
  queryEmbedding: number[],
  lang: string = "zh",
  matchCount: number = DEFAULT_MATCH_COUNT
): Promise<RagHit[]> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return [];

  const url = `${SUPABASE_URL.replace(/\/+$/, "")}/rest/v1/rpc/match_documents`;
  const body = {
    query_embedding: queryEmbedding,
    match_threshold: 0.75,
    match_count: Math.max(1, Math.min(10, matchCount)),
  };

  const headers: Record<string, string> = {
    "content-type": "application/json",
    apikey: SUPABASE_SERVICE_KEY,
    authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    accept: "application/json",
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });

    if (res.status === 404) return [];
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Supabase RPC error ${res.status}: ${text}`);
    }

    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) return [];

    return (data as RagHit[]).map((d) => ({
      content: String(d.content || ""),
      source_title: d.source_title ?? null,
      source_url: d.source_url ?? null,
      similarity: typeof d.similarity === "number" ? d.similarity : null,
    }));
  } catch (error) {
    console.error("RAG检索失败:", error);
    return [];
  }
}

/**
 * 构建上下文字符串
 */
function buildContext(hits: RagHit[]): string {
  if (!hits.length) return "";

  const parts: string[] = [];
  for (const h of hits) {
    const src = h.source_title ? `【来源:${h.source_title}】` : "";
    const sc = typeof h.similarity === "number" ? `（相关度:${h.similarity.toFixed(3)}）` : "";
    const chunk = `${src}${sc}\n${String(h.content || "").trim()}`;
    parts.push(chunk);

    const tmp = parts.join("\n\n---\n\n");
    if (tmp.length >= CONTEXT_CHAR_LIMIT) {
      return tmp.slice(0, CONTEXT_CHAR_LIMIT);
    }
  }

  const joined = parts.join("\n\n---\n\n");
  return joined.length > CONTEXT_CHAR_LIMIT ? joined.slice(0, CONTEXT_CHAR_LIMIT) : joined;
}

/**
 * 获取 RAG 上下文
 */
export async function getRagContext(
  question: string,
  lang: string = "zh"
): Promise<string> {
  try {
    // 1. 生成查询向量（768维）
    const embedding = await callOllamaEmbedding(question);

    // 2. 调用 Supabase RPC 检索
    const hits = await callSupabaseMatch(embedding, lang, DEFAULT_MATCH_COUNT);

    // 3. 构建上下文
    return buildContext(hits);
  } catch (error) {
    console.error("RAG上下文获取失败:", error);
    return "";
  }
}
```

#### 步骤3.6：创建配置和日志模块

**文件**：`apps/local-ai-service/src/lib/config.ts`

```typescript
import dotenv from "dotenv";

dotenv.config();

export type LocalAIConfig = {
  port: number;
  host: string;
  serviceTokens: Set<string>;
  ollamaBaseUrl: string;
  aiModel: string;
  embeddingModel: string;
  supabaseUrl: string;
  supabaseServiceKey: string;
  nodeEnv: string;
  version: string;
};

export function loadConfig(): LocalAIConfig {
  const {
    PORT,
    HOST,
    SERVICE_TOKENS,
    OLLAMA_BASE_URL,
    AI_MODEL,
    EMBEDDING_MODEL,
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    NODE_ENV,
    npm_package_version,
  } = process.env;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error("SUPABASE_URL 和 SUPABASE_SERVICE_KEY 必须配置");
  }

  return {
    port: Number(PORT || 8788),
    host: HOST || "0.0.0.0",
    serviceTokens: new Set(
      (SERVICE_TOKENS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    ),
    ollamaBaseUrl: OLLAMA_BASE_URL || "http://localhost:11434/v1",
    aiModel: AI_MODEL || "llama3.2:3b",
    embeddingModel: EMBEDDING_MODEL || "nomic-embed-text",
    supabaseUrl: SUPABASE_URL,
    supabaseServiceKey: SUPABASE_SERVICE_KEY,
    nodeEnv: NODE_ENV || "development",
    version: npm_package_version || "0.0.0",
  };
}
```

**文件**：`apps/local-ai-service/src/lib/logger.ts`

```typescript
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: process.env.NODE_ENV === "development" ? {
    target: "pino-pretty",
    options: {
      colorize: true,
    },
  } : undefined,
});
```

#### 步骤3.7：创建认证中间件

**文件**：`apps/local-ai-service/src/middlewares/auth.ts`

```typescript
import { FastifyRequest } from "fastify";
import type { LocalAIConfig } from "../lib/config.js";

export function ensureServiceAuth(
  request: FastifyRequest,
  config: LocalAIConfig
): void {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    const err: Error & { statusCode?: number } = new Error("Missing Authorization header");
    err.statusCode = 401;
    throw err;
  }

  const token = authHeader.slice(7);
  if (!config.serviceTokens.has(token)) {
    const err: Error & { statusCode?: number } = new Error("Invalid service token");
    err.statusCode = 401;
    throw err;
  }
}
```

#### 步骤3.8：创建问答路由

**文件**：`apps/local-ai-service/src/routes/ask.ts`

```typescript
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { ensureServiceAuth } from "../middlewares/auth.js";
import { getRagContext } from "../lib/rag.js";
import { callOllamaChat } from "../lib/ollamaClient.js";
import type { LocalAIConfig } from "../lib/config.js";

type AskBody = {
  question?: string;
  userId?: string;
  lang?: string;
};

type AskResult = {
  answer: string;
  sources?: Array<{ title: string; url: string; snippet?: string }>;
  model: string;
  safetyFlag: "ok" | "needs_human" | "blocked";
};

function buildSystemPrompt(lang: string): string {
  const base =
    "你是 ZALEM 驾驶考试学习助手。请基于日本交通法规与题库知识回答用户问题，引用时要简洁，不编造，不输出与驾驶考试无关的内容。";
  if (lang === "ja") {
    return "あなたは ZALEM の運転免許学習アシスタントです。日本の交通法規と問題集の知識に基づいて、簡潔かつ正確に回答してください。推測や捏造は禁止し、関係のない内容は出力しないでください。";
  }
  if (lang === "en") {
    return "You are ZALEM's driving-test study assistant. Answer based on Japan's traffic laws and question bank. Be concise and accurate. Do not fabricate or include unrelated content.";
  }
  return base;
}

export default async function askRoute(app: FastifyInstance): Promise<void> {
  app.post(
    "/v1/ask",
    async (request: FastifyRequest<{ Body: AskBody }>, reply: FastifyReply): Promise<void> => {
      const config = app.config as LocalAIConfig;

      try {
        // 1) 服务间鉴权
        ensureServiceAuth(request, config);

        // 2) 校验请求体
        const body = request.body as AskBody;
        const question = (body.question || "").trim();
        const lang = (body.lang || "zh").toLowerCase().trim();

        if (!question || question.length === 0 || question.length > 2000) {
          reply.code(400).send({
            ok: false,
            errorCode: "VALIDATION_FAILED",
            message: "Question is required and must be between 1 and 2000 characters",
          });
          return;
        }

        // 3) RAG 检索（获取上下文）
        const reference = await getRagContext(question, lang);

        // 4) 调用 Ollama Chat
        const sys = buildSystemPrompt(lang);
        const userPrefix = lang === "ja" ? "質問：" : lang === "en" ? "Question:" : "问题：";
        const refPrefix =
          lang === "ja" ? "関連参照：" : lang === "en" ? "Related references:" : "相关参考资料：";

        const answer = await callOllamaChat(
          [
            { role: "system", content: sys },
            {
              role: "user",
              content: `${userPrefix} ${question}\n\n${refPrefix}\n${reference || "（無/None）"}`,
            },
          ],
          0.4
        );

        if (!answer) {
          reply.code(502).send({
            ok: false,
            errorCode: "PROVIDER_ERROR",
            message: "Empty response from Ollama",
          });
          return;
        }

        // 5) 构建 sources（从 reference 中提取）
        const sources: Array<{ title: string; url: string; snippet?: string }> = reference
          ? [{ title: "RAG Reference", url: "", snippet: reference.slice(0, 200) }]
          : [];

        // 6) 返回结果
        const result: AskResult = {
          answer,
          sources: sources.length > 0 ? sources : undefined,
          model: config.aiModel,
          safetyFlag: "ok", // 本地服务暂不实现安全审查
        };

        reply.send({
          ok: true,
          data: result,
        });
      } catch (e) {
        const err = e as Error & { statusCode?: number };
        const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
        const message = status >= 500 ? "Internal Server Error" : err.message || "Bad Request";
        reply.code(status).send({
          ok: false,
          errorCode:
            status === 400
              ? "VALIDATION_FAILED"
              : status === 401
              ? "AUTH_REQUIRED"
              : "INTERNAL_ERROR",
          message,
        });
      }
    }
  );
}
```

#### 步骤3.9：创建主入口文件

**文件**：`apps/local-ai-service/src/index.ts`

```typescript
import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { loadConfig, type LocalAIConfig } from "./lib/config.js";
import { logger } from "./lib/logger.js";

declare module "fastify" {
  interface FastifyInstance {
    config: LocalAIConfig;
  }
}

function buildServer(config: LocalAIConfig): FastifyInstance {
  const app = Fastify({
    logger: logger,
  });

  app.decorate("config", config);

  // 注册 CORS
  app.register(cors, {
    origin: false, // 默认关闭跨域，仅接受内部请求
  });

  // 健康检查
  app.get("/healthz", async (_req, reply) => {
    reply.send({
      ok: true,
      data: {
        status: "ok",
        version: config.version,
        model: config.aiModel,
        embeddingModel: config.embeddingModel,
        env: config.nodeEnv,
        time: new Date().toISOString(),
      },
    });
  });

  return app;
}

async function registerRoutes(app: FastifyInstance): Promise<void> {
  try {
    const askModule = await import("./routes/ask.js");
    await askModule.default(app);
  } catch (err) {
    logger.error("路由注册失败:", err);
  }
}

async function start() {
  const config = loadConfig();
  const app = buildServer(config);

  // 注册路由
  await registerRoutes(app);

  // 优雅退出
  const close = async () => {
    try {
      await app.close();
      process.exit(0);
    } catch (e) {
      process.exit(1);
    }
  };
  process.on("SIGINT", close);
  process.on("SIGTERM", close);

  // 启动服务
  const port = config.port;
  const host = config.host;

  try {
    await app.listen({ port, host });
    logger.info(`本地AI服务启动成功: http://${host}:${port}`);
    logger.info(`Chat模型: ${config.aiModel}`);
    logger.info(`Embedding模型: ${config.embeddingModel}`);
  } catch (err) {
    logger.error("服务启动失败:", err);
    process.exit(1);
  }
}

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection:", reason);
});

start();
```

#### 步骤3.10：创建环境变量文件

**文件**：`apps/local-ai-service/.env.local`

```bash
# Ollama 配置
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_API_KEY=ollama

# 模型配置
AI_MODEL=llama3.2:3b
EMBEDDING_MODEL=nomic-embed-text

# 服务配置
PORT=8788
HOST=0.0.0.0
NODE_ENV=development
SERVICE_TOKENS=local_ai_token_dev_12345

# 数据库配置
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_key
```

#### 步骤3.11：安装依赖

```bash
cd apps/local-ai-service
npm install
```

**预期结果**：
- ✅ 目录结构创建完成
- ✅ 所有文件创建完成
- ✅ 依赖安装成功

---

### 阶段4：修改主站路由实现无缝切换（20分钟）

#### 步骤4.1：修改现有 `/api/ai/ask` 路由支持服务切换

**文件**：`apps/web/app/api/ai/ask/route.ts`

**修改位置**：在步骤3（转发到 AI-Service）部分

**修改内容**：添加服务选择逻辑

```typescript
// 在文件顶部添加配置读取
const USE_LOCAL_AI = process.env.USE_LOCAL_AI === "true"; // 新增：控制是否使用本地AI
const LOCAL_AI_SERVICE_URL = process.env.LOCAL_AI_SERVICE_URL ?? "";
const LOCAL_AI_SERVICE_TOKEN = process.env.LOCAL_AI_SERVICE_TOKEN ?? "";

// 在步骤3处修改：
// 3) 选择AI服务（本地或在线）
const useLocalAI = USE_LOCAL_AI && LOCAL_AI_SERVICE_URL && LOCAL_AI_SERVICE_TOKEN;
const aiServiceUrl = useLocalAI ? LOCAL_AI_SERVICE_URL : AI_SERVICE_URL;
const aiServiceToken = useLocalAI ? LOCAL_AI_SERVICE_TOKEN : AI_SERVICE_TOKEN;

if (!aiServiceUrl || !aiServiceToken) {
  return internalError("AI service is not configured.");
}

// 转发到选择的AI服务
// 注意：本地AI服务和在线AI服务使用相同的接口格式
aiResp = await fetch(`${aiServiceUrl.replace(/\/$/, "")}/v1/ask`, {
  method: "POST",
  headers: {
    "content-type": "application/json; charset=utf-8",
    authorization: `Bearer ${aiServiceToken}`,
  },
  body: JSON.stringify(forwardPayload),
});
```

**关键点**：
- ✅ 通过环境变量 `USE_LOCAL_AI=true` 控制切换
- ✅ 前端代码完全不需要修改
- ✅ 接口格式完全兼容
- ✅ 支持在线AI服务作为降级方案

#### 步骤4.2：更新主站环境变量配置

**文件**：`.env.local`（项目根目录）

```bash
# AI服务选择（新增：控制使用哪个服务）
USE_LOCAL_AI=true  # 设置为 true 使用本地AI，false 或未设置使用在线AI

# 本地AI服务配置（新增）
LOCAL_AI_SERVICE_URL=http://localhost:8788
LOCAL_AI_SERVICE_TOKEN=local_ai_token_dev_12345

# 在线AI服务配置（保留，作为降级方案）
AI_SERVICE_URL=https://ai.zalem.app
AI_SERVICE_TOKEN=svc_token_xxx
```

**预期结果**：
- ✅ 主站路由支持无缝切换
- ✅ 环境变量配置完成
- ✅ 前端代码无需修改

---

### 阶段4.5：确保本地AI服务接口格式兼容（10分钟）

#### 步骤4.5.1：检查并调整本地AI服务响应格式

**文件**：`apps/local-ai-service/src/routes/ask.ts`

**确保响应格式与在线AI服务完全一致**：

```typescript
// 响应格式必须包含以下字段（与在线AI服务对齐）
type AskResult = {
  answer: string;
  sources?: Array<{ title: string; url: string; snippet?: string }>;
  model: string;
  safetyFlag: "ok" | "needs_human" | "blocked";
  // 可选：向后兼容字段
  reference?: string | null;
  tokens?: { prompt?: number; completion?: number; total?: number };
  lang?: string;
  cached?: boolean;
  time?: string;
};

// 返回格式
reply.send({
  ok: true,
  data: {
    answer,
    sources: sources.length > 0 ? sources : undefined,
    model: config.aiModel,
    safetyFlag: "ok",
    // 向后兼容字段
    reference: reference || null,
    lang,
    cached: false,
    time: new Date().toISOString(),
  },
});
```

**预期结果**：
- ✅ 本地AI服务响应格式与在线AI服务完全一致
- ✅ 主站可以无缝切换服务

---

### 阶段4.6：验证无缝切换（5分钟）

**验证步骤**：
1. 确保环境变量 `USE_LOCAL_AI=true` 已设置
2. 启动本地AI服务（`localhost:8788`）
3. 启动主站（`localhost:3000`）
4. 前端调用 `/api/ai/ask`，应该自动使用本地AI服务
5. 修改 `USE_LOCAL_AI=false`，应该自动切换回在线AI服务

**预期结果**：
- ✅ 通过环境变量控制无缝切换
- ✅ 前端代码完全不需要修改
- ✅ 接口格式完全兼容

---

### 阶段5：测试验证（20分钟）

#### 步骤5.1：启动服务

```bash
# 终端1: 启动 Ollama（如果还没启动）
ollama serve

# 终端2: 启动本地AI服务
cd apps/local-ai-service
npm run dev

# 终端3: 启动主站
npm run dev
```

#### 步骤5.2：测试本地AI服务

```bash
# 1. 健康检查
curl http://localhost:8788/healthz

# 预期结果:
# {"ok":true,"data":{"status":"ok","version":"1.0.0","model":"llama3.2:3b","embeddingModel":"nomic-embed-text",...}}

# 2. 测试问答（需要token）
curl -X POST http://localhost:8788/v1/ask \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer local_ai_token_dev_12345" \
  -d '{
    "question": "日本驾考中，超速行驶的处罚是什么？",
    "lang": "zh"
  }'
```

#### 步骤5.3：测试主站路由（无缝切换）

```bash
# 测试主站路由（使用现有 /api/ai/ask，自动切换到本地AI）
curl -X POST http://localhost:3000/api/ai/ask \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_jwt_token" \
  -d '{
    "question": "日本驾考中，超速行驶的处罚是什么？",
    "locale": "zh-CN"
  }'

# 验证：响应格式应该与在线AI服务完全一致
# 预期响应格式：
# {
#   "ok": true,
#   "data": {
#     "answer": "...",
#     "sources": [...],
#     "model": "llama3.2:3b",
#     "safetyFlag": "ok",
#     ...
#   }
# }
```

#### 步骤5.4：测试 Ollama 模型

```bash
# 测试 Chat 模型
curl http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.2:3b",
    "messages": [{"role": "user", "content": "你好"}]
  }'

# 测试 Embedding 模型
curl http://localhost:11434/api/embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "model": "nomic-embed-text",
    "prompt": "日本交通法规"
  }'
```

**预期结果**：
- ✅ 所有服务启动成功
- ✅ 健康检查返回正常
- ✅ 问答接口返回答案
- ✅ Ollama 模型正常工作

---

## ✅ 预期结果

### 1. 架构完整性

- ✅ 独立的 `apps/local-ai-service` 服务
- ✅ 独立的端口 `8788`（不与 `apps/ai-service` 冲突）
- ✅ 修改现有路由 `/api/ai/ask` 支持无缝切换（主站）
- ✅ 独立的配置和环境变量

### 2. 功能完整性

- ✅ 本地AI服务可以独立运行
- ✅ 支持 RAG 检索（768维向量）
- ✅ 支持多语言问答（zh/ja/en）
- ✅ 健康检查接口正常
- ✅ 错误处理完善
- ✅ **无缝切换**：通过环境变量控制使用本地或在线AI服务
- ✅ **接口兼容**：响应格式与在线AI服务完全一致
- ✅ **前端无感**：前端代码完全不需要修改

### 3. 性能指标

- ✅ 服务启动时间：< 5秒
- ✅ 问答响应时间：< 5秒（本地网络）
- ✅ Embedding 生成时间：< 1秒
- ✅ RAG 检索时间：< 500ms

### 4. 独立性验证

- ✅ 不依赖 `apps/ai-service` 的代码
- ✅ 不共享配置文件
- ✅ 可以同时运行两个服务（8787 和 8788）
- ✅ 主站可以通过环境变量 `USE_LOCAL_AI` 无缝切换服务
- ✅ 前端代码完全不需要修改
- ✅ 接口格式完全兼容，支持无缝切换

---

## 📋 验证清单

执行完成后，请验证以下项目：

- [ ] Ollama 服务运行在 `localhost:11434`
- [ ] `llama3.2:3b` 和 `nomic-embed-text` 模型已下载
- [ ] 数据库迁移完成（`ai_vectors.embedding` 为 `vector(768)`）
- [ ] `apps/local-ai-service` 目录结构完整
- [ ] 所有 TypeScript 文件编译通过
- [ ] 本地AI服务启动在 `localhost:8788`
- [ ] 健康检查 `/healthz` 返回正常
- [ ] 问答接口 `/v1/ask` 返回答案
- [ ] 主站路由 `/api/ai/ask` 支持无缝切换到本地AI服务
- [ ] 通过环境变量 `USE_LOCAL_AI=true` 启用本地AI
- [ ] 前端调用 `/api/ai/ask` 正常工作（无需修改前端代码）
- [ ] 环境变量配置正确
- [ ] 日志输出正常

---

## 🎯 总结

### 核心要点

1. **完全独立**：本地AI服务与在线AI服务完全解耦
2. **方案A**：使用 `llama3.2:3b` + `nomic-embed-text`（768维）
3. **本地化**：所有AI处理都在本地完成，无需云端API
4. **无缝切换**：通过环境变量 `USE_LOCAL_AI=true` 控制切换，前端无需修改
5. **接口兼容**：本地AI服务响应格式与在线AI服务完全一致
6. **可扩展**：未来可以轻松切换模型或升级配置

### 注意事项

- ⚠️ 不要修改 `apps/ai-service` 的任何代码
- ⚠️ 确保端口不冲突（8787 vs 8788）
- ⚠️ 环境变量要区分（`LOCAL_AI_*` vs `AI_SERVICE_*`）
- ⚠️ 通过 `USE_LOCAL_AI=true` 启用本地AI服务
- ⚠️ 确保本地AI服务响应格式与在线AI服务完全一致
- ⚠️ 数据库迁移前确保数据已备份或为空

---

**文档创建时间**: 2025-01-15  
**最后更新**: 2025-01-15

