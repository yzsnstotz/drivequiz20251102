// apps/web/app/api/ai/ask/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { config } from "dotenv";
import { resolve } from "path";

/* AI_ENV_BLOCK_START */
function readRaw(key: string, d = ""): string {
  const v = process.env[key];
  return (typeof v === "string" ? v : d).trim();
}

function readBool(key: string, d = false): boolean {
  const v = readRaw(key, d ? "true" : "false").toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function readUrl(key: string, d = ""): string {
  const v = readRaw(key, d).replace(/\/+$/, "");
  return v;
}

const ENV = {
  USE_LOCAL_AI: readBool("USE_LOCAL_AI", false),
  LOCAL_AI_SERVICE_URL: readUrl("LOCAL_AI_SERVICE_URL"),
  LOCAL_AI_SERVICE_TOKEN: readRaw("LOCAL_AI_SERVICE_TOKEN"),
  AI_SERVICE_URL: readUrl("AI_SERVICE_URL"),
  AI_SERVICE_TOKEN: readRaw("AI_SERVICE_TOKEN"),
};

function forceModeFromReq(req: NextRequest): "local" | "online" | null {
  try {
    const url = new URL(req.url);
    const m = url.searchParams.get("ai")?.toLowerCase();
    if (m === "local" || m === "online") return m as "local" | "online";
  } catch {
    // Ignore URL parsing errors
  }
  return null;
}

function pickAiTarget(req: NextRequest): { mode: "local" | "online"; url: string; token: string } {
  const forced = forceModeFromReq(req);
  const wantLocal = forced ? forced === "local" : ENV.USE_LOCAL_AI;

  if (wantLocal) {
    if (!ENV.LOCAL_AI_SERVICE_URL) {
      throw new Error("LOCAL_AI_SERVICE_URL is empty while USE_LOCAL_AI=true");
    }
    if (!ENV.LOCAL_AI_SERVICE_TOKEN) {
      throw new Error("LOCAL_AI_SERVICE_TOKEN is empty while USE_LOCAL_AI=true");
    }
    return {
      mode: "local",
      url: ENV.LOCAL_AI_SERVICE_URL,
      token: ENV.LOCAL_AI_SERVICE_TOKEN,
    };
  }

  if (!ENV.AI_SERVICE_URL || !ENV.AI_SERVICE_TOKEN) {
    throw new Error("Online AI service URL/TOKEN is not configured.");
  }
  return {
    mode: "online",
    url: ENV.AI_SERVICE_URL,
    token: ENV.AI_SERVICE_TOKEN,
  };
}

// 统一响应工具（保证每条返回都有指纹和调试头）
const __ROUTE_FPRINT = "ask-route-fp-1762431422-10156";

function respondJSON(body: any, debug: Record<string, string> = {}) {
  return NextResponse.json(body, {
    headers: {
      "x-route-fingerprint": __ROUTE_FPRINT,
      ...debug,
    },
  });
}
/* AI_ENV_BLOCK_END */

// 显式加载环境变量（确保从项目根目录加载 .env.local）
// 必须在模块加载时立即执行，确保环境变量在后续代码读取前已加载
if (process.env.NODE_ENV !== "production") {
  // Next.js 在开发模式下，process.cwd() 返回项目根目录
  // 但为了确保，我们尝试多个可能的路径
  const rootEnvLocal = resolve(process.cwd(), ".env.local");
  const rootEnv = resolve(process.cwd(), ".env");
  const webEnvLocal = resolve(__dirname, "../../../.env.local");
  const webEnv = resolve(__dirname, "../../../.env");
  
  console.log("[ENV LOAD] 开始加载环境变量", {
    rootEnvLocal,
    rootEnv,
    webEnvLocal,
    webEnv,
    cwd: process.cwd(),
    __dirname,
  });
  
  // 优先加载 apps/web/.env.local，然后加载项目根目录的 .env.local
  // override: true 确保后加载的文件可以覆盖先加载的变量
  const result1 = config({ path: webEnvLocal, override: true });
  const result2 = config({ path: rootEnvLocal, override: true });
  const result3 = config({ path: rootEnv, override: false });
  const result4 = config({ path: webEnv, override: false });
  
  console.log("[ENV LOAD] 环境变量加载结果", {
    webEnvLocal: result1?.parsed ? Object.keys(result1.parsed).length : 0,
    rootEnvLocal: result2?.parsed ? Object.keys(result2.parsed).length : 0,
    rootEnv: result3?.parsed ? Object.keys(result3.parsed).length : 0,
    webEnv: result4?.parsed ? Object.keys(result4.parsed).length : 0,
  });
  
  // 立即检查关键环境变量
  console.log("[ENV LOAD] 加载后的环境变量值", {
    USE_LOCAL_AI: process.env.USE_LOCAL_AI,
    LOCAL_AI_SERVICE_URL: process.env.LOCAL_AI_SERVICE_URL,
    LOCAL_AI_SERVICE_TOKEN: process.env.LOCAL_AI_SERVICE_TOKEN ? "***" : "",
    AI_SERVICE_URL: process.env.AI_SERVICE_URL,
    AI_SERVICE_TOKEN: process.env.AI_SERVICE_TOKEN ? "***" : "",
  });
}

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

// 获取环境变量的函数（在运行时读取，确保 dotenv 已加载）
function getEnvVar(key: string, defaultValue = ""): string {
  const value = process.env[key] ?? defaultValue;
  if (process.env.NODE_ENV !== "production") {
    console.log(`[ENV GET] ${key} = ${key.includes("TOKEN") ? (value ? "***" : "") : value}`);
  }
  return value;
}

// ---- 配置与内存状态（本地开发用；生产建议迁移至持久层/Redis） ----
// AI服务选择：通过环境变量控制使用本地或在线AI服务
// 注意：这些变量在函数中动态读取，确保 dotenv 已加载
const getUseLocalAI = () => getEnvVar("USE_LOCAL_AI") === "true";
const getLocalAIServiceUrl = () => getEnvVar("LOCAL_AI_SERVICE_URL");
const getLocalAIServiceToken = () => getEnvVar("LOCAL_AI_SERVICE_TOKEN");
const getAIServiceUrl = () => getEnvVar("AI_SERVICE_URL");
const getAIServiceToken = () => getEnvVar("AI_SERVICE_TOKEN");

// 调试日志（仅在开发环境）
if (process.env.NODE_ENV !== "production") {
  console.log("[AI Service Config]", {
    USE_LOCAL_AI: getUseLocalAI(),
    LOCAL_AI_SERVICE_URL: getLocalAIServiceUrl(),
    LOCAL_AI_SERVICE_TOKEN: getLocalAIServiceToken() ? "***" : "",
    AI_SERVICE_URL: getAIServiceUrl(),
    AI_SERVICE_TOKEN: getAIServiceToken() ? "***" : "",
  });
}
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
    
    // 处理 base64url 解码（添加 padding 如果需要）
    let payloadBase64 = parts[1];
    const padding = (4 - (payloadBase64.length % 4)) % 4;
    if (padding > 0) {
      payloadBase64 += "=".repeat(padding);
    }
    
    // 替换 base64url 字符为 base64 字符
    payloadBase64 = payloadBase64.replace(/-/g, "+").replace(/_/g, "/");
    
    // 解码并解析 JSON
    const payloadStr = Buffer.from(payloadBase64, "base64").toString("utf8");
    const payload = JSON.parse(payloadStr) as { 
      sub?: string; 
      user_id?: string; 
      userId?: string;
      id?: string;
    };
    
    // 尝试多种可能的字段名
    const userId = payload.sub || payload.user_id || payload.userId || payload.id || null;
    if (!userId || typeof userId !== "string") return null;
    
    // 验证是否为有效的 UUID 格式（可选，但建议）
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(userId)) {
      return userId;
    }
    
    // 如果不是 UUID 格式，但仍然返回（可能是其他格式的 ID）
    return userId;
  } catch (e) {
    // 解析失败，返回 null
    return null;
  }
}

