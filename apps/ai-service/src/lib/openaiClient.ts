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
 * @returns OpenAI 客户端实例
 */
export function getOpenAIClient(config: ServiceConfig): OpenAI {
  const baseUrl =
    process.env.OPENAI_BASE_URL?.trim() ||
    process.env.OLLAMA_BASE_URL?.trim() ||
    "https://api.openai.com/v1";

  // 检查是否是 OpenRouter
  const isOpenRouter = baseUrl.includes("openrouter.ai");
  
  // 根据 base URL 选择 API key
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
