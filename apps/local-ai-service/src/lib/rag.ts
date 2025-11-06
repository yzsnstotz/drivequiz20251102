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
    // RAG 检索失败不影响主流程，仅记录错误
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
    // RAG 上下文获取失败不影响主流程，仅记录错误
    return "";
  }
}

