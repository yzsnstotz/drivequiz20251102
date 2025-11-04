// apps/web/app/api/ai/ask/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";

/**
 * 主站 API：转发用户问答到 AI-Service（含JWT校验、日配额限制、参数校验、统一响应）
 * - 与当前 AI-Service /v1/ask 接口字段对齐（question/answer/reference/model/tokens/lang/cached/time）
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ok<T> = { ok: true; data: T; pagination?: never };
type Err = {
  ok: false;
  errorCode:
    | "AUTH_REQUIRED"
    | "RATE_LIMIT_EXCEEDED"
    | "VALIDATION_FAILED"
    | "PROVIDER_ERROR"
    | "INTERNAL_ERROR";
  message: string;
  details?: Record<string, unknown>;
};

type AiAskData = {
  question: string;
  answer: string;
  reference: string | null;
  model: string;
  tokens?: { prompt?: number; completion?: number; total?: number };
  lang: string;
  cached: boolean;
  time: string; // ISO8601
};

type AiServiceResponse = Ok<AiAskData> | Err;

type AskRequestBody = {
  question?: string;
  locale?: string; // 前端可能传入的 BCP-47；将映射为 AI-Service 的 lang
};

// ---- 配置与内存状态（本地开发用；生产建议迁移至持久层/Redis） ----
const AI_SERVICE_URL = process.env.AI_SERVICE_URL ?? "";
const AI_SERVICE_TOKEN = process.env.AI_SERVICE_TOKEN ?? "";
const DAILY_LIMIT = Number(process.env.AI_ASK_DAILY_LIMIT ?? "10");
const ANSWER_CHAR_LIMIT = Number(process.env.AI_ANSWER_CHAR_LIMIT ?? "300");

type Counter = { count: number; resetAt: string };
const dailyCounter = new Map<string, Counter>();

// ---- 工具函数 ----
function json<T extends object>(status: number, body: T) {
  return NextResponse.json(body, { status });
}

function badRequest(message: string, details?: Record<string, unknown>) {
  return json<Err>(400, { ok: false, errorCode: "VALIDATION_FAILED", message, details });
}

function unauthorized(message = "Authentication required.") {
  return json<Err>(401, { ok: false, errorCode: "AUTH_REQUIRED", message });
}

function rateLimited(details: Record<string, unknown>) {
  return json<Err>(429, {
    ok: false,
    errorCode: "RATE_LIMIT_EXCEEDED",
    message: "Daily ask limit exceeded.",
    details,
  });
}

function internalError(message = "Internal server error.") {
  return json<Err>(500, { ok: false, errorCode: "INTERNAL_ERROR", message });
}

function todayUtcDate(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
}

/** 统一读取用户JWT：优先 Bearer，其次 Cookie，最后 query=token（便于 smoke 测试） */
function readUserJwt(req: NextRequest): string | null {
  // 1) Authorization: Bearer <jwt>
  const authHeader = req.headers.get("authorization");
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (token) return token;
  }

  // 2) Supabase Cookie（如果是前端页面请求）
  try {
    const cookieJwt = req.cookies.get("sb-access-token")?.value;
    if (cookieJwt && cookieJwt.trim()) return cookieJwt.trim();
  } catch {
    // Ignore cookie read errors
  }

  // 3) 兜底：?token=<jwt>（仅联调/脚本测试使用）
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (token && token.trim()) return token.trim();
  } catch {
    // Ignore URL parsing errors
  }

  return null;
}

// 尝试从JWT解析 userId（不验证签名，仅为配额统计与透传；生产环境应使用服务端验证）
function unsafeDecodeJwtSub(jwt: string): string | null {
  try {
    const parts = jwt.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    const sub = payload.sub || payload.user_id || payload.userId || null;
    if (!sub || typeof sub !== "string") return null;
    return sub;
  } catch {
    return null;
  }
}

function incrAndCheckDailyLimit(key: string): { ok: boolean; resetAt: string; remaining: number } {
  const today = todayUtcDate();
  const rec = dailyCounter.get(key);
  if (!rec || rec.resetAt !== today) {
    dailyCounter.set(key, { count: 1, resetAt: today });
    return { ok: true, resetAt: today, remaining: Math.max(DAILY_LIMIT - 1, 0) };
  }
  if (rec.count >= DAILY_LIMIT) {
    return { ok: false, resetAt: rec.resetAt, remaining: 0 };
  }
  rec.count += 1;
  dailyCounter.set(key, rec);
  return { ok: true, resetAt: rec.resetAt, remaining: Math.max(DAILY_LIMIT - rec.count, 0) };
}

