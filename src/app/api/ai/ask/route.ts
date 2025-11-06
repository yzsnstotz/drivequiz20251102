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
  try {
    // 0) 选择 AI 服务（本地或在线）
    let selectedAiServiceUrl: string;
    let selectedAiServiceToken: string;
    let aiServiceMode: "local" | "online";
    
    // 检查 URL 参数是否强制选择模式
    let forceMode: "local" | "online" | null = null;
    try {
      const url = new URL(req.url);
      const aiParam = url.searchParams.get("ai")?.toLowerCase();
      if (aiParam === "local" || aiParam === "online") {
        forceMode = aiParam as "local" | "online";
      }
    } catch (e) {
      // Ignore URL parsing errors
    }
    
    // 从数据库读取 aiProvider 配置（如果 URL 参数没有强制指定）
    let aiProviderFromDb: "online" | "local" | null = null;
    if (!forceMode) {
      try {
        const configRow = await (aiDb as any)
          .selectFrom("ai_config")
          .select(["value"])
          .where("key", "=", "aiProvider")
          .executeTakeFirst();
        
        if (configRow && (configRow.value === "local" || configRow.value === "online")) {
          aiProviderFromDb = configRow.value as "online" | "local";
        }
      } catch (e) {
        // 如果读取配置失败，使用环境变量作为后备
        console.error("[AI Config] Failed to read aiProvider from database:", e);
      }
    }
    
    // 优先级：URL 参数 > 数据库配置 > 环境变量
    // 如果数据库配置存在，优先使用数据库配置；否则使用环境变量
    const wantLocal = forceMode 
      ? forceMode === "local" 
      : (aiProviderFromDb !== null 
          ? aiProviderFromDb === "local" 
          : USE_LOCAL_AI);
    
    if (wantLocal) {
      if (!LOCAL_AI_SERVICE_URL || !LOCAL_AI_SERVICE_TOKEN) {
        // 如果本地AI服务配置不完整，回退到在线服务
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
        selectedAiServiceUrl = AI_SERVICE_URL;
        selectedAiServiceToken = AI_SERVICE_TOKEN;
        aiServiceMode = "online";
      } else {
        selectedAiServiceUrl = LOCAL_AI_SERVICE_URL;
        selectedAiServiceToken = LOCAL_AI_SERVICE_TOKEN;
        aiServiceMode = "local";
      }
    } else {
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
      selectedAiServiceUrl = AI_SERVICE_URL;
      selectedAiServiceToken = AI_SERVICE_TOKEN;
      aiServiceMode = "online";
    }

    // 1) 用户鉴权（JWT）- 支持多种方式：Bearer header、Cookie、query 参数
    // 允许未登录用户匿名访问（使用匿名 ID）
    let jwt: string | null = null;
    
    // 1) Authorization: Bearer <jwt>
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      jwt = authHeader.slice("Bearer ".length).trim();
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
        }
      } catch (e) {
        console.error("[JWT] Cookie read error", (e as Error).message);
      }
    }
    
    // 3) Query 参数（?token=<jwt>，便于测试/脚本）
    if (!jwt) {
      try {
        const url = new URL(req.url);
        const token = url.searchParams.get("token");
        if (token && token.trim()) {
          jwt = token.trim();
        }
      } catch (e) {
        console.error("[JWT] URL parsing error", (e as Error).message);
      }
    }
    
    // 验证 JWT（如果提供了 token，否则使用匿名 ID）
    let session: { userId: string } | null = null;
    
    if (jwt) {
      // 先检查是否是激活token格式，激活token不需要JWT验证
      if (jwt.startsWith("act-")) {
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
            }
          }
        } catch (e) {
          console.error("[JWT] Failed to parse activation token", (e as Error).message);
        }
      } else {
        // 标准JWT格式，需要验证
        session = await verifyJwt(`Bearer ${jwt}`);
        
        // 如果配置了密钥但验证失败，拒绝请求（生产环境）
        if (!session && USER_JWT_SECRET && isProduction()) {
          console.error("[JWT] Production: JWT verification failed");
          return err("AUTH_REQUIRED", "Invalid or expired authentication token.", 401);
        }
      }
    }
    
    // 如果没有session，使用匿名ID
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

    // 4) 从users表获取userid（如果session.userId是act-格式，则查询数据库获取对应的userid）
    let forwardedUserId: string | null = null;
    
    if (session.userId === "anonymous") {
      forwardedUserId = null;
    } else if (session.userId.startsWith("act-")) {
      // 如果是act-格式，从users表查询对应的userid
      try {
        // 从act-{activationId}格式中提取activationId
        const parts = session.userId.split("-");
        if (parts.length >= 2 && parts[0] === "act") {
          const activationId = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(activationId) && activationId > 0) {
            // 通过activationId查找激活记录，然后查找用户
            const activation = await db
              .selectFrom("activations")
              .select(["email"])
              .where("id", "=", activationId)
              .executeTakeFirst();
            
            if (activation) {
              // 通过邮箱查找用户，获取userid
              const user = await db
                .selectFrom("users")
                .select(["userid"])
                .where("email", "=", activation.email)
                .executeTakeFirst();
              
              if (user?.userid) {
                forwardedUserId = user.userid;
              } else {
                // 如果用户表中没有userid，使用原始的act-格式（向后兼容）
                forwardedUserId = session.userId;
              }
            } else {
              // 激活记录不存在，使用原始格式
              forwardedUserId = session.userId;
            }
          } else {
            forwardedUserId = session.userId;
          }
        } else {
          forwardedUserId = session.userId;
        }
      } catch (error) {
        console.error("[JWT] Failed to fetch userid from database", (error as Error).message);
        // 查询失败时，使用原始userId（向后兼容）
        forwardedUserId = session.userId;
      }
    } else {
      // UUID格式或其他格式，直接使用
      forwardedUserId = session.userId;
    }
    
    // 确保 selectedAiServiceUrl 不重复 /v1 路径
    const baseUrl = selectedAiServiceUrl.replace(/\/v1\/?$/, "").replace(/\/+$/, "");
    
    const upstream = await fetch(`${baseUrl}/v1/ask`, {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=utf-8",
        authorization: `Bearer ${selectedAiServiceToken}`,
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
    if (result.ok && result.data) {
      // 在返回数据中添加AI类型信息
      return ok({
        ...result.data,
        aiProvider: aiServiceMode, // "online" 或 "local"
      });
    }
    
    // 如果result.ok为false，应该已经在上面处理了，这里作为后备
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
