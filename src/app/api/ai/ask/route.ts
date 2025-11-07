import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { db } from "@/lib/db";
import { aiDb } from "@/lib/aiDb";

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

// 本地 AI 服务配置（如果启用）
const USE_LOCAL_AI = process.env.USE_LOCAL_AI === "true" || process.env.USE_LOCAL_AI === "1";
const LOCAL_AI_SERVICE_URL = process.env.LOCAL_AI_SERVICE_URL;
const LOCAL_AI_SERVICE_TOKEN = process.env.LOCAL_AI_SERVICE_TOKEN;

// 在模块加载时记录环境变量（仅在开发环境）
if (process.env.NODE_ENV === "development") {
  console.log("[ENV MODULE] 环境变量配置", {
    USE_LOCAL_AI,
    LOCAL_AI_SERVICE_URL: LOCAL_AI_SERVICE_URL || "(empty)",
    AI_SERVICE_URL: AI_SERVICE_URL || "(empty)",
  });
}

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
  // 生产环境安全检查：必须配置 USER_JWT_SECRET
  if (isProduction()) {
    if (!USER_JWT_SECRET) {
      console.error("[JWT] Production environment requires USER_JWT_SECRET");
      return null;
    }
    // 生产环境必须提供有效的 Authorization header
    if (!authorization?.startsWith("Bearer ")) {
      return null;
    }
  }
  
  // 开发或预览环境：如果未配置 USER_JWT_SECRET，允许跳过认证（仅用于本地测试和预览）
  if (!USER_JWT_SECRET) {
    if (isDevelopmentOrPreview()) {
      // 开发模式兜底：如果有 Bearer token，即使不验证也允许通过
      if (authorization?.startsWith("Bearer ")) {
        const token = authorization.slice("Bearer ".length).trim();
        if (token) {
          // 尝试解析 payload（不验证签名，仅开发/预览模式）
          try {
            const [header, payload, signature] = token.split(".");
            if (!header || !payload) {
              return null;
            }
            const json = JSON.parse(atobUrlSafe(payload)) as { 
              sub?: string; 
              user_id?: string; 
              userId?: string;
              id?: string;
            };
            const userId = json.sub || json.user_id || json.userId || json.id || null;
            if (!userId || typeof userId !== "string") {
              return null;
            }
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (uuidRegex.test(userId)) {
              return { userId };
            }
            return null;
          } catch (e) {
            console.error("[JWT] Dev mode: parse error", (e as Error).message);
            return null;
          }
        }
      }
      // 开发或预览环境允许跳过认证
      return null; // 返回 null，让调用方使用匿名 ID
    }
    // 非开发/预览环境但未配置密钥，返回 null
    return null;
  }

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice("Bearer ".length).trim();
  
  try {
    // Supabase Legacy JWT Secret 通常是 Base64 编码的，需要先解码
    let secret: Uint8Array;
    try {
      // 尝试 Base64 解码（Supabase Legacy JWT Secret 格式）
      const decodedSecret = Buffer.from(USER_JWT_SECRET, "base64");
      secret = new Uint8Array(decodedSecret);
    } catch {
      // 如果 Base64 解码失败，使用原始字符串（向后兼容）
      secret = new TextEncoder().encode(USER_JWT_SECRET);
    }
    
    const { payload } = await jwtVerify(token, secret); // 默认允许 HS256
    
    // 尝试多种可能的字段名
    const payloadWithUserId = payload as { 
      sub?: string; 
      user_id?: string; 
      userId?: string;
      id?: string;
    };
    const userId = payloadWithUserId.sub || payloadWithUserId.user_id || payloadWithUserId.userId || payloadWithUserId.id || null;
    
    if (!userId || typeof userId !== "string") {
      return null;
    }
    
    // 验证是否为有效的 UUID 格式
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(userId)) {
      return { userId };
    }
    // 如果不是 UUID 格式，返回 null（将被视为匿名用户）
    return null;
  } catch (e) {
    console.error("[JWT] JWT verification failed", (e as Error).message);
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
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  console.log(`[${requestId}] [POST START] 请求开始`, {
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
  
  try {
    // 0) 选择 AI 服务（本地或在线）
    console.log(`[${requestId}] [STEP 0] 开始选择AI服务`);
    let selectedAiServiceUrl: string;
    let selectedAiServiceToken: string;
    let aiServiceMode: "local" | "online";
    
    // 记录环境变量状态
    console.log(`[${requestId}] [ENV CHECK] 环境变量检查`, {
      USE_LOCAL_AI: USE_LOCAL_AI,
      LOCAL_AI_SERVICE_URL: LOCAL_AI_SERVICE_URL ? `${LOCAL_AI_SERVICE_URL.substring(0, 20)}...` : "(empty)",
      LOCAL_AI_SERVICE_TOKEN: LOCAL_AI_SERVICE_TOKEN ? "***" : "(empty)",
      AI_SERVICE_URL: AI_SERVICE_URL ? `${AI_SERVICE_URL.substring(0, 20)}...` : "(empty)",
      AI_SERVICE_TOKEN: AI_SERVICE_TOKEN ? "***" : "(empty)",
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV,
    });
    
    // 检查 URL 参数是否强制选择模式
    let forceMode: "local" | "online" | null = null;
    try {
      const url = new URL(req.url);
      const aiParam = url.searchParams.get("ai")?.toLowerCase();
      if (aiParam === "local" || aiParam === "online") {
        forceMode = aiParam as "local" | "online";
        console.log(`[${requestId}] [STEP 0.1] URL参数强制模式: ${forceMode}`);
      }
    } catch (e) {
      console.error(`[${requestId}] [STEP 0.1] URL解析错误:`, (e as Error).message);
      // Ignore URL parsing errors
    }
    
    // 从数据库读取 aiProvider 配置（如果 URL 参数没有强制指定）
    let aiProviderFromDb: "online" | "local" | null = null;
    if (!forceMode) {
      try {
        console.log(`[${requestId}] [STEP 0.2] 从数据库读取aiProvider配置`);
        const configRow = await (aiDb as any)
          .selectFrom("ai_config")
          .select(["value"])
          .where("key", "=", "aiProvider")
          .executeTakeFirst();
        
        if (configRow && (configRow.value === "local" || configRow.value === "online")) {
          aiProviderFromDb = configRow.value as "online" | "local";
          console.log(`[${requestId}] [STEP 0.2] 数据库配置: ${aiProviderFromDb}`);
        } else {
          console.log(`[${requestId}] [STEP 0.2] 数据库配置为空或无效`);
        }
      } catch (e) {
        // 如果读取配置失败，使用环境变量作为后备
        console.error(`[${requestId}] [STEP 0.2] 数据库读取失败:`, (e as Error).message);
      }
    }
    
    // 优先级：URL 参数 > 数据库配置 > 环境变量
    // 如果数据库配置存在，优先使用数据库配置；否则使用环境变量
    const wantLocal = forceMode 
      ? forceMode === "local" 
      : (aiProviderFromDb !== null 
          ? aiProviderFromDb === "local" 
          : USE_LOCAL_AI);
    
    console.log(`[${requestId}] [STEP 0.3] AI服务选择决策`, {
      forceMode,
      aiProviderFromDb,
      USE_LOCAL_AI,
      wantLocal,
    });
    
    if (wantLocal) {
      if (!LOCAL_AI_SERVICE_URL || !LOCAL_AI_SERVICE_TOKEN) {
        console.warn(`[${requestId}] [STEP 0.4] 本地AI服务配置不完整，回退到在线服务`);
        // 如果本地AI服务配置不完整，回退到在线服务
        if (!AI_SERVICE_URL || !AI_SERVICE_TOKEN) {
          console.error(`[${requestId}] [STEP 0.4] 在线AI服务配置也不完整，返回错误`);
          return err(
            "INTERNAL_ERROR",
            "AI service is not configured.",
            500,
            { missing: ["AI_SERVICE_URL", "AI_SERVICE_TOKEN"].filter(
              (k) => !process.env[k as "AI_SERVICE_URL" | "AI_SERVICE_TOKEN"],
            ) },
          );
        }
        selectedAiServiceUrl = AI_SERVICE_URL;
        selectedAiServiceToken = AI_SERVICE_TOKEN;
        aiServiceMode = "online";
        console.log(`[${requestId}] [STEP 0.4] 已选择在线AI服务（回退）`);
      } else {
        selectedAiServiceUrl = LOCAL_AI_SERVICE_URL;
        selectedAiServiceToken = LOCAL_AI_SERVICE_TOKEN;
        aiServiceMode = "local";
        console.log(`[${requestId}] [STEP 0.4] 已选择本地AI服务`);
      }
    } else {
      if (!AI_SERVICE_URL || !AI_SERVICE_TOKEN) {
        console.error(`[${requestId}] [STEP 0.4] 在线AI服务配置不完整，返回错误`);
        return err(
          "INTERNAL_ERROR",
          "AI service is not configured.",
          500,
          { missing: ["AI_SERVICE_URL", "AI_SERVICE_TOKEN"].filter(
            (k) => !process.env[k as "AI_SERVICE_URL" | "AI_SERVICE_TOKEN"],
          ) },
        );
      }
      selectedAiServiceUrl = AI_SERVICE_URL;
      selectedAiServiceToken = AI_SERVICE_TOKEN;
      aiServiceMode = "online";
      console.log(`[${requestId}] [STEP 0.4] 已选择在线AI服务`);
    }
    
    console.log(`[${requestId}] [STEP 0.5] AI服务选择完成`, {
      mode: aiServiceMode,
      url: selectedAiServiceUrl ? `${selectedAiServiceUrl.substring(0, 30)}...` : "(empty)",
      hasToken: !!selectedAiServiceToken,
    });

    // 1) 用户鉴权（JWT）- 支持多种方式：Bearer header、Cookie、query 参数
    // 允许未登录用户匿名访问（使用匿名 ID）
    console.log(`[${requestId}] [STEP 1] 开始JWT验证`);
    let jwt: string | null = null;
    
    // 1) Authorization: Bearer <jwt>
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      jwt = authHeader.slice("Bearer ".length).trim();
      console.log(`[${requestId}] [STEP 1.1] 从Authorization header获取JWT`);
    }
    
    // 2) Cookie（优先检查 USER_TOKEN，兼容移动端）
    if (!jwt) {
      try {
        // 优先检查 USER_TOKEN cookie（激活时设置的）
        let cookieJwt = req.cookies.get("USER_TOKEN")?.value;
        if (!cookieJwt) {
          // 如果没有 USER_TOKEN，检查 sb-access-token（Supabase 前端可能使用）
          cookieJwt = req.cookies.get("sb-access-token")?.value;
        }
        
        if (cookieJwt && cookieJwt.trim()) {
          jwt = cookieJwt.trim();
          console.log(`[${requestId}] [STEP 1.2] 从Cookie获取JWT`);
        }
      } catch (e) {
        console.error(`[${requestId}] [STEP 1.2] Cookie读取错误:`, (e as Error).message);
      }
    }
    
    // 3) Query 参数（?token=<jwt>，便于测试/脚本）
    if (!jwt) {
      try {
        const url = new URL(req.url);
        const token = url.searchParams.get("token");
        if (token && token.trim()) {
          jwt = token.trim();
          console.log(`[${requestId}] [STEP 1.3] 从Query参数获取JWT`);
        }
      } catch (e) {
        console.error(`[${requestId}] [STEP 1.3] URL解析错误:`, (e as Error).message);
      }
    }
    
    if (!jwt) {
      console.log(`[${requestId}] [STEP 1.4] 未找到JWT，将使用匿名ID`);
    }
    
    // 验证 JWT（如果提供了 token，否则使用匿名 ID）
    let session: { userId: string } | null = null;
    
    if (jwt) {
      // 先检查是否是激活token格式，激活token不需要JWT验证
      if (jwt.startsWith("act-")) {
        console.log(`[${requestId}] [STEP 1.5] 检测到激活token格式`);
        // 处理激活token（act-xxxxxxxx-xxxxxxxx格式）
        try {
          const parts = jwt.split("-");
          if (parts.length >= 3 && parts[0] === "act") {
            // 从 act-{hash}-{activationId} 格式中提取 activationId（最后一个部分）
            const activationId = parseInt(parts[parts.length - 1], 16); // 从hex转换为数字
            if (!isNaN(activationId) && activationId > 0) {
              // 使用activationId作为用户ID（格式：act-{activationId}）
              const userId = `act-${activationId}`;
              session = { userId };
              console.log(`[${requestId}] [STEP 1.5] 激活token解析成功: ${userId}`);
            }
          }
        } catch (e) {
          console.error(`[${requestId}] [STEP 1.5] 激活token解析失败:`, (e as Error).message);
        }
      } else {
        // 标准JWT格式，需要验证
        console.log(`[${requestId}] [STEP 1.6] 开始验证标准JWT`);
        session = await verifyJwt(`Bearer ${jwt}`);
        
        if (session) {
          console.log(`[${requestId}] [STEP 1.6] JWT验证成功: ${session.userId}`);
        } else {
          console.warn(`[${requestId}] [STEP 1.6] JWT验证失败`);
        }
        
        // 如果配置了密钥但验证失败，拒绝请求（生产环境）
        if (!session && USER_JWT_SECRET && isProduction()) {
          console.error(`[${requestId}] [STEP 1.6] 生产环境JWT验证失败，返回401`);
          return err("AUTH_REQUIRED", "Invalid or expired authentication token.", 401);
        }
      }
    }
    
    // 如果没有session，使用匿名ID
    if (!session) {
      session = { userId: "anonymous" };
      console.log(`[${requestId}] [STEP 1.7] 使用匿名ID`);
    }
    
    console.log(`[${requestId}] [STEP 1.8] 会话信息`, {
      userId: session.userId,
      isAnonymous: session.userId === "anonymous",
    });

    // 2) 解析与参数校验
    console.log(`[${requestId}] [STEP 2] 开始解析请求体`);
    let body: AskRequest | null = null;
    try {
      body = (await req.json()) as AskRequest | null;
      console.log(`[${requestId}] [STEP 2.1] 请求体解析成功`, {
        hasQuestion: !!body?.question,
        questionLength: body?.question?.length || 0,
        hasLocale: !!body?.locale,
      });
    } catch (e) {
      console.error(`[${requestId}] [STEP 2.1] 请求体解析失败:`, (e as Error).message);
      return err("VALIDATION_FAILED", "Invalid JSON body.", 400);
    }
    
    if (!body || typeof body.question !== "string") {
      console.error(`[${requestId}] [STEP 2.2] 请求体缺少question字段`);
      return err("VALIDATION_FAILED", "question is required.", 400);
    }

    const question = normalizeQuestion(body.question);
    if (question.length === 0) {
      console.error(`[${requestId}] [STEP 2.3] question为空`);
      return err("VALIDATION_FAILED", "question is empty.", 400);
    }
    if (question.length > QUESTION_MAX) {
      console.error(`[${requestId}] [STEP 2.4] question过长: ${question.length} > ${QUESTION_MAX}`);
      return err("VALIDATION_FAILED", "question too long.", 400);
    }

    const locale = body.locale?.trim();
    if (locale && !BCP47.test(locale)) {
      console.error(`[${requestId}] [STEP 2.5] locale格式无效: ${locale}`);
      return err("VALIDATION_FAILED", "invalid locale.", 400);
    }
    
    console.log(`[${requestId}] [STEP 2.6] 参数校验通过`, {
      questionLength: question.length,
      locale: locale || "(none)",
    });

    // 3) 配额检查（用户维度 10次/日）
    console.log(`[${requestId}] [STEP 3] 开始配额检查`);
    touchResetIfNeeded();
    const k = session.userId;
    const nowKey = lastDayKey;
    const c = counters.get(k);
    if (!c || c.dayKey !== nowKey) {
      counters.set(k, { count: 1, dayKey: nowKey });
      console.log(`[${requestId}] [STEP 3.1] 配额检查通过（新用户/新日期）`, {
        userId: k,
        count: 1,
        dayKey: nowKey,
      });
    } else {
      if (c.count >= DAILY_LIMIT) {
        console.warn(`[${requestId}] [STEP 3.2] 配额已超限`, {
          userId: k,
          count: c.count,
          limit: DAILY_LIMIT,
        });
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
      console.log(`[${requestId}] [STEP 3.3] 配额检查通过`, {
        userId: k,
        count: c.count,
        limit: DAILY_LIMIT,
      });
    }

    // 4) 从users表获取userid（如果session.userId是act-格式，则查询数据库获取对应的userid）
    console.log(`[${requestId}] [STEP 4] 开始处理userId转发`);
    let forwardedUserId: string | null = null;
    
    if (session.userId === "anonymous") {
      forwardedUserId = null;
      console.log(`[${requestId}] [STEP 4.1] 匿名用户，forwardedUserId = null`);
    } else if (session.userId.startsWith("act-")) {
      console.log(`[${requestId}] [STEP 4.2] 检测到act-格式，查询数据库`);
      // 如果是act-格式，从users表查询对应的userid
      try {
        // 从act-{activationId}格式中提取activationId
        const parts = session.userId.split("-");
        if (parts.length >= 2 && parts[0] === "act") {
          const activationId = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(activationId) && activationId > 0) {
            console.log(`[${requestId}] [STEP 4.2.1] 查询激活记录: activationId=${activationId}`);
            // 通过activationId查找激活记录，然后查找用户
            const activation = await db
              .selectFrom("activations")
              .select(["email"])
              .where("id", "=", activationId)
              .executeTakeFirst();
            
            if (activation) {
              console.log(`[${requestId}] [STEP 4.2.2] 激活记录找到，查询用户: email=${activation.email}`);
              // 通过邮箱查找用户，获取userid
              const user = await db
                .selectFrom("users")
                .select(["userid"])
                .where("email", "=", activation.email)
                .executeTakeFirst();
              
              if (user?.userid) {
                forwardedUserId = user.userid;
                console.log(`[${requestId}] [STEP 4.2.3] 用户找到: userid=${forwardedUserId}`);
              } else {
                // 如果用户表中没有userid，使用原始的act-格式（向后兼容）
                forwardedUserId = session.userId;
                console.log(`[${requestId}] [STEP 4.2.3] 用户未找到，使用原始格式: ${forwardedUserId}`);
              }
            } else {
              // 激活记录不存在，使用原始格式
              forwardedUserId = session.userId;
              console.log(`[${requestId}] [STEP 4.2.2] 激活记录未找到，使用原始格式: ${forwardedUserId}`);
            }
          } else {
            forwardedUserId = session.userId;
            console.log(`[${requestId}] [STEP 4.2.1] activationId无效，使用原始格式: ${forwardedUserId}`);
          }
        } else {
          forwardedUserId = session.userId;
          console.log(`[${requestId}] [STEP 4.2] act-格式解析失败，使用原始格式: ${forwardedUserId}`);
        }
      } catch (error) {
        console.error(`[${requestId}] [STEP 4.2] 数据库查询失败:`, (error as Error).message);
        // 查询失败时，使用原始userId（向后兼容）
        forwardedUserId = session.userId;
      }
    } else {
      // UUID格式或其他格式，直接使用
      forwardedUserId = session.userId;
      console.log(`[${requestId}] [STEP 4.3] 直接使用session.userId: ${forwardedUserId}`);
    }
    
    console.log(`[${requestId}] [STEP 4.4] userId转发完成`, {
      originalUserId: session.userId,
      forwardedUserId,
    });
    
    // 确保 selectedAiServiceUrl 不重复 /v1 路径
    const baseUrl = selectedAiServiceUrl.replace(/\/v1\/?$/, "").replace(/\/+$/, "");
    const upstreamUrl = `${baseUrl}/v1/ask`;
    
    console.log(`[${requestId}] [STEP 5] 开始向上游服务发送请求`, {
      url: upstreamUrl,
      mode: aiServiceMode,
      baseUrl: baseUrl,
      selectedAiServiceUrl: selectedAiServiceUrl,
    });
    
    const requestBody = {
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
    };
    
    console.log(`[${requestId}] [STEP 5.1] 请求体准备完成`, {
      userId: forwardedUserId,
      questionLength: question.length,
      locale: locale || "(none)",
    });
    
    let upstream: Response;
    let upstreamError: Error | null = null;
    const fetchStartTime = Date.now();
    try {
      // 添加超时控制（30秒）
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 30000); // 30秒超时
      
      console.log(`[${requestId}] [STEP 5.2] 开始fetch请求`, {
        url: upstreamUrl,
        method: "POST",
        hasBody: !!requestBody,
        timeout: 30000,
      });
      
      upstream = await fetch(upstreamUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json; charset=utf-8",
          authorization: `Bearer ${selectedAiServiceToken}`,
          "x-zalem-client": "web",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      const fetchDuration = Date.now() - fetchStartTime;
      
      console.log(`[${requestId}] [STEP 5.2] 上游请求完成`, {
        status: upstream.status,
        statusText: upstream.statusText,
        ok: upstream.ok,
        duration: `${fetchDuration}ms`,
      });
    } catch (error) {
      const fetchDuration = Date.now() - fetchStartTime;
      upstreamError = error as Error;
      
      // 提取更详细的错误信息
      const errorDetails: Record<string, unknown> = {
        error: upstreamError.message,
        errorName: upstreamError.name,
        duration: `${fetchDuration}ms`,
        url: upstreamUrl,
        mode: aiServiceMode,
      };
      
      // 检查是否是超时错误
      if (upstreamError.name === "AbortError" || upstreamError.message.includes("timeout")) {
        errorDetails.errorType = "TIMEOUT";
        console.error(`[${requestId}] [STEP 5.2] 上游请求超时:`, errorDetails);
        return err("PROVIDER_ERROR", "AI service request timeout (30s)", 504);
      }
      
      // 检查是否是网络连接错误
      if (upstreamError.message.includes("fetch failed") || upstreamError.message.includes("ECONNREFUSED") || upstreamError.message.includes("ENOTFOUND")) {
        errorDetails.errorType = "NETWORK_ERROR";
        errorDetails.stack = upstreamError.stack;
        
        // 尝试解析URL以获取更多信息
        try {
          const urlObj = new URL(upstreamUrl);
          errorDetails.hostname = urlObj.hostname;
          errorDetails.port = urlObj.port || (urlObj.protocol === "https:" ? 443 : 80);
          errorDetails.protocol = urlObj.protocol;
        } catch (urlError) {
          errorDetails.urlParseError = (urlError as Error).message;
        }
        
        console.error(`[${requestId}] [STEP 5.2] 上游请求网络错误:`, errorDetails);
        
        // 如果当前使用的是本地AI服务，尝试回退到在线AI服务
        if (aiServiceMode === "local" && AI_SERVICE_URL && AI_SERVICE_TOKEN) {
          console.warn(`[${requestId}] [STEP 5.2.1] 本地AI服务失败，尝试回退到在线AI服务`);
          const fallbackBaseUrl = AI_SERVICE_URL.replace(/\/v1\/?$/, "").replace(/\/+$/, "");
          const fallbackUrl = `${fallbackBaseUrl}/v1/ask`;
          
          console.log(`[${requestId}] [STEP 5.2.2] 开始回退请求`, {
            url: fallbackUrl,
            mode: "online",
          });
          
          const fallbackStartTime = Date.now();
          try {
            const fallbackController = new AbortController();
            // 回退请求使用更长的超时时间（90秒），因为AI服务可能需要更长时间生成回答
            const fallbackTimeout = 90000; // 90秒
            const fallbackTimeoutId = setTimeout(() => {
              fallbackController.abort();
            }, fallbackTimeout);
            
            console.log(`[${requestId}] [STEP 5.2.2.1] 回退请求配置`, {
              timeout: fallbackTimeout,
              url: fallbackUrl,
            });
            
            const fallbackResponse = await fetch(fallbackUrl, {
              method: "POST",
              headers: {
                "content-type": "application/json; charset=utf-8",
                authorization: `Bearer ${AI_SERVICE_TOKEN}`,
                "x-zalem-client": "web",
              },
              body: JSON.stringify(requestBody),
              signal: fallbackController.signal,
            });
            
            clearTimeout(fallbackTimeoutId);
            const fallbackDuration = Date.now() - fallbackStartTime;
            
            console.log(`[${requestId}] [STEP 5.2.3] 回退请求成功`, {
              status: fallbackResponse.status,
              statusText: fallbackResponse.statusText,
              ok: fallbackResponse.ok,
              duration: `${fallbackDuration}ms`,
            });
            
            // 使用回退响应继续处理
            upstream = fallbackResponse;
            aiServiceMode = "online"; // 更新模式标记
          } catch (fallbackError) {
            const fallbackDuration = Date.now() - fallbackStartTime;
            const fallbackErr = fallbackError as Error;
            
            // 检查是否是超时错误
            if (fallbackErr.name === "AbortError" || fallbackErr.message.includes("aborted")) {
              console.error(`[${requestId}] [STEP 5.2.3] 回退请求超时:`, {
                error: fallbackErr.message,
                duration: `${fallbackDuration}ms`,
                timeout: "90s",
              });
              return err("PROVIDER_ERROR", `Both local and online AI services failed. Local: ${upstreamError.message}. Fallback: Request timeout (90s). The AI service may be slow or unavailable.`, 504);
            }
            
            // 其他错误
            console.error(`[${requestId}] [STEP 5.2.3] 回退请求也失败:`, {
              error: fallbackErr.message,
              errorName: fallbackErr.name,
              duration: `${fallbackDuration}ms`,
              stack: fallbackErr.stack,
            });
            return err("PROVIDER_ERROR", `Both local and online AI services failed. Local: ${upstreamError.message}. Fallback: ${fallbackErr.message}`, 502);
          }
        } else {
          // 没有回退选项，直接返回错误
          return err("PROVIDER_ERROR", `Failed to connect to AI service: ${upstreamError.message}. Please check if the service URL is correct and accessible.`, 502);
        }
      }
      
      // 其他错误
      errorDetails.errorType = "UNKNOWN_ERROR";
      errorDetails.stack = upstreamError.stack;
      console.error(`[${requestId}] [STEP 5.2] 上游请求失败:`, errorDetails);
      return err("PROVIDER_ERROR", `Failed to connect to AI service: ${upstreamError.message}`, 502);
    }

    let result: AiServiceResponse;
    try {
      const responseText = await upstream.text();
      console.log(`[${requestId}] [STEP 5.3] 上游响应文本长度: ${responseText.length}`);
      
      try {
        result = JSON.parse(responseText) as AiServiceResponse;
        console.log(`[${requestId}] [STEP 5.4] 上游响应解析成功`, {
          ok: result.ok,
          hasData: !!result.data,
          errorCode: result.errorCode || "(none)",
          message: result.message || "(none)",
        });
      } catch (parseError) {
        console.error(`[${requestId}] [STEP 5.4] 上游响应JSON解析失败:`, {
          error: (parseError as Error).message,
          responsePreview: responseText.substring(0, 200),
        });
        return err("PROVIDER_ERROR", "Invalid response from AI service", 502);
      }
    } catch (error) {
      console.error(`[${requestId}] [STEP 5.3] 读取上游响应失败:`, (error as Error).message);
      return err("PROVIDER_ERROR", `Failed to read response from AI service: ${(error as Error).message}`, 502);
    }

    // 5) 上游异常与统一透传
    console.log(`[${requestId}] [STEP 6] 开始处理上游响应`);
    if (!upstream.ok || !result.ok) {
      const status = upstream.status || 502;
      console.warn(`[${requestId}] [STEP 6.1] 上游返回错误`, {
        upstreamOk: upstream.ok,
        resultOk: result.ok,
        status,
        errorCode: result.errorCode,
        message: result.message,
      });
      
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
      console.error(`[${requestId}] [STEP 6.2] 返回错误响应`, {
        code,
        message: msg,
        status: mapStatus(status),
      });
      return err(code, msg, mapStatus(status));
    }
    
    console.log(`[${requestId}] [STEP 6.3] 上游响应成功`);

    // 6) 成功：记录AI聊天行为到缓存（异步，不阻塞响应）
    if (result.ok && session.userId !== "anonymous" && forwardedUserId) {
      // forwardedUserId就是userid（如act-13），直接通过userid查找用户
      // 使用异步执行，不阻塞响应
      void (async () => {
        try {
          let userId: number | null = null;
          
          // 重试机制：最多重试3次
          let retries = 3;
          let lastError: Error | null = null;
          
          while (retries > 0) {
            try {
              // 直接通过userid查找用户（不需要通过activation）
              // 添加超时处理：使用 Promise.race 实现超时
              const queryPromise = db
                .selectFrom("users")
                .select(["id"])
                .where("userid", "=", forwardedUserId)
                .executeTakeFirst();
              
              const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error("Database query timeout")), 10000); // 10秒超时
              });
              
              const user = await Promise.race([queryPromise, timeoutPromise]);
              
              if (user) {
                userId = user.id;
              }
              
              // 查询成功，跳出重试循环
              break;
            } catch (error) {
              lastError = error as Error;
              retries--;
              
              // 如果是连接错误，等待后重试
              if (retries > 0 && (
                (error as Error).message.includes("Connection terminated") ||
                (error as Error).message.includes("timeout") ||
                (error as Error).message.includes("pool") ||
                (error as Error).message.includes("shutdown")
              )) {
                // 等待指数退避：1秒、2秒、4秒
                const waitTime = Math.pow(2, 3 - retries) * 1000;
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
              }
              
              // 其他错误或重试次数用完，抛出错误
              throw error;
            }
          }
          
          // 如果所有重试都失败，记录错误但不影响主流程
          if (retries === 0 && lastError) {
            throw lastError;
          }
          
          // 如果找到了用户ID，记录到缓存
          if (userId) {
            const { getAiChatBehaviorCache } = await import("@/lib/aiChatBehaviorCacheServer");
            const cache = getAiChatBehaviorCache();
            
            const ipAddress =
              req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
              req.headers.get("x-real-ip")?.trim() ||
              null;
            const userAgent = req.headers.get("user-agent") || null;
            const clientType = "web"; // 可以从请求头或其他地方获取
            
            // 添加到缓存（异步，不阻塞）
            // 在Serverless环境中，立即写入更可靠（不依赖定时器）
            const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
            cache.addChatRecord(userId, question, ipAddress, userAgent, clientType, !!isServerless);
          }
        } catch (error) {
          // 记录行为失败不影响主流程，仅记录日志
          // 过滤掉常见的连接错误，避免日志过多
          const errorMessage = (error as Error).message || String(error);
          if (
            !errorMessage.includes("Connection terminated") &&
            !errorMessage.includes("timeout") &&
            !errorMessage.includes("pool") &&
            !errorMessage.includes("shutdown") &&
            !errorMessage.includes("DbHandler exited")
          ) {
            console.error("[AI Ask] Failed to record chat behavior:", error);
          }
        }
      })();
    }

    // 7) 成功：返回结果，包含AI类型信息
    console.log(`[${requestId}] [STEP 7] 准备返回成功响应`);
    if (result.ok && result.data) {
      // 在返回数据中添加AI类型信息
      const responseData = {
        ...result.data,
        aiProvider: aiServiceMode, // "online" 或 "local"
      };
      
      console.log(`[${requestId}] [STEP 7.1] 返回成功响应`, {
        hasAnswer: !!result.data.answer,
        answerLength: result.data.answer?.length || 0,
        hasSources: !!result.data.sources,
        sourcesCount: result.data.sources?.length || 0,
        model: result.data.model || "(none)",
        aiProvider: aiServiceMode,
      });
      
      return ok(responseData);
    }
    
    // 如果result.ok为false，应该已经在上面处理了，这里作为后备
    console.warn(`[${requestId}] [STEP 7.2] result.ok为false但未在上游处理，返回空数据`);
    return ok(result.data || {});
  } catch (e) {
    const error = e as Error;
    console.error(`[${requestId}] [ERROR] 未捕获的异常`, {
      error: error.message,
      stack: error.stack,
      name: error.name,
    });
    return err("INTERNAL_ERROR", `Unexpected server error: ${error.message}`, 500);
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
