// apps/web/app/api/ai/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { aiDb, insertAiLog } from "@/lib/aiDb";

// 运行配置（动态渲染，服务端执行）
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** === 环境变量（遵循《🛠️ 研发规范 v1.0》命名） ===
 *  AI_SERVICE_URL        e.g. https://ai.example.com/v1
 *  AI_SERVICE_TOKEN      与 AI-Service 的 Service Token 对齐
 */
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "";
const AI_SERVICE_TOKEN = process.env.AI_SERVICE_TOKEN || "";

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
  scene?: string;
  model?: string;
  messages?: any[]; // 历史消息
  sourceLanguage?: string;
  targetLanguage?: string;
  seedUrl?: string;
  maxHistory?: number;
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
  aiProvider?: string;
  cached?: boolean;
};
type AiServiceDataB = {
  answer: string;
  reference?: string | null;
  model: string;
  tokens?: { prompt?: number; completion?: number; total?: number };
  lang?: string;
  cached?: boolean;
  time?: string;
  aiProvider?: string;
};

// === 工具：标准错误包裹 ===
function badRequest(message: string): NextResponse<Err> {
  return NextResponse.json({ ok: false, errorCode: "VALIDATION_FAILED", message }, { status: 400 });
}
function providerError(message: string): NextResponse<Err> {
  return NextResponse.json({ ok: false, errorCode: "PROVIDER_ERROR", message }, { status: 502 });
}


// === 调用 AI-Service /ask ===
async function callAiService(body: AskBody): Promise<Response> {
  if (!AI_SERVICE_URL || !AI_SERVICE_TOKEN) {
    throw new Error("AI service not configured");
  }
  
  // 过滤 undefined/null 字段
  const payload = Object.fromEntries(
    Object.entries(body).filter(([_, v]) => v !== undefined && v !== null)
  );

  return fetch(`${AI_SERVICE_URL.replace(/\/+$/, "")}/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AI_SERVICE_TOKEN}`,
    },
    body: JSON.stringify(payload),
  });
}

// === POST /api/ai/chat ===
export async function POST(req: NextRequest) {
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  console.log(`[APPS-WEB] /api/ai/chat called with requestId: ${requestId}`);

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
      return NextResponse.json(upstreamJson, { status: upstream.status || 502 });
    }
    if (!("ok" in upstreamJson) || upstreamJson.ok !== true) {
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

    // 费用估算：优先使用上游 costEstimate.approxUsd；否则为 null
    const approxUsd =
      (data as AiServiceDataA).costEstimate?.approxUsd ?? null;

    // safetyFlag：若上游未提供，默认 ok
    const safetyFlag: "ok" | "needs_human" | "blocked" =
      (data as AiServiceDataA).safetyFlag ?? "ok";

    // 异步写 ai_logs（不阻断）
    // 强制 scene="chat" 如果前端没传 (但前端应该传)
    // 根据需求：scene 固定为 "chat"
    const scene = "chat";

    void insertAiLog({
      userId: input.userId ?? null,
      question: input.question,
      answer: data.answer,
      from: scene, // 使用统一的 from 字段
      locale: lang ?? null,
      model: data.model,
      ragHits,
      safetyFlag,
      costEst: approxUsd, // 统一字段名为 costEst
      sources: (data as AiServiceDataA).sources ? JSON.stringify((data as AiServiceDataA).sources) : null,
      aiProvider: data.aiProvider ?? null,
      cached: data.cached ?? false,
    }).catch((e) => {
        console.warn(`[${requestId}] ai_logs async write failed`, e);
    });

    // 原样返回上游成功体
    return NextResponse.json(upstreamJson, { status: 200 });
  } catch (e: any) {
    console.error(`[web] /api/ai/chat error [${requestId}]`, {
      message: e?.message,
      name: e?.name,
    });
    return NextResponse.json(
      {
        ok: false,
        errorCode: "INTERNAL_ERROR",
        message: e?.message ?? "AI 服务调用失败",
      },
      { status: 502 }
    );
  }
}
