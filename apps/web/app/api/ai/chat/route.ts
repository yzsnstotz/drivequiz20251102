// apps/web/app/api/ai/chat/route.ts
import { NextRequest, NextResponse } from "next/server";

// 运行配置（动态渲染，服务端执行）
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** === 环境变量（遵循《🛠️ 研发规范 v1.0》命名） ===
 *  AI_SERVICE_URL        e.g. https://ai.example.com/v1
 *  AI_SERVICE_TOKEN      与 AI-Service 的 Service Token 对齐
 *  SUPABASE_URL          Supabase 项目 URL
 *  SUPABASE_SERVICE_KEY  Supabase 服务密钥（仅服务端）
 */
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "";
const AI_SERVICE_TOKEN = process.env.AI_SERVICE_TOKEN || "";
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";

// 统一响应类型（与《📐 接口与命名规范 v1.0》对齐）
type Ok<T> = { ok: true; data: T; pagination?: never };
type Err = {
  ok: false;
  errorCode:
    | "AUTH_REQUIRED"
    | "VALIDATION_FAILED"
    | "PROVIDER_ERROR"
    | "INTERNAL_ERROR"
    | "FORBIDDEN"
    | "RATE_LIMIT_EXCEEDED"
    | "CONTENT_BLOCKED";
  message: string;
};

// 前端传入体
type AskBody = {
  question?: string;
  userId?: string;
  lang?: string; // "zh" | "ja" | "en" | ...
};

// 兼容 AI-Service 两种返回结构
type AiServiceDataA = {
  answer: string;
  sources?: Array<{ title: string; url: string; snippet?: string }>;
  model: string;
  safetyFlag?: "ok" | "needs_human" | "blocked";
  costEstimate?: { inputTokens?: number; outputTokens?: number; approxUsd?: number };
  time?: string;
  lang?: string;
};
type AiServiceDataB = {
  answer: string;
  reference?: string | null;
  model: string;
  tokens?: { prompt?: number; completion?: number; total?: number };
  lang?: string;
  cached?: boolean;
  time?: string;
};

// === 工具：标准错误包裹 ===
function badRequest(message: string): NextResponse<Err> {
  return NextResponse.json({ ok: false, errorCode: "VALIDATION_FAILED", message }, { status: 400 });
}
function providerError(message: string): NextResponse<Err> {
  return NextResponse.json({ ok: false, errorCode: "PROVIDER_ERROR", message }, { status: 502 });
}
function internalError(message = "Internal Server Error"): NextResponse<Err> {
  return NextResponse.json({ ok: false, errorCode: "INTERNAL_ERROR", message }, { status: 500 });
}

// === 落库：ai_logs（失败仅告警，不阻断） ===
async function writeAiLogToSupabase(log: {
  userId?: string | null;
  question: string;
  answer: string;
  lang?: string | null; // 存 zh/ja/en
  model: string;
  ragHits: number;
  safetyFlag: "ok" | "needs_human" | "blocked";
  costEstUsd?: number | null;
  createdAtIso?: string;
}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    // eslint-disable-next-line no-console
    console.warn("[web] skip ai_logs insert: missing SUPABASE env");
    return;
  }
  // 与后端约定的 snake_case 字段
  // 注意：数据库表中的字段名是 locale，不是 language
  const payload = [
    {
      user_id: log.userId ?? null,
      question: log.question,
      answer: log.answer,
      locale: log.lang ?? null, // 使用 locale 字段（数据库表中的实际字段名）
      model: log.model,
      rag_hits: log.ragHits,
      safety_flag: log.safetyFlag,
      cost_est: log.costEstUsd ?? null,
      created_at: log.createdAtIso ?? new Date().toISOString(),
    },
  ];

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/ai_logs`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      // eslint-disable-next-line no-console
      console.warn("[web] ai_logs insert non-2xx", { status: res.status, text });
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[web] ai_logs insert failed", { error: (e as Error).message });
  }
}

// === 调用 AI-Service /ask ===
async function callAiService(body: AskBody): Promise<Response> {
  if (!AI_SERVICE_URL || !AI_SERVICE_TOKEN) {
    throw new Error("AI service not configured");
  }
  return fetch(`${AI_SERVICE_URL.replace(/\/+$/, "")}/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AI_SERVICE_TOKEN}`,
    },
    body: JSON.stringify(body),
  });
}

// === POST /api/ai/chat ===
export async function POST(req: NextRequest) {
  try {
    const input = (await req.json().catch(() => ({}))) as AskBody;

    // 简单校验
    if (!input.question || typeof input.question !== "string") {
      return badRequest("Missing or invalid 'question'");
    }

    // 透传到 AI-Service
    const upstream = await callAiService(input);
    const upstreamText = await upstream.text();
    let upstreamJson: Ok<AiServiceDataA | AiServiceDataB> | Err;

    try {
      upstreamJson = JSON.parse(upstreamText);
    } catch {
      return providerError("AI-Service returned non-JSON");
    }

    // 直接转发非 2xx 或失败结构
    if (!upstream.ok) {
      // 上游非 2xx，尽量透传错误体
      return NextResponse.json(upstreamJson, { status: upstream.status || 502 });
    }
    if (!("ok" in upstreamJson) || upstreamJson.ok !== true) {
      // 语义失败
      const status =
        (upstreamJson as Err).errorCode === "CONTENT_BLOCKED"
          ? 403
          : (upstreamJson as Err).errorCode === "VALIDATION_FAILED"
          ? 400
          : 502;
      return NextResponse.json(upstreamJson, { status });
    }

    // === 成功场景：落库（失败仅告警） ===
    const data = upstreamJson.data as AiServiceDataA & AiServiceDataB;

    // rag 命中：优先 sources 数量；若无 sources，用 reference 是否存在推断 0/1
    const ragHits = Array.isArray((data as AiServiceDataA).sources)
      ? ((data as AiServiceDataA).sources?.length ?? 0)
      : (data as AiServiceDataB).reference
      ? 1
      : 0;

    // 语言：沿用上游（或前端请求）
    const lang =
      (data.lang as string | undefined) ||
      (typeof input.lang === "string" ? input.lang : undefined);

    // 费用估算：优先使用上游 costEstimate.approxUsd；否则为 null（后续可接入统一估算器）
    const approxUsd =
      (data as AiServiceDataA).costEstimate?.approxUsd ?? null;

    // safetyFlag：若上游未提供，默认 ok
    const safetyFlag: "ok" | "needs_human" | "blocked" =
      (data as AiServiceDataA).safetyFlag ?? "ok";

    // createdAt：用上游 time 或现在
    const createdAt = (data.time as string | undefined) || new Date().toISOString();

    // 异步写 ai_logs（不阻断）
    void writeAiLogToSupabase({
      userId: input.userId ?? null,
      question: input.question,
      answer: data.answer,
      lang: lang ?? null,
      model: data.model,
      ragHits,
      safetyFlag,
      costEstUsd: approxUsd,
      createdAtIso: createdAt,
    }).catch(() => {});

    // 原样返回上游成功体
    return NextResponse.json(upstreamJson, { status: 200 });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[web] /api/ai/chat error", e);
    return internalError();
  }
}
