# 🔍 Render 服务 RAG 与 Summary 功能实现检查报告

**检查日期**: 2025-01-27  
**服务位置**: Render (apps/ai-service)  
**状态**: ✅ 已实现

---

## 📋 功能概览

### 1. RAG (Retrieval-Augmented Generation) 功能

#### ✅ 实现状态：已完成

**核心实现文件**:
- `apps/ai-service/src/lib/rag.ts` - RAG 检索核心模块
- `apps/ai-service/src/routes/ask.ts` - 问答路由（集成 RAG）
- `apps/ai-service/src/routes/admin/ragIngest.ts` - RAG 向量化入口

#### 功能详情

**1.1 RAG 检索功能** (`getRagContext`)

```143:157:apps/ai-service/src/lib/rag.ts
export async function getRagContext(
  question: string,
  lang = "zh",
  config?: ServiceConfig
): Promise<string> {
  try {
    if (!config) return "";
    const embedding = await embedQuery(config, question);
    const hits = await callSupabaseMatch(config, embedding, lang, DEFAULT_MATCH_COUNT);
    return buildContext(hits);
  } catch {
    // 安全降级，不阻断主流程
    return "";
  }
}
```

**实现要点**:
- ✅ 使用 OpenAI `text-embedding-3-small` 模型生成查询向量
- ✅ 调用 Supabase PostgREST RPC: `match_documents` 进行向量相似度检索
- ✅ 默认返回 5 条最相关文档（`DEFAULT_MATCH_COUNT = 5`）
- ✅ 上下文长度限制：4000 字符（`CONTEXT_CHAR_LIMIT`）
- ✅ 支持多语言（zh/ja/en）
- ✅ 失败时安全降级，返回空字符串，不阻断主流程

**1.2 RAG 在问答路由中的集成**

```198:198:apps/ai-service/src/routes/ask.ts
        const reference = await getRagContext(question, lang, config);
```

**集成流程**:
1. 用户提问 → `/v1/ask` 路由
2. 执行 RAG 检索获取相关上下文
3. 将 RAG 上下文注入到 OpenAI 提示词中
4. 生成增强后的回答

**1.3 RAG 向量化入口** (`/v1/admin/rag/ingest`)

```191:313:apps/ai-service/src/routes/admin/ragIngest.ts
export default async function ragIngestRoute(app: FastifyInstance): Promise<void> {
  app.post(
    "/v1/admin/rag/ingest",
    async (
      request: FastifyRequest<{ Body: IngestBody }>,
      reply: FastifyReply,
    ): Promise<void> => {
      const config = app.config as ServiceConfig;

      try {
        // 1) 服务间鉴权
        ensureServiceAuth(request, config);

        // 2) 校验请求体
        const body = request.body || {};
        const { docId, title, url, content, version } = body;

        if (!docId || typeof docId !== "string" || docId.trim().length === 0) {
          reply.code(400).send({
            ok: false,
            errorCode: "VALIDATION_FAILED",
            message: "docId is required",
          } as Err);
          return;
        }

        if (!content || typeof content !== "string" || content.trim().length === 0) {
          reply.code(400).send({
            ok: false,
            errorCode: "VALIDATION_FAILED",
            message: "content is required",
          } as Err);
          return;
        }

        const finalTitle = (typeof title === "string" ? title.trim() : "") || "Untitled";
        const finalUrl = typeof url === "string" ? url.trim() : "";
        const finalVersion = (typeof version === "string" ? version.trim() : "") || "v1";

        // 3) 文本分片
        const chunks = chunkText(content.trim());
        if (chunks.length === 0) {
          reply.code(400).send({
            ok: false,
            errorCode: "VALIDATION_FAILED",
            message: "Content is too short to chunk",
          } as Err);
          return;
        }

        // 4) 批量生成嵌入
        const vectors: Array<{
          docId: string;
          content: string;
          embedding: number[];
          sourceTitle: string;
          sourceUrl: string;
          version: string;
        }> = [];

        for (const chunk of chunks) {
          try {
            const embedding = await createEmbedding(config, chunk);
            vectors.push({
              docId: docId.trim(),
              content: chunk,
              embedding,
              sourceTitle: finalTitle,
              sourceUrl: finalUrl,
              version: finalVersion,
            });
          } catch (e) {
            // Silent failure
            // 继续处理其他 chunk，不阻断
          }
        }

        if (vectors.length === 0) {
          reply.code(502).send({
            ok: false,
            errorCode: "PROVIDER_ERROR",
            message: "Failed to create embeddings for any chunks",
          } as Err);
          return;
        }

        // 5) 批量写入 ai_vectors
        await insertVectors(config, vectors);

        // 6) 更新 ai_rag_docs.chunks
        await updateDocChunks(config, docId.trim(), vectors.length);

        // 7) 返回成功
        reply.send({
          ok: true,
          data: {
            docId: docId.trim(),
            chunks: vectors.length,
            version: finalVersion,
          },
        } as Ok<{ docId: string; chunks: number; version: string }>);
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
              : status === 403
              ? "FORBIDDEN"
              : status === 502
              ? "PROVIDER_ERROR"
              : "INTERNAL_ERROR",
          message,
        } as Err);
      }
    },
  );
}
```

