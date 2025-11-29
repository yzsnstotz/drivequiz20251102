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
 */
async function getCurrentAiProvider(): Promise<string | null> {
  // 检查缓存
  const now = Date.now();
  if (aiConfigCache && now - aiConfigCache.timestamp < AI_CONFIG_CACHE_TTL) {
    return aiConfigCache.dbProvider;
  }

  try {
    const response = await fetch("/api/ai/config", {
      cache: "force-cache", // 利用浏览器缓存
    });
    if (!response.ok) {
      // 如果请求失败，尝试使用缓存（即使过期）
      if (aiConfigCache) {
        return aiConfigCache.dbProvider;
      }
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
    // 如果请求失败，尝试使用缓存（即使过期）
    if (aiConfigCache) {
      return aiConfigCache.dbProvider;
    }
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

  // 获取数据库中的原始 aiProvider 配置（仅当 provider 为 render 时）
  let xAiProviderHeader: string | undefined = undefined;
  if (provider === "render") {
    try {
      const dbProvider = await getCurrentAiProvider();
      console.log("[callAiDirect] 读取数据库 provider 配置:", {
        dbProvider,
        willSendHeader: dbProvider === "openai" || dbProvider === "openrouter" || dbProvider === "gemini",
      });
      // 只发送需要发送的 provider（openai, openrouter, gemini）
      if (dbProvider === "openai" || dbProvider === "openrouter" || dbProvider === "gemini") {
        xAiProviderHeader = dbProvider;
      } else if (dbProvider) {
        console.warn("[callAiDirect] 数据库 provider 值不支持发送 X-AI-Provider 头:", dbProvider);
      }
    } catch (error) {
      console.warn("[callAiDirect] 获取数据库 provider 配置失败:", error);
    }
  }

  // 增强日志记录，记录完整的请求信息（不暴露敏感信息）
  console.log("[callAiDirect] 调用 AI 服务:", {
    provider,
    baseUrl: url,
    requestUrl,
    hasToken: !!token,
    tokenLength: token?.length || 0,
    tokenPrefix: token ? `${token.substring(0, 8)}...` : "undefined",
    scene: rest.scene,
    model: rest.model,
    xAiProviderHeader,
    questionLength: rest.question?.length || 0,
    locale: rest.locale,
    hasMessages: !!rest.messages,
    messagesCount: rest.messages?.length || 0,
    timestamp: new Date().toISOString(),
  });

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

    // 构建请求体
    // 将locale转换为lang（BCP-47格式 -> 简短格式）
    const lang = localeToLang(rest.locale);
    
    const requestBody = {
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
    
    // 记录请求详情（脱敏）
    console.log("[callAiDirect] 发送请求:", {
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
    
    // 发送前日志（结构化）
    console.log("[aiClient.front] send", {
      locale: rest.locale,
      lang: lang,
      scene: rest.scene,
      model: rest.model,
      provider: provider,
    });
    
    response = await fetch(requestUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
    });
  } catch (fetchError: any) {
    // 网络错误（如 CORS、连接失败等）
    // 安全地提取错误信息（Error 对象在序列化时可能变成空对象）
    let errorMessage = "Network error";
    let errorName = "Unknown";
    let errorStack = "";
    
    if (fetchError) {
      // 优先使用 message 属性
      if (typeof fetchError.message === "string") {
        errorMessage = fetchError.message;
      } else if (typeof fetchError === "string") {
        errorMessage = fetchError;
      } else if (fetchError.toString && fetchError.toString() !== "[object Object]") {
        errorMessage = fetchError.toString();
      }
      
      // 提取 name
      if (typeof fetchError.name === "string") {
        errorName = fetchError.name;
      }
      
      // 提取 stack
      if (typeof fetchError.stack === "string") {
        errorStack = fetchError.stack.substring(0, 200);
      }
    }
    
    // 检查是否是 CORS 错误
    const isCorsError = 
      errorMessage.includes("CORS") || 
      errorMessage.includes("cors") || 
      errorMessage.includes("Failed to fetch") ||
      errorMessage.includes("NetworkError") ||
      errorName === "TypeError" && errorMessage.includes("fetch");
    
    // 检查是否是连接错误
    const isConnectionError = 
      errorMessage.includes("ECONNREFUSED") || 
      errorMessage.includes("ENOTFOUND") || 
      errorMessage.includes("network") ||
      errorMessage.includes("ERR_CONNECTION_REFUSED") ||
      errorMessage.includes("ERR_NAME_NOT_RESOLVED");
    
    // 确保所有值都是可序列化的基本类型
    const errorInfo = {
      provider: String(provider),
      baseUrl: String(url || "(未定义)"),
      requestUrl: String(requestUrl || "(未定义)"),
      errorMessage: String(errorMessage),
      errorName: String(errorName),
      errorStack: String(errorStack || "(无堆栈信息)"),
      isCorsError: Boolean(isCorsError),
      isConnectionError: Boolean(isConnectionError),
      // 原始错误对象（用于调试）
      rawError: fetchError ? String(fetchError) : "null",
    };
    
    console.error("[callAiDirect] 网络请求失败:", errorInfo);
    
    // 同时输出格式化字符串，确保信息可见
    console.error(
      `[callAiDirect] 网络请求失败详情:\n` +
      `  Provider: ${errorInfo.provider}\n` +
      `  Base URL: ${errorInfo.baseUrl}\n` +
      `  Request URL: ${errorInfo.requestUrl}\n` +
      `  错误消息: ${errorInfo.errorMessage}\n` +
      `  错误类型: ${errorInfo.errorName}\n` +
      `  CORS 错误: ${errorInfo.isCorsError}\n` +
      `  连接错误: ${errorInfo.isConnectionError}`
    );
    
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

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    
    // 尝试解析 JSON 错误响应，提取详细错误信息
    let parsedError: any = null;
    let detailedMessage = errorText.substring(0, 200);
    try {
      parsedError = JSON.parse(errorText);
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
      // 如果解析失败，使用原始错误文本
    }
    
    const errorMessage = `AI service error: ${response.status} ${detailedMessage}`;
    
    // 增强错误日志
    console.error("[callAiDirect] AI service 调用失败:", {
      provider,
      status: response.status,
      statusText: response.statusText,
      url: requestUrl,
      baseUrl: url,
      errorCode: parsedError?.errorCode || "UNKNOWN",
      errorMessage: detailedMessage,
      rawError: errorText.substring(0, 500),
      hasParsedError: !!parsedError,
      timestamp: new Date().toISOString(),
    });
    
    // 针对配置不匹配的情况提供更友好的错误提示
    let userFriendlyMessage = errorMessage;
    if (parsedError?.errorCode === "INTERNAL_ERROR" && detailedMessage.includes("local")) {
      userFriendlyMessage = `配置错误：数据库配置为 "local"，但调用了远程服务。请检查环境变量配置或刷新页面重试。`;
    } else if (parsedError?.errorCode === "INTERNAL_ERROR") {
      // 在生产环境显示友好提示，开发环境显示详细错误
      const isDev = process.env.NODE_ENV === "development";
      userFriendlyMessage = isDev 
        ? errorMessage
        : `AI 服务暂时不可用，请稍后重试。如果问题持续，请联系支持。`;
    }
    
    return {
      ok: false,
      errorCode:
        response.status === 401
          ? "AUTH_REQUIRED"
          : response.status === 403
          ? "FORBIDDEN"
          : parsedError?.errorCode || "AI_SERVICE_ERROR",
      message: userFriendlyMessage,
    };
  }

  const data = (await response.json()) as AiClientResponse;
  
  // 响应后日志
  const responseText = data?.data?.answer || "";
  const responsePreview = responseText.substring(0, 80);
  console.log("[aiClient.front] response", {
    status: response.status,
    lang: lang,
    responsePreview: responsePreview,
  });
  
  return data;
}
