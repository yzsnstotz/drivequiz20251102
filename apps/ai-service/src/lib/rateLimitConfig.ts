// apps/ai-service/src/lib/rateLimitConfig.ts
/**
 * Provider 频率限制配置读取
 * 
 * 功能：
 *  - 从 Supabase 数据库读取频率限制配置
 *  - 支持缓存配置以提高性能（30秒刷新）
 *  - 配置 key 格式：rate_limit_{provider}_max 和 rate_limit_{provider}_time_window
 * 
 * 依赖环境变量：
 *  - SUPABASE_URL
 *  - SUPABASE_SERVICE_KEY
 */

export type RateLimitConfig = {
  max: number;
  timeWindow: number; // 秒
};

// 配置缓存（30秒过期）
const CONFIG_CACHE_TTL = 30000; // 30 秒

type RateLimitConfigCache = Map<string, { config: RateLimitConfig; lastUpdated: number }>;

const configCache: RateLimitConfigCache = new Map();

/**
 * 获取 Provider 的默认频率限制配置
 */
function getDefaultRateLimitConfig(provider: string): RateLimitConfig {
  // local 使用更高的限制（120/分钟）
  if (provider === "local") {
    return {
      max: 120,
      timeWindow: 60,
    };
  }
  // 其他 Provider 使用默认限制（60/分钟）
  return {
    max: 60,
    timeWindow: 60,
  };
}

/**
 * 从 Supabase 数据库读取频率限制配置
 */
async function fetchRateLimitConfigFromDb(provider: string): Promise<RateLimitConfig | null> {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return null;
  }

  try {
    const maxKey = `rate_limit_${provider}_max`;
    const timeWindowKey = `rate_limit_${provider}_time_window`;

    // 使用 Supabase REST API 读取配置
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/ai_config?key=in.(${maxKey},${timeWindowKey})&select=key,value`,
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
    const configMap: Record<string, string> = {};

    for (const row of rows) {
      configMap[row.key] = row.value;
    }

    const max = configMap[maxKey] ? Number(configMap[maxKey]) : null;
    const timeWindow = configMap[timeWindowKey] ? Number(configMap[timeWindowKey]) : null;

    // 如果两个配置都存在，返回配置
    if (max !== null && timeWindow !== null && max > 0 && timeWindow > 0) {
      return {
        max,
        timeWindow,
      };
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * 获取指定 Provider 的频率限制配置
 * 优先从数据库读取，如果不存在则使用默认值
 */
export async function getRateLimitConfig(provider: string): Promise<RateLimitConfig> {
  // 规范化 provider 名称
  const normalizedProvider = provider.toLowerCase().trim();

  // 检查缓存
  const now = Date.now();
  const cached = configCache.get(normalizedProvider);
  if (cached && now - cached.lastUpdated < CONFIG_CACHE_TTL) {
    return cached.config;
  }

  // 从数据库读取配置
  const dbConfig = await fetchRateLimitConfigFromDb(normalizedProvider);
  
  let config: RateLimitConfig;
  if (dbConfig) {
    config = dbConfig;
  } else {
    // 使用默认配置
    config = getDefaultRateLimitConfig(normalizedProvider);
  }

  // 更新缓存
  configCache.set(normalizedProvider, {
    config,
    lastUpdated: now,
  });

  return config;
}

/**
 * 清除配置缓存（强制下次重新读取）
 */
export function clearRateLimitConfigCache(): void {
  configCache.clear();
}

/**
 * 清除指定 Provider 的配置缓存
 */
export function clearRateLimitConfigCacheForProvider(provider: string): void {
  const normalizedProvider = provider.toLowerCase().trim();
  configCache.delete(normalizedProvider);
}