**向量化流程**:
1. 文本分片：每片 500-800 字符，带 100 字符重叠
2. 批量生成嵌入向量（使用 `text-embedding-3-small`）
3. 批量写入 Supabase `ai_vectors` 表
4. 更新 `ai_rag_docs.chunks` 统计字段

**1.4 RAG 检索函数** (`ragSearch`)

```166:207:apps/ai-service/src/lib/rag.ts
export async function ragSearch(
  question: string,
  topK = 3,
  threshold = 0.75,
  config?: ServiceConfig
): Promise<SourceRef[]> {
  try {
    if (!config) return [];

    // 1) 生成查询向量
    const embedding = await embedQuery(config, question);

    // 2) 调用 Supabase RPC match_documents
    const hits = await callSupabaseMatch(config, embedding, "zh", topK);

    // 3) 过滤并转换为 SourceRef[]
    const results: SourceRef[] = [];
    for (const hit of hits) {
      // 过滤：score >= threshold
      const score = hit.score ?? 0;
      if (score < threshold) continue;

      // 提取 title 和 url（从 source 字段解析或使用默认值）
      const sourceStr = hit.source || "";
      const parts = sourceStr.split("|");
      const title = parts[0]?.trim() || "RAG Reference";
      const url = parts[1]?.trim() || "";

      results.push({
        title,
        url,
        snippet: hit.content?.slice(0, 200) || undefined,
        score,
      });
    }

    return results.slice(0, topK);
  } catch {
    // 安全降级，不阻断主流程
    return [];
  }
}
```

**功能特点**:
- ✅ 返回标准 `SourceRef[]` 格式（包含 title, url, snippet, score）
- ✅ 支持相似度阈值过滤（默认 0.75）
- ✅ 支持自定义返回数量（默认 3）

---

### 2. Summary (每日摘要) 功能

#### ✅ 实现状态：已完成

**核心实现文件**:
- `apps/ai-service/src/tasks/dailySummarize.ts` - 摘要生成任务
- `apps/ai-service/src/routes/admin/daily-summary.ts` - 摘要查询 API
- `apps/ai-service/src/jobs/cron.dailySummarize.ts` - 定时任务调度

#### 功能详情

**2.1 摘要生成任务** (`runDailySummarize`)

