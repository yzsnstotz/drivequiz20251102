import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { db } from "@/lib/db";
import { aiDb } from "@/lib/aiDb";
import { calculateQuestionHash } from "@/lib/questionHash";
import {
  getAIAnswerFromJson,
  getAIAnswerFromDb,
  saveAIAnswerToDb,
} from "@/lib/questionDb";

// 用户缓存存储（内存缓存，按用户ID和题目hash存储）
// 格式：Map<userId, Map<questionHash, answer>>
const userAnswerCache = new Map<string, Map<string, string>>();

/**
 * 获取用户缓存的AI答案
 */
function getUserCachedAnswer(userId: string | null, questionHash: string): string | null {
  if (!userId || !questionHash) return null;
  const userCache = userAnswerCache.get(userId);
  if (!userCache) return null;
  return userCache.get(questionHash) || null;
}

/**
 * 存储用户缓存的AI答案
 */
function setUserCachedAnswer(userId: string | null, questionHash: string, answer: string): void {
  if (!userId || !questionHash || !answer) return;
  let userCache = userAnswerCache.get(userId);
  if (!userCache) {
    userCache = new Map();
    userAnswerCache.set(userId, userCache);
  }
  userCache.set(questionHash, answer);
  // 限制每个用户的缓存大小（最多1000条）
  if (userCache.size > 1000) {
    const entries = Array.from(userCache.entries());
    entries.slice(0, entries.length - 1000).forEach(([key]) => userCache!.delete(key));
  }
}

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
  questionHash?: string; // 题目的hash值（从JSON包或数据库获取，避免重复计算）
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
    cached?: boolean; // 缓存标识
    aiProvider?: string; // AI 服务提供商
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
const LOCAL_AI_SERVICE_URL = process.env.LOCAL_AI_SERVICE_URL?.trim();
const LOCAL_AI_SERVICE_TOKEN = process.env.LOCAL_AI_SERVICE_TOKEN?.trim();

// 直连 OpenRouter 配置
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY?.trim();
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL?.trim();
const OPENROUTER_REFERER_URL = process.env.OPENROUTER_REFERER_URL?.trim();
const OPENROUTER_APP_NAME = process.env.OPENROUTER_APP_NAME?.trim();

// 直连 OpenAI 配置
const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim();
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL?.trim();

// 在模块加载时记录环境变量（仅在开发环境）
if (process.env.NODE_ENV === "development") {
  console.log("[ENV MODULE] 环境变量配置", {
    LOCAL_AI_SERVICE_URL: LOCAL_AI_SERVICE_URL || "(empty)",
    AI_SERVICE_URL: AI_SERVICE_URL || "(empty)",
    OPENROUTER_BASE_URL: OPENROUTER_BASE_URL || "(empty)",
  });
}

type AiProviderValue = "openai" | "local" | "openrouter" | "openrouter_direct" | "openai_direct";

function requireEnvVar(key: string): string {
  const raw = process.env[key];
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new Error(`${key} is not configured.`);
  }
  return raw.trim();
}

function normalizeAiProviderValue(value: string | null | undefined): AiProviderValue | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  switch (v) {
    case "online":
    case "openai":
      return "openai";
    case "local":
      return "local";
    case "openrouter":
      return "openrouter";
    case "openrouter-direct":
    case "openrouter_direct":
      return "openrouter_direct";
    case "openai-direct":
    case "openai_direct":
      return "openai_direct";
    default:
      return null;
  }
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

/**
 * 规范化 locale：将 zh-CN、zh_CN 等格式转换为 zh（与查询逻辑保持一致）
 * 确保写入和查询时使用相同的 locale 格式
 */
function normalizeLocale(locale: string | undefined | null): string {
  if (!locale) return "zh";
  const localeLower = locale.toLowerCase().trim();
  if (localeLower.startsWith("zh")) {
    return "zh";
  } else if (localeLower.startsWith("ja")) {
    return "ja";
  } else if (localeLower.startsWith("en")) {
    return "en";
  }
  return locale;
}

// ==== 辅助函数：构建系统提示 ====
function buildSystemPrompt(lang: string): string {
  const base =
    "你是 ZALEM 驾驶考试学习助手。请基于日本交通法规与题库知识回答用户问题，引用时要简洁，不编造，不输出与驾驶考试无关的内容。";
  if (lang === "ja") {
    return "あなたは ZALEM の運転免許学習アシスタントです。日本の交通法規と問題集の知識に基づいて、簡潔かつ正確に回答してください。推測や捏造は禁止し、関係のない内容は出力しないでください。";
  }
  if (lang === "en") {
    return "You are ZALEM's driving-test study assistant. Answer based on Japan's traffic laws and question bank. Be concise and accurate. Do not fabricate or include unrelated content.";
  }
  return base;
}

// ==== 辅助函数：简化版安全审查 ====
function checkSafetySimple(text: string): { pass: boolean; reason?: string } {
  const normalized = (text || "").toLowerCase().trim();
  
  // 高风险关键词
  const hardBlocks = [
    { pattern: /自杀|轻生|suicide|kill myself/, reason: "内容涉及自残/自杀等高风险内容，建议寻求专业帮助。" },
    { pattern: /制造爆炸物|bomb making|homemade explosive/, reason: "涉及违法犯罪的方法或操作，无法提供帮助。" },
    { pattern: /毒品制作|cook meth|制造毒品/, reason: "涉及违法犯罪的方法或操作，无法提供帮助。" },
    { pattern: /信用卡盗刷|刷卡器|skimmer/, reason: "涉及违法犯罪的方法或操作，无法提供帮助。" },
    { pattern: /性爱|色情|裸照|av |成人片|约炮|口交|肛交|强奸|乱伦/, reason: "涉及成人/性相关内容，无法提供帮助。" },
    { pattern: /杀人|自制爆炸物|爆炸物|砍杀|恐袭|恐怖袭击|血腥|处决|制炸弹/, reason: "涉及暴力与极端伤害内容，无法提供帮助。" },
  ];
  
  for (const block of hardBlocks) {
    if (block.pattern.test(normalized)) {
      return { pass: false, reason: block.reason };
    }
  }
  
  return { pass: true };
}

// ==== 辅助函数：写入 ai_logs 表 ====
/**
 * 将AI回答写入 ai_logs 表（异步，不阻塞响应）
 * 作为AI服务写入的备份，确保所有AI回答都被保存
 */
