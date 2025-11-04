import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * ZALEM · 前端 → 主站 API：/api/ai/ask
 * - 校验用户 JWT（Bearer）
 * - 用户维度配额：10次/日（内存计数，UTC按日重置，生产可切Redis/DB）
 * - 入参校验（question 非空、≤1000字符；locale 可选、满足 BCP-47）
 * - 转发到 AI-Service /v1/ask（携带 Service Token），透传统一响应结构
 * - 统一错误码与消息体遵循《📐 接口与命名规范 v1.0》
 */

type AskRequest = {
  question: string;
  locale?: string;
};

type AiServiceResponse = {
  ok: boolean;
  data?: {
    answer: string;
    sources?: Array<{
      title: string;
      url: string;
      snippet?: string;
      score?: number;
      version?: string;
    }>;
    model?: string;
    safetyFlag?: "ok" | "needs_human" | "blocked";
    costEstimate?: { inputTokens: number; outputTokens: number; approxUsd: number };
  };
  errorCode?: string;
  message?: string;
  pagination?: unknown;
};

const DAILY_LIMIT = 10; // 每用户每日配额
const ANSWER_CHAR_LIMIT = 300; // 供下游约束（主站仅透传）
const QUESTION_MAX = 1000; // 硬性上限（接口层）
const BCP47 =
  /^(?:[a-zA-Z]{2,3}(?:-[a-zA-Z]{3}){0,3}|[a-zA-Z]{4}|[a-zA-Z]{5,8})(?:-[a-zA-Z]{4})?(?:-[a-zA-Z]{2}|\d{3})?(?:-(?:[a-zA-Z0-9]{5,8}|\d[a-zA-Z0-9]{3}))*?(?:-[a-wy-zA-WY-Z0-9](?:-[a-zA-Z0-9]{2,8})+)*?$/;

// ==== 环境变量 ====
const AI_SERVICE_URL = process.env.AI_SERVICE_URL;
const AI_SERVICE_TOKEN = process.env.AI_SERVICE_TOKEN;
const USER_JWT_PUBLIC_KEY = process.env.USER_JWT_PUBLIC_KEY; // PEM (RS256)；如使用别的方案，可替换 verifyJwt()