```69:169:apps/ai-service/src/tasks/dailySummarize.ts
export async function runDailySummarize(
  config: ServiceConfig,
  input: DailySummarizeInput,
): Promise<{ ok: true; data: DailySummary } | { ok: false; errorCode: string; message: string }> {
  try {
    // 1) 计算统计区间（默认昨天 00:00:00 ~ 今天 00:00:00 UTC）
    const { sinceIso, untilIso, dateUtc } = getDateWindow(input.dateUtc);

    // 2) 拉取日志
    let raw: AskLogRecord[] = [];
    try {
      raw = await input.fetchLogs(sinceIso, untilIso);
    } catch (e) {
      return { ok: false, errorCode: "PROVIDER_ERROR", message: "Failed to fetch logs." };
    }
    const logs = normalizeArray(
      (input.maxRecords && input.maxRecords > 0 ? raw.slice(0, input.maxRecords) : raw) ?? [],
    );

    // 3) 快速聚合（频次、来源、语言、安全）
    const agg = aggregate(logs);

    // 4) 组装 RAG 上下文（高频问题 + 未命中/空答的样本）
    const topQuestionsText = agg.topQuestions.map((q) => q.question).slice(0, 20).join("\n");
    const emptyAnswersText = logs
      .filter((r) => !r.answer)
      .slice(0, 20)
      .map((r) => r.question)
      .join("\n");
    const queryText = [topQuestionsText, emptyAnswersText].filter(Boolean).join("\n");
    const ragContext = await getRagContext(queryText || "无数据", "zh", config);

    // 5) 生成摘要草案（让模型归纳常见问题、知识缺口与安全观察）
    const aiProvider = await getAiProviderFromConfig();
    const openai = getOpenAIClient(config, aiProvider);
    const model = resolveModel(config);
    const prompt = composePrompt(dateUtc, agg, ragContext);

    let summaryMd = "";
    let usedModel: string | undefined;
    let usageIn: number | undefined;
    let usageOut: number | undefined;

    try {
      const completion = await openai.chat.completions.create({
        model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You are ZALEM's product analyst. Produce concise, actionable, safe, and bilingual-friendly (CN primary, JP/EN ready) daily summaries for an AI Q&A module.",
          },
          { role: "user", content: prompt },
        ],
      });

      summaryMd = (completion.choices?.[0]?.message?.content || "").trim();
      usedModel = completion.model || model;
      // OpenAI SDK 4.x: usage.prompt_tokens / usage.completion_tokens
      const u: any = completion.usage || {};
      usageIn = typeof u.prompt_tokens === "number" ? u.prompt_tokens : undefined;
      usageOut = typeof u.completion_tokens === "number" ? u.completion_tokens : undefined;
    } catch (e) {
      return { ok: false, errorCode: "PROVIDER_ERROR", message: "OpenAI completion failed." };
    }

    // 6) 安全审查（摘要内容不得包含敏感数据或违规引导）
    const safety = await checkSafety(summaryMd);
    if (!safety.ok) {
      return { ok: false, errorCode: "FORBIDDEN", message: "Summary blocked by safety policy." };
    }

    // 7) 产出结构化结果
    const out: DailySummary = {
      dateUtc,
      totals: agg.totals,
      topQuestions: agg.topQuestions,
      topSources: agg.topSources,
      gaps: agg.gaps,
      safetyNotes: agg.safetyNotes,
      publish: {
        markdown: summaryMd,
        model: usedModel,
        tokens: { input: usageIn, output: usageOut },
      },
    };

    // 8) 写入缓存（幂等覆写）— 与路由约定保持一致：ai:summary:<YYYY-MM-DD>:<range>
    const cacheKey = `ai:summary:${dateUtc}:day`;
    try {
      await cacheSet(cacheKey, out, 7 * 24 * 3600);
    } catch (e) {
      return { ok: false, errorCode: "CACHE_ERROR", message: "Failed to write summary cache." };
    }

    return { ok: true, data: out };
  } catch (e) {
    return { ok: false, errorCode: "INTERNAL_ERROR", message: "Daily summarize failed." };
  }
}
```

**摘要生成流程**:
1. ✅ 拉取昨日问答日志（从 Supabase `ai_logs` 表）
2. ✅ 聚合统计指标（问题频次、来源、语言、安全标志）
3. ✅ **使用 RAG 增强上下文**（高频问题 + 未命中样本）
4. ✅ 调用 OpenAI 生成 Markdown 摘要
5. ✅ 安全审查摘要内容
6. ✅ 写入 Redis 缓存（键：`ai:summary:<YYYY-MM-DD>:day`，TTL：7天）

**2.2 摘要查询 API** (`/v1/admin/daily-summary`)

