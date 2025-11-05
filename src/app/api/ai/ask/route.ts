import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

export const runtime = "nodejs";

/**
 * ZALEM · 前端 → 主站 API：/api/ai/ask
 * - 校验用户 JWT（Bearer）- 使用 HS256 (USER_JWT_SECRET)
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
const USER_JWT_SECRET = process.env.USER_JWT_SECRET; // HMAC 密钥（用户端 JWT 校验，HS256）

// ==== 环境检测 ====
function isProduction(): boolean {
  // VERCEL_ENV: 'development' | 'preview' | 'production'
  // NODE_ENV: 'development' | 'production' | 'test'
  const vercelEnv = process.env.VERCEL_ENV;
  const nodeEnv = process.env.NODE_ENV;
  
  // 明确的生产环境：VERCEL_ENV === 'production' 或 NODE_ENV === 'production' 且不是预览环境
  if (vercelEnv === "production") return true;
  if (nodeEnv === "production" && vercelEnv !== "preview") return true;
  
  return false;
}

function isDevelopmentOrPreview(): boolean {
  const vercelEnv = process.env.VERCEL_ENV;
  const nodeEnv = process.env.NODE_ENV;
  
  // 开发环境
  if (nodeEnv === "development" || !nodeEnv) return true;
  // 预览环境
  if (vercelEnv === "preview" || vercelEnv === "development") return true;
  
  return false;
}

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

// ==== JWT 解析（HS256 HMAC 验证，缺省时退化为仅检测存在性）====
/**
 * 用户 JWT 校验
 * - 使用 HMAC（HS256/HS512）验证
 * - 开发模式：如果未配置 USER_JWT_SECRET，允许跳过认证（仅用于本地测试和预览）
 * - 生产环境：必须配置 USER_JWT_SECRET，严格验证 JWT（安全要求）
 */
