// src/app/api/admin/ai/models/route.ts
/* 功能：获取 AI 模型列表（按 provider 分类） */
import { NextRequest } from "next/server";
import { success, badRequest } from "@/app/api/_lib/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ModelInfo = {
  id: string;
  name: string;
  description?: string;
};

/**
 * GET /api/admin/ai/models?provider=gemini
 * 获取指定 provider 的可用模型列表
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const provider = searchParams.get("provider");

    if (!provider) {
      return badRequest("provider parameter is required");
    }

    let models: ModelInfo[] = [];

    // 根据 provider 返回对应的模型列表
    if (provider === "gemini" || provider === "gemini_direct") {
      // 与 apps/ai-service/src/lib/geminiClient.ts 中的 getGeminiModels 保持一致
      models = [
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
    } else if (provider === "openai" || provider === "openai_direct") {
      models = [
        {
          id: "gpt-4o-mini",
          name: "GPT-4o Mini",
          description: "快速且经济的模型，适合大多数任务",
        },
        {
          id: "gpt-4o",
          name: "GPT-4o",
          description: "最新的 GPT-4 优化版本",
        },
        {
          id: "gpt-4-turbo",
          name: "GPT-4 Turbo",
          description: "高性能模型，适合复杂任务",
        },
        {
          id: "gpt-3.5-turbo",
          name: "GPT-3.5 Turbo",
          description: "快速且经济的模型",
        },
      ];
    } else if (provider === "openrouter" || provider === "openrouter_direct") {
      models = [
        {
          id: "openai/gpt-4o-mini",
          name: "OpenAI GPT-4o Mini",
          description: "快速且经济的模型",
        },
        {
          id: "openai/gpt-4o",
          name: "OpenAI GPT-4o",
          description: "最新的 GPT-4 优化版本",
        },
        {
          id: "openai/gpt-4-turbo",
          name: "OpenAI GPT-4 Turbo",
          description: "高性能模型",
        },
        {
          id: "openai/gpt-3.5-turbo",
          name: "OpenAI GPT-3.5 Turbo",
          description: "快速且经济的模型",
        },
        {
          id: "anthropic/claude-3.5-sonnet",
          name: "Anthropic Claude 3.5 Sonnet",
          description: "强大的推理模型",
        },
        {
          id: "anthropic/claude-3-opus",
          name: "Anthropic Claude 3 Opus",
          description: "最强大的 Claude 模型",
        },
        {
          id: "anthropic/claude-3-haiku",
          name: "Anthropic Claude 3 Haiku",
          description: "快速且经济的 Claude 模型",
        },
        {
          id: "google/gemini-pro",
          name: "Google Gemini Pro",
          description: "Google 的 Gemini Pro 模型",
        },
        {
          id: "google/gemini-pro-1.5",
          name: "Google Gemini Pro 1.5",
          description: "Google 的 Gemini Pro 1.5 模型",
        },
        {
          id: "meta-llama/llama-3.1-70b-instruct",
          name: "Meta Llama 3.1 70B",
          description: "Meta 的大型语言模型",
        },
        {
          id: "meta-llama/llama-3.1-8b-instruct",
          name: "Meta Llama 3.1 8B",
          description: "Meta 的小型语言模型",
        },
        {
          id: "mistralai/mistral-7b-instruct",
          name: "Mistral 7B Instruct",
          description: "Mistral 的指令调优模型",
        },
        {
          id: "mistralai/mixtral-8x7b-instruct",
          name: "Mistral Mixtral 8x7B",
          description: "Mistral 的混合专家模型",
        },
        {
          id: "qwen/qwen-2.5-7b-instruct",
          name: "Qwen 2.5 7B Instruct",
          description: "Qwen 的指令调优模型",
        },
        {
          id: "qwen/qwen-2.5-72b-instruct",
          name: "Qwen 2.5 72B Instruct",
          description: "Qwen 的大型指令调优模型",
        },
      ];
    } else if (provider === "local" || provider === "ollama") {
      models = [
        {
          id: "llama3.2:3b",
          name: "Llama 3.2 3B",
          description: "轻量级本地模型",
        },
        {
          id: "llama3.2:1b",
          name: "Llama 3.2 1B",
          description: "超轻量级本地模型",
        },
        {
          id: "llama3.1:8b",
          name: "Llama 3.1 8B",
          description: "中等规模本地模型",
        },
        {
          id: "llama3.1:70b",
          name: "Llama 3.1 70B",
          description: "大型本地模型",
        },
        {
          id: "mistral:7b",
          name: "Mistral 7B",
          description: "Mistral 本地模型",
        },
        {
          id: "qwen2.5:7b",
          name: "Qwen 2.5 7B",
          description: "Qwen 本地模型",
        },
      ];
    } else {
      return badRequest(`Unsupported provider: ${provider}`);
    }

    return success(models);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unexpected server error.";
    return badRequest(msg);
  }
}



