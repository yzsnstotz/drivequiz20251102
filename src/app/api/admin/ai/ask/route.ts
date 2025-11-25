import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { callAiServiceCore } from "../_lib/aiServiceCore";

/**
 * 后台 AI 问答接口
 * - 管理员 token 验证（必需）
 * - 跳过用户配额限制
 * - 支持场景配置（scene）
 * - 支持长超时（250秒，用于批量处理）
 * - 支持批量处理任务（翻译、润色、分类标签等）
 */

export const runtime = "nodejs";

type AskRequest = {
  question: string;
  locale?: string;
  questionHash?: string;
  scene?: string; // 场景标识：question_translation, question_polish, question_category_tags 等
  skipCache?: boolean;
  testMode?: boolean;
  sourceLanguage?: string; // 源语言（用于翻译场景）
  targetLanguage?: string; // 目标语言（用于翻译场景）
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
    cached?: boolean;
    aiProvider?: string;
  };
  errorCode?: string;
  message?: string;
};

// ==== 统一响应 ====
function ok<T>(data: T) {
  return NextResponse.json({ ok: true, data } as const, { status: 200 });
}

function err(
  code: "AUTH_REQUIRED" | "FORBIDDEN" | "VALIDATION_FAILED" | "PROVIDER_ERROR" | "INTERNAL_ERROR",
  message: string,
  status: number,
  details?: Record<string, unknown>,
) {
  return NextResponse.json({ ok: false, errorCode: code, message, details } as const, { status });
}

/**
 * 验证管理员 token
 */
async function verifyAdminToken(authHeader: string | null): Promise<{ adminId: number } | null> {
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return null;
  }

  try {
    const admin = await db
      .selectFrom("admins")
      .select(["id"])
      .where("token", "=", token)
      .where("is_active", "=", true)
      .executeTakeFirst();

    if (admin) {
      return { adminId: admin.id };
    }
  } catch (e) {
    console.error("[Admin AI Ask] Admin token verification failed:", (e as Error).message);
  }

  return null;
}

/**
 * 调用 AI 服务核心函数（直接调用，不经过用户接口）
 * 这是真正的分离：后台接口直接调用 AI 服务，不经过用户接口
 */
async function callMainAiAsk(
  body: AskRequest,
  adminToken: string,
  requestId: string,
  timeout: number = 250000, // 默认 250 秒超时（批量处理需要更长时间）
): Promise<AiServiceResponse> {
  // 直接调用 AI 服务核心函数，不经过用户接口
  return await callAiServiceCore({
    question: body.question,
    locale: body.locale || "zh-CN",
    scene: body.scene,
    sourceLanguage: body.sourceLanguage,
    targetLanguage: body.targetLanguage,
    requestId,
    timeout,
  });
}

// ==== 入口：POST /api/admin/ai/ask ====
export async function POST(req: NextRequest) {
  const requestId = `admin-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  console.log(`[${requestId}] [ADMIN AI ASK] 后台请求开始`, {
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  try {
    // 1) 管理员验证（必需）
    const authHeader = req.headers.get("authorization");
    const admin = await verifyAdminToken(authHeader);

    if (!admin) {
      console.warn(`[${requestId}] [ADMIN AI ASK] 管理员验证失败`);
      return err("AUTH_REQUIRED", "Admin token is required.", 401);
    }

    console.log(`[${requestId}] [ADMIN AI ASK] 管理员验证通过`, {
      adminId: admin.adminId,
    });

    // 2) 解析请求体
    let body: AskRequest;
    try {
      body = await req.json();
    } catch (e) {
      return err("VALIDATION_FAILED", "Invalid JSON body.", 400);
    }

    // 3) 参数校验
    const question = (body.question || "").trim();
    if (!question || question.length === 0) {
      return err("VALIDATION_FAILED", "question is required.", 400);
    }

    if (question.length > 2000) {
      return err("VALIDATION_FAILED", "question too long (max 2000 characters).", 400);
    }

    const locale = body.locale?.trim() || "zh";
    const scene = body.scene?.trim() || null;
    const sourceLanguage = body.sourceLanguage?.trim() || null;
    const targetLanguage = body.targetLanguage?.trim() || null;

    console.log(`[${requestId}] [ADMIN AI ASK] 参数校验通过`, {
      questionLength: question.length,
      locale,
      scene,
      sourceLanguage,
      targetLanguage,
    });

    // 4) 调用主站 AI 接口（内部调用）
    // 后台请求使用更长的超时时间（250秒），适合批量处理任务
    const timeout = 250000; // 250秒
    const adminToken = authHeader!.slice("Bearer ".length).trim();
    
    console.log(`[${requestId}] [ADMIN AI ASK] 开始调用主站 AI 接口`, {
      timeout: `${timeout}ms`,
      scene,
      adminId: admin.adminId,
    });

    const result = await callMainAiAsk(
      {
        question,
        locale,
        questionHash: body.questionHash,
        scene: scene || undefined,
        skipCache: body.skipCache,
        testMode: body.testMode,
        sourceLanguage: sourceLanguage || undefined,
        targetLanguage: targetLanguage || undefined,
      },
      adminToken,
      requestId,
      timeout,
    );

    if (!result.ok) {
      console.error(`[${requestId}] [ADMIN AI ASK] 主站 AI 接口调用失败`, {
        errorCode: result.errorCode,
        message: result.message,
      });
      return err(
        (result.errorCode as any) || "PROVIDER_ERROR",
        result.message || "AI service error",
        result.errorCode === "AUTH_REQUIRED" ? 401 : 502,
      );
    }

    console.log(`[${requestId}] [ADMIN AI ASK] 请求成功`, {
      hasAnswer: !!result.data?.answer,
      answerLength: result.data?.answer?.length || 0,
      model: result.data?.model || "(none)",
      aiProvider: result.data?.aiProvider || "(none)",
      cached: result.data?.cached || false,
      hasSources: !!result.data?.sources,
      sourcesCount: result.data?.sources?.length || 0,
      sources: result.data?.sources ? JSON.stringify(result.data.sources, null, 2) : "(none)",
    });

    // 5) 返回结果（包含耗时信息，因为主站接口已经在 sources 中添加了耗时信息）
    const responseData = result.data || {};
    
    // 调试：确认耗时信息是否包含在 sources 中
    if (responseData && 'sources' in responseData && Array.isArray(responseData.sources)) {
      const timingSource = responseData.sources.find((s: any) => s.title === "处理耗时");
      if (timingSource) {
        console.log(`[${requestId}] [ADMIN AI ASK] 耗时信息已包含在响应中`, {
          timingSource,
          snippet: timingSource.snippet,
        });
      } else {
        console.warn(`[${requestId}] [ADMIN AI ASK] 警告：响应中未找到耗时信息`, {
          sourcesCount: responseData.sources.length,
          sources: JSON.stringify(responseData.sources, null, 2),
        });
      }
    } else {
      console.warn(`[${requestId}] [ADMIN AI ASK] 警告：响应中没有 sources 字段`, {
        hasSources: responseData && 'sources' in responseData,
        responseDataKeys: responseData ? Object.keys(responseData) : [],
      });
    }
    
    return ok(responseData);
  } catch (e) {
    const error = e as Error;
    console.error(`[${requestId}] [ADMIN AI ASK] 未捕获的异常`, {
      error: error.message,
      stack: error.stack,
      name: error.name,
    });
    return err("INTERNAL_ERROR", `Unexpected server error: ${error.message}`, 500);
  }
}

