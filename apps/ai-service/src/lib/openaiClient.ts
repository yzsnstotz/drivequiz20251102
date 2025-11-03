/**
 * OpenAI 客户端封装模块
 * 提供统一的 OpenAI API 调用接口（单例模式）
 * 支持可选自定义 Base URL（兼容 Ollama / Azure / Proxy）
 */

import OpenAI from "openai";
import type { ServiceConfig } from "../index";

let clientInstance: OpenAI | null = null;

/**
 * 获取或创建 OpenAI 客户端实例
 * @param config 服务配置
 * @returns OpenAI 客户端实例
 */
export function getOpenAIClient(config: ServiceConfig): OpenAI {
  if (clientInstance) return clientInstance;

  const baseUrl =
    process.env.OPENAI_BASE_URL?.trim() ||
    process.env.OLLAMA_BASE_URL?.trim() ||
    "https://api.openai.com/v1";

  clientInstance = new OpenAI({
    apiKey: config.openaiApiKey,
    baseURL: baseUrl,
    defaultHeaders: {
      "User-Agent": `ZalemAI/${config.version}`,
    },
  });

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
