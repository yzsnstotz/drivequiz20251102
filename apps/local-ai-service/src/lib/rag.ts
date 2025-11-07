/**
 * RAG 检索模块（Supabase pgvector，768维）
 * 使用 Ollama nomic-embed-text 生成向量
 */

import { callOllamaEmbedding } from "./ollamaClient.js";
import { logger } from "./logger.js";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
// 优化参数：增加检索数量以获得更好的上下文关联
const DEFAULT_MATCH_COUNT = 7; // 从5增加到7，获取更多相关上下文
const CONTEXT_CHAR_LIMIT = 4000;
// 相似度阈值：降低阈值以获取更多相关但相似度稍低的内容
const DEFAULT_MATCH_THRESHOLD = 0.65; // 从0.75降低到0.65，平衡相关性和数量

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
  matchCount: number = DEFAULT_MATCH_COUNT,
  matchThreshold: number = DEFAULT_MATCH_THRESHOLD
): Promise<RagHit[]> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return [];

  const url = `${SUPABASE_URL.replace(/\/+$/, "")}/rest/v1/rpc/match_documents`;
  const body = {
    query_embedding: queryEmbedding,
    match_threshold: matchThreshold,
    match_count: Math.max(1, Math.min(10, matchCount)),
  };

  const headers: Record<string, string> = {
    "content-type": "application/json",
    apikey: SUPABASE_SERVICE_KEY,
    authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    accept: "application/json",
  };

  try {
    const startedAt = Date.now();
    logger.info(
      {
        event: "rag.supabase.request",
        matchCount,
        matchThreshold,
        lang,
      },
      "调用 Supabase match_documents"
    );
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

    const hits = (data as RagHit[]).map((d) => ({
      content: String(d.content || ""),
      source_title: d.source_title ?? null,
      source_url: d.source_url ?? null,
      similarity: typeof d.similarity === "number" ? d.similarity : null,
    }));

    logger.info(
      {
        event: "rag.supabase.success",
        durationMs: Date.now() - startedAt,
        matchCount: hits.length,
        lang,
      },
      "Supabase match_documents 返回结果"
    );

    return hits;
  } catch (error) {
    // RAG 检索失败不影响主流程，仅记录错误
    logger.error(
      {
        event: "rag.supabase.error",
        lang,
        error: error instanceof Error ? error.message : String(error),
      },
      "Supabase match_documents 调用失败"
    );
    return [];
  }
}

/**
 * 构建上下文字符串
 * 优化：按相似度排序，优先使用高相关度的内容
 */
function buildContext(hits: RagHit[]): string {
  if (!hits.length) return "";

  // 按相似度降序排序（相似度高的在前）
  const sortedHits = [...hits].sort((a, b) => {
    const simA = a.similarity ?? 0;
    const simB = b.similarity ?? 0;
    return simB - simA;
  });

  const parts: string[] = [];
  for (const h of sortedHits) {
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
 * 优化：根据问题长度动态调整检索参数
 */
export async function getRagContext(
  question: string,
  lang: string = "zh"
): Promise<string> {
  try {
    const startedAt = Date.now();
    logger.info(
      {
        event: "rag.context.start",
        questionLength: question.length,
        lang,
      },
      "开始生成 RAG 上下文"
    );
    // 1. 生成查询向量（768维）
    const embedStartedAt = Date.now();
    const embedding = await callOllamaEmbedding(question);
    logger.info(
      {
        event: "rag.embedding.success",
        durationMs: Date.now() - embedStartedAt,
        vectorLength: embedding.length,
        lang,
      },
      "生成查询向量完成"
    );

    // 2. 根据问题复杂度动态调整检索参数
    // 问题越长或越复杂，检索更多相关内容
    const questionLength = question.length;
    let matchCount = DEFAULT_MATCH_COUNT;
    let matchThreshold = DEFAULT_MATCH_THRESHOLD;
    
    if (questionLength > 100) {
      // 长问题：增加检索数量，稍微降低阈值
      matchCount = 8;
      matchThreshold = 0.63;
    } else if (questionLength < 20) {
      // 短问题：减少检索数量，提高阈值（更精确）
      matchCount = 5;
      matchThreshold = 0.68;
    }

    // 3. 调用 Supabase RPC 检索
    const hits = await callSupabaseMatch(embedding, lang, matchCount, matchThreshold);

    // 4. 过滤低质量结果（相似度太低的内容可能不相关）
    const filteredHits = hits.filter((h) => {
      const sim = h.similarity ?? 0;
      // 只保留相似度 >= 0.6 的结果（确保基本相关性）
      return sim >= 0.6;
    });
    // 5. 构建上下文
    const context = buildContext(filteredHits);
    logger.info(
      {
        event: "rag.context.success",
        durationMs: Date.now() - startedAt,
        lang,
        originalHits: hits.length,
        filteredHits: filteredHits.length,
        contextLength: context.length,
      },
      "生成 RAG 上下文完成"
    );
    return context;
  } catch (error) {
    // RAG 上下文获取失败不影响主流程，仅记录错误
    logger.error(
      {
        event: "rag.context.error",
        lang,
        error: error instanceof Error ? error.message : String(error),
      },
      "生成 RAG 上下文失败"
    );
    return "";
  }
}