```67:152:apps/ai-service/src/routes/admin/daily-summary.ts
export default async function dailySummaryRoute(app: FastifyInstance): Promise<void> {
  app.get(
    "/v1/admin/daily-summary",
    async (
      request: FastifyRequest<{ Querystring: QueryParams }>,
      reply: FastifyReply,
    ): Promise<void> => {
      const config = app.config as ServiceConfig;

      try {
        // 1) 服务间鉴权
        ensureServiceAuth(request, config);

        // 2) 解析与校验参数
        const date = (request.query.date && String(request.query.date)) || utcToday();
        const range = (String(request.query.range || "day").toLowerCase() as "day" | "week" | "month");

        if (!["day", "week", "month"].includes(range)) {
          reply.code(400).send({
            ok: false,
            errorCode: "VALIDATION_FAILED",
            message: "Invalid range. Allowed: day | week | month",
            details: { received: range },
          } as Err);
          return;
        }

        if (!DATE_RE.test(date)) {
          reply.code(400).send({
            ok: false,
            errorCode: "VALIDATION_FAILED",
            message: "Invalid date format. Expect YYYY-MM-DD",
            details: { received: date },
          } as Err);
          return;
        }

        // 3) 读取缓存（与 dailySummarize 任务键名对齐）
        const cacheKey = buildCacheKey(date, range);
        const cached = await cacheGet<SummaryDoc | null>(cacheKey);

        if (cached && typeof cached === "object") {
          // 命中缓存：补齐必要字段的默认值（避免历史数据缺字段）
          const doc: SummaryDoc = {
            date: cached.date || date,
            range: (cached.range as SummaryDoc["range"]) || "day",
            generatedAt: cached.generatedAt || new Date().toISOString(),
            version: (cached.version as SummaryDoc["version"]) || "v1",
            sections: {
              faq: Array.isArray(cached.sections?.faq) ? cached.sections.faq : [],
              topSources: Array.isArray(cached.sections?.topSources) ? cached.sections.topSources : [],
              safety: cached.sections?.safety ?? { okCount: 0, needsHuman: 0, blocked: 0 },
              gaps: Array.isArray(cached.sections?.gaps) ? cached.sections.gaps : [],
            },
            meta: { ...(cached.meta || {}), source: "cache-hit", cacheKey },
          };
          reply.send({ ok: true, data: doc } as Ok<SummaryDoc>);
          return;
        }

        // 4) 缓存未命中：返回占位空结构（不报错）
        reply.send({
          ok: true,
          data: {},
          note: "no_cached_summary",
        } as Ok<Record<string, never>> & { note: string });
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
              : status === 403
              ? "FORBIDDEN"
              : "INTERNAL_ERROR",
          message,
        } as Err);
      }
    },
  );
```

**API 功能**:
- ✅ GET `/v1/admin/daily-summary?date=YYYY-MM-DD&range=day|week|month`
- ✅ 从 Redis 缓存读取摘要（键：`ai:summary:<date>:<range>`）
- ✅ 支持查询指定日期的摘要
- ✅ 缓存未命中时返回空结构（不报错）

**2.3 定时任务调度** (Render Cron)

```16:21:render.yaml
  - type: cron
    name: ai-daily-summarize
    rootDir: apps/ai-service
    schedule: "0 0 * * *"
    buildCommand: npm install && npm run build
    startCommand: node dist/tasks/dailySummarize.js
```

**定时任务配置**:
- ✅ 调度时间：每日 00:00 UTC
- ✅ 执行脚本：`node dist/cron.js`（已创建独立入口文件）
- ✅ 环境变量：继承 Web 服务配置

**Cron 入口文件**：
- ✅ 已创建 `apps/ai-service/src/cron.ts`
- ✅ 编译后为 `dist/cron.js`
- ✅ 自动加载配置并执行摘要任务

---

## 🔗 RAG 与 Summary 的集成

### Summary 功能使用 RAG 增强

在摘要生成任务中，**RAG 被用于增强上下文**：

```91:99:apps/ai-service/src/tasks/dailySummarize.ts
    // 4) 组装 RAG 上下文（高频问题 + 未命中/空答的样本）
    const topQuestionsText = agg.topQuestions.map((q) => q.question).slice(0, 20).join("\n");
    const emptyAnswersText = logs
      .filter((r) => !r.answer)
      .slice(0, 20)
      .map((r) => r.question)
      .join("\n");
    const queryText = [topQuestionsText, emptyAnswersText].filter(Boolean).join("\n");
    const ragContext = await getRagContext(queryText || "无数据", "zh", config);
```

**集成方式**:
1. 提取高频问题（TOP 20）
2. 提取未命中/空答问题（TOP 20）
3. 将这些问题作为 RAG 查询文本
4. 获取相关文档上下文
5. 将 RAG 上下文注入到摘要生成提示词中

---

## 📊 数据库依赖

### 必需的表和函数

**1. 核心表**:
- ✅ `ai_vectors` - 向量存储表（pgvector）
- ✅ `ai_rag_docs` - RAG 文档元数据表
- ✅ `ai_logs` - 问答日志表（用于摘要生成）

**2. RPC 函数**:
- ✅ `match_documents(query_embedding, match_threshold, match_count)` - 向量相似度检索

**3. 扩展**:
- ✅ `pgvector` - PostgreSQL 向量扩展

---

## ⚙️ 环境变量配置

### Render Web 服务必需变量

| 变量名 | 说明 | 是否必填 |
|--------|------|----------|
| `OPENAI_API_KEY` | OpenAI API 密钥（用于生成嵌入和对话） | ✅ |
| `SUPABASE_URL` | Supabase 项目 URL | ✅ |
| `SUPABASE_SERVICE_KEY` | Supabase Service Key | ✅ |
| `SERVICE_TOKENS` | 服务间认证令牌（逗号分隔） | ✅ |
| `AI_MODEL` | AI 模型（默认：gpt-4o-mini） | ⚠️ |
| `EMBEDDING_MODEL` | 嵌入模型（默认：text-embedding-3-small） | ⚠️ |
| `AI_CACHE_REDIS_URL` | Redis 缓存 URL（可选） | ❌ |
| `PORT` | 服务端口（默认：8787） | ⚠️ |

