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

function requireEnv(key: string): string {
  const raw = process.env[key];
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new Error(`${key} is not set. Please configure ${key} in the environment.`);
  }
  return raw.trim();
}

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
 * @param aiProvider AI 提供商配置（必须）
 * @returns OpenAI 客户端实例
 */
export function getOpenAIClient(config: ServiceConfig, aiProvider: "openai" | "openrouter"): OpenAI {
  
  let isOpenRouter: boolean;
  let baseUrl: string;

  if (aiProvider === "openrouter") {
    isOpenRouter = true;
    baseUrl = requireEnv("OPENROUTER_BASE_URL");
  } else {
    isOpenRouter = false;
    baseUrl = requireEnv("OPENAI_BASE_URL");
  }

  // 根据提供商选择 API key
  const apiKey = isOpenRouter ? config.openrouterApiKey : config.openaiApiKey;

  // 如果配置改变，重新创建客户端实例
  if (clientInstance && (lastBaseUrl !== baseUrl || lastApiKey !== apiKey)) {
    clearOpenAIClient();
  }

  // 如果客户端实例不存在，创建新的
  if (!clientInstance) {
    // 验证 API key
    if (!apiKey || apiKey.trim() === "") {
      const missingKey = isOpenRouter ? "OPENROUTER_API_KEY" : "OPENAI_API_KEY";
      throw new Error(`${missingKey} is not set. Please configure ${missingKey} in the environment.`);
    }

    const defaultHeaders: Record<string, string> = {
      "User-Agent": `ZalemAI/${config.version}`,
    };

    // OpenRouter 需要额外的 headers
    if (isOpenRouter) {
      defaultHeaders["HTTP-Referer"] = requireEnv("OPENROUTER_REFERER_URL");
      defaultHeaders["X-Title"] = requireEnv("OPENROUTER_APP_NAME");
    }

    clientInstance = new OpenAI({
      apiKey: apiKey.trim(),
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
  aiProvider: "openai" | "openrouter",
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  temperature = 0.7,
): Promise<string> {
  const openai = getOpenAIClient(config, aiProvider);
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
