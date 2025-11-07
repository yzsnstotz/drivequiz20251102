// apps/local-ai-service/src/routes/ragIngest.ts
/**
 * Local AI Service
 * RAG Document Ingestion API
 *
 * POST /v1/admin/rag/ingest
 * - 服务侧鉴权：Authorization: Bearer <SERVICE_TOKEN>
 * - 接收文档内容，执行：分片→嵌入（Ollama）→批量写 ai_vectors → 统计 chunks
 * - 返回统一结构：{ ok, data | errorCode, message }
 *
 * 实现要点：
 * - 文本分片：每片 500-800 字符
 * - 嵌入模型：nomic-embed-text（768 维）
 * - 批量写入：通过 Supabase REST API
 * - 更新 ai_rag_docs.chunks 统计
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { LocalAIConfig } from "../lib/config.js";
import { ensureServiceAuth } from "../middlewares/auth.js";
import { callOllamaEmbedding } from "../lib/ollamaClient.js";

// 统一响应类型
type Ok<T> = { ok: true; data: T };
type ErrCode = "AUTH_REQUIRED" | "FORBIDDEN" | "VALIDATION_FAILED" | "PROVIDER_ERROR" | "INTERNAL_ERROR";
type Err = { ok: false; errorCode: ErrCode; message: string; details?: unknown };

type IngestBody = {
  docId?: string;
  title?: string;
  url?: string;
  content?: string;
  version?: string;
  lang?: string;
  meta?: Record<string, unknown>;
};

const CHUNK_MIN_SIZE = 500;
const CHUNK_MAX_SIZE = 800;
const CHUNK_OVERLAP = 100; // 重叠字符数，避免截断句子

/** 文本分片（每片 500-800 字符，带重叠） */
function chunkText(text: string): string[] {
  if (!text || text.length === 0) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    // 计算本片结束位置（尝试在句子边界截断）
    let end = Math.min(start + CHUNK_MAX_SIZE, text.length);

    // 如果未到文本末尾，尝试在句号、换行符等位置截断
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf(".", end);
      const lastNewline = text.lastIndexOf("\n", end);
      const lastSpace = text.lastIndexOf(" ", end);
      const breakPoint = Math.max(lastPeriod, lastNewline, lastSpace);
      if (breakPoint > start + CHUNK_MIN_SIZE) {
        end = breakPoint + 1;
      }
    }

    const chunk = text.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    // 下一片起始位置：重叠处理
    start = Math.max(start + 1, end - CHUNK_OVERLAP);
  }

  return chunks;
}

/** 生成嵌入向量（使用 Ollama） */
async function createEmbedding(
  config: LocalAIConfig,
  text: string,
): Promise<number[]> {
  try {
    const embedding = await callOllamaEmbedding(text);
    
    // 验证维度（nomic-embed-text 应该是 768 维）
    if (embedding.length !== 768) {
      throw new Error(`Embedding dimension mismatch: expected 768, got ${embedding.length}`);
    }
    
    return embedding;
  } catch (e) {
    throw new Error(`Embedding failed: ${(e as Error).message}`);
  }
}

/** 批量写入 ai_vectors */
async function insertVectors(
  config: LocalAIConfig,
  vectors: Array<{
    docId: string;
    content: string;
    embedding: number[];
    sourceTitle: string;
    sourceUrl: string;
    version: string;
  }>,
): Promise<void> {
  const SUPABASE_URL = config.supabaseUrl;
  const SUPABASE_SERVICE_KEY = config.supabaseServiceKey;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error("Missing Supabase configuration");
  }

  // 转换为数据库格式（pgvector 需要 JSON 数组格式）
  const payload = vectors.map((v) => ({
    doc_id: v.docId,
    content: v.content,
    embedding: v.embedding, // pgvector 接受 JSON 数组
    source_title: v.sourceTitle,
    source_url: v.sourceUrl || null,
    version: v.version,
  }));

  // 分批写入（每批最多 100 条）
  const batchSize = 100;
  for (let i = 0; i < payload.length; i += batchSize) {
    const batch = payload.slice(i, i + batchSize);
    try {
      const res = await fetch(`${SUPABASE_URL.replace(/\/+$/, "")}/rest/v1/ai_vectors`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(batch),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Supabase insert failed: ${res.status} ${text}`);
      }
    } catch (e) {
      throw e;
    }
  }
}

/** 更新 ai_rag_docs.chunks 统计 */
async function updateDocChunks(
  config: LocalAIConfig,
  docId: string,
  chunksCount: number,
): Promise<void> {
  const SUPABASE_URL = config.supabaseUrl;
  const SUPABASE_SERVICE_KEY = config.supabaseServiceKey;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return; // 静默失败，不影响主流程
  }

  try {
    const res = await fetch(
      `${SUPABASE_URL.replace(/\/+$/, "")}/rest/v1/ai_rag_docs?id=eq.${encodeURIComponent(docId)}`,
      {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ chunks: chunksCount }),
      },
    );

    if (!res.ok) {
      // Silent failure
    }
  } catch (e) {
    // Silent failure
  }
}

export default async function ragIngestRoute(app: FastifyInstance): Promise<void> {
  app.post(
    "/v1/admin/rag/ingest",
    async (
      request: FastifyRequest<{ Body: IngestBody }>,
      reply: FastifyReply,
    ): Promise<void> => {
      const config = app.config as LocalAIConfig;

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

        // 4) 批量生成嵌入（使用 Ollama）
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
            // 继续处理其他 chunk，不阻断
            console.error(`Failed to create embedding for chunk: ${(e as Error).message}`);
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