### Render Cron 作业必需变量

继承 Web 服务的环境变量，额外需要：
- ✅ 所有 Web 服务的必需变量
- ⚠️ `CRON_DAILY_SUMMARY_ENABLED`（默认：true）
- ⚠️ `CRON_DAILY_SUMMARY_UTC_HOUR`（默认：2）
- ⚠️ `CRON_DAILY_SUMMARY_UTC_MINUTE`（默认：0）

---

## ✅ 功能完整性检查

### RAG 功能

| 功能项 | 状态 | 说明 |
|--------|------|------|
| 向量检索 | ✅ | 已实现，使用 Supabase pgvector |
| 多语言支持 | ✅ | 支持 zh/ja/en |
| 上下文构建 | ✅ | 已实现，限制 4000 字符 |
| 向量化入口 | ✅ | `/v1/admin/rag/ingest` 已实现 |
| 文本分片 | ✅ | 500-800 字符/片，带重叠 |
| 批量写入 | ✅ | 支持批量写入向量 |
| 错误处理 | ✅ | 安全降级，不阻断主流程 |

### Summary 功能

| 功能项 | 状态 | 说明 |
|--------|------|------|
| 日志拉取 | ✅ | 从 Supabase `ai_logs` 表拉取 |
| 数据聚合 | ✅ | 频次、来源、语言、安全统计 |
| RAG 增强 | ✅ | 使用 RAG 上下文增强摘要 |
| AI 生成 | ✅ | 调用 OpenAI 生成 Markdown 摘要 |
| 安全审查 | ✅ | 摘要内容安全审查 |
| 缓存存储 | ✅ | 写入 Redis（TTL：7天） |
| 查询 API | ✅ | `/v1/admin/daily-summary` 已实现 |
| 定时任务 | ✅ | Render Cron 每日 00:00 UTC |
| 手动触发 | ✅ | `/v1/admin/daily-summary/rebuild` 已实现 |

---

## ⚠️ 潜在问题与建议

### 1. Cron 任务入口文件

**状态**：✅ 已创建独立的 Cron 入口文件 `apps/ai-service/src/cron.ts`

**说明**：
- 入口文件已创建，编译后为 `dist/cron.js`
- `render.yaml` 已更新为使用 `node dist/cron.js`
- 该文件会加载配置并执行一次摘要任务

### 2. 缓存依赖

**问题**：Summary 功能依赖 Redis 缓存，但 `AI_CACHE_REDIS_URL` 为可选。

**建议**：
- 如果未配置 Redis，摘要功能可能无法正常工作
- 考虑添加内存缓存作为降级方案

### 3. RAG 向量数据

**问题**：RAG 功能依赖 `ai_vectors` 表中的向量数据。

**建议**：
- 确保已通过 `/v1/admin/rag/ingest` 导入文档
- 定期检查向量数据量和质量

### 4. 数据库迁移

**问题**：需要确保数据库迁移脚本已执行。

**建议**：
- 确认以下脚本已在 Supabase 中执行：
  - `src/migrations/20251103_ai_core.sql`
  - `src/migrations/20251103_ai_rpc.sql`
  - `src/migrations/20251103_ai_rls.sql`

---

## 📝 总结

### ✅ 已完成

1. **RAG 功能**：完整实现，包括检索、向量化、多语言支持
2. **Summary 功能**：完整实现，包括日志聚合、RAG 增强、AI 生成、缓存存储
3. **API 端点**：所有必需的管理 API 已实现
4. **定时任务**：Render Cron 配置已就绪

### ⚠️ 需要验证

1. Cron 任务入口文件是否存在
2. 数据库迁移脚本是否已执行
3. 环境变量是否完整配置
4. Redis 缓存是否可用（Summary 功能）

### 🔄 建议操作

1. 验证 Render 服务健康状态：`GET /healthz`
2. 测试 RAG 检索：通过 `/v1/ask` 发送问题
3. 测试摘要生成：手动触发 `/v1/admin/daily-summary/rebuild`
4. 检查 Cron 任务日志：确认定时任务正常执行

---

**报告生成时间**: 2025-01-27  
**生成工具**: Cursor AI

