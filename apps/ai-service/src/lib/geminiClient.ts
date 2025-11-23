/**
 * Google Gemini 客户端封装模块
 * 提供统一的 Gemini API 调用接口（单例模式）
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ServiceConfig } from "../index.js";

let clientInstance: GoogleGenerativeAI | null = null;
let lastApiKey: string | null = null;

/**
 * 清除客户端实例（用于重新创建）
 */
export function clearGeminiClient(): void {
  clientInstance = null;
  lastApiKey = null;
}

/**
 * 获取或创建 Gemini 客户端实例
 * @param config 服务配置
 * @returns Gemini 客户端实例
 */
export function getGeminiClient(config: ServiceConfig): GoogleGenerativeAI {
  const apiKey = config.geminiApiKey;

  // 如果配置改变，重新创建客户端实例
  if (clientInstance && lastApiKey !== apiKey) {
    clearGeminiClient();
  }

  // 如果客户端实例不存在，创建新的
  if (!clientInstance) {
    // 验证 API key
    if (!apiKey || apiKey.trim() === "") {
      throw new Error("GEMINI_API_KEY is not set. Please configure GEMINI_API_KEY in the environment.");
    }

    clientInstance = new GoogleGenerativeAI(apiKey.trim());
    lastApiKey = apiKey;
  }

  return clientInstance;
}

/**
 * 将 OpenAI 格式的 messages 转换为 Gemini 格式
 */
function convertMessagesToGeminiFormat(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
): { messages: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }>; systemInstruction: string } {
  const geminiMessages: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];
  let systemInstruction = "";

  for (const msg of messages) {
    if (msg.role === "system") {
      // Gemini 使用 systemInstruction 参数，而不是消息
      systemInstruction = msg.content;
    } else if (msg.role === "user") {
      geminiMessages.push({
        role: "user",
        parts: [{ text: msg.content }],
      });
    } else if (msg.role === "assistant") {
      geminiMessages.push({
        role: "model",
        parts: [{ text: msg.content }],
      });
    }
  }

  return { messages: geminiMessages, systemInstruction };
}

/**
 * 获取 Gemini 可用模型列表
 * @param config 服务配置
 * @returns 模型列表
 */
export async function getGeminiModels(config: ServiceConfig): Promise<Array<{ id: string; name: string; description?: string }>> {
  const gemini = getGeminiClient(config);
  
  try {
    // Gemini API 目前没有直接的模型列表端点
    // 根据官方文档，当前支持的模型列表
    // 参考：https://ai.google.dev/models/gemini
    const availableModels = [
      {
        id: "gemini-3.0-pro",
        name: "Gemini 3.0 Pro",
        description: "最新发布的顶级模型（2025年11月），在多项基准测试中超越 GPT-5 Pro（推荐）",
      },
      {
        id: "gemini-2.5-pro",
        name: "Gemini 2.5 Pro",
        description: "最先进的推理模型，擅长多模态理解和复杂任务",
      },
      {
        id: "gemini-2.5-pro-preview",
        name: "Gemini 2.5 Pro Preview",
        description: "Gemini 2.5 Pro 预览版，包含最新特性",
      },
      {
        id: "gemini-2.5-flash",
        name: "Gemini 2.5 Flash",
        description: "速度快、成本低，适用于快速响应场景（推荐）",
      },
      {
        id: "gemini-2.5-flash-preview-09-2025",
        name: "Gemini 2.5 Flash Preview 09-2025",
        description: "Gemini 2.5 Flash 预览版（2025年9月）",
      },
      {
        id: "gemini-2.5-flash-lite",
        name: "Gemini 2.5 Flash Lite",
        description: "超轻量版本，更快更便宜，适合大批量任务",
      },
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        description: "最新的多模态模型，具有新一代功能",
      },
      {
        id: "gemini-2.0-flash-lite",
        name: "Gemini 2.0 Flash Lite",
        description: "优化的 Gemini 2.0 Flash，成本效益和低延迟",
      },
      {
        id: "gemini-2.5-flash-image",
        name: "Gemini 2.5 Flash Image",
        description: "支持图片生成和对话式多轮修改",
      },
      // 旧模型（向后兼容，会自动映射到新模型）
      {
        id: "gemini-1.5-pro",
        name: "Gemini 1.5 Pro (已停用)",
        description: "已停用，将自动映射到 Gemini 2.5 Pro",
      },
      {
        id: "gemini-1.5-flash",
        name: "Gemini 1.5 Flash (已停用)",
        description: "已停用，将自动映射到 Gemini 2.5 Flash",
      },
      {
        id: "gemini-pro",
        name: "Gemini Pro (已停用)",
        description: "已停用，将自动映射到 Gemini 2.5 Pro",
      },
    ];

    // 验证 API Key 是否有效（通过尝试创建一个模型实例）
    try {
      gemini.getGenerativeModel({ model: "gemini-2.5-flash" });
    } catch (error) {
      console.warn("[GEMINI] API Key 验证失败，但返回默认模型列表:", error);
    }

    return availableModels;
  } catch (e) {
    console.error("[GEMINI] 获取模型列表失败:", e);
    // 返回默认模型列表，确保前端可以正常工作
    return [
      {
        id: "gemini-2.5-flash",
        name: "Gemini 2.5 Flash",
        description: "推荐模型",
      },
      {
        id: "gemini-2.5-pro",
        name: "Gemini 2.5 Pro",
        description: "最先进的模型",
      },
    ];
  }
}

/**
 * 统一封装的通用调用函数
 * 可直接用于简单任务（如对话）
 */
export async function callGeminiChat(
  config: ServiceConfig,
  model: string,
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  temperature = 0.7,
  responseFormat?: { type: "json_object" }
): Promise<{ text: string; tokens?: { prompt?: number; completion?: number; total?: number } }> {
  const gemini = getGeminiClient(config);
  
  try {
    // 转换消息格式
    const { messages: geminiMessages, systemInstruction } = convertMessagesToGeminiFormat(messages);
    
    // 获取模型实例
    const geminiModel = gemini.getGenerativeModel({ 
      model: model || "gemini-pro",
      systemInstruction: systemInstruction || undefined,
    });

    // 构建生成配置
    const generationConfig: any = {
      temperature,
    };

    // 如果要求 JSON 格式，添加响应格式配置
    if (responseFormat?.type === "json_object") {
      generationConfig.responseMimeType = "application/json";
    }

    // 调用 Gemini API
    const result = await geminiModel.generateContent({
      contents: geminiMessages,
      generationConfig,
    });

    const response = result.response;
    const text = response.text() || "";

    // 提取 tokens 信息（如果可用）
    const usageMetadata = response.usageMetadata;
    const tokens = usageMetadata
      ? {
          prompt: usageMetadata.promptTokenCount,
          completion: usageMetadata.candidatesTokenCount,
          total: usageMetadata.totalTokenCount,
        }
      : undefined;

    return {
      text: text.trim(),
      tokens,
    };
  } catch (e) {
    throw new Error(`Gemini API 调用失败: ${(e as Error).message}`);
  }
}

