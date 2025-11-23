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
  
  // 获取当前配置的 provider（默认使用 render）
  let provider: "render" | "local" = "render";
  try {
    const { getCurrentAiProviderConfig } = await import("@/app/api/admin/question-processing/_lib/batchProcessUtils");
    const config = await getCurrentAiProviderConfig();
    provider = config.provider as "render" | "local";
  } catch (error) {
    console.warn("[callAiServiceCore] 获取 provider 配置失败，使用默认值 render:", error);
  }
  
  const result = await callAiServer({
    provider,
    question,
    locale: locale || "zh-CN",
    scene: scene || undefined,
    sourceLanguage: sourceLanguage || undefined,
    targetLanguage: targetLanguage || undefined,
  });
  
  if (!result.ok) {
    return {
      ok: false,
      errorCode: result.errorCode || "AI_SERVICE_ERROR",
      message: result.message || "AI service returned error",
    };
  }
  
  // result.data 包含 answer, aiProvider, model 等字段
  const answer = (result.data as any)?.answer || "";
  const aiProvider = (result.data as any)?.aiProvider;
  const model = (result.data as any)?.model;
  
  return {
    ok: !!answer,
    data: {
      answer,
      aiProvider,
      model,
    },
    errorCode: answer ? undefined : "AI_SERVICE_ERROR",
    message: answer ? undefined : "AI service returned empty answer",
  };
}
