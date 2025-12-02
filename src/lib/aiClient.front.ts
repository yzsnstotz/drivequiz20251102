"use client";

/**
 * 前端 AI 客户端 - 直接调用 ai-service
 * 支持 120 秒超时，不受 Next.js 20 秒限制
 * 支持多 Provider：local / render
 * 指令版本：0004 - 添加 X-AI-Provider 请求头支持
 */

import { resolveAiEndpoint, type AiProviderKey } from "./aiEndpoint";
import { joinUrl } from "./urlJoin";

export type { AiProviderKey };

/**
 * 将BCP-47格式的locale转换为简短格式的lang
 * @param locale BCP-47格式的locale（如 "en-US", "zh-CN", "ja-JP"）
 * @returns 简短格式的lang（"zh", "ja", "en"）
 */
function localeToLang(locale: string | undefined): "zh" | "ja" | "en" {
  if (!locale) return "zh";
  
  const normalized = locale.toLowerCase().trim();
  
  // 支持BCP-47格式和简短格式
  if (normalized.startsWith("ja") || normalized === "japanese" || normalized === "jp") {
    return "ja";
  }
  if (normalized.startsWith("en") || normalized === "english") {
    return "en";
  }
  if (normalized.startsWith("zh") || normalized === "chinese" || normalized === "cn") {
    return "zh";
  }
  
  // 默认返回中文
  return "zh";
}

// 缓存配置
const AI_CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 分钟
let aiConfigCache: { dbProvider: string | null; timestamp: number } | null = null;

/**
 * 获取当前的 aiProvider 配置（通过 API，带缓存）
 * 
 * 缓存策略：
 * 1. 如果缓存有效（未过期），直接返回
 * 2. 如果缓存过期但存在，使用过期缓存以保持会话一致性（避免后台切换配置导致前端报错）
 * 3. 只有在完全没有缓存的情况下才请求 API
 */
