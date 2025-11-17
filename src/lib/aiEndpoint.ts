"use client";

/**
 * AI 端点解析工具
 * 根据 provider 解析对应的服务端点（URL + TOKEN）
 * 指令版本：0002
 */

export type AiProviderKey = "local" | "render";

/**
 * 根据 provider 解析对应的服务端点（URL + TOKEN）
 * @param provider Provider 名称
 * @returns 服务端点配置
 */
export function resolveAiEndpoint(provider: AiProviderKey): { url: string; token: string } {
  const endpoints = {
    local: {
      url: process.env.NEXT_PUBLIC_LOCAL_AI_SERVICE_URL,
      token: process.env.NEXT_PUBLIC_LOCAL_AI_SERVICE_TOKEN,
    },
    render: {
      url: process.env.NEXT_PUBLIC_RENDER_AI_SERVICE_URL,
      token: process.env.NEXT_PUBLIC_RENDER_AI_SERVICE_TOKEN,
    },
  } as const;

  const ep = endpoints[provider];

  // 详细的调试日志
  console.log("[resolveAiEndpoint] 解析端点:", {
    provider,
    hasUrl: !!ep?.url,
    hasToken: !!ep?.token,
    urlPreview: ep?.url ? `${ep.url.substring(0, 50)}...` : "undefined",
    tokenPreview: ep?.token ? `${ep.token.substring(0, 10)}...` : "undefined",
  });

  if (!ep?.url) {
    const error = new Error(
      `AI endpoint URL not configured for provider: ${provider}. Please configure NEXT_PUBLIC_${provider.toUpperCase()}_AI_SERVICE_URL in Vercel.`
    );
    console.error("[resolveAiEndpoint] 环境变量未配置:", {
      provider,
      envVar: `NEXT_PUBLIC_${provider.toUpperCase()}_AI_SERVICE_URL`,
      error: error.message,
    });
    throw error;
  }

  if (!ep?.token) {
    const error = new Error(
      `AI endpoint token not configured for provider: ${provider}. Please configure NEXT_PUBLIC_${provider.toUpperCase()}_AI_SERVICE_TOKEN in Vercel.`
    );
    console.error("[resolveAiEndpoint] 环境变量未配置:", {
      provider,
      envVar: `NEXT_PUBLIC_${provider.toUpperCase()}_AI_SERVICE_TOKEN`,
      error: error.message,
    });
    throw error;
  }

  // 验证 URL 格式
  try {
    const urlObj = new URL(ep.url);
    console.log("[resolveAiEndpoint] URL 验证通过:", {
      provider,
      protocol: urlObj.protocol,
      hostname: urlObj.hostname,
      port: urlObj.port || "default",
      pathname: urlObj.pathname,
    });
  } catch (urlError) {
    const error = new Error(
      `AI endpoint URL format error for provider ${provider}: "${ep.url}". Should be a complete URL like "https://zalem.onrender.com" or "http://localhost:8788"`
    );
    console.error("[resolveAiEndpoint] URL 格式错误:", {
      provider,
      url: ep.url,
      error: error.message,
      urlError: urlError instanceof Error ? urlError.message : String(urlError),
    });
    throw error;
  }

  // 返回原始 URL，由调用方使用 joinUrl 处理拼接
  return { url: ep.url, token: ep.token };
}

