/**
 * 图片缓存工具
 * 使用 Cache API 存储已加载的广告图片，避免重复加载
 */

const CACHE_NAME = "ad-images-cache-v1";
const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB 最大缓存大小
const MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000; // 7天缓存有效期

interface CacheEntry {
  url: string;
  blob: Blob;
  timestamp: number;
  size: number;
}

/**
 * 获取缓存对象
 */
async function getCache(): Promise<Cache | null> {
  if (typeof window === "undefined" || !("caches" in window)) {
    return null;
  }

  try {
    return await caches.open(CACHE_NAME);
  } catch (error) {
    console.warn("[ImageCache] Failed to open cache:", error);
    return null;
  }
}

/**
 * 从缓存中获取图片
 */
export async function getCachedImage(url: string): Promise<string | null> {
  const cache = await getCache();
  if (!cache) {
    return null;
  }

  try {
    const response = await cache.match(url);
    if (!response) {
      return null;
    }

    // 检查缓存是否过期
    const cachedDate = response.headers.get("date");
    if (cachedDate) {
      const cacheTime = new Date(cachedDate).getTime();
      const now = Date.now();
      if (now - cacheTime > MAX_CACHE_AGE) {
        // 缓存已过期，删除
        await cache.delete(url);
        return null;
      }
    }

    // 创建 Blob URL
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    console.warn("[ImageCache] Failed to get cached image:", error);
    return null;
  }
}

/**
 * 将图片存储到缓存
 */
export async function cacheImage(url: string): Promise<void> {
  const cache = await getCache();
  if (!cache) {
    return;
  }

  try {
    // 检查是否已经缓存
    const existing = await cache.match(url);
    if (existing) {
      return; // 已经缓存，不需要重复存储
    }

    // 获取图片
    const response = await fetch(url, {
      mode: "cors",
      cache: "no-cache",
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    // 检查缓存大小
    const blob = await response.blob();
    const size = blob.size;

    // 如果图片太大，不缓存
    if (size > MAX_CACHE_SIZE) {
      console.warn("[ImageCache] Image too large to cache:", url, size);
      return;
    }

    // 存储到缓存
    await cache.put(url, response.clone());
  } catch (error) {
    console.warn("[ImageCache] Failed to cache image:", error);
    // 静默失败，不影响图片显示
  }
}

/**
 * 预加载图片并缓存
 */
export async function preloadAndCacheImage(url: string): Promise<string | null> {
  // 先检查缓存
  const cachedUrl = await getCachedImage(url);
  if (cachedUrl) {
    return cachedUrl;
  }

  // 如果缓存中没有，加载并缓存
  try {
    await cacheImage(url);
    // 重新获取缓存（刚刚存储的）
    return await getCachedImage(url);
  } catch (error) {
    console.warn("[ImageCache] Failed to preload image:", error);
    // 如果缓存失败，返回原始 URL
    return url;
  }
}

/**
 * 清理过期缓存
 */
export async function cleanExpiredCache(): Promise<void> {
  const cache = await getCache();
  if (!cache) {
    return;
  }

  try {
    const keys = await cache.keys();
    const now = Date.now();

    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const cachedDate = response.headers.get("date");
        if (cachedDate) {
          const cacheTime = new Date(cachedDate).getTime();
          if (now - cacheTime > MAX_CACHE_AGE) {
            await cache.delete(request);
          }
        }
      }
    }
  } catch (error) {
    console.warn("[ImageCache] Failed to clean expired cache:", error);
  }
}

/**
 * 清理所有缓存
 */
export async function clearCache(): Promise<void> {
  if (typeof window === "undefined" || !("caches" in window)) {
    return;
  }

  try {
    await caches.delete(CACHE_NAME);
  } catch (error) {
    console.warn("[ImageCache] Failed to clear cache:", error);
  }
}

