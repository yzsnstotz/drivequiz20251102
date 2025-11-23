/**
 * AI 服务核心调用模块（共享）
 * 供后台接口直接使用，不经过用户接口
 * 直接使用 /api/ai/_lib/aiServiceCore 中的实现，实现真正的分离
 */

// 使用动态导入避免 webpack 模块解析冲突和循环依赖
// 注意：动态导入可以确保模块在运行时才解析，避免编译时的循环依赖问题

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

/**
 * 调用 AI 服务核心函数（直接调用，不经过用户接口）
 * 这是真正的分离：后台接口直接调用 AI 服务，不经过用户接口
 * 跳过用户配额检查（userId=null, isAnonymous=false）
 */
export async function callAiServiceCore(params: {
  question: string;
  locale?: string;
  scene?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  requestId: string;
  timeout?: number; // 超时时间（毫秒），默认 250 秒
}): Promise<AiServiceResponse> {
  const { question, locale = "zh-CN", scene, sourceLanguage, targetLanguage, requestId, timeout = 250000 } = params;

  // 直接使用 callAiServer，因为用户接口的 AI 服务核心函数不存在
  // 后台接口直接调用 AI 服务，跳过用户配额检查
  const { callAiServer } = await import("@/lib/aiClient.server");
  
  const result = await callAiServer({
    question,
    locale: locale || "zh-CN",
    scene: scene || undefined,
    sourceLanguage: sourceLanguage || undefined,
    targetLanguage: targetLanguage || undefined,
  });
  
  return {
    ok: !!result.answer,
    data: {
      answer: result.answer || "",
      aiProvider: result.aiProvider,
      model: result.model,
    },
    errorCode: result.answer ? undefined : "AI_SERVICE_ERROR",
    message: result.answer ? undefined : "AI service returned empty answer",
  };

  // 直接调用用户接口的 AI 服务核心函数
  // 但设置 userId=null 和 isAnonymous=false，跳过用户配额检查
  // 这样后台请求就不会经过用户接口，也不会触发配额限制
  return await callAiServiceCoreFromUserLib({
    question,
    locale,
    scene,
    sourceLanguage,
    targetLanguage,
    requestId,
    timeout,
    userId: null, // 后台调用不使用用户ID，跳过配额检查
    isAnonymous: false, // 后台调用不是匿名用户
  });
}
