// src/app/api/admin/ai/models/route.ts
/**
 * 获取 AI Provider 可用模型列表
 * 支持从 Provider API 动态获取或返回缓存的模型列表
 */
import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { success, badRequest, internalError } from "@/app/api/_lib/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/admin/ai/models
 * 获取指定 Provider 的可用模型列表
 * Query: ?provider=openai|openrouter|gemini|gemini_direct
 */
export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    const provider = req.nextUrl.searchParams.get("provider");

    if (!provider) {
      return badRequest("provider parameter is required");
    }

    // 验证 provider 值
    const validProviders = [
      "openai",
      "openai_direct",
      "openrouter",
      "openrouter_direct",
      "gemini",
      "gemini_direct",
    ];

    if (!validProviders.includes(provider)) {
      return badRequest(
        `provider must be one of: ${validProviders.join(", ")}`
      );
    }

    let models: Array<{ id: string; name: string; description?: string }> = [];

    // 根据 provider 获取模型列表
    if (provider === "gemini" || provider === "gemini_direct") {
      // Gemini 模型列表
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
        // 旧模型（向后兼容）
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
      // OpenAI 模型列表
      models = [
        {
          id: "gpt-4o-mini",
          name: "GPT-4o Mini",
          description: "快速且经济的模型（推荐）",
        },
        {
          id: "gpt-4o",
          name: "GPT-4o",
          description: "最强大的 GPT-4 模型",
        },
        {
          id: "gpt-4-turbo",
          name: "GPT-4 Turbo",
          description: "GPT-4 Turbo 模型",
        },
        {
          id: "gpt-3.5-turbo",
          name: "GPT-3.5 Turbo",
          description: "快速且经济的 GPT-3.5 模型",
        },
      ];
    } else if (provider === "openrouter" || provider === "openrouter_direct") {
      // OpenRouter 模型列表（支持多种提供商）
      models = [
        // OpenAI
        {
          id: "openai/gpt-4o-mini",
          name: "OpenAI GPT-4o Mini",
          description: "快速且经济的模型",
        },
        {
          id: "openai/gpt-4o",
          name: "OpenAI GPT-4o",
          description: "最强大的 GPT-4 模型",
        },
        {
          id: "openai/gpt-4-turbo",
          name: "OpenAI GPT-4 Turbo",
          description: "GPT-4 Turbo 模型",
        },
        {
          id: "openai/gpt-3.5-turbo",
          name: "OpenAI GPT-3.5 Turbo",
          description: "快速且经济的 GPT-3.5 模型",
        },
        // Anthropic
        {
          id: "anthropic/claude-3.5-sonnet",
          name: "Anthropic Claude 3.5 Sonnet",
          description: "Claude 3.5 Sonnet 模型",
        },
        {
          id: "anthropic/claude-3-opus",
          name: "Anthropic Claude 3 Opus",
          description: "Claude 3 Opus 模型",
        },
        {
          id: "anthropic/claude-3-haiku",
          name: "Anthropic Claude 3 Haiku",
          description: "Claude 3 Haiku 模型",
        },
        // Google
        {
          id: "google/gemini-pro",
          name: "Google Gemini Pro",
          description: "Gemini Pro 模型",
        },
        {
          id: "google/gemini-pro-1.5",
          name: "Google Gemini Pro 1.5",
          description: "Gemini Pro 1.5 模型",
        },
        // Meta
        {
          id: "meta-llama/llama-3.1-70b-instruct",
          name: "Meta Llama 3.1 70B",
          description: "Llama 3.1 70B 模型",
        },
        {
          id: "meta-llama/llama-3.1-8b-instruct",
          name: "Meta Llama 3.1 8B",
          description: "Llama 3.1 8B 模型",
        },
        // Mistral
        {
          id: "mistralai/mistral-7b-instruct",
          name: "Mistral 7B Instruct",
          description: "Mistral 7B 模型",
        },
        {
          id: "mistralai/mixtral-8x7b-instruct",
          name: "Mistral Mixtral 8x7B",
          description: "Mistral Mixtral 8x7B 模型",
        },
        // Qwen
        {
          id: "qwen/qwen-2.5-7b-instruct",
          name: "Qwen 2.5 7B Instruct",
          description: "Qwen 2.5 7B 模型",
        },
        {
          id: "qwen/qwen-2.5-72b-instruct",
          name: "Qwen 2.5 72B Instruct",
          description: "Qwen 2.5 72B 模型",
        },
      ];
    }

    return success({
      provider,
      models,
      count: models.length,
    });
  } catch (err) {
    console.error("[GET /api/admin/ai/models] Error:", err);
    const msg = err instanceof Error ? err.message : "Unexpected server error.";
    return internalError(msg);
  }
});

