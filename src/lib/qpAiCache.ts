/**
 * Question-Processor AI 结果内存缓存模块（共享版本）
 * 供 Next.js 批量处理工具使用，与 question-processor 保持一致的缓存逻辑
 * 指令版本：0003
 */

export interface AiCacheKeyInput {
  scene: string;
  provider: string;
  model: string;
  // 建议使用题目文本的 hash，而不是整段文本
  questionText: string;
}

export interface AiCacheEntry<T = any> {
  value: T;
  createdAt: number;
  ttlMs: number;
}

const cache = new Map<string, AiCacheEntry>();

/**
 * 构建缓存 key
 * 使用简单 hash 避免 key 太长
 */
function buildKey(input: AiCacheKeyInput): string {
  // 可以简单做个 hash，避免 key 太长
  const base = `${input.scene}::${input.provider}::${input.model}::${input.questionText}`;
  // 简单 hash（不追求密码学安全）
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    hash = (hash * 31 + base.charCodeAt(i)) | 0;
  }
  return `${input.scene}::${input.provider}::${input.model}::${hash}`;
}

/**
 * 从缓存获取值
 * @param keyInput 缓存 key 输入
 * @param now 当前时间戳（用于测试，默认 Date.now()）
 * @returns 缓存的值，如果不存在或已过期则返回 null
 */
export function getAiCache<T = any>(
  keyInput: AiCacheKeyInput,
  now = Date.now(),
): T | null {
  const key = buildKey(keyInput);
  const entry = cache.get(key);
  if (!entry) return null;
  if (now - entry.createdAt > entry.ttlMs) {
    cache.delete(key);
    return null;
  }
  return entry.value as T;
}

/**
 * 设置缓存值
 * @param keyInput 缓存 key 输入
 * @param value 要缓存的值
 * @param ttlMs TTL（毫秒）
 * @param now 当前时间戳（用于测试，默认 Date.now()）
 */
export function setAiCache<T = any>(
  keyInput: AiCacheKeyInput,
  value: T,
  ttlMs: number,
  now = Date.now(),
): void {
  const key = buildKey(keyInput);
  cache.set(key, {
    value,
    createdAt: now,
    ttlMs,
  });
}

/**
 * 清理所有缓存
 * 可选：提供一个清理函数，在入口命令中周期性调用（非必须）
 */
export function clearAiCache(): void {
  cache.clear();
}

/**
 * 获取缓存统计信息（用于调试）
 */
export function getAiCacheStats(): { size: number; keys: string[] } {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
  };
}