async function verifyJwt(authorization?: string): Promise<{ userId: string } | null> {
  console.log("[JWT Debug] verifyJwt called", {
    hasAuth: !!authorization,
    authPrefix: authorization?.substring(0, 20),
    hasSecret: !!USER_JWT_SECRET,
    isProduction: isProduction(),
    isDevOrPreview: isDevelopmentOrPreview(),
  });

  // 生产环境安全检查：必须配置 USER_JWT_SECRET
  if (isProduction()) {
    if (!USER_JWT_SECRET) {
      console.error("[JWT Debug] Production environment requires USER_JWT_SECRET");
      return null;
    }
    // 生产环境必须提供有效的 Authorization header
    if (!authorization?.startsWith("Bearer ")) {
      console.log("[JWT Debug] Production: missing or invalid Bearer token");
      return null;
    }
  }
  
  // 开发或预览环境：如果未配置 USER_JWT_SECRET，允许跳过认证（仅用于本地测试和预览）
  if (!USER_JWT_SECRET) {
    console.log("[JWT Debug] USER_JWT_SECRET not configured");
    if (isDevelopmentOrPreview()) {
      // 开发模式兜底：如果有 Bearer token，即使不验证也允许通过
      if (authorization?.startsWith("Bearer ")) {
        const token = authorization.slice("Bearer ".length).trim();
        if (token) {
          // 尝试解析 payload（不验证签名，仅开发/预览模式）
          try {
            const [header, payload, signature] = token.split(".");
            if (!header || !payload) {
              console.log("[JWT Debug] Dev mode: invalid token format");
              return null;
            }
            const json = JSON.parse(atobUrlSafe(payload)) as { 
              sub?: string; 
              user_id?: string; 
              userId?: string;
              id?: string;
            };
            console.log("[JWT Debug] Dev mode: parsed payload", {
              hasSub: !!json.sub,
              hasUser_id: !!json.user_id,
              hasUserId: !!json.userId,
              hasId: !!json.id,
              payloadKeys: Object.keys(json),
            });
            const userId = json.sub || json.user_id || json.userId || json.id || null;
            if (!userId || typeof userId !== "string") {
              console.log("[JWT Debug] Dev mode: no userId found in payload");
              return null;
            }
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (uuidRegex.test(userId)) {
              console.log("[JWT Debug] Dev mode: valid UUID found", userId);
              return { userId };
            }
            console.log("[JWT Debug] Dev mode: userId is not UUID format", userId);
            return null;
          } catch (e) {
            console.error("[JWT Debug] Dev mode: parse error", (e as Error).message);
            return null;
          }
        }
      }
      // 开发或预览环境允许跳过认证
      console.log("[JWT Debug] Dev mode: no Bearer token, returning null");
      return null; // 返回 null，让调用方使用匿名 ID
    }
    // 非开发/预览环境但未配置密钥，返回 null
    console.log("[JWT Debug] Not dev/preview and no secret configured");
    return null;
  }

  if (!authorization?.startsWith("Bearer ")) {
    console.log("[JWT Debug] No Bearer token in authorization header");
    return null;
  }

  const token = authorization.slice("Bearer ".length).trim();
  console.log("[JWT Debug] Token extracted", { tokenLength: token.length, tokenPrefix: token.substring(0, 20) });
  
  try {
    // Supabase Legacy JWT Secret 通常是 Base64 编码的，需要先解码
    let secret: Uint8Array;
    let secretType: "base64" | "raw" = "raw";
    try {
      // 尝试 Base64 解码（Supabase Legacy JWT Secret 格式）
      const decodedSecret = Buffer.from(USER_JWT_SECRET, "base64");
      secret = new Uint8Array(decodedSecret);
      secretType = "base64";
      console.log("[JWT Debug] Secret decoded as Base64", { secretLength: secret.length });
    } catch {
      // 如果 Base64 解码失败，使用原始字符串（向后兼容）
      secret = new TextEncoder().encode(USER_JWT_SECRET);
      secretType = "raw";
      console.log("[JWT Debug] Secret used as raw string", { secretLength: secret.length });
    }
    
    const { payload } = await jwtVerify(token, secret); // 默认允许 HS256
    console.log("[JWT Debug] JWT verification successful", {
      secretType,
      payloadKeys: Object.keys(payload),
      hasSub: !!payload.sub,
      hasUser_id: !!(payload as any).user_id,
      hasUserId: !!(payload as any).userId,
      hasId: !!payload.id,
    });
    
    // 尝试多种可能的字段名
    const payloadWithUserId = payload as { 
      sub?: string; 
      user_id?: string; 
      userId?: string;
      id?: string;
    };
    const userId = payloadWithUserId.sub || payloadWithUserId.user_id || payloadWithUserId.userId || payloadWithUserId.id || null;
    console.log("[JWT Debug] Extracted userId", { userId, type: typeof userId });
    
    if (!userId || typeof userId !== "string") {
      console.log("[JWT Debug] userId is null or not string");
      return null;
    }
    
    // 验证是否为有效的 UUID 格式
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(userId)) {
      console.log("[JWT Debug] Valid UUID userId found", userId);
      return { userId };
    }
    // 如果不是 UUID 格式，返回 null（将被视为匿名用户）
    console.log("[JWT Debug] userId is not UUID format", userId);
    return null;
  } catch (e) {
    console.error("[JWT Debug] JWT verification failed", {
      error: (e as Error).message,
      errorName: (e as Error).name,
      stack: (e as Error).stack?.substring(0, 200),
    });
    return null;
  }
}

// ==== 工具 ====
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
    console.log("[JWT Debug] JWT extraction result", {
      hasJwt: !!jwt,
      jwtLength: jwt?.length,
      jwtPrefix: jwt?.substring(0, 20),
      hasSecret: !!USER_JWT_SECRET,
    });
    
    if (jwt) {
      session = await verifyJwt(`Bearer ${jwt}`);
      console.log("[JWT Debug] verifyJwt result", {
        hasSession: !!session,
        userId: session?.userId,
      });
      
      // 如果配置了密钥但验证失败，拒绝请求（生产环境）
      if (!session && USER_JWT_SECRET && isProduction()) {
        console.error("[JWT Debug] Production: JWT verification failed");
        return err("AUTH_REQUIRED", "Invalid or expired authentication token.", 401);
      }
    } else {
      console.log("[JWT Debug] No JWT token provided");
    }
    
    // 如果没有 token 或验证失败但未配置密钥，使用匿名 ID（允许未登录用户访问）
    if (!session) {
      console.log("[JWT Debug] Using anonymous session");
      session = { userId: "anonymous" };
    }
    
    console.log("[JWT Debug] Final session", { userId: session.userId });

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
    const forwardedUserId = session.userId === "anonymous" ? null : session.userId;
    console.log("[JWT Debug] Forwarding to AI-Service", {
      originalUserId: session.userId,
      forwardedUserId,
      isAnonymous: session.userId === "anonymous",
    });
    
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
        userId: forwardedUserId,
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
