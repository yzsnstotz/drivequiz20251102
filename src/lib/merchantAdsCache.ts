// ============================================================
// 文件路径: src/lib/merchantAdsCache.ts
// 功能: 商家广告请求缓存和去重
// 更新日期: 2025-11-29
// ============================================================

interface MerchantAd {
  id: number;
  name: any;
  description: any;
  address: any;
  phone: string | null;
  email: string | null;
  imageUrl: string | null;
  category: string | null;
  adSlot: string | null;
  adStartDate: string | null;
  adEndDate: string | null;
}

interface CacheEntry {
  data: MerchantAd[];
  timestamp: number;
}

// 缓存配置
const CACHE_TTL = 2 * 60 * 1000; // 2 分钟
const cache = new Map<string, CacheEntry>();

// 请求去重：正在进行的请求
const pendingRequests = new Map<string, Promise<MerchantAd[]>>();

/**
 * 生成缓存键
 */
function getCacheKey(adSlot?: string, category?: string): string {
  if (adSlot) {
    return `adSlot:${adSlot}`;
  }
  if (category) {
    return `category:${category}`;
  }
  return 'all';
}

/**
 * 获取缓存的广告数据
 */
function getCachedData(key: string): MerchantAd[] | null {
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }

  const now = Date.now();
  if (now - entry.timestamp > CACHE_TTL) {
    // 缓存过期，删除
    cache.delete(key);
    return null;
  }

  return entry.data;
}

/**
 * 设置缓存数据
 */
function setCachedData(key: string, data: MerchantAd[]): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

/**
 * 获取商家广告（带缓存和去重）
 */
export async function fetchMerchantAds(
  adSlot?: string,
  category?: string
): Promise<MerchantAd[]> {
  const cacheKey = getCacheKey(adSlot, category);

  // 检查缓存
  const cached = getCachedData(cacheKey);
  if (cached !== null) {
    return cached;
  }

  // 检查是否有正在进行的请求
  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey)!;
  }

  // 创建新请求
  const params = adSlot
    ? `adSlot=${encodeURIComponent(adSlot)}`
    : category
    ? `category=${encodeURIComponent(category)}`
    : '';

  const promise = fetch(`/api/merchant-ads?${params}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  })
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.ok && data.data) {
        return data.data.items || [];
      }
      return [];
    })
    .then((items) => {
      // 缓存结果
      setCachedData(cacheKey, items);
      return items;
    })
    .catch((error) => {
      // 请求失败，返回空数组
      if (process.env.NODE_ENV === "development") {
        console.error("[MerchantAdsCache] Fetch failed:", error);
      }
      return [];
    })
    .finally(() => {
      // 清除正在进行的请求
      pendingRequests.delete(cacheKey);
    });

  // 保存正在进行的请求
  pendingRequests.set(cacheKey, promise);

  return promise;
}

/**
 * 清除缓存
 */
export function clearCache(): void {
  cache.clear();
  pendingRequests.clear();
}

/**
 * 清除特定广告位的缓存
 */
export function clearCacheForSlot(adSlot?: string, category?: string): void {
  const key = getCacheKey(adSlot, category);
  cache.delete(key);
}