// 生成匿名用户ID（基于 token 的 hash，确保同一 token 生成相同的匿名ID）
function generateAnonymousId(token: string): string {
  try {
    // 使用简单的 hash 函数生成一个稳定的匿名ID
    // 注意：这不是加密安全的，仅用于区分不同的匿名用户
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      const char = token.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    // 生成一个类似 UUID 的格式（但不是真正的 UUID）
    const hex = Math.abs(hash).toString(16).padStart(8, "0");
    return `anon-${hex.slice(0, 8)}-${hex.slice(8, 12) || "0000"}-${hex.slice(12, 16) || "0000"}-${hex.slice(16, 20) || "0000"}-${hex.slice(20, 32) || "000000000000"}`.slice(0, 36);
  } catch {
    return "anonymous";
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
  let isAnonymous = false;
  
  if (jwt) {
    userId = unsafeDecodeJwtSub(jwt);
    // 如果解析失败，但有 token，使用基于 token 的匿名ID
    if (!userId) {
      userId = generateAnonymousId(jwt);
      isAnonymous = true;
    }
  } else {
    // 没有 token，使用默认匿名ID
    userId = "anonymous";
    isAnonymous = true;
  }
  
  // 配额统计：使用 userId（真实用户）或匿名ID
  const quotaKey = isAnonymous ? `anon:${userId}` : `u:${userId}`;
  const limitRes = incrAndCheckDailyLimit(quotaKey);
  if (!limitRes.ok) {
    return respondJSON({
      ok: false,
      errorCode: "RATE_LIMIT_EXCEEDED",
      message: "Daily ask limit exceeded.",
      details: { limit: DAILY_LIMIT, resetAt: limitRes.resetAt },
    });
  }

  // 2) 校验请求体
  let body: AskRequestBody;
  try {
    body = (await req.json()) as AskRequestBody;
  } catch {
    return respondJSON({
      ok: false,
      errorCode: "VALIDATION_FAILED",
      message: "Invalid JSON body.",
    });
  }

  const question = (body.question ?? "").trim();
  const locale = (body.locale ?? "").trim() || undefined;

  if (!question) {
    return respondJSON({
      ok: false,
      errorCode: "VALIDATION_FAILED",
      message: "`question` is required.",
    });
  }
  if (question.length > 1000) {
    return respondJSON({
      ok: false,
      errorCode: "VALIDATION_FAILED",
      message: "`question` exceeds 1000 characters.",
    });
  }
  if (!isValidLocale(locale)) {
    return respondJSON({
      ok: false,
      errorCode: "VALIDATION_FAILED",
      message: "`locale` must follow BCP-47.",
    });
  }

  // 3) 选择AI服务（本地或在线）
  console.log("[STEP 3] 开始选择AI服务");
  
  /* AI_PICK_START */
  let __aiTarget: { mode: "local" | "online"; url: string; token: string };
  let __requestUrl: string;
  let __debugHeaders: Record<string, string> = {};
  try {
    __aiTarget = pickAiTarget(req);
    __requestUrl = `${__aiTarget.url}/v1/ask`;
    __debugHeaders = {
      "x-ai-service-mode": __aiTarget.mode,
      "x-ai-service-url": __aiTarget.url,
    };
  } catch (e: any) {
    return respondJSON({
      ok: false,
      errorCode: "INTERNAL_ERROR",
      message: e?.message || "AI service is not configured.",
    });
  }
  /* AI_PICK_END */
  
  const aiServiceUrl = __aiTarget.url;
  const aiServiceToken = __aiTarget.token;
  
  console.log("[STEP 3] AI服务选择结果", {
    mode: __aiTarget.mode,
    aiServiceUrl,
    aiServiceToken: aiServiceToken ? "***" : "",
  });

  const forwardPayload: Record<string, unknown> = {
    // 传递 userId（无论是否为 UUID）
    // AI Service 的 normalizeUserId 会验证 UUID 格式，非 UUID 会转换为 null
    // 但如果是有效的 UUID，应该传递它；如果是匿名 ID，也应该传递（虽然会被转换为 null）
    userId: userId, // 传递实际解析出的 userId，让 AI Service 处理验证
    // AI-Service 期望字段为 lang
    lang: mapLocaleToLang(locale),
    question,
    metadata: { 
      channel: "web", 
      client: "zalem",
      isAnonymous, // 标记是否为匿名用户
      originalUserId: userId, // 原始 userId（用于日志追踪）
    },
  };

  let aiResp: Response;
  try {
    const headers: Record<string, string> = {
      "content-type": "application/json; charset=utf-8",
    };
    // 透传用户信息（可选，用于日志或风控）
    if (jwt) {
      headers["x-user-jwt"] = jwt;
    }
    
    console.log("[STEP 4] 准备转发请求到AI服务", {
      url: __requestUrl,
      method: "POST",
      headers: {
        ...headers,
        authorization: headers.authorization ? "Bearer ***" : "",
      },
      payload: {
        ...forwardPayload,
        userId: forwardPayload.userId ? "***" : null,
      },
    });
    
    // 转发到选择的AI服务（本地AI服务和在线AI服务使用相同的接口格式）
    const startTime = Date.now();
    aiResp = await fetch(__requestUrl, {
      method: "POST",
      headers: {
        ...headers,
        authorization: `Bearer ${__aiTarget.token}`,
      },
      body: JSON.stringify(forwardPayload),
    });
    const duration = Date.now() - startTime;
    
    console.log("[STEP 4] AI服务响应", {
      status: aiResp.status,
      statusText: aiResp.statusText,
      headers: Object.fromEntries(aiResp.headers.entries()),
      duration: `${duration}ms`,
    });
  } catch (e: any) {
    console.error("[STEP 4] AI服务请求失败", {
      error: e?.message,
      stack: e?.stack,
      url: __aiTarget.url,
    });
    return respondJSON({
      ok: false,
      errorCode: "PROVIDER_ERROR",
      message: "AI service is unreachable.",
      details: { reason: e?.message ?? "fetch_failed" },
    });
  }

  let aiJson: AiServiceResponse;
  try {
    const responseText = await aiResp.text();
    console.log("[STEP 5] AI服务响应内容（原始）", {
      status: aiResp.status,
      textLength: responseText.length,
      textPreview: responseText.substring(0, 200),
    });
    
    aiJson = JSON.parse(responseText) as AiServiceResponse;
    console.log("[STEP 5] AI服务响应内容（解析后）", {
      ok: aiJson.ok,
      model: aiJson.ok ? aiJson.data?.model : undefined,
      answerLength: aiJson.ok ? aiJson.data?.answer?.length : undefined,
      errorCode: !aiJson.ok ? aiJson.errorCode : undefined,
      message: !aiJson.ok ? aiJson.message : undefined,
    });
  } catch (e: any) {
    console.error("[STEP 5] 解析AI服务响应失败", {
      error: e?.message,
      status: aiResp.status,
      stack: e?.stack,
    });
    return respondJSON({
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
    return respondJSON({ ok: true, data: cut }, __debugHeaders);
  }

  // 将子服务错误码原样透传（含429/400等），若上游返回200包错则此处归一为400
  const statusPassthrough = aiResp.status || 400;
  return respondJSON(aiJson);
}
