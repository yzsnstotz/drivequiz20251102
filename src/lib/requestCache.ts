/**
 * 通用请求去重 + 结果缓存工具
 * 
 * 功能：
 * 1. 多个组件在同一时间段请求同一个 API 时，只发一次 HTTP 请求，其他调用复用同一 Promise
 * 2. 使用 TTL 短缓存结果，在 TTL 内相同 key 也不再访问服务器
 * 
 * 内存管理：
 * - 每5分钟自动清理过期缓存（TTL清理策略）
 * - 清理时只删除已过期且无pending请求的缓存项
 * - 建议缓存key包含用户标识，避免跨用户泄漏敏感信息
 * 
 * 安全约定：
 * - 缓存key必须包含用户标识（如 userId），格式：`api_name:user_id`
 * - 避免在缓存中存储敏感信息（如密码、token等）
 * - 缓存仅在客户端（浏览器）环境生效
 */

type CacheEntry<T> = {
  promise: Promise<T> | null;
  data: T | null;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry<any>>();

/**
 * 带缓存的请求函数
 * @param key 缓存键（建议格式：`api_name:user_id` 或 `api_name:param1:param2`）
 * @param ttlMs 缓存有效期（毫秒）
 * @param fetcher 实际执行请求的函数
 * @returns Promise<T>
 */
export function fetchWithCache<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const isDev = process.env.NODE_ENV !== "production";
  let entry = cache.get(key) as CacheEntry<T> | undefined;

  if (entry) {
    // 1) 有在飞的 promise，直接返回（请求去重）
    if (entry.promise) {
      if (isDev) console.log("[requestCache] reuse pending promise for key:", key);
      return entry.promise;
    }
    // 2) 有未过期数据，直接返回（结果缓存）
    if (entry.data && entry.expiresAt > now) {
      if (isDev) console.log("[requestCache] hit cache for key:", key);
      return Promise.resolve(entry.data);
    }
  }

  // 3) 需要发新请求
  if (isDev) console.log("[requestCache] miss, fetching key:", key);
  const newEntry: CacheEntry<T> = {
    promise: null,
    data: entry?.data ?? null, // 保留旧数据作为 fallback
    expiresAt: now + ttlMs,
  };
  cache.set(key, newEntry);

  const p = fetcher()
    .then((res) => {
      newEntry.data = res;
      newEntry.expiresAt = Date.now() + ttlMs;
      newEntry.promise = null;
      return res;
    })
    .catch((err) => {
      // 请求失败：保留旧数据（如果有），立即允许下一次重试
      newEntry.promise = null;
      throw err;
    });

  newEntry.promise = p;
  return p;
}

/**
 * 清除指定 key 的缓存
 * @param key 缓存键
 */
export function clearCache(key: string): void {
  cache.delete(key);
}

/**
 * 清除所有缓存
 */
export function clearAllCache(): void {
  cache.clear();
}

/**
 * TTL清理策略：定期清理过期缓存
 * 
 * 清理规则：
 * - 每5分钟执行一次清理
 * - 只删除已过期（expiresAt < now）且无pending请求（!entry.promise）的缓存项
 * - 保留pending请求的缓存项，避免清理正在进行的请求
 * 
 * 内存安全：
 * - 防止长时间运行导致的内存泄漏
 * - 自动清理过期数据，无需手动管理
 */
if (typeof window !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of cache.entries()) {
      // 只清理已过期且无pending请求的缓存项
      if (entry.expiresAt < now && !entry.promise) {
        cache.delete(key);
      }
    }
  }, 5 * 60 * 1000); // 5分钟
}