async function writeAiLogToDatabase(params: {
  userId: string | null;
  question: string;
  answer: string;
  locale: string | undefined;
  model: string;
  ragHits: number;
  safetyFlag: "ok" | "needs_human" | "blocked";
  costEstUsd: number | null;
  sources?: Array<{ title: string; url: string; snippet?: string }>;
  createdAtIso?: string;
  from?: string | null; // "study" | "question" | "chat" 等，标识来源
  aiProvider?: string | null; // "openai" | "local" | "openrouter" | "openrouter_direct" | "openai_direct" | "cache"
  cached?: boolean | null; // 是否是缓存
  cacheSource?: string | null; // "json" | "database"，缓存来源
}): Promise<void> {
  try {
    // 规范化 userId：如果是 act- 格式，直接使用；如果是 anonymous，设为 null
    let normalizedUserId: string | null = null;
    if (params.userId && params.userId !== "anonymous") {
      // 如果是 act- 格式，直接使用
      if (params.userId.startsWith("act-")) {
        normalizedUserId = params.userId;
      } else {
        // 尝试验证是否为有效的 UUID 格式
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(params.userId)) {
          normalizedUserId = params.userId;
        }
      }
    }

    // 规范化 locale：将 zh-CN、zh_CN 等格式转换为 zh
    let normalizedLocale: string | null = null;
    if (params.locale) {
      const localeLower = params.locale.toLowerCase();
      if (localeLower.startsWith("zh")) {
        normalizedLocale = "zh";
      } else if (localeLower.startsWith("ja")) {
        normalizedLocale = "ja";
      } else if (localeLower.startsWith("en")) {
        normalizedLocale = "en";
      } else {
        normalizedLocale = params.locale;
      }
    }

    // 准备 sources JSONB 数据
    const sourcesJson = params.sources && params.sources.length > 0 
      ? JSON.stringify(params.sources) 
      : null;

    // 写入数据库
    await aiDb
      .insertInto("ai_logs")
      .values({
        user_id: normalizedUserId,
        question: params.question,
        answer: params.answer,
        locale: normalizedLocale,
        model: params.model,
        rag_hits: params.ragHits,
        safety_flag: params.safetyFlag,
        cost_est: params.costEstUsd,
        sources: sourcesJson as any, // JSONB 字段
        from: params.from || null, // 来源标识
        ai_provider: params.aiProvider || null, // AI服务提供商
        cached: params.cached || false, // 是否是缓存
        cache_source: params.cacheSource || null, // 缓存来源
        created_at: params.createdAtIso ? new Date(params.createdAtIso) : new Date(),
      })
      .execute();
  } catch (error) {
    // 写入失败不影响主流程，仅记录日志
    const errorMessage = (error as Error).message || String(error);
    // 过滤掉常见的连接错误，避免日志过多
    if (
      !errorMessage.includes("Connection terminated") &&
      !errorMessage.includes("timeout") &&
      !errorMessage.includes("pool") &&
      !errorMessage.includes("shutdown")
    ) {
      console.error("[AI Ask] Failed to write ai_logs:", errorMessage);
    }
  }
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
    let selectedAiServiceUrl: string | undefined;
    let selectedAiServiceToken: string | undefined;
    let aiServiceMode: "local" | "openai" | "openrouter" | "openrouter_direct" | "openai_direct";
    
    // 记录环境变量状态
    console.log(`[${requestId}] [ENV CHECK] 环境变量检查`, {
      LOCAL_AI_SERVICE_URL: LOCAL_AI_SERVICE_URL ? `${LOCAL_AI_SERVICE_URL.substring(0, 20)}...` : "(empty)",
      LOCAL_AI_SERVICE_TOKEN: LOCAL_AI_SERVICE_TOKEN ? "***" : "(empty)",
      AI_SERVICE_URL: AI_SERVICE_URL ? `${AI_SERVICE_URL.substring(0, 20)}...` : "(empty)",
      AI_SERVICE_TOKEN: AI_SERVICE_TOKEN ? "***" : "(empty)",
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV,
    });
    
    // 检查 URL 参数是否强制选择模式
    let forceMode: "local" | "openai" | null = null;
    try {
      const url = new URL(req.url);
      const aiParam = url.searchParams.get("ai")?.toLowerCase();
      if (aiParam === "local" || aiParam === "online" || aiParam === "openai") {
        forceMode = aiParam === "local" ? "local" : "openai";
        console.log(`[${requestId}] [STEP 0.1] URL参数强制模式: ${forceMode}`);
      }
    } catch (e) {
      console.error(`[${requestId}] [STEP 0.1] URL解析错误:`, (e as Error).message);
      // Ignore URL parsing errors
    }
    
    // 从数据库读取 aiProvider 配置（如果 URL 参数没有强制指定）
    let aiProviderFromDb: AiProviderValue | null = null;
    if (!forceMode) {
      try {
        console.log(`[${requestId}] [STEP 0.2] 从数据库读取aiProvider配置`);
        const configRow = await (aiDb as any)
          .selectFrom("ai_config")
          .select(["value"])
          .where("key", "=", "aiProvider")
          .executeTakeFirst();
        
        if (configRow) {
          const normalized = normalizeAiProviderValue(configRow.value);
          if (normalized) {
            aiProviderFromDb = normalized;
            console.log(`[${requestId}] [STEP 0.2] 数据库配置: ${normalized}`);
          } else {
            console.warn(`[${requestId}] [STEP 0.2] 数据库配置值无效: ${configRow.value}`);
          }
        } else {
          console.log(`[${requestId}] [STEP 0.2] 数据库配置为空或无效`);
        }
      } catch (e) {
        // 如果读取配置失败，使用环境变量作为后备
        console.error(`[${requestId}] [STEP 0.2] 数据库读取失败:`, (e as Error).message);
      }
    }
    
    // 优先级：URL 参数 > 数据库配置
    if (!forceMode && !aiProviderFromDb) {
      console.error(`[${requestId}] [STEP 0.3] 未获取到 aiProvider 配置`);
      return err("INTERNAL_ERROR", "AI provider is not configured.", 500);
    }

    const wantLocal = forceMode
      ? forceMode === "local"
      : aiProviderFromDb === "local";

    console.log(`[${requestId}] [STEP 0.3] AI服务选择决策`, {
      forceMode,
      aiProviderFromDb,
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
        aiServiceMode = "openai";
        console.log(`[${requestId}] [STEP 0.4] 已选择 OpenAI 服务（回退）`);
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
      // 如果是 openrouter_direct 或 openai_direct，不通过 AI Service，直接调用 API
      if (aiProviderFromDb === "openrouter_direct") {
        aiServiceMode = "openrouter_direct";
        console.log(`[${requestId}] [STEP 0.4] 已选择直连OpenRouter模式（不通过AI Service）`);
      } else if (aiProviderFromDb === "openai_direct") {
        aiServiceMode = "openai_direct";
        console.log(`[${requestId}] [STEP 0.4] 已选择直连OpenAI模式（不通过AI Service）`);
      } else {
      selectedAiServiceUrl = AI_SERVICE_URL;
      selectedAiServiceToken = AI_SERVICE_TOKEN;
      // openrouter 和 openai 使用相同的 AI Service URL，由 AI Service 内部根据环境变量决定
      aiServiceMode = aiProviderFromDb === "openrouter" ? "openrouter" : "openai";
      console.log(`[${requestId}] [STEP 0.4] 已选择${aiServiceMode === "openrouter" ? "OpenRouter" : "OpenAI"} AI服务`);
      }
    }
    
    console.log(`[${requestId}] [STEP 0.5] AI服务选择完成`, {
      mode: aiServiceMode,
      url: (aiServiceMode === "openrouter_direct" || aiServiceMode === "openai_direct") 
        ? (aiServiceMode === "openrouter_direct" ? "直连OpenRouter" : "直连OpenAI")
        : (selectedAiServiceUrl ? `${selectedAiServiceUrl.substring(0, 30)}...` : "(empty)"),
      hasToken: (aiServiceMode === "openrouter_direct" || aiServiceMode === "openai_direct") ? "N/A" : !!selectedAiServiceToken,
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
    
    // 获取题目的hash值（如果前端传递了，直接使用，避免重复计算）
    const questionHashFromRequest = body.questionHash?.trim() || null;
    
    console.log(`[${requestId}] [STEP 2.6] 参数校验通过`, {
      questionLength: question.length,
      locale: locale || "(none)",
      hasQuestionHash: !!questionHashFromRequest,
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

    // 4) 处理userId转发（act-格式直接使用，因为userid字段本身就是act-{activationId}格式）
    console.log(`[${requestId}] [STEP 4] 开始处理userId转发`);
    let forwardedUserId: string | null = null;
    
    if (session.userId === "anonymous") {
      forwardedUserId = null;
      console.log(`[${requestId}] [STEP 4.1] 匿名用户，forwardedUserId = null`);
    } else if (session.userId.startsWith("act-")) {
      // act-格式的userId直接使用，因为userid字段本身就是act-{activationId}格式
      // 不需要查询数据库，直接使用session.userId作为forwardedUserId
      forwardedUserId = session.userId;
      console.log(`[${requestId}] [STEP 4.2] 检测到act-格式，直接使用: ${forwardedUserId}`);
    } else {
      // UUID格式或其他格式，直接使用
      forwardedUserId = session.userId;
      console.log(`[${requestId}] [STEP 4.3] 直接使用session.userId: ${forwardedUserId}`);
    }
    
    console.log(`[${requestId}] [STEP 4.4] userId转发完成`, {
      originalUserId: session.userId,
      forwardedUserId,
    });
    
    // 4.5) 检查是否有缓存的AI解析（如果是题目）
    // 前端已经检查过本地JSON包，后端直接检查数据库
    console.log(`[${requestId}] [STEP 4.5] 开始检查缓存的AI解析`);
    let cachedAnswer: string | null = null;
    let questionHash: string | null = null;
    let packageName: string | null = null;
    let cacheSource: "json" | "database" | null = null; // 记录缓存来源
    
    try {
      // 1. 使用前端传递的hash值（前端必须传递hash）
      if (questionHashFromRequest) {
        questionHash = questionHashFromRequest;
        console.log(`[${requestId}] [STEP 4.5.0] 使用前端传递的hash值`, {
          questionHash: questionHash.substring(0, 16) + "...",
        });
      } else {
        // 如果没有传递hash，说明这不是题目请求，直接调用AI服务
        console.log(`[${requestId}] [STEP 4.5.0] 未传递hash值，将直接调用AI服务生成新解析`);
        // questionHash 保持为 null，后续会直接调用AI服务
        questionHash = null;
      }
      
      // 2. 如果有了questionHash，直接检查数据库（前端已经检查过JSON包）
      if (questionHash) {
        // 规范化 locale：将 zh-CN、zh_CN 等格式转换为 zh（与查询逻辑保持一致）
        const normalizedLocale = normalizeLocale(locale);
        // 直接检查数据库（前端已经检查过本地JSON包，不需要重复检查）
        cachedAnswer = await getAIAnswerFromDb(questionHash, normalizedLocale);
        if (cachedAnswer) {
          cacheSource = "database"; // 标记为从数据库读取
          console.log(`[${requestId}] [STEP 4.5.1] 从数据库中找到AI解析`, {
            questionHash: questionHash.substring(0, 16) + "...",
            answerLength: cachedAnswer.length,
          });
          // 存入用户缓存（按照要求：从数据库获取后存入用户cache）
          if (forwardedUserId) {
            setUserCachedAnswer(forwardedUserId, questionHash, cachedAnswer);
            console.log(`[${requestId}] [STEP 4.5.1.1] 已存入用户缓存（来源：数据库）`);
          }
        }
      }
      
      // 如果找到缓存的AI解析，直接返回
      if (cachedAnswer) {
        console.log(`[${requestId}] [STEP 4.5.3] 使用缓存的AI解析，跳过AI服务调用`);
        
        // 使用记录的缓存来源（json或database）
        // 如果cacheSource为null，说明没有找到缓存（不应该到达这里）
        const finalCacheSource = cacheSource || "database";
        
        // 写入日志（标识为习题调用，缓存来源）
        void writeAiLogToDatabase({
          userId: forwardedUserId,
          question,
          answer: cachedAnswer,
          locale,
          model: "Cached", // 缓存时使用"Cached"作为模型名
          ragHits: 0,
          safetyFlag: "ok",
          costEstUsd: null,
          sources: [],
          from: "question", // 标识为习题调用
          aiProvider: "cache",
          cached: true,
          cacheSource: finalCacheSource,
          createdAtIso: new Date().toISOString(),
        }).catch((error) => {
          console.error(`[${requestId}] [STEP 4.5.4] 写入缓存日志失败:`, (error as Error).message);
        });
        
        return ok({
          answer: cachedAnswer,
          cached: true,
          aiProvider: "cache",
          cacheSource: finalCacheSource, // 返回缓存来源
        });
      }
    } catch (error) {
      console.error(`[${requestId}] [STEP 4.5] 检查缓存失败:`, error);
      // 如果检查失败，继续调用AI服务（不抛出错误，让流程继续）
    }
    
    // 如果是直连 OpenRouter 模式，直接调用 OpenRouter API，不通过 AI Service
    if (aiServiceMode === "openrouter_direct") {
      console.log(`[${requestId}] [STEP 5] 开始直连OpenRouter处理`);
      
      // 检查环境变量
      if (!OPENROUTER_API_KEY) {
        console.error(`[${requestId}] [STEP 5.1] OPENROUTER_API_KEY 未设置`);
        return err("INTERNAL_ERROR", "OPENROUTER_API_KEY is not set. Please set OPENROUTER_API_KEY environment variable.", 500);
      }
      
      // 调试：检查 API Key 格式（不打印完整内容）
      // 检查是否有空白字符问题
      const originalLength = process.env.OPENROUTER_API_KEY?.length || 0;
      const trimmedLength = OPENROUTER_API_KEY.length;
      const hasWhitespace = originalLength !== trimmedLength;
      const apiKeyPrefix = OPENROUTER_API_KEY.substring(0, 10);
      const apiKeyLength = OPENROUTER_API_KEY.length;
      console.log(`[${requestId}] [STEP 5.1.1] API Key 检查`, {
        prefix: apiKeyPrefix,
        length: apiKeyLength,
        originalLength: originalLength,
        trimmedLength: trimmedLength,
        hasWhitespace: hasWhitespace,
        startsWithSkOr: OPENROUTER_API_KEY.startsWith("sk-or-v1-"),
        hasValue: !!OPENROUTER_API_KEY,
        warning: hasWhitespace ? "检测到 API Key 中有空白字符，已自动去除" : undefined,
      });
      
      const openRouterBaseUrl = requireEnvVar("OPENROUTER_BASE_URL");
      const openRouterRefererUrl = requireEnvVar("OPENROUTER_REFERER_URL");
      const openRouterAppName = requireEnvVar("OPENROUTER_APP_NAME");
      
      // 从数据库读取模型配置
      let model: string | null = null;
      try {
        const modelRow = await (aiDb as any)
          .selectFrom("ai_config")
          .select(["value"])
          .where("key", "=", "model")
          .executeTakeFirst();
        if (modelRow && modelRow.value && modelRow.value.trim()) {
          model = modelRow.value.trim();
        }
      } catch (e) {
        console.warn(`[${requestId}] [STEP 5.2] 读取模型配置失败:`, (e as Error).message);
      }

      if (!model) {
        console.error(`[${requestId}] [STEP 5.2] 无法确定直连 OpenRouter 的模型`);
        return err("INTERNAL_ERROR", "OpenRouter model is not configured.", 500);
      }
      
      // 安全审查（简化版，使用本地规则）
      const safetyCheck = checkSafetySimple(question);
      if (!safetyCheck.pass) {
        console.warn(`[${requestId}] [STEP 5.3] 安全审查未通过:`, safetyCheck.reason);
        return err("FORBIDDEN", safetyCheck.reason || "Content blocked by safety policy", 403);
      }
      
      // RAG 检索（简化版，如果配置了 Supabase 则使用）
      let ragContext = "";
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (supabaseUrl && supabaseServiceKey) {
          // 这里可以调用 RAG 检索，但为了简化，暂时跳过
          // 如果需要完整的 RAG 功能，可以复用 apps/ai-service/src/lib/rag.ts 的逻辑
          console.log(`[${requestId}] [STEP 5.4] RAG 检索已配置，但直连模式下暂时跳过`);
        }
      } catch (e) {
        console.warn(`[${requestId}] [STEP 5.4] RAG 检索失败:`, (e as Error).message);
      }
      
      // 构建系统提示
      const lang = locale || "zh";
      const sysPrompt = buildSystemPrompt(lang);
      const userPrefix = lang === "ja" ? "質問：" : lang === "en" ? "Question:" : "问题：";
      const refPrefix = lang === "ja" ? "関連参照：" : lang === "en" ? "Related references:" : "相关参考资料：";
      
      // 调用 OpenRouter API
      console.log(`[${requestId}] [STEP 5.5] 开始调用OpenRouter API`, {
        model,
        baseUrl: openRouterBaseUrl,
        questionLength: question.length,
        hasRagContext: !!ragContext,
      });
      
      const openRouterUrl = `${openRouterBaseUrl}/chat/completions`;
      const openRouterBody = {
        model: model,
        temperature: 0.4,
        messages: [
          { role: "system", content: sysPrompt },
          {
            role: "user",
            content: `${userPrefix} ${question}\n\n${refPrefix}\n${ragContext || "（無/None）"}`,
          },
        ],
      };
      
      const openRouterHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": openRouterRefererUrl,
        "X-Title": openRouterAppName,
      };
      
      // 注意：OpenRouter 要求使用 HTTP-Referer（不是 Referer）
      // 但某些 HTTP 客户端可能会自动转换，所以我们也尝试添加 Referer
      // 不过根据 OpenRouter 文档，HTTP-Referer 是正确的
      
      // 调试：检查 headers（不打印完整 API Key）
      console.log(`[${requestId}] [STEP 5.5.1] OpenRouter Headers 检查`, {
        hasAuthorization: !!openRouterHeaders["Authorization"],
        authorizationPrefix: openRouterHeaders["Authorization"]?.substring(0, 20) + "...",
        httpReferer: openRouterHeaders["HTTP-Referer"],
        xTitle: openRouterHeaders["X-Title"],
        contentType: openRouterHeaders["Content-Type"],
      });
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
        
        const openRouterResponse = await fetch(openRouterUrl, {
          method: "POST",
          headers: openRouterHeaders,
          body: JSON.stringify(openRouterBody),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (!openRouterResponse.ok) {
          const errorText = await openRouterResponse.text().catch(() => "");
          let errorDetails: any = {};
          try {
            errorDetails = JSON.parse(errorText);
          } catch {
            errorDetails = { raw: errorText };
          }
          
          console.error(`[${requestId}] [STEP 5.6] OpenRouter API 错误:`, {
            status: openRouterResponse.status,
            statusText: openRouterResponse.statusText,
            error: errorText,
            errorDetails,
            apiKeyPrefix: OPENROUTER_API_KEY.substring(0, 10),
            apiKeyLength: OPENROUTER_API_KEY.length,
            apiKeyStartsWithSkOr: OPENROUTER_API_KEY.startsWith("sk-or-v1-"),
            url: openRouterUrl,
            headers: {
              hasAuthorization: !!openRouterHeaders["Authorization"],
              httpReferer: openRouterHeaders["HTTP-Referer"],
              xTitle: openRouterHeaders["X-Title"],
            },
          });
          
          // 如果是 401 错误，提供更详细的错误信息和诊断建议
          if (openRouterResponse.status === 401) {
            const errorMessage = errorDetails.error?.message || errorText;
            const originalLength = process.env.OPENROUTER_API_KEY?.length || 0;
            const trimmedLength = OPENROUTER_API_KEY.length;
            const hasWhitespace = originalLength !== trimmedLength;
            const diagnosticInfo = {
              error: errorMessage,
              apiKeyPrefix: OPENROUTER_API_KEY.substring(0, 15),
              apiKeyLength: OPENROUTER_API_KEY.length,
              originalLength: originalLength,
              trimmedLength: trimmedLength,
              hasWhitespace: hasWhitespace,
              apiKeyFormat: OPENROUTER_API_KEY.startsWith("sk-or-v1-") ? "correct" : "incorrect",
              httpReferer: OPENROUTER_REFERER_URL,
              xTitle: OPENROUTER_APP_NAME,
              suggestion: errorMessage === "User not found." 
                ? hasWhitespace
                  ? "API Key 中检测到空白字符（已自动去除）。如果问题仍然存在，请检查 Vercel 环境变量中的 OPENROUTER_API_KEY 是否正确配置，确保没有多余的空格或换行符，并验证 API Key 在 OpenRouter 中仍然有效。"
                  : "API Key 可能无效或已过期。请检查 Vercel 环境变量中的 OPENROUTER_API_KEY 是否正确配置，并确保 API Key 在 OpenRouter 中仍然有效。建议：1) 验证 API Key 是否有效（使用 curl 测试），2) 检查 Vercel 环境变量中是否有隐藏字符，3) 重新设置环境变量并重新部署。"
                : "请检查 OPENROUTER_API_KEY 环境变量是否正确配置。"
            };
            
            console.error(`[${requestId}] [STEP 5.6.1] OpenRouter 401 错误诊断`, diagnosticInfo);
            
            return err("AUTH_REQUIRED", `OpenRouter API 认证失败: ${errorMessage}。请检查 Vercel 环境变量中的 OPENROUTER_API_KEY 是否正确配置。`, 401);
          }
          
          return err("PROVIDER_ERROR", `OpenRouter API error: ${openRouterResponse.status} ${openRouterResponse.statusText}`, openRouterResponse.status >= 500 ? 502 : openRouterResponse.status);
        }
        
        const openRouterData = await openRouterResponse.json() as {
          choices?: Array<{ message?: { content?: string } }>;
          usage?: { prompt_tokens?: number; completion_tokens?: number };
          model?: string;
        };
        
        const answer = openRouterData.choices?.[0]?.message?.content?.trim() || "";
        if (!answer) {
          console.error(`[${requestId}] [STEP 5.7] OpenRouter API 返回空答案`);
          return err("PROVIDER_ERROR", "OpenRouter API returned empty answer", 502);
        }
        
        // 截断答案（如果超过限制）
        const truncatedAnswer = answer.length > ANSWER_CHAR_LIMIT 
          ? answer.substring(0, ANSWER_CHAR_LIMIT) + "..."
          : answer;
        
        // 计算成本估算（简化版）
        const inputTokens = openRouterData.usage?.prompt_tokens || 0;
        const outputTokens = openRouterData.usage?.completion_tokens || 0;
        const costEstimate = {
          inputTokens,
          outputTokens,
          approxUsd: 0, // 简化版，不计算具体成本
        };
        
        console.log(`[${requestId}] [STEP 5.8] OpenRouter API 调用成功`, {
          model: openRouterData.model || model,
          answerLength: truncatedAnswer.length,
          inputTokens,
          outputTokens,
        });
        
        // 判断是否是习题调用（如果之前找到了匹配的题目）
        const isQuestionCall = !!questionHash;
        
        // 写入 ai_logs 表（异步，不阻塞响应）
        void writeAiLogToDatabase({
          userId: forwardedUserId,
          question,
          answer: truncatedAnswer,
          locale,
          model: openRouterData.model || model,
          ragHits: 0, // 直连模式下暂时没有 RAG
          safetyFlag: "ok",
          costEstUsd: costEstimate.approxUsd,
          sources: [], // 直连模式下暂时不返回 RAG 来源
          from: isQuestionCall ? "question" : null, // 如果是习题调用，标识为"question"
          aiProvider: "openrouter_direct",
          cached: false,
          cacheSource: null,
          createdAtIso: new Date().toISOString(),
        }).catch((error) => {
          console.error(`[${requestId}] [STEP 5.8.1] 写入 ai_logs 失败:`, (error as Error).message);
        });
        
        // 如果是题目，写入 question_ai_answers 表（同步等待，确保在 Serverless 环境中完成）
        if (questionHash) {
          // 规范化 locale：将 zh-CN、zh_CN 等格式转换为 zh（与查询逻辑保持一致）
          const localeStr = normalizeLocale(locale);
          console.log(`[${requestId}] [STEP 5.8.2] 开始检查并写入 question_ai_answers 表（直连OpenRouter模式）`, {
            questionHash: questionHash.substring(0, 16) + "...",
            locale: localeStr,
            originalLocale: locale,
          });
          
          // 在 Serverless 环境中，使用 await 等待写入完成（会稍微延迟响应，但确保数据写入）
          try {
            // 检查是否已存在（防止并发请求重复写入）
            const existing = await getAIAnswerFromDb(questionHash, localeStr);
            if (existing) {
              console.log(`[${requestId}] [STEP 5.8.2.1] 数据库已有AI解析，跳过写入（避免覆盖）`, {
                questionHash: questionHash.substring(0, 16) + "...",
                existingAnswerLength: existing.length,
              });
            } else {
              // 只有在数据库中没有时才写入新回答
              const savedId = await saveAIAnswerToDb(
                questionHash,
                truncatedAnswer,
                localeStr,
                openRouterData.model || model,
                [], // 直连模式下暂时没有 RAG 来源
                forwardedUserId || undefined
              );
              
              if (savedId > 0) {
                console.log(`[${requestId}] [STEP 5.8.2.2] 成功写入 question_ai_answers 表（新回答）`, {
                  questionHash: questionHash.substring(0, 16) + "...",
                  answerLength: truncatedAnswer.length,
                  savedId,
                  locale: localeStr,
                });
                
                // 存入用户缓存
                if (forwardedUserId) {
                  setUserCachedAnswer(forwardedUserId, questionHash, truncatedAnswer);
                  console.log(`[${requestId}] [STEP 5.8.2.3] 已存入用户缓存（来源：AI解析）`, {
                    userId: forwardedUserId,
                    questionHash: questionHash.substring(0, 16) + "...",
                  });
                }
              } else {
                console.error(`[${requestId}] [STEP 5.8.2.2] 写入 question_ai_answers 表返回ID为0，可能写入失败`, {
                  questionHash: questionHash.substring(0, 16) + "...",
                  answerLength: truncatedAnswer.length,
                  locale: localeStr,
                });
              }
            }
          } catch (error) {
            const errorObj = error as Error;
            console.error(`[${requestId}] [STEP 5.8.2] 写入 question_ai_answers 失败:`, {
              error: errorObj.message,
              name: errorObj.name,
              stack: errorObj.stack,
              questionHash: questionHash.substring(0, 16) + "...",
              locale: localeStr,
            });
          }
        } else {
          console.warn(`[${requestId}] [STEP 5.8.2] questionHash 为 null，跳过写入 question_ai_answers 表（直连OpenRouter模式）`);
        }
        
        console.log(`[${requestId}] [STEP 5.8.3] 准备返回成功响应（直连OpenRouter模式）`);
        
        // 返回结果
        return ok({
          answer: truncatedAnswer,
          sources: [], // 直连模式下暂时不返回 RAG 来源
          model: openRouterData.model || model,
          safetyFlag: "ok" as const,
          costEstimate,
          aiProvider: "openrouter_direct",
        });
      } catch (error) {
        const errorObj = error as Error;
        console.error(`[${requestId}] [STEP 5.9] OpenRouter API 调用失败:`, {
          error: errorObj.message,
          name: errorObj.name,
          stack: errorObj.stack,
        });
        
        if (errorObj.name === "AbortError" || errorObj.message.includes("timeout")) {
          return err("PROVIDER_ERROR", "OpenRouter API request timeout (30s)", 504);
        }
        
        return err("PROVIDER_ERROR", `Failed to call OpenRouter API: ${errorObj.message}`, 502);
      }
    }
    
    // 如果是直连 OpenAI 模式，直接调用 OpenAI API，不通过 AI Service
    if (aiServiceMode === "openai_direct") {
      console.log(`[${requestId}] [STEP 5] 开始直连OpenAI处理`);
      
      // 检查环境变量
      if (!OPENAI_API_KEY) {
        console.error(`[${requestId}] [STEP 5.1] OPENAI_API_KEY 未设置`);
        return err("INTERNAL_ERROR", "OPENAI_API_KEY is not set. Please set OPENAI_API_KEY environment variable.", 500);
      }
      
      // 调试：检查 API Key 格式（不打印完整内容）
      const originalLength = process.env.OPENAI_API_KEY?.length || 0;
      const trimmedLength = OPENAI_API_KEY.length;
      const hasWhitespace = originalLength !== trimmedLength;
      const apiKeyPrefix = OPENAI_API_KEY.substring(0, 10);
      const apiKeyLength = OPENAI_API_KEY.length;
      console.log(`[${requestId}] [STEP 5.1.1] API Key 检查`, {
        prefix: apiKeyPrefix,
        length: apiKeyLength,
        originalLength: originalLength,
        trimmedLength: trimmedLength,
        hasWhitespace: hasWhitespace,
        startsWithSk: OPENAI_API_KEY.startsWith("sk-"),
        hasValue: !!OPENAI_API_KEY,
        warning: hasWhitespace ? "检测到 API Key 中有空白字符，已自动去除" : undefined,
      });
      
      const openaiBaseUrl = requireEnvVar("OPENAI_BASE_URL");
      
      // 从数据库读取模型配置
      let model: string | null = null;
      try {
        const modelRow = await (aiDb as any)
          .selectFrom("ai_config")
          .select(["value"])
          .where("key", "=", "model")
          .executeTakeFirst();
        if (modelRow && modelRow.value && modelRow.value.trim()) {
          model = modelRow.value.trim();
        }
      } catch (e) {
        console.warn(`[${requestId}] [STEP 5.2] 读取模型配置失败:`, (e as Error).message);
      }

      if (!model) {
        console.error(`[${requestId}] [STEP 5.2] 无法确定直连 OpenAI 的模型`);
        return err("INTERNAL_ERROR", "OpenAI model is not configured.", 500);
      }
      
      // 安全审查（简化版，使用本地规则）
      const safetyCheck = checkSafetySimple(question);
      if (!safetyCheck.pass) {
        console.warn(`[${requestId}] [STEP 5.3] 安全审查未通过:`, safetyCheck.reason);
        return err("FORBIDDEN", safetyCheck.reason || "Content blocked by safety policy", 403);
      }
      
      // RAG 检索（简化版，如果配置了 Supabase 则使用）
      let ragContext = "";
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (supabaseUrl && supabaseServiceKey) {
          // 这里可以调用 RAG 检索，但为了简化，暂时跳过
          // 如果需要完整的 RAG 功能，可以复用 apps/ai-service/src/lib/rag.ts 的逻辑
          console.log(`[${requestId}] [STEP 5.4] RAG 检索已配置，但直连模式下暂时跳过`);
        }
      } catch (e) {
        console.warn(`[${requestId}] [STEP 5.4] RAG 检索失败:`, (e as Error).message);
      }
      
      // 构建系统提示
      const lang = locale || "zh";
      const sysPrompt = buildSystemPrompt(lang);
      const userPrefix = lang === "ja" ? "質問：" : lang === "en" ? "Question:" : "问题：";
      const refPrefix = lang === "ja" ? "関連参照：" : lang === "en" ? "Related references:" : "相关参考资料：";
      
      // 调用 OpenAI API
      console.log(`[${requestId}] [STEP 5.5] 开始调用OpenAI API`, {
        model,
        baseUrl: openaiBaseUrl,
        questionLength: question.length,
        hasRagContext: !!ragContext,
      });
      
      const openaiUrl = `${openaiBaseUrl}/chat/completions`;
      const openaiBody = {
        model: model,
        temperature: 0.4,
        messages: [
          { role: "system", content: sysPrompt },
          {
            role: "user",
            content: `${userPrefix} ${question}\n\n${refPrefix}\n${ragContext || "（無/None）"}`,
          },
        ],
      };
      
      const openaiHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      };
      
      // 调试：检查 headers（不打印完整 API Key）
      console.log(`[${requestId}] [STEP 5.5.1] OpenAI Headers 检查`, {
        hasAuthorization: !!openaiHeaders["Authorization"],
        authorizationPrefix: openaiHeaders["Authorization"]?.substring(0, 20) + "...",
        contentType: openaiHeaders["Content-Type"],
      });
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
        
        const openaiResponse = await fetch(openaiUrl, {
          method: "POST",
          headers: openaiHeaders,
          body: JSON.stringify(openaiBody),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (!openaiResponse.ok) {
          const errorText = await openaiResponse.text().catch(() => "");
          let errorDetails: any = {};
          try {
            errorDetails = JSON.parse(errorText);
          } catch {
            errorDetails = { raw: errorText };
          }
          
          console.error(`[${requestId}] [STEP 5.6] OpenAI API 错误:`, {
            status: openaiResponse.status,
            statusText: openaiResponse.statusText,
            error: errorText,
            errorDetails,
            apiKeyPrefix: OPENAI_API_KEY.substring(0, 10),
            apiKeyLength: OPENAI_API_KEY.length,
            apiKeyStartsWithSk: OPENAI_API_KEY.startsWith("sk-"),
            url: openaiUrl,
          });
          
          // 如果是 401 错误，提供更详细的错误信息和诊断建议
          if (openaiResponse.status === 401) {
            const errorMessage = errorDetails.error?.message || errorText;
            const originalLength = process.env.OPENAI_API_KEY?.length || 0;
            const trimmedLength = OPENAI_API_KEY.length;
            const hasWhitespace = originalLength !== trimmedLength;
            const diagnosticInfo = {
              error: errorMessage,
              apiKeyPrefix: OPENAI_API_KEY.substring(0, 15),
              apiKeyLength: OPENAI_API_KEY.length,
              originalLength: originalLength,
              trimmedLength: trimmedLength,
              hasWhitespace: hasWhitespace,
              apiKeyFormat: OPENAI_API_KEY.startsWith("sk-") ? "correct" : "incorrect",
              suggestion: errorMessage === "Incorrect API key provided." 
                ? hasWhitespace
                  ? "API Key 中检测到空白字符（已自动去除）。如果问题仍然存在，请检查 Vercel 环境变量中的 OPENAI_API_KEY 是否正确配置，确保没有多余的空格或换行符，并验证 API Key 在 OpenAI 中仍然有效。"
                  : "API Key 可能无效或已过期。请检查 Vercel 环境变量中的 OPENAI_API_KEY 是否正确配置，并确保 API Key 在 OpenAI 中仍然有效。建议：1) 验证 API Key 是否有效（使用 curl 测试），2) 检查 Vercel 环境变量中是否有隐藏字符，3) 重新设置环境变量并重新部署。"
                : "请检查 OPENAI_API_KEY 环境变量是否正确配置。"
            };
            
            console.error(`[${requestId}] [STEP 5.6.1] OpenAI 401 错误诊断`, diagnosticInfo);
            
            return err("AUTH_REQUIRED", `OpenAI API 认证失败: ${errorMessage}。请检查 Vercel 环境变量中的 OPENAI_API_KEY 是否正确配置。`, 401);
          }
          
          return err("PROVIDER_ERROR", `OpenAI API error: ${openaiResponse.status} ${openaiResponse.statusText}`, openaiResponse.status >= 500 ? 502 : openaiResponse.status);
        }
        
        const openaiData = await openaiResponse.json() as {
          choices?: Array<{ message?: { content?: string } }>;
          usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
          model?: string;
        };
        
        const answer = openaiData.choices?.[0]?.message?.content?.trim() || "";
        if (!answer) {
          console.error(`[${requestId}] [STEP 5.7] OpenAI API 返回空答案`);
          return err("PROVIDER_ERROR", "OpenAI API returned empty answer", 502);
        }
        
        // 截断答案（如果超过限制）
        const truncatedAnswer = answer.length > ANSWER_CHAR_LIMIT 
          ? answer.substring(0, ANSWER_CHAR_LIMIT) + "..."
          : answer;
        
        // 计算成本估算（简化版）
        const inputTokens = openaiData.usage?.prompt_tokens || 0;
        const outputTokens = openaiData.usage?.completion_tokens || 0;
        const costEstimate = {
          inputTokens,
          outputTokens,
          approxUsd: 0, // 简化版，不计算具体成本
        };
        
        console.log(`[${requestId}] [STEP 5.8] OpenAI API 调用成功`, {
          model: openaiData.model || model,
          answerLength: truncatedAnswer.length,
          inputTokens,
          outputTokens,
        });
        
        // 判断是否是习题调用（如果之前找到了匹配的题目）
        const isQuestionCall = !!questionHash;
        
        // 写入 ai_logs 表（异步，不阻塞响应）
        void writeAiLogToDatabase({
          userId: forwardedUserId,
          question,
          answer: truncatedAnswer,
          locale,
          model: openaiData.model || model,
          ragHits: 0, // 直连模式下暂时没有 RAG
          safetyFlag: "ok",
          costEstUsd: costEstimate.approxUsd,
          sources: [], // 直连模式下暂时不返回 RAG 来源
          from: isQuestionCall ? "question" : null, // 如果是习题调用，标识为"question"
          aiProvider: "openai_direct",
          cached: false,
          cacheSource: null,
          createdAtIso: new Date().toISOString(),
        }).catch((error) => {
          console.error(`[${requestId}] [STEP 5.8.1] 写入 ai_logs 失败:`, (error as Error).message);
        });
        
        // 如果是题目，写入 question_ai_answers 表（同步等待，确保在 Serverless 环境中完成）
        if (questionHash) {
          // 规范化 locale：将 zh-CN、zh_CN 等格式转换为 zh（与查询逻辑保持一致）
          const localeStr = normalizeLocale(locale);
          console.log(`[${requestId}] [STEP 5.8.2] 开始检查并写入 question_ai_answers 表（直连OpenAI模式）`, {
            questionHash: questionHash.substring(0, 16) + "...",
            locale: localeStr,
            originalLocale: locale,
          });
          
          // 在 Serverless 环境中，使用 await 等待写入完成（会稍微延迟响应，但确保数据写入）
          try {
            // 检查是否已存在（防止并发请求重复写入）
            const existing = await getAIAnswerFromDb(questionHash, localeStr);
            if (existing) {
              console.log(`[${requestId}] [STEP 5.8.2.1] 数据库已有AI解析，跳过写入（避免覆盖）`, {
                questionHash: questionHash.substring(0, 16) + "...",
                existingAnswerLength: existing.length,
              });
            } else {
              // 只有在数据库中没有时才写入新回答
              const savedId = await saveAIAnswerToDb(
                questionHash,
                truncatedAnswer,
                localeStr,
                openaiData.model || model,
                [], // 直连模式下暂时没有 RAG 来源
                forwardedUserId || undefined
              );
              
              if (savedId > 0) {
                console.log(`[${requestId}] [STEP 5.8.2.2] 成功写入 question_ai_answers 表（新回答）`, {
                  questionHash: questionHash.substring(0, 16) + "...",
                  answerLength: truncatedAnswer.length,
                  savedId,
                  locale: localeStr,
                });
                
                // 存入用户缓存
                if (forwardedUserId) {
                  setUserCachedAnswer(forwardedUserId, questionHash, truncatedAnswer);
                  console.log(`[${requestId}] [STEP 5.8.2.3] 已存入用户缓存（来源：AI解析）`, {
                    userId: forwardedUserId,
                    questionHash: questionHash.substring(0, 16) + "...",
                  });
                }
              } else {
                console.error(`[${requestId}] [STEP 5.8.2.2] 写入 question_ai_answers 表返回ID为0，可能写入失败`, {
                  questionHash: questionHash.substring(0, 16) + "...",
                  answerLength: truncatedAnswer.length,
                  locale: localeStr,
                });
              }
            }
          } catch (error) {
            const errorObj = error as Error;
            console.error(`[${requestId}] [STEP 5.8.2] 写入 question_ai_answers 失败:`, {
              error: errorObj.message,
              name: errorObj.name,
              stack: errorObj.stack,
              questionHash: questionHash.substring(0, 16) + "...",
              locale: localeStr,
            });
          }
        } else {
          console.warn(`[${requestId}] [STEP 5.8.2] questionHash 为 null，跳过写入 question_ai_answers 表（直连OpenAI模式）`);
        }
        
        console.log(`[${requestId}] [STEP 5.8.3] 准备返回成功响应（直连OpenAI模式）`);
        
        // 返回结果
        return ok({
          answer: truncatedAnswer,
          sources: [], // 直连模式下暂时不返回 RAG 来源
          model: openaiData.model || model,
          safetyFlag: "ok" as const,
          costEstimate,
          aiProvider: "openai_direct",
        });
      } catch (error) {
        const errorObj = error as Error;
        console.error(`[${requestId}] [STEP 5.9] OpenAI API 调用失败:`, {
          error: errorObj.message,
          name: errorObj.name,
          stack: errorObj.stack,
        });
        
        if (errorObj.name === "AbortError" || errorObj.message.includes("timeout")) {
          return err("PROVIDER_ERROR", "OpenAI API request timeout (30s)", 504);
        }
        
        return err("PROVIDER_ERROR", `Failed to call OpenAI API: ${errorObj.message}`, 502);
      }
    }
    
    // 确保 selectedAiServiceUrl 不重复 /v1 路径（仅在非直连模式下）
    // 注意：openrouter_direct 和 openai_direct 模式已经在上面处理并返回了，不会到达这里
    if (!selectedAiServiceUrl || !selectedAiServiceToken) {
      console.error(`[${requestId}] [STEP 5] AI服务配置不完整`, {
        hasUrl: !!selectedAiServiceUrl,
        hasToken: !!selectedAiServiceToken,
        mode: aiServiceMode,
      });
      return err("INTERNAL_ERROR", "AI service is not configured.", 500);
    }
    
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
      
      const upstreamHeaders: Record<string, string> = {
        "content-type": "application/json; charset=utf-8",
        authorization: `Bearer ${selectedAiServiceToken}`,
        "x-zalem-client": "web",
      };
      if (aiServiceMode === "openai" || aiServiceMode === "openrouter") {
        upstreamHeaders["X-AI-Provider"] = aiServiceMode;
      }

      upstream = await fetch(upstreamUrl, {
        method: "POST",
        headers: upstreamHeaders,
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
        let hostname: string | null = null;
        try {
          const urlObj = new URL(upstreamUrl);
          hostname = urlObj.hostname;
          errorDetails.hostname = hostname;
          errorDetails.port = urlObj.port || (urlObj.protocol === "https:" ? 443 : 80);
          errorDetails.protocol = urlObj.protocol;
          
          // 检查是否是DNS解析问题（快速失败通常意味着DNS解析失败）
          if (fetchDuration < 1000) {
            errorDetails.likelyCause = "DNS_RESOLUTION_FAILED";
            errorDetails.suggestion = `The hostname "${hostname}" may not be resolvable. Please check: 1) DNS records are configured correctly, 2) Cloudflare Tunnel is running (if using tunnel), 3) The domain exists and is accessible.`;
          }
        } catch (urlError) {
          errorDetails.urlParseError = (urlError as Error).message;
        }
        
        console.error(`[${requestId}] [STEP 5.2] 上游请求网络错误:`, errorDetails);
        
        // 如果当前使用的是本地AI服务，尝试回退到在线AI服务
        if (aiServiceMode === "local" && AI_SERVICE_URL && AI_SERVICE_TOKEN) {
          console.warn(`[${requestId}] [STEP 5.2.1] 本地AI服务失败（可能是DNS解析问题），尝试回退到在线AI服务`, {
            hostname: hostname || "(unknown)",
            duration: `${fetchDuration}ms`,
            note: "快速失败（<1s）通常表示DNS解析失败",
          });
          const fallbackBaseUrl = AI_SERVICE_URL.replace(/\/v1\/?$/, "").replace(/\/+$/, "");
          const fallbackUrl = `${fallbackBaseUrl}/v1/ask`;
          
          console.log(`[${requestId}] [STEP 5.2.2] 开始回退请求`, {
            url: fallbackUrl,
            mode: "openai",
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
            
            const fallbackHeaders: Record<string, string> = {
              "content-type": "application/json; charset=utf-8",
              authorization: `Bearer ${AI_SERVICE_TOKEN}`,
              "x-zalem-client": "web",
            };
            fallbackHeaders["X-AI-Provider"] = "openai";

            const fallbackResponse = await fetch(fallbackUrl, {
              method: "POST",
              headers: fallbackHeaders,
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
            aiServiceMode = "openai"; // 更新模式标记
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
        mode: aiServiceMode,
      });
      
      // 如果当前使用的是本地AI服务且返回502/503/504错误，尝试回退到在线AI服务
      if (aiServiceMode === "local" && (status === 502 || status === 503 || status === 504) && AI_SERVICE_URL && AI_SERVICE_TOKEN) {
        console.warn(`[${requestId}] [STEP 6.1.1] 本地AI服务返回${status}错误，尝试回退到在线AI服务`);
        const fallbackBaseUrl = AI_SERVICE_URL.replace(/\/v1\/?$/, "").replace(/\/+$/, "");
        const fallbackUrl = `${fallbackBaseUrl}/v1/ask`;
        
        try {
          const fallbackController = new AbortController();
          const fallbackTimeout = 90000; // 90秒
          const fallbackTimeoutId = setTimeout(() => {
            fallbackController.abort();
          }, fallbackTimeout);
          
          const fallbackHeaders: Record<string, string> = {
            "content-type": "application/json; charset=utf-8",
            authorization: `Bearer ${AI_SERVICE_TOKEN}`,
            "x-zalem-client": "web",
          };
          fallbackHeaders["X-AI-Provider"] = "openai";

          const fallbackResponse = await fetch(fallbackUrl, {
            method: "POST",
            headers: fallbackHeaders,
            body: JSON.stringify(requestBody),
            signal: fallbackController.signal,
          });
          
          clearTimeout(fallbackTimeoutId);
          
          if (fallbackResponse.ok) {
            const fallbackText = await fallbackResponse.text();
            const fallbackResult = JSON.parse(fallbackText) as AiServiceResponse;
            
            if (fallbackResult.ok) {
              console.log(`[${requestId}] [STEP 6.1.2] 回退到 OpenAI 服务成功`);
              // 使用回退响应继续处理
              result = fallbackResult;
              aiServiceMode = "openai";
            } else {
              // 回退服务也返回错误，继续使用原始错误
              console.error(`[${requestId}] [STEP 6.1.2] 回退服务也返回错误:`, fallbackResult);
            }
          } else {
            // 回退服务返回非2xx状态码，继续使用原始错误
            console.error(`[${requestId}] [STEP 6.1.2] 回退服务返回${fallbackResponse.status}错误`);
          }
        } catch (fallbackError) {
          console.error(`[${requestId}] [STEP 6.1.2] 回退请求失败:`, (fallbackError as Error).message);
          // 回退失败，继续使用原始错误
        }
      }
      
      // 如果回退后仍然失败，返回错误
      if (!result.ok) {
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

    // 7) 成功：写入 ai_logs 表（作为备份，确保所有AI回答都被保存）
    // 注意：AI服务也会写入 ai_logs 表，但这里作为备份确保写入成功
    // 在 render indirect 和 direct 模式下都调用（除了本地 ollama）
    // 注意：如果使用了缓存（cached=true），已经在 STEP 4.5.3 中写入了日志，这里应该跳过
    if (result.ok && result.data && result.data.answer && aiServiceMode !== "local") {
      // 如果使用了缓存，跳过写入（已经在 STEP 4.5.3 中写入了）
      if (result.data.cached) {
        console.log(`[${requestId}] [STEP 7] 使用缓存，跳过写入 ai_logs（已在 STEP 4.5.3 中写入）`);
      } else {
        console.log(`[${requestId}] [STEP 7] 开始写入 ai_logs 表（备份）`);
        
        // 计算 RAG 命中数
        const ragHits = Array.isArray(result.data.sources) 
          ? result.data.sources.length 
          : 0;
        
        // 获取成本估算
        const costEstUsd = result.data.costEstimate?.approxUsd ?? null;
        
        // 异步写入 ai_logs 表（不阻塞响应）
        // 类型断言：已经检查了 result.data.answer 存在
        const answer = result.data.answer;
        if (answer) {
          // 判断是否是习题调用（如果之前找到了匹配的题目）
          const isQuestionCall = !!questionHash;
          
          void writeAiLogToDatabase({
            userId: forwardedUserId,
            question,
            answer: answer,
            locale,
            model: result.data.model || "unknown",
            ragHits,
            safetyFlag: result.data.safetyFlag || "ok",
            costEstUsd,
            sources: result.data.sources,
            from: isQuestionCall ? "question" : null, // 如果是习题调用，标识为"question"
            aiProvider: result.data.aiProvider || aiServiceMode || null, // 使用返回的aiProvider或aiServiceMode
            cached: false, // 不是缓存
            cacheSource: null,
            createdAtIso: new Date().toISOString(),
          }).catch((error) => {
            console.error(`[${requestId}] [STEP 7.1] 写入 ai_logs 失败:`, (error as Error).message);
          });
        }
      }
    }
    
    // 7.5) 如果问题是题目，写入 question_ai_answers 表
    // 并在每10次新解析后触发批量更新JSON包
    if (result.ok && result.data && result.data.answer) {
      // 记录 questionHash 状态，用于调试
      console.log(`[${requestId}] [STEP 7.5] 准备写入 question_ai_answers 表`, {
        hasQuestionHash: !!questionHash,
        questionHash: questionHash ? `${questionHash.substring(0, 16)}...` : "(null)",
        hasAnswer: !!result.data.answer,
        answerLength: result.data.answer?.length || 0,
        locale: locale || "zh",
      });
      
      // 如果找到了questionHash，写入question_ai_answers表
      // 注意：只有在数据库中没有AI回答时才写入，如果已有则跳过
      // 注意：JSON包不会实时更新，需要定期在后台手动更新
      if (questionHash) {
        console.log(`[${requestId}] [STEP 7.5] 开始检查并写入 question_ai_answers 表`, {
          questionHash: questionHash.substring(0, 16) + "...",
          questionHashLength: questionHash.length,
          locale: locale || "zh",
        });
        
        const answer = result.data.answer;
        // 规范化 locale：将 zh-CN、zh_CN 等格式转换为 zh（与查询逻辑保持一致）
        const localeStr = normalizeLocale(locale);
        
        // 在 Serverless 环境中，使用 await 等待写入完成（会稍微延迟响应，但确保数据写入）
        // 注意：Vercel 等 Serverless 环境可能会在响应返回后立即终止函数执行
        // 为了确保数据写入，我们使用 await 等待写入完成
        try {
          // 检查是否已存在（防止并发请求重复写入）
          // 注意：正常情况下，如果数据库有答案，STEP 4.5就会返回，不会到达这里
          // 这里检查是为了防止并发请求的情况
          console.log(`[${requestId}] [STEP 7.5.0] 检查数据库中是否已存在AI解析`, {
            questionHash: questionHash.substring(0, 16) + "...",
            locale: localeStr,
          });
          
          const existing = await getAIAnswerFromDb(questionHash, localeStr);
          if (existing) {
            console.log(`[${requestId}] [STEP 7.5.1] 数据库已有AI解析（可能是并发请求），跳过写入（避免覆盖）`, {
              questionHash: questionHash.substring(0, 16) + "...",
              existingAnswerLength: existing.length,
            });
            // 注意：JSON包不会实时更新，需要定期在后台手动更新
          } else {
            console.log(`[${requestId}] [STEP 7.5.1] 数据库中不存在AI解析，准备写入新回答`, {
              questionHash: questionHash.substring(0, 16) + "...",
              answerLength: answer.length,
              model: result.data?.model || "unknown",
            });
            
            // 只有在数据库中没有时才写入新回答
            const savedId = await saveAIAnswerToDb(
              questionHash,
              answer,
              localeStr,
              result.data?.model || "unknown",
              result.data?.sources,
              forwardedUserId || undefined
            );
            
            if (savedId > 0) {
              console.log(`[${requestId}] [STEP 7.5.2] 成功写入 question_ai_answers 表（新回答）`, {
                questionHash: questionHash.substring(0, 16) + "...",
                answerLength: answer.length,
                packageName,
                savedId,
                locale: localeStr,
              });
              
              // 存入用户缓存（按照要求：AI解析后存入用户cache）
              if (forwardedUserId) {
                setUserCachedAnswer(forwardedUserId, questionHash, answer);
                console.log(`[${requestId}] [STEP 7.5.2.1] 已存入用户缓存（来源：AI解析）`, {
                  userId: forwardedUserId,
                  questionHash: questionHash.substring(0, 16) + "...",
                });
              }
              
              // 注意：JSON包不会实时更新，需要定期在后台手动更新
              // 用户下次请求时，会从数据库读取缓存（STEP 4.5）
              console.log(`[${requestId}] [STEP 7.5.3] 已写入数据库，JSON包需要定期手动更新`);
            } else {
              console.error(`[${requestId}] [STEP 7.5.2] 写入 question_ai_answers 表返回ID为0，可能写入失败`, {
                questionHash: questionHash.substring(0, 16) + "...",
                answerLength: answer.length,
                locale: localeStr,
                model: result.data?.model || "unknown",
              });
            }
          }
        } catch (error) {
          // 详细记录错误信息，包括堆栈
          const errorObj = error as Error;
          console.error(`[${requestId}] [STEP 7.5] 写入 question_ai_answers 失败:`, {
            error: errorObj.message,
            name: errorObj.name,
            stack: errorObj.stack,
            questionHash: questionHash.substring(0, 16) + "...",
            answerLength: answer.length,
            locale: localeStr,
          });
          // 不抛出错误，避免影响主流程
        }
      } else {
        // questionHash 为 null，记录警告日志
        console.warn(`[${requestId}] [STEP 7.5] questionHash 为 null，跳过写入 question_ai_answers 表`, {
          hasQuestionHashFromRequest: !!questionHashFromRequest,
          questionHashFromRequest: questionHashFromRequest ? `${questionHashFromRequest.substring(0, 16)}...` : "(null)",
          questionLength: question.length,
          questionPreview: question.substring(0, 100) + "...",
          note: "如果这是一道题目，前端应该传递 questionHash 字段",
        });
      }
    }
    
    // 8) 成功：返回结果，包含AI类型信息
    console.log(`[${requestId}] [STEP 8] 准备返回成功响应`);
    if (result.ok && result.data) {
      // 在返回数据中添加AI类型信息
      const responseData = {
        ...result.data,
        aiProvider: aiServiceMode,
        cached: result.data.cached || false, // 透传缓存标识
      };
      
      console.log(`[${requestId}] [STEP 8.1] 返回成功响应`, {
        hasAnswer: !!result.data.answer,
        answerLength: result.data.answer?.length || 0,
        hasSources: !!result.data.sources,
        sourcesCount: result.data.sources?.length || 0,
        model: result.data.model || "(none)",
        aiProvider: aiServiceMode,
        cached: result.data.cached || false,
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
