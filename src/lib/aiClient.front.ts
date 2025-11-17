"use client";

/**
 * 前端 AI 客户端 - 直接调用 ai-service
 * 支持 120 秒超时，不受 Next.js 20 秒限制
 * 支持多 Provider：local / render
 * 指令版本：0003
 */

import { resolveAiEndpoint, type AiProviderKey } from "./aiEndpoint";
import { joinUrl } from "./urlJoin";

export type { AiProviderKey };

export interface AiClientRequest {
  provider: AiProviderKey; // 必须指定 provider: "local" | "render"
  question: string;
  locale?: string;
  scene?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  messages?: Array<{ role: "user" | "assistant"; content: string }>;
  maxHistory?: number;
  seedUrl?: string;
  model?: string; // 可选：指定模型名称
}

export interface AiClientResponse {
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
}

/**
 * 直接调用 ai-service
 * @param params AI 请求参数（必须包含 provider）
 * @returns AI 响应
 */
export async function callAiDirect(params: AiClientRequest): Promise<AiClientResponse> {
  const { provider, ...rest } = params;

  // 根据 provider 解析端点
  let url: string;
  let token: string;
  try {
    const endpoint = resolveAiEndpoint(provider);
    url = endpoint.url;
    token = endpoint.token;
  } catch (error: any) {
    console.error("[callAiDirect] 端点解析失败:", {
      provider,
      error: error?.message,
    });
    return {
      ok: false,
      errorCode: "CONFIG_ERROR",
      message: `AI 服务配置错误: ${error?.message || "环境变量未配置"}`,
    };
  }

  // 使用 joinUrl 安全拼接 URL
  const requestUrl = joinUrl(url, "/v1/ask");

  console.log("[callAiDirect] 调用 AI 服务:", {
    provider,
    baseUrl: url,
    requestUrl,
    hasToken: !!token,
    tokenLength: token?.length || 0,
    scene: rest.scene,
    model: rest.model,
    questionLength: rest.question?.length || 0,
  });

  let response: Response;
  try {
    response = await fetch(requestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        question: rest.question,
        lang: rest.locale || "zh",
        scene: rest.scene,
        sourceLanguage: rest.sourceLanguage,
        targetLanguage: rest.targetLanguage,
        messages: rest.messages,
        maxHistory: rest.maxHistory,
        seedUrl: rest.seedUrl,
        model: rest.model,
      }),
    });
  } catch (fetchError: any) {
    // 网络错误（如 CORS、连接失败等）
    const errorMessage = fetchError?.message || "Network error";
    const errorName = fetchError?.name || "Unknown";
    const errorStack = fetchError?.stack?.substring(0, 200) || "";
    
    console.error("[callAiDirect] 网络请求失败:", {
      provider,
      baseUrl: url,
      requestUrl,
      error: errorMessage,
      name: errorName,
      stack: errorStack,
      // 检查是否是 CORS 错误
      isCorsError: errorMessage.includes("CORS") || errorMessage.includes("cors") || errorMessage.includes("Failed to fetch"),
      // 检查是否是连接错误
      isConnectionError: errorMessage.includes("ECONNREFUSED") || errorMessage.includes("ENOTFOUND") || errorMessage.includes("network"),
    });
    
    // 提供更详细的错误信息
    let detailedMessage = `网络请求失败: ${errorMessage}`;
    if (errorMessage.includes("Failed to fetch") || errorMessage.includes("network")) {
      detailedMessage += `\n\n可能的原因：\n1. AI 服务未运行（检查 ${url} 是否可访问）\n2. CORS 配置问题（检查 ai-service 的 CORS 设置）\n3. 网络连接问题（检查防火墙/代理设置）\n4. URL 配置错误（当前 URL: ${requestUrl}）`;
    }
    
    return {
      ok: false,
      errorCode: "NETWORK_ERROR",
      message: detailedMessage,
    };
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    const errorMessage = `AI service error: ${response.status} ${errorText.substring(0, 200)}`;
    console.error("[callAiDirect] AI service 调用失败:", {
      provider,
      status: response.status,
      statusText: response.statusText,
      url: requestUrl,
      error: errorText.substring(0, 200),
    });
    return {
      ok: false,
      errorCode:
        response.status === 401
          ? "AUTH_REQUIRED"
          : response.status === 403
          ? "FORBIDDEN"
          : "AI_SERVICE_ERROR",
      message: errorMessage,
    };
  }

  const data = (await response.json()) as AiClientResponse;
  return data;
}