function isValidLocale(locale?: string): boolean {
  if (!locale) return true;
  // 简化的 BCP-47 校验
  return /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/.test(locale);
}

/** 将 locale 映射到 AI-Service 的 lang（仅支持 zh/ja/en，其他回退 zh） */
function mapLocaleToLang(locale?: string): "zh" | "ja" | "en" {
  const l = (locale || "").toLowerCase();
  if (l.startsWith("ja")) return "ja";
  if (l.startsWith("en")) return "en";
  return "zh";
}

function truncateAnswer(ans: string, limit: number): string {
  if (ans.length <= limit) return ans;
  return ans.slice(0, limit);
}

// ---- 路由处理 ----
export async function POST(req: NextRequest) {
  // 1) 鉴权：用户 JWT（前端 -> 主站）
  // 允许未登录用户匿名访问（使用匿名 ID）
  const jwt = readUserJwt(req);
  let userId: string | null = null;
  
  if (jwt) {
    userId = unsafeDecodeJwtSub(jwt);
  }
  
  // 如果没有 token 或无法解析 userId，使用匿名 ID
  const quotaKey = userId ? `u:${userId}` : (jwt ? `anon:${jwt.slice(0, 16)}` : "anon:anonymous");
  const limitRes = incrAndCheckDailyLimit(quotaKey);
  if (!limitRes.ok) {
    return rateLimited({ limit: DAILY_LIMIT, resetAt: limitRes.resetAt });
  }

  // 2) 校验请求体
  let body: AskRequestBody;
  try {
    body = (await req.json()) as AskRequestBody;
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const question = (body.question ?? "").trim();
  const locale = (body.locale ?? "").trim() || undefined;

  if (!question) return badRequest("`question` is required.");
  if (question.length > 1000) return badRequest("`question` exceeds 1000 characters.");
  if (!isValidLocale(locale)) return badRequest("`locale` must follow BCP-47.");

  // 3) 转发到 AI-Service（主站 -> 子服务）
  if (!AI_SERVICE_URL || !AI_SERVICE_TOKEN) {
    return internalError("AI service is not configured.");
  }

  const forwardPayload: Record<string, unknown> = {
    userId: userId ?? "anonymous",
    // AI-Service 期望字段为 lang
    lang: mapLocaleToLang(locale),
    question,
    metadata: { channel: "web", client: "zalem" },
  };

  let aiResp: Response;
  try {
    const headers: Record<string, string> = {
      "content-type": "application/json; charset=utf-8",
      // 服务间鉴权走 Service Token
      authorization: `Bearer ${AI_SERVICE_TOKEN}`,
    };
    // 透传用户信息（可选，用于日志或风控）
    if (jwt) {
      headers["x-user-jwt"] = jwt;
    }
    
    aiResp = await fetch(`${AI_SERVICE_URL.replace(/\/$/, "")}/v1/ask`, {
      method: "POST",
      headers,
      body: JSON.stringify(forwardPayload),
    });
  } catch (e: any) {
    return json<Err>(502, {
      ok: false,
      errorCode: "PROVIDER_ERROR",
      message: "AI service is unreachable.",
      details: { reason: e?.message ?? "fetch_failed" },
    });
  }

  let aiJson: AiServiceResponse;
  try {
    aiJson = (await aiResp.json()) as AiServiceResponse;
  } catch {
    return json<Err>(502, {
      ok: false,
      errorCode: "PROVIDER_ERROR",
      message: "Invalid response from AI service.",
    });
  }

  // 4) 统一响应与长度裁切（对齐 AI-Service 的真实字段）
  if (aiJson.ok) {
    const cut: AiAskData = {
      ...aiJson.data,
      answer: truncateAnswer(aiJson.data.answer, ANSWER_CHAR_LIMIT),
    };
    return json<Ok<AiAskData>>(200, { ok: true, data: cut });
  }

  // 将子服务错误码原样透传（含429/400等），若上游返回200包错则此处归一为400
  const statusPassthrough = aiResp.status || 400;
  return json<Err>(statusPassthrough, aiJson);
}
