/**
 * 轻量缓存层（内存 LRU + 过期）
 * - 仅依赖原生 Map，不引入外部库，成本最低
 * - 接口：cacheGet / cacheSet
 * - 可 later 扩展为 Redis（保持函数签名不变）
 */

type CacheValue = {
  v: unknown; // 原始值
  exp: number; // 过期时间戳（ms）
};

/** 最大缓存条目数（LRU 剔除阈值） */
const MAX_ENTRIES = Number(process.env.AI_CACHE_MAX_ENTRIES || 1000);

/**
 * 基于 Map 的 LRU 实现：
 * - get 时：将 key 重新 set 到 Map 末尾，表示最近使用
 * - set 时：若超过 MAX_ENTRIES，剔除首个条目（最久未使用）
 */
class MemoryLRU {
  private store = new Map<string, CacheValue>();

  get<T = unknown>(key: string): T | null {
    const now = Date.now();
    const hit = this.store.get(key);
    if (!hit) return null;

    // 过期判断
    if (hit.exp > 0 && now > hit.exp) {
      this.store.delete(key);
      return null;
    }

    // LRU：移动到末尾
    this.store.delete(key);
    this.store.set(key, hit);

    return hit.v as T;
  }

  set(key: string, value: unknown, ttlSec?: number): void {
    // LRU：存在则先删除，后插入到末尾
    if (this.store.has(key)) this.store.delete(key);

    const exp =
      typeof ttlSec === "number" && ttlSec > 0
        ? Date.now() + ttlSec * 1000
        : 0;

    this.store.set(key, { v: value, exp });

    // 超限剔除最旧
    if (this.store.size > MAX_ENTRIES) {
      const oldestKey = this.store.keys().next().value as string | undefined;
      if (oldestKey) this.store.delete(oldestKey);
    }
  }

  del(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

// 单例内存缓存
const mem = new MemoryLRU();

/**
 * 读取缓存
 * @param key 缓存 key（建议使用明确前缀，如 ask:xxx）
 * @returns 命中则返回值，否则 null
 */
export async function cacheGet<T = unknown>(key: string): Promise<T | null> {
  try {
    return mem.get<T>(key);
  } catch {
    return null;
  }
}

/**
 * 写入缓存
 * @param key 缓存 key
 * @param value 任意可序列化对象（内部原样保存）
 * @param ttlSec 过期秒数（默认 3600 = 1h）
 */
export async function cacheSet(
  key: string,
  value: unknown,
  ttlSec = 3600
): Promise<void> {
  try {
    mem.set(key, value, ttlSec);
  } catch {
    // 静默失败，避免影响主流程
  }
}

/** 可选导出：清理与删除（供任务/测试使用） */
export async function cacheDel(key: string): Promise<void> {
  try {
    mem.del(key);
  } catch {
    // ignore
  }
}

export async function cacheClear(): Promise<void> {
  try {
    mem.clear();
  } catch {
    // ignore
  }
}
