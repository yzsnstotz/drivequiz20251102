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

type ConfigCache = {
  model?: string;
  cacheTtl?: number;
  aiProvider?: string;
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
      aiProvider: dbConfig.aiProvider,
      lastUpdated: now,
    };
    return dbConfig.model;
  }

  // 如果数据库读取失败，使用环境变量
  const envModel = process.env.AI_MODEL || "gpt-4o-mini";
  
  // 更新缓存（使用环境变量）
  configCache = {
    model: envModel,
    lastUpdated: now,
  };

  return envModel;
}

/**
 * 获取当前配置的 AI 提供商
 * 优先从数据库读取，如果失败则使用环境变量判断
 */
export async function getAiProviderFromConfig(): Promise<"openai" | "openrouter" | null> {
  // 检查缓存是否有效
  const now = Date.now();
  if (configCache && now - configCache.lastUpdated < CONFIG_CACHE_TTL) {
    if (configCache.aiProvider) {
      // 数据库配置：online = OpenAI, openrouter = OpenRouter
      if (configCache.aiProvider === "online") {
        return "openai";
      } else if (configCache.aiProvider === "openrouter" || configCache.aiProvider === "openrouter-direct") {
        return "openrouter";
      }
    }
  }

  // 从数据库读取配置
  const dbConfig = await fetchConfigFromDb();
  if (dbConfig?.aiProvider) {
    // 更新缓存
    if (!configCache) {
      configCache = { lastUpdated: now };
    }
    configCache.aiProvider = dbConfig.aiProvider;
    configCache.lastUpdated = now;
    
    // 数据库配置：online = OpenAI, openrouter = OpenRouter
    if (dbConfig.aiProvider === "online") {
      return "openai";
    } else if (dbConfig.aiProvider === "openrouter" || dbConfig.aiProvider === "openrouter-direct") {
      return "openrouter";
    }
  }

  // 如果数据库读取失败，使用环境变量判断
  const baseUrl = process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1";
  if (baseUrl.includes("openrouter.ai")) {
    return "openrouter";
  }
  
  return "openai"; // 默认使用 OpenAI
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
      model: configCache?.model || dbConfig.model || process.env.AI_MODEL || "gpt-4o-mini",
      cacheTtl: dbConfig.cacheTtl,
      lastUpdated: now,
    };
    return dbConfig.cacheTtl;
  }

  // 如果数据库读取失败，使用环境变量或默认值
  const envCacheTtl = Number(process.env.AI_CACHE_TTL_SECONDS || 86400);
  
  // 更新缓存
  configCache = {
    model: configCache?.model || process.env.AI_MODEL || "gpt-4o-mini",
    cacheTtl: envCacheTtl,
    lastUpdated: now,
  };

  return envCacheTtl;
}

/**
 * 清除配置缓存（强制下次重新读取）
 */
export function clearConfigCache(): void {
  configCache = null;
}

