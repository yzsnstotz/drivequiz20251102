"use client";

/**
 * 前端 AI Provider 配置客户端
 * 从配置中心获取当前使用的 provider
 * 指令版本：0002
 */

import type { AiProviderKey } from "./aiEndpoint";
import { mapDbProviderToClientProvider } from "./aiProviderMapping";

export type { AiProviderKey };

export interface AiProviderConfig {
  provider: AiProviderKey;
  model?: string;
}

/**
 * 从配置中心获取当前使用的 AI Provider
 * 前台用户端使用公开接口 /api/ai/config（不需要管理员认证）
 * 后台管理端可以使用 /api/admin/ai/config（需要管理员认证）
 * @returns 当前配置的 provider 和 model
 */
export async function getCurrentAiProvider(): Promise<AiProviderConfig> {
  try {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    
    // 前台用户端使用公开接口（不需要管理员认证）
    const res = await fetch(`${base}/api/ai/config`, {
      cache: "no-store",
    });

    if (!res.ok) {
      console.warn("[getCurrentAiProvider] 配置读取失败，使用默认值");
      return { provider: "render", model: "gpt-4o-mini" };
    }

    const data = await res.json();
    if (data.ok && data.data) {
      // 公开接口已经返回映射后的 provider
      return {
        provider: data.data.provider || "render",
        model: data.data.model || undefined,
      };
    }

    return { provider: "render", model: "gpt-4o-mini" };
  } catch (error) {
    console.warn("[getCurrentAiProvider] 获取配置失败，使用默认值:", error);
    return { provider: "render", model: "gpt-4o-mini" };
  }
}