// ==== 内存配额（生产建议改造为 Redis / DB 聚合）====
type Counter = { count: number; dayKey: string };
const counters = new Map<string, Counter>();
let lastDayKey = dayKeyUtc();
function dayKeyUtc() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(
    now.getUTCDate(),
  ).padStart(2, "0")}`;
}
function touchResetIfNeeded() {
  const k = dayKeyUtc();
  if (k !== lastDayKey) {
    counters.clear();
    lastDayKey = k;
  }
}

// ==== 统一响应 ====
function ok<T>(data: T) {
  return NextResponse.json({ ok: true, data } as const, { status: 200 });
}
function err(
  code:
    | "AUTH_REQUIRED"
    | "FORBIDDEN"
    | "VALIDATION_FAILED"
    | "RATE_LIMIT_EXCEEDED"
    | "PROVIDER_ERROR"
    | "INTERNAL_ERROR",
  message: string,
  status: number,
  details?: Record<string, unknown>,
) {
  return NextResponse.json({ ok: false, errorCode: code, message, details } as const, { status });
}

// ==== JWT 解析（RS256 公钥验证，缺省时退化为仅检测存在性）====
async function verifyJwt(authorization?: string): Promise<{ userId: string } | null> {
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  if (!token) return null;

  // 若未配置公钥，则尝试从 token 中解析 userId（仅用于开发/预览环境）
  if (!USER_JWT_PUBLIC_KEY) {
    try {
      const [header, payload, signature] = token.split(".");
      if (!header || !payload) return null;
      // 尝试解析 payload（不验证签名）
      const json = JSON.parse(atobUrlSafe(payload)) as { 
        sub?: string; 
        user_id?: string; 
        userId?: string;
        id?: string;
      };
      // 尝试多种可能的字段名
      const userId = json.sub || json.user_id || json.userId || json.id || null;
      if (!userId || typeof userId !== "string") return null;
      // 验证是否为有效的 UUID 格式
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(userId)) {
        return { userId };
      }
      // 如果不是 UUID 格式，返回 null（将被视为匿名用户）
      return null;
    } catch {
      // 如果解析失败，返回 null
      return null;
    }
  }

  // 配置了公钥：严格验证签名
  try {
    const [header, payload, signature] = token.split(".");
    if (!header || !payload || !signature) return null;

    const enc = new TextEncoder();
    const data = `${header}.${payload}`;
    const sig = base64UrlToUint8Array(signature);

    const pubKey = await crypto.subtle.importKey(
      "spki",
      pemToArrayBuffer(USER_JWT_PUBLIC_KEY),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );

    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      pubKey,
      sig,
      enc.encode(data),
    );
    if (!valid) return null;

    const json = JSON.parse(atobUrlSafe(payload)) as { 
      sub?: string; 
      user_id?: string; 
      userId?: string;
      id?: string;
    };
    // 尝试多种可能的字段名
    const userId = json.sub || json.user_id || json.userId || json.id || null;
    if (!userId || typeof userId !== "string") return null;
    // 验证是否为有效的 UUID 格式
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(userId)) {
      return { userId };
    }
    // 如果不是 UUID 格式，返回 null（将被视为匿名用户）
    return null;
  } catch {
    return null;
  }
}

// ==== 工具 ====
function base64UrlToUint8Array(b64url: string) {
  const pad = "=".repeat((4 - (b64url.length % 4)) % 4);
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const raw = Buffer.from(b64, "base64");
  return new Uint8Array(raw);
}
function pemToArrayBuffer(pem: string) {
  const b64 = pem.replace(/-----(BEGIN|END) PUBLIC KEY-----/g, "").replace(/\s+/g, "");
  return Buffer.from(b64, "base64");
}
function atobUrlSafe(b64url: string) {
  const pad = "=".repeat((4 - (b64url.length % 4)) % 4);
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64").toString("utf8");
}
function normalizeQuestion(q: string) {
  return q.trim().replace(/\s+/g, " ");
}

// ==== 入口：POST /api/ai/ask ====
export async function POST(req: NextRequest) {
  try {
    // 0) 基础校验：AI-Service 配置
    if (!AI_SERVICE_URL || !AI_SERVICE_TOKEN) {
      return err(
        "INTERNAL_ERROR",
        "AI service is not configured.",
        500,
        { missing: ["AI_SERVICE_URL", "AI_SERVICE_TOKEN"].filter(
          (k) => !process.env[k as "AI_SERVICE_URL" | "AI_SERVICE_TOKEN"],
        ) },
      );
    }

    // 1) 用户鉴权（JWT）- 支持多种方式：Bearer header、Cookie、query 参数
    // 允许未登录用户匿名访问（使用匿名 ID）
    let jwt: string | null = null;
    
    // 1) Authorization: Bearer <jwt>
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      jwt = authHeader.slice("Bearer ".length).trim();
    }
    
    // 2) Cookie（Supabase 前端可能使用）
    if (!jwt) {
      try {
        const cookieJwt = req.cookies.get("sb-access-token")?.value;
        if (cookieJwt && cookieJwt.trim()) jwt = cookieJwt.trim();
      } catch {
        // Ignore cookie read errors
      }
    }
    
    // 3) Query 参数（?token=<jwt>，便于测试/脚本）
    if (!jwt) {
      try {
        const url = new URL(req.url);
        const token = url.searchParams.get("token");
        if (token && token.trim()) jwt = token.trim();
      } catch {
        // Ignore URL parsing errors
      }
    }
    
    // 验证 JWT（如果提供了 token，否则使用匿名 ID）
    let session: { userId: string } | null = null;
    if (jwt) {
      session = await verifyJwt(`Bearer ${jwt}`);
      // 如果配置了公钥但验证失败，拒绝请求
      if (!session && USER_JWT_PUBLIC_KEY) {
        return err("AUTH_REQUIRED", "Invalid or expired authentication token.", 401);
      }
    }
    
    // 如果没有 token 或验证失败但未配置公钥，使用匿名 ID（允许未登录用户访问）
    if (!session) {
      session = { userId: "anonymous" };
    }

    // 2) 解析与参数校验
    const body = (await req.json()) as AskRequest | null;
    if (!body || typeof body.question !== "string")
      return err("VALIDATION_FAILED", "question is required.", 400);

    const question = normalizeQuestion(body.question);
    if (question.length === 0)
      return err("VALIDATION_FAILED", "question is empty.", 400);
    if (question.length > QUESTION_MAX)
      return err("VALIDATION_FAILED", "question too long.", 400);

    const locale = body.locale?.trim();
    if (locale && !BCP47.test(locale))
      return err("VALIDATION_FAILED", "invalid locale.", 400);

    // 3) 配额检查（用户维度 10次/日）
    touchResetIfNeeded();
    const k = session.userId;
    const nowKey = lastDayKey;
    const c = counters.get(k);
    if (!c || c.dayKey !== nowKey) {
      counters.set(k, { count: 1, dayKey: nowKey });
    } else {
      if (c.count >= DAILY_LIMIT) {
        return err("RATE_LIMIT_EXCEEDED", "Daily ask limit exceeded.", 429, {
          limit: DAILY_LIMIT,
          resetAt: new Date(
            Date.UTC(
              new Date().getUTCFullYear(),
              new Date().getUTCMonth(),
              new Date().getUTCDate() + 1,
              0,
              0,
              0,
              0,
            ),
          ).toISOString(),
        });
      }
      c.count += 1;
      counters.set(k, c);
    }

    // 4) 转发到 AI-Service
    // 确保 AI_SERVICE_URL 不重复 /v1 路径
    const baseUrl = AI_SERVICE_URL.replace(/\/v1\/?$/, "").replace(/\/+$/, "");
    const upstream = await fetch(`${baseUrl}/v1/ask`, {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=utf-8",
        authorization: `Bearer ${AI_SERVICE_TOKEN}`,
        "x-zalem-client": "web",
      },
      body: JSON.stringify({
        // 传递 userId（如果是有效 UUID）或 null（匿名用户）
        // AI Service 的 normalizeUserId 会处理 "anonymous" 和非 UUID 格式
        userId: session.userId === "anonymous" ? null : session.userId,
        locale,
        question,
        metadata: {
          channel: "web",
          client: "zalem",
          answerCharLimit: ANSWER_CHAR_LIMIT,
          version: "v1.0.1",
          isAnonymous: session.userId === "anonymous",
          originalUserId: session.userId, // 原始 userId（用于日志追踪）
        },
      }),
      // 如需：可在此增加超时与重试（指数退避）
    });

    const result = (await upstream.json()) as AiServiceResponse;

    // 5) 上游异常与统一透传
    if (!upstream.ok || !result.ok) {
      const status = upstream.status || 502;
      // 将上游错误码按标准映射；若缺失则归类 PROVIDER_ERROR
      const upstreamCode =
        result.errorCode as
          | "VALIDATION_FAILED"
          | "NOT_RELEVANT"
          | "SAFETY_BLOCKED"
          | "RATE_LIMIT_EXCEEDED"
          | "PROVIDER_ERROR"
          | undefined;
      
      // 映射上游错误码到主站标准错误码
      let code: "VALIDATION_FAILED" | "RATE_LIMIT_EXCEEDED" | "PROVIDER_ERROR" | "AUTH_REQUIRED" | "FORBIDDEN" | "INTERNAL_ERROR";
      if (upstreamCode === "VALIDATION_FAILED") {
        code = "VALIDATION_FAILED";
      } else if (upstreamCode === "RATE_LIMIT_EXCEEDED") {
        code = "RATE_LIMIT_EXCEEDED";
      } else if (upstreamCode === "SAFETY_BLOCKED") {
        code = "FORBIDDEN";
      } else if (upstreamCode === "NOT_RELEVANT") {
        code = "PROVIDER_ERROR";
      } else {
        code = "PROVIDER_ERROR";
      }
      
      const msg = result.message || `AI service error (${status}).`;
      return err(code, msg, mapStatus(status));
    }

    // 6) 成功：直接返回统一包裹结构
    return ok(result.data || {});
  } catch (e) {
    return err("INTERNAL_ERROR", "Unexpected server error.", 500);
  }
}

// ==== 辅助 ====
function joinUrl(base: string, path: string) {
  return `${base.replace(/\/+$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;
}
function mapStatus(s: number) {
  if (s === 400) return 400;
  if (s === 401) return 401;
  if (s === 403) return 403;
  if (s === 404) return 404;
  if (s === 409) return 409;
  if (s === 429) return 429;
  if (s >= 500 && s < 600) return 502;
  return 502;
}