async function getCurrentAiProvider(): Promise<string | null> {
  const now = Date.now();
  
  // 1. 检查缓存是否有效
  if (aiConfigCache && now - aiConfigCache.timestamp < AI_CONFIG_CACHE_TTL) {
    return aiConfigCache.dbProvider;
  }

  // 2. 缓存过期但存在，使用过期缓存以保持会话一致性
  // 这样可以确保前端在整个会话期间使用相同的 provider 配置
  // 后台切换配置不会影响已打开的前端页面，只有刷新页面后才会获取新配置
  if (aiConfigCache) {
    if (process.env.NODE_ENV === "development") {
      console.log("[getCurrentAiProvider] 缓存已过期，但使用过期缓存以保持会话一致性:", {
        dbProvider: aiConfigCache.dbProvider,
        age: Math.round((now - aiConfigCache.timestamp) / 1000) + "秒",
      });
    }
    return aiConfigCache.dbProvider;
  }

  // 3. 完全没有缓存时才请求 API
  try {
    const response = await fetch("/api/ai/config", {
      cache: "no-store", // 改为 no-store，避免浏览器缓存干扰
    });
    if (!response.ok) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[getCurrentAiProvider] API 响应失败:", response.status, response.statusText);
      }
      return null;
    }
    const data = await response.json();
    const dbProvider = data?.data?.dbProvider;
    
    // 更新缓存
    aiConfigCache = {
      dbProvider: dbProvider || null,
      timestamp: Date.now(),
    };
    
    // 返回数据库中的原始值
    return dbProvider || null;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[getCurrentAiProvider] 获取配置失败:", error);
    }
    return null;
  }
}

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
    if (process.env.NODE_ENV === "development") {
      console.error("[callAiDirect] 端点解析失败:", {
        provider,
        error: error?.message,
      });
    }
    return {
      ok: false,
      errorCode: "CONFIG_ERROR",
      message: `AI 服务配置错误: ${error?.message || "环境变量未配置"}`,
    };
  }

  // 使用 joinUrl 安全拼接 URL
  const requestUrl = joinUrl(url, "/v1/ask");

  // 获取数据库中的原始 aiProvider 配置（仅当 provider 为 render 时）
  let xAiProviderHeader: string | undefined = undefined;
  if (provider === "render") {
    try {
      const dbProvider = await getCurrentAiProvider();
      // 只发送需要发送的 provider（openai, openrouter, gemini）
      if (dbProvider === "openai" || dbProvider === "openrouter" || dbProvider === "gemini") {
        xAiProviderHeader = dbProvider;
      }
    } catch (error) {
      // 配置获取失败不影响主流程，静默处理
      if (process.env.NODE_ENV === "development") {
        console.warn("[callAiDirect] 获取数据库 provider 配置失败:", error);
      }
    }
  }

  // 将locale转换为lang（BCP-47格式 -> 简短格式）
  const lang = localeToLang(rest.locale);
  
  let response: Response;
  try {
    // 构建请求头
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    // 添加 X-AI-Provider 头（如果适用）
    if (xAiProviderHeader) {
      headers["X-AI-Provider"] = xAiProviderHeader;
    }

    // 构建请求体 - 先构建原始对象，然后过滤 undefined/null
    const rawBody: Record<string, any> = {
      question: rest.question,
      lang: lang,
      scene: rest.scene,
      sourceLanguage: rest.sourceLanguage,
      targetLanguage: rest.targetLanguage,
      messages: rest.messages,
      maxHistory: rest.maxHistory,
      seedUrl: rest.seedUrl,
      model: rest.model,
    };

    // 过滤掉 undefined 和 null 值，避免序列化问题
    const requestBody = Object.fromEntries(
      Object.entries(rawBody).filter(([_, v]) => v !== undefined && v !== null)
    ) as typeof rawBody;

    // 基本参数校验（防御性校验）
    if (!requestBody.question || typeof requestBody.question !== "string") {
      throw new Error("AI 请求缺少有效的 question 字段");
    }

    if (!requestBody.scene || typeof requestBody.scene !== "string") {
      throw new Error("AI 请求缺少有效的 scene 标识");
    }
    
    // 记录请求详情（仅在开发环境，避免日志污染）
    if (process.env.NODE_ENV === "development") {
      console.debug("[aiClient] requestBody to ai-service", {
        method: "POST",
        url: requestUrl,
        headers: {
          "Content-Type": headers["Content-Type"],
          "Authorization": headers["Authorization"] ? "Bearer ***" : undefined,
          "X-AI-Provider": headers["X-AI-Provider"] || undefined,
        },
        bodySize: JSON.stringify(requestBody).length,
        questionLength: rest.question?.length || 0,
        scene: rest.scene,
        model: rest.model,
        locale: rest.locale,
        lang: lang,
      });
    }
    
    response = await fetch(requestUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
    });
  } catch (fetchError: any) {
    // 网络错误（如 CORS、连接失败等）
    // 安全地提取错误信息（Error 对象在序列化时可能变成空对象）
    let errorMessage = "Network error";
    
    if (fetchError) {
      // 优先使用 message 属性
      if (typeof fetchError.message === "string") {
        errorMessage = fetchError.message;
      } else if (typeof fetchError === "string") {
        errorMessage = fetchError;
      } else if (fetchError.toString && fetchError.toString() !== "[object Object]") {
        errorMessage = fetchError.toString();
      }
    }
    
    // 检查是否是 CORS 错误
    const isCorsError = 
      errorMessage.includes("CORS") || 
      errorMessage.includes("cors") || 
      errorMessage.includes("Failed to fetch") ||
      errorMessage.includes("NetworkError");
    
    // 检查是否是连接错误
    const isConnectionError = 
      errorMessage.includes("ECONNREFUSED") || 
      errorMessage.includes("ENOTFOUND") || 
      errorMessage.includes("network") ||
      errorMessage.includes("ERR_CONNECTION_REFUSED") ||
      errorMessage.includes("ERR_NAME_NOT_RESOLVED");
    
    // 在开发环境记录详细错误信息
    if (process.env.NODE_ENV === "development") {
      console.error("[aiClient] 网络请求失败", {
        provider: String(provider),
        baseUrl: String(url || "(未定义)"),
        requestUrl: String(requestUrl || "(未定义)"),
        errorMessage: String(errorMessage),
        isCorsError: Boolean(isCorsError),
        isConnectionError: Boolean(isConnectionError),
      });
    }
    
    // 提供更详细的错误信息
    let detailedMessage = `网络请求失败: ${errorMessage}`;
    if (isCorsError || isConnectionError) {
      detailedMessage += `\n\n可能的原因：\n1. AI 服务未运行（检查 ${url} 是否可访问）\n2. CORS 配置问题（检查 ai-service 的 CORS 设置）\n3. 网络连接问题（检查防火墙/代理设置）\n4. URL 配置错误（当前 URL: ${requestUrl}）`;
    }
    
    return {
      ok: false,
      errorCode: "NETWORK_ERROR",
      message: detailedMessage,
    };
  }

  // 先读取响应文本，然后根据状态码处理
  const status = response.status;
  const statusText = response.statusText;
  const responseText = await response.text();

  if (!response.ok) {
    // 在开发环境保留部分原始响应，便于排查
    if (process.env.NODE_ENV === "development") {
      console.error("[aiClient] ai-service error response", {
        status,
        statusText,
        bodyPreview: responseText.slice(0, 500),
      });
    }

    // 尝试解析 JSON 错误响应
    let parsedError: any = null;
    let detailedMessage = `AI service 返回错误状态：${status} ${statusText || ""}`.trim();
    
    try {
      parsedError = JSON.parse(responseText);
      if (parsedError && typeof parsedError === "object") {
        // 提取错误信息
        if (parsedError.message) {
          detailedMessage = parsedError.message;
        } else if (parsedError.error) {
          detailedMessage = typeof parsedError.error === "string" 
            ? parsedError.error 
            : JSON.stringify(parsedError.error);
        }
        
        // 如果是 INTERNAL_ERROR，尝试提取更详细的信息
        if (parsedError.errorCode === "INTERNAL_ERROR" && parsedError.details) {
          const details = parsedError.details;
          if (details.errorMessage) {
            detailedMessage = details.errorMessage;
          } else if (details.error) {
            detailedMessage = typeof details.error === "string"
              ? details.error
              : JSON.stringify(details.error);
          }
        }
      }
    } catch {
      // 如果解析失败，使用原始错误文本（但限制长度）
      if (responseText && responseText.length > 0) {
        detailedMessage = responseText.slice(0, 200);
      }
    }

    // 针对配置不匹配的情况提供更友好的错误提示
    let userFriendlyMessage = detailedMessage;
    if (parsedError?.errorCode === "INTERNAL_ERROR" && detailedMessage.includes("local")) {
      userFriendlyMessage = `配置错误：数据库配置为 "local"，但调用了远程服务。请检查环境变量配置或刷新页面重试。`;
    } else if (parsedError?.errorCode === "INTERNAL_ERROR") {
      // 在生产环境显示友好提示，开发环境显示详细错误
      const isDev = process.env.NODE_ENV === "development";
      userFriendlyMessage = isDev 
        ? detailedMessage
        : `AI 服务暂时不可用，请稍后重试。如果问题持续，请联系支持。`;
    }
    
    return {
      ok: false,
      errorCode:
        status === 401
          ? "AUTH_REQUIRED"
          : status === 403
          ? "FORBIDDEN"
          : parsedError?.errorCode || "AI_SERVICE_ERROR",
      message: userFriendlyMessage,
    };
  }

  // 解析 JSON 响应（安全模式）
  let data: AiClientResponse;
  try {
    data = JSON.parse(responseText) as AiClientResponse;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[aiClient] 解析 ai-service 响应 JSON 失败", {
        status,
        statusText,
        bodyPreview: responseText.slice(0, 500),
        error,
      });
    }
    return {
      ok: false,
      errorCode: "AI_SERVICE_ERROR",
      message: "无法解析 AI 服务返回的数据，请稍后重试。",
    };
  }
  
  return data;
}
