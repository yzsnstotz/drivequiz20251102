// apps/ai-service/src/lib/configLoader.ts
/**
 * ZALEM · AI-Service
 * Config Loader Utility
 *
 * 功能：
 *  - 从 Supabase 数据库读取 ai_config 配置
 *  - 支持缓存配置以提高性能
 *  - 配置更新时自动刷新缓存
 *
 * 依赖环境变量：
 *  - SUPABASE_URL
 *  - SUPABASE_SERVICE_KEY
 */

// Logger import removed for performance

// 配置缓存（5分钟过期）
const CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5分钟

type NormalizedProvider = "openai" | "openrouter" | "gemini" | "local" | "openrouter_direct";

type ConfigCache = {
  model?: string;
  cacheTtl?: number;
  aiProvider?: NormalizedProvider;
  lastUpdated: number;
};

let configCache: ConfigCache | null = null;

/**
 * 从 Supabase 数据库读取 ai_config 配置
 */
async function fetchConfigFromDb(): Promise<{ model?: string; cacheTtl?: number; aiProvider?: string } | null> {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return null;
  }

  try {
    // 使用 Supabase REST API 读取配置（包括 aiProvider）
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/ai_config?key=in.(model,cacheTtl,aiProvider)&select=key,value`,
      {
        method: "GET",
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
      },
    );

    if (!res.ok) {
      return null;
    }

    const rows = (await res.json()) as Array<{ key: string; value: string }>;
    const config: { model?: string; cacheTtl?: number; aiProvider?: string } = {};

    for (const row of rows) {
      if (row.key === "model") {
        config.model = row.value;
      } else if (row.key === "cacheTtl") {
        config.cacheTtl = Number(row.value) || undefined;
      } else if (row.key === "aiProvider") {
        config.aiProvider = row.value;
      }
    }

    return config;
  } catch (error) {
    return null;
  }
}

/**
 * 获取当前配置的模型名称
 * 优先从数据库读取，如果失败则使用环境变量
 */
export async function getModelFromConfig(): Promise<string> {
  // 检查缓存是否有效
  const now = Date.now();
  if (configCache && now - configCache.lastUpdated < CONFIG_CACHE_TTL) {
    if (configCache.model) {
      return configCache.model;
    }
  }

  // 从数据库读取配置
  const dbConfig = await fetchConfigFromDb();
  if (dbConfig?.model) {
    // 更新缓存
    configCache = {
      model: dbConfig.model,
      cacheTtl: dbConfig.cacheTtl,
      aiProvider: normalizeProvider(dbConfig.aiProvider),
      lastUpdated: now,
    };
    return dbConfig.model;
  }

  const envModel = process.env.AI_MODEL?.trim();
  if (!envModel) {
    throw new Error("AI model is not configured. Please set ai_config.model or AI_MODEL environment variable.");
  }

  configCache = {
    model: envModel,
    lastUpdated: now,
  };

  return envModel;
}

/**
 * 获取当前配置的 AI 提供商
 * 优先从数据库读取，如果失败则抛出错误
 */
export async function getAiProviderFromConfig(): Promise<"openai" | "openrouter" | "gemini"> {
  // 检查缓存是否有效
  const now = Date.now();
  if (configCache && now - configCache.lastUpdated < CONFIG_CACHE_TTL) {
    if (configCache.aiProvider && isRemoteProvider(configCache.aiProvider)) {
      return mapRemoteProvider(configCache.aiProvider);
    }
    if (configCache.aiProvider === "gemini") {
      return "gemini";
    }
  }

  // 从数据库读取配置
  const dbConfig = await fetchConfigFromDb();
  if (dbConfig?.aiProvider) {
    // 更新缓存
    if (!configCache) {
      configCache = { lastUpdated: now };
    }
    const normalized = normalizeProvider(dbConfig.aiProvider);
    configCache.aiProvider = normalized;
    configCache.lastUpdated = now;

    if (normalized && isRemoteProvider(normalized)) {
      return mapRemoteProvider(normalized);
    }

    if (normalized === "gemini") {
      return "gemini";
    }

    if (normalized === "local") {
      throw new Error("AI provider is set to 'local', remote AI service should not be accessed.");
    }
    throw new Error(`Unsupported aiProvider value: ${dbConfig.aiProvider}`);
  }

  throw new Error("AI provider is not configured. Please set ai_config.aiProvider to 'openai', 'openrouter', or 'gemini'.");
}

/**
 * 获取缓存 TTL 配置
 */
export async function getCacheTtlFromConfig(): Promise<number> {
  // 检查缓存是否有效
  const now = Date.now();
  if (configCache && now - configCache.lastUpdated < CONFIG_CACHE_TTL) {
    if (configCache.cacheTtl !== undefined) {
      return configCache.cacheTtl;
    }
  }

  // 从数据库读取配置
  const dbConfig = await fetchConfigFromDb();
  if (dbConfig?.cacheTtl !== undefined) {
    // 更新缓存
    configCache = {
      model: configCache?.model || dbConfig.model || undefined,
      cacheTtl: dbConfig.cacheTtl,
      lastUpdated: now,
    };
    return dbConfig.cacheTtl;
  }

  const envTtlRaw = process.env.AI_CACHE_TTL_MS?.trim();
  if (envTtlRaw) {
    const envTtl = Number(envTtlRaw);
    if (Number.isFinite(envTtl) && envTtl > 0) {
      configCache = {
        model: configCache?.model,
        cacheTtl: envTtl,
        lastUpdated: now,
      };
      return envTtl;
    }
    throw new Error("AI_CACHE_TTL_MS must be a positive number when provided.");
  }

  throw new Error("Cache TTL is not configured. Please set ai_config.cacheTtl or AI_CACHE_TTL_MS.");
}

/**
 * 清除配置缓存（强制下次重新读取）
 */
export function clearConfigCache(): void {
  configCache = null;
}

function normalizeProvider(value: string | undefined): NormalizedProvider | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  switch (normalized) {
    case "openai":
      return "openai";
    case "openrouter":
      return "openrouter";
    case "gemini":
      return "gemini";
    case "local":
      return "local";
    case "openrouter-direct":
    case "openrouter_direct":
      return "openrouter_direct";
    default:
      return undefined;
  }
}

function isRemoteProvider(provider: NormalizedProvider): provider is "openai" | "openrouter" | "openrouter_direct" {
  return provider !== "local" && provider !== "gemini";
}

function mapRemoteProvider(provider: "openai" | "openrouter" | "openrouter_direct"): "openai" | "openrouter" {
  if (provider === "openai") {
    return "openai";
  }
  return "openrouter";
}

