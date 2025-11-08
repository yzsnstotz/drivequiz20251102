/**
 * OpenAI 客户端封装模块
 * 提供统一的 OpenAI API 调用接口（单例模式）
 * 支持可选自定义 Base URL（兼容 Ollama / Azure / Proxy）
 */

import OpenAI from "openai";
import type { ServiceConfig } from "../index.js";

let clientInstance: OpenAI | null = null;
let lastBaseUrl: string | null = null;
let lastApiKey: string | null = null;

/**
 * 清除客户端实例（用于重新创建）
 */
export function clearOpenAIClient(): void {
  clientInstance = null;
  lastBaseUrl = null;
  lastApiKey = null;
}

/**
 * 获取或创建 OpenAI 客户端实例
 * @param config 服务配置
 * @param aiProvider 从数据库读取的 AI 提供商配置（可选）
 * @returns OpenAI 客户端实例
 */
export function getOpenAIClient(config: ServiceConfig, aiProvider?: "openai" | "openrouter" | null): OpenAI {
  // 优先使用传入的 aiProvider 配置（从数据库读取）
  // 如果没有传入，则根据环境变量判断
  let isOpenRouter: boolean;
  let baseUrl: string;
  
  if (aiProvider === "openrouter") {
    // 明确使用 OpenRouter
    isOpenRouter = true;
    baseUrl = process.env.OPENAI_BASE_URL?.trim() || "https://openrouter.ai/api/v1";
  } else if (aiProvider === "openai") {
    // 明确使用 OpenAI
    isOpenRouter = false;
    baseUrl = process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1";
    // 如果环境变量设置为 OpenRouter，但配置要求使用 OpenAI，则强制使用 OpenAI
    if (baseUrl.includes("openrouter.ai")) {
      baseUrl = "https://api.openai.com/v1";
    }
  } else {
    // 没有传入配置，使用环境变量判断（向后兼容）
    baseUrl =
      process.env.OPENAI_BASE_URL?.trim() ||
      process.env.OLLAMA_BASE_URL?.trim() ||
      "https://api.openai.com/v1";
    isOpenRouter = baseUrl.includes("openrouter.ai");
  }
  
  // 根据提供商选择 API key
  const apiKey = isOpenRouter && config.openrouterApiKey 
    ? config.openrouterApiKey 
    : config.openaiApiKey;

  // 如果配置改变，重新创建客户端实例
  if (clientInstance && (lastBaseUrl !== baseUrl || lastApiKey !== apiKey)) {
    clearOpenAIClient();
  }

  // 如果客户端实例不存在，创建新的
  if (!clientInstance) {
    // 验证 API key
    if (!apiKey) {
      const errorMsg = isOpenRouter 
        ? "OPENROUTER_API_KEY is not set. Please set OPENROUTER_API_KEY environment variable."
        : "OPENAI_API_KEY is not set. Please set OPENAI_API_KEY environment variable.";
      throw new Error(errorMsg);
    }

    const defaultHeaders: Record<string, string> = {
      "User-Agent": `ZalemAI/${config.version}`,
    };

    // OpenRouter 需要额外的 headers
    if (isOpenRouter) {
      defaultHeaders["HTTP-Referer"] = process.env.OPENROUTER_REFERER_URL || "https://zalem.app";
      defaultHeaders["X-Title"] = process.env.OPENROUTER_APP_NAME || "ZALEM";
    }

    clientInstance = new OpenAI({
      apiKey: apiKey,
      baseURL: baseUrl,
      defaultHeaders,
    });

    lastBaseUrl = baseUrl;
    lastApiKey = apiKey;
  }

  return clientInstance;
}

/**
 * 统一封装的通用调用函数
 * 可直接用于简单任务（如 embedding）
 */
export async function callOpenAIChat(
  config: ServiceConfig,
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  temperature = 0.7
): Promise<string> {
  const openai = getOpenAIClient(config);
  try {
    const completion = await openai.chat.completions.create({
      model: config.aiModel,
      messages,
      temperature,
    });
    return completion.choices?.[0]?.message?.content?.trim() || "";
  } catch (e) {
    throw new Error(`OpenAI API 调用失败: ${(e as Error).message}`);
  }
}
