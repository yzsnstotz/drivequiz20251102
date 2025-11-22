// apps/ai-service/src/lib/rag.ts
/**
 * RAG 检索模块（Supabase pgvector）
 * - 生成查询文本的向量
 * - 调用 Supabase PostgREST RPC: match_documents
 * - 返回拼接后的参考上下文字符串（失败/未配置时降级为空）
 */

import type { ServiceConfig } from "../index.js";
import { getAiProviderFromConfig } from "./configLoader.js";
import { getOpenAIClient } from "./openaiClient.js";

type RagHit = {
  content: string;
  source?: string | null;
  score?: number | null;
};

/** 标准 SourceRef 类型（与接口规范对齐） */
export type SourceRef = {
  title: string;
  url: string;
  snippet?: string;
  docId?: string;
  score?: number;
  version?: string;
};

const DEFAULT_MATCH_COUNT = 5 as const;
const CONTEXT_CHAR_LIMIT = 4000 as const;
const EMBEDDING_MODEL = (process.env.EMBEDDING_MODEL || "text-embedding-3-small").trim();
// 优化：缩短超时时间到 5 秒，避免 RAG 检索阻塞主流程
const FETCH_TIMEOUT_MS = Number(process.env.RAG_FETCH_TIMEOUT_MS || 5000);

/** 统一语言规范化（默认 zh，仅接受 zh/ja/en） */
function normalizeLang(lang?: string): "zh" | "ja" | "en" {
  const v = (lang || "zh").toLowerCase().trim();
  return (["zh", "ja", "en"] as const).includes(v as any) ? (v as "zh" | "ja" | "en") : "zh";
}

/** 安全截断文本，避免超长输入 */
function safeSlice(s: string, max = 3000): string {
  return s.length > max ? s.slice(0, max) : s;
}

/** 生成查询向量（OpenAI Embeddings） */
async function embedQuery(
  config: ServiceConfig,
  text: string,
  aiProvider?: "openai" | "openrouter" | "gemini"
): Promise<number[]> {
  // 如果未提供 aiProvider，才从配置读取（避免重复查询）
  let provider = aiProvider || await getAiProviderFromConfig();
  // Gemini 不支持 embeddings，使用 OpenAI/OpenRouter
  if (provider === "gemini") {
    // 回退到 OpenAI 进行 embeddings
    provider = "openai" as const;
  }
  const openai = getOpenAIClient(config, provider);
  const input = safeSlice(text, 3000);
  try {
    const resp = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input,
    });
    const vec = resp.data?.[0]?.embedding;
    if (!vec || !Array.isArray(vec)) throw new Error("Empty embedding result");
    return vec as number[];
  } catch (e) {
    throw new Error(`Embedding failed: ${(e as Error).message}`);
  }
}

/** 调用 Supabase RPC：match_documents */
async function callSupabaseMatch(
  config: ServiceConfig,
  queryEmbedding: number[],
  lang: string,
  matchCount: number = DEFAULT_MATCH_COUNT
): Promise<RagHit[]> {
  // 基础配置缺失 → 直接降级为空（由上层兜底）
  if (!config.supabaseUrl || !config.supabaseServiceKey) return [];

  const url = `${config.supabaseUrl.replace(/\/+$/, "")}/rest/v1/rpc/match_documents`;
  const body = {
    query_embedding: queryEmbedding,
    match_count: Math.max(1, Math.min(10, matchCount)),
    lang: normalizeLang(lang),
  };

  const headers: Record<string, string> = {
    "content-type": "application/json",
    apikey: config.supabaseServiceKey,
    authorization: `Bearer ${config.supabaseServiceKey}`,
    accept: "application/json",
  };

  // 超时控制
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: ac.signal,
    });

    if (res.status === 404) {
      // RPC 不存在 → 返回空结果
      return [];
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Supabase RPC error ${res.status}: ${text}`);
    }
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) return [];
    // 仅挑选需要字段，容错未知字段
    return (data as RagHit[]).map((d) => ({
      content: String((d as RagHit).content || ""),
      source: (d as RagHit).source ?? null,
      score: typeof (d as RagHit).score === "number" ? (d as RagHit).score : null,
    }));
  } finally {
    clearTimeout(timer);
  }
}

/** 将命中结果拼接为上下文，带来源标注并限制长度 */
function buildContext(hits: RagHit[]): string {
  if (!hits.length) return "";
  const parts: string[] = [];
  for (const h of hits) {
    const src = h.source ? `【来源:${h.source}】` : "";
    const sc = typeof h.score === "number" ? `（相关度:${h.score.toFixed(3)}）` : "";
    const chunk = `${src}${sc}\n${String(h.content || "").trim()}`;
    parts.push(chunk);
    // 轻量提前截断，避免无谓拼接
    const tmp = parts.join("\n\n---\n\n");
    if (tmp.length >= CONTEXT_CHAR_LIMIT) {
      return tmp.slice(0, CONTEXT_CHAR_LIMIT);
    }
  }
  const joined = parts.join("\n\n---\n\n");
  return joined.length > CONTEXT_CHAR_LIMIT ? joined.slice(0, CONTEXT_CHAR_LIMIT) : joined;
}

/**
 * 对外入口：获取检索上下文
 * - 无 Supabase 配置或 RPC 缺失/失败 → 返回空字符串
 * @param aiProvider 可选的 AI 提供商，避免重复查询配置
 */
export async function getRagContext(
  question: string,
  lang = "zh",
  config?: ServiceConfig,
  aiProvider?: "openai" | "openrouter" | "gemini"
): Promise<string> {
  try {
    if (!config) return "";
    const embedding = await embedQuery(config, question, aiProvider);
    const hits = await callSupabaseMatch(config, embedding, lang, DEFAULT_MATCH_COUNT);
    return buildContext(hits);
  } catch {
    // 安全降级，不阻断主流程
    return "";
  }
}

/**
 * RAG 检索函数（导出）
 * @param question 查询问题
 * @param topK 返回结果数量（默认 3）
 * @param threshold 相似度阈值（默认 0.75）
 * @returns SourceRef[] 标准来源引用数组
 */
export async function ragSearch(
  question: string,
  topK = 3,
  threshold = 0.75,
  config?: ServiceConfig,
  aiProvider?: "openai" | "openrouter" | "gemini"
): Promise<SourceRef[]> {
  try {
    if (!config) return [];

    // 1) 生成查询向量
    const embedding = await embedQuery(config, question, aiProvider);

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
