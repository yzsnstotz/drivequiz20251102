import "server-only";

/**
 * 服务端 AI 客户端 - 直接调用 ai-service
 * 使用服务端环境变量（AI_LOCAL_SERVICE_URL / AI_RENDER_SERVICE_URL）
 * 指令版本：0003
 */

import { joinUrl } from "./urlJoin";

export type ServerAiProviderKey = "local" | "render";

/**
 * 根据 provider 解析对应的服务端点（URL + TOKEN）
 * 使用服务端环境变量
 * @param provider Provider 名称
 * @returns 服务端点配置
 */
function resolveServerAiEndpoint(provider: ServerAiProviderKey): { url: string; token: string } {
  const endpoints = {
    local: {
      url: process.env.AI_LOCAL_SERVICE_URL,
      token: process.env.AI_LOCAL_SERVICE_TOKEN,
    },
    render: {
      url: process.env.AI_RENDER_SERVICE_URL,
      token: process.env.AI_RENDER_SERVICE_TOKEN,
    },
  } as const;

  const ep = endpoints[provider];

  if (!ep?.url) {
    const error = new Error(
      `AI server endpoint URL not configured for provider: ${provider}. Please configure AI_${provider.toUpperCase()}_SERVICE_URL.`
    );
    console.error("[resolveServerAiEndpoint] 环境变量未配置:", error.message);
    throw error;
  }

  if (!ep?.token) {
    const error = new Error(
      `AI server endpoint token not configured for provider: ${provider}. Please configure AI_${provider.toUpperCase()}_SERVICE_TOKEN.`
    );
    console.error("[resolveServerAiEndpoint] 环境变量未配置:", error.message);
    throw error;
  }

  // 验证 URL 格式
  try {
    new URL(ep.url);
  } catch {
    const error = new Error(
      `AI server endpoint URL format error for provider ${provider}: "${ep.url}". Should be a complete URL like "https://zalem.onrender.com"`
    );
    console.error("[resolveServerAiEndpoint] URL 格式错误:", error.message);
    throw error;
  }

  return {
    url: ep.url, // 保留原始 URL，由 joinUrl 处理斜杠
    token: ep.token,
  };
}

export interface ServerAiRequest {
  provider: ServerAiProviderKey;
  question: string;
  locale?: string;
  scene?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  messages?: Array<{ role: "user" | "assistant"; content: string }>;
  maxHistory?: number;
  seedUrl?: string;
  model?: string;
  // 允许其他字段
  [key: string]: any;
}

export interface ServerAiResponse<T = any> {
  ok: boolean;
  data?: T;
  message?: string;
  errorCode?: string;
}

/**
 * 服务端直接调用 ai-service
 * @param params AI 请求参数（必须包含 provider）
 * @param options 可选配置（如超时时间）
 * @returns AI 响应
 */
export async function callAiServer<T = any>(
  params: ServerAiRequest,
  options?: { timeoutMs?: number }
): Promise<ServerAiResponse<T>> {
  const { provider, ...rest } = params;
  const { url, token } = resolveServerAiEndpoint(provider);

  const controller = new AbortController();
  const timeout = options?.timeoutMs ?? 120_000; // 默认 120 秒
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    // 使用 joinUrl 安全拼接 URL
    const requestUrl = joinUrl(url, "/v1/ask");

    console.log("[callAiServer] 调用 AI 服务:", {
      provider,
      url: `${url.substring(0, 50)}...`,
      scene: rest.scene,
      model: rest.model,
      timeoutMs: timeout,
    });

    const res = await fetch(requestUrl, {
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
        // 传递其他字段（如果有）
        ...Object.fromEntries(
          Object.entries(rest).filter(
            ([key]) =>
              !["question", "locale", "scene", "sourceLanguage", "targetLanguage", "messages", "maxHistory", "seedUrl", "model"].includes(key)
          )
        ),
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    const text = await res.text().catch(() => "");
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      // ignore JSON parse error
    }

    if (!res.ok) {
      const errorMessage =
        json?.message ??
        `AI service error: ${res.status} ${res.statusText} ${text?.slice(0, 200)}`;
      console.error("[callAiServer] AI service 调用失败:", {
        provider,
        status: res.status,
        statusText: res.statusText,
        url: requestUrl,
        error: text?.slice(0, 200),
      });
      return {
        ok: false,
        message: errorMessage,
        errorCode:
          json?.errorCode ??
          (res.status === 401
            ? "AUTH_REQUIRED"
            : res.status === 403
            ? "FORBIDDEN"
            : "AI_SERVICE_HTTP_ERROR"),
      };
    }

    // 兼容 ai-service 返回格式 { ok, data, ... }
    if (json && typeof json === "object") {
      if (typeof json.ok === "boolean") {
        return json as ServerAiResponse<T>;
      }
      // 如果返回格式是 { answer, sources, ... }，包装为 { ok: true, data: {...} }
      return { ok: true, data: json as T };
    }

    return { ok: true, data: json as T };
  } catch (err: any) {
    if (err?.name === "AbortError") {
      console.error("[callAiServer] AI service 调用超时:", {
        provider,
        timeoutMs: timeout,
      });
      return {
        ok: false,
        message: `AI service timeout after ${timeout} ms`,
        errorCode: "AI_SERVICE_TIMEOUT",
      };
    }
    console.error("[callAiServer] AI service 调用错误:", {
      provider,
      error: err?.message,
      stack: err?.stack?.substring(0, 500),
    });
    return {
      ok: false,
      message: err?.message ?? String(err),
      errorCode: "AI_SERVICE_NETWORK_ERROR",
    };
  } finally {
    clearTimeout(timer);
  }
}

