"use client";

/**
 * 前端 AI Provider 配置客户端
 * 从配置中心获取当前使用的 provider
 * 指令版本：0003 - 添加本地缓存机制
 */

import type { AiProviderKey } from "./aiEndpoint";
import { mapDbProviderToClientProvider } from "./aiProviderMapping";

export type { AiProviderKey };

export interface AiProviderConfig {
  provider: AiProviderKey;
  model?: string;
}

/**
 * 缓存的 Provider 配置结构
 */
interface CachedProviderConfig {
  provider: AiProviderKey;
  model?: string;
  timestamp: number;
}

/**
 * 缓存键
 */
const CACHE_KEY = "AI_PROVIDER_CONFIG_CACHE";
const LEGACY_PROVIDER_KEY = "ai_provider";
const LEGACY_MODEL_KEY = "ai_model";

/**
 * 缓存过期时间（毫秒）：5分钟
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * 从 localStorage 读取缓存的配置
 */
function getCachedConfig(): CachedProviderConfig | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) {
      return null;
    }

    const config: CachedProviderConfig = JSON.parse(cached);
    return config;
  } catch (error) {
    console.warn("[getCurrentAiProvider] 读取缓存失败:", error);
    return null;
  }
}

/**
 * 读取用户本地选择（兼容旧键和值结构）
 * - 优先读取 localStorage("ai_provider")；支持 string 或 JSON { provider, model }
 * - 兼容单独的 localStorage("ai_model")
 */
function readLegacySelection(): AiProviderConfig | null {
  if (typeof window === "undefined") return null;
  try {
    let provider: string | null = null;
    let model: string | undefined = undefined;

    const rawProvider = localStorage.getItem(LEGACY_PROVIDER_KEY);
    const rawModel = localStorage.getItem(LEGACY_MODEL_KEY);

    if (rawProvider) {
      // 兼容 JSON 结构 { provider, model }
      try {
        const parsed = JSON.parse(rawProvider);
        if (parsed && typeof parsed === "object") {
          provider = parsed.provider ?? null;
          model = parsed.model ?? rawModel ?? undefined;
        } else if (typeof parsed === "string") {
          provider = parsed;
          model = rawModel ?? undefined;
        }
      } catch {
        provider = rawProvider;
        model = rawModel ?? undefined;
      }
    }

    if (!provider) return null;

    const normalized = mapDbProviderToClientProvider(provider);
    if (normalized !== "local" && normalized !== "render") {
      console.warn("[getCurrentAiProvider] 本地 provider 非法，忽略:", provider);
      return null;
    }

    const config: AiProviderConfig = { provider: normalized, model };
    console.log("[getCurrentAiProvider] 使用本地存储的 provider", {
      provider: config.provider,
      model: config.model,
    });
    return config;
  } catch (error) {
    console.warn("[getCurrentAiProvider] 读取本地 provider 失败:", error);
    return null;
  }
}

/**
 * 检查缓存是否过期
 */
function isCacheExpired(cached: CachedProviderConfig): boolean {
  const now = Date.now();
  return now - cached.timestamp > CACHE_TTL_MS;
}

/**
 * 保存配置到 localStorage 缓存
 */
function saveToCache(config: AiProviderConfig): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const cached: CachedProviderConfig = {
      ...config,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
    console.log("[getCurrentAiProvider] 配置已缓存:", {
      provider: config.provider,
      model: config.model,
      timestamp: new Date(cached.timestamp).toISOString(),
    });
  } catch (error) {
    console.warn("[getCurrentAiProvider] 保存缓存失败:", error);
  }
}

/**
 * 从配置中心获取当前使用的 AI Provider
 * 前台用户端使用公开接口 /api/ai/config（不需要管理员认证）
 * 后台管理端可以使用 /api/admin/ai/config（需要管理员认证）
 * 
 * 实现缓存机制：
 * 1. 检查 localStorage 缓存
 * 2. 如果缓存未过期，直接返回
 * 3. 如果过期或不存在，请求 API 获取最新配置
 * 4. 将新配置保存到缓存
 * 5. 如果 API 请求失败，使用缓存的配置（即使过期）作为 fallback
 * 
 * @returns 当前配置的 provider 和 model
 */
export async function getCurrentAiProvider(): Promise<AiProviderConfig> {
  // 0. 用户本地选择优先（符合“用户选择优先，缺失才 fallback”）
  const localSelection = readLegacySelection();
  if (localSelection) {
    return localSelection;
  }

  // 1. 检查缓存
  const cached = getCachedConfig();
  if (cached && !isCacheExpired(cached)) {
    console.log("[getCurrentAiProvider] 使用缓存配置:", {
      provider: cached.provider,
      model: cached.model,
      age: Math.round((Date.now() - cached.timestamp) / 1000) + "秒",
    });
    return {
      provider: cached.provider,
      model: cached.model,
    };
  }

  // 2. 缓存过期或不存在，请求 API
  try {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    
    // 前台用户端使用公开接口（不需要管理员认证）
    const res = await fetch(`${base}/api/ai/config`, {
      cache: "no-store",
    });

    if (!res.ok) {
      console.warn("[getCurrentAiProvider] 配置读取失败，尝试使用缓存");
      // API 失败时，使用缓存作为 fallback（即使过期）
      if (cached) {
        console.log("[getCurrentAiProvider] 使用过期缓存作为 fallback:", {
          provider: cached.provider,
          model: cached.model,
        });
        return {
          provider: cached.provider,
          model: cached.model,
        };
      }
      // 没有缓存，使用默认值
      return { provider: "render", model: "gpt-4o-mini" };
    }

    const data = await res.json();
    if (data.ok && data.data) {
      // 公开接口已经返回映射后的 provider
      const config: AiProviderConfig = {
        provider: data.data.provider || "render",
        model: data.data.model || undefined,
      };
      
      // 3. 保存到缓存
      saveToCache(config);
      
      return config;
    }

    // API 返回格式错误，尝试使用缓存
    if (cached) {
      console.warn("[getCurrentAiProvider] API 返回格式错误，使用缓存:", {
        provider: cached.provider,
        model: cached.model,
      });
      return {
        provider: cached.provider,
        model: cached.model,
      };
    }

    // 只有完全没有数据时才兜底 render，避免覆盖用户选择
    console.warn("[getCurrentAiProvider] 无缓存且 API 失败，使用兜底 render");
    return { provider: "render", model: "gpt-4o-mini" };
  } catch (error) {
    console.warn("[getCurrentAiProvider] 获取配置失败，尝试使用缓存:", error);
    // 网络错误时，使用缓存作为 fallback（即使过期）
    if (cached) {
      console.log("[getCurrentAiProvider] 使用过期缓存作为 fallback:", {
        provider: cached.provider,
        model: cached.model,
      });
      return {
        provider: cached.provider,
        model: cached.model,
      };
    }
    // 没有缓存也没有用户选择，才兜底 render
    console.warn("[getCurrentAiProvider] 无缓存无用户选择，使用兜底 render");
    return { provider: "render", model: "gpt-4o-mini" };
  }
}

