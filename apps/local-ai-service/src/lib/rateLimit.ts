// apps/local-ai-service/src/lib/rateLimit.ts
/**
 * Provider 频率限制中间件
 * 
 * 功能：
 *  - 基于 Provider 的独立频率限制
 *  - 使用内存存储（适合单实例部署）
 *  - 基于客户端 IP 地址进行限制
 * 
 * 注意：与 ai-service 保持完全一致（A3 规范）
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { getRateLimitConfig } from "./rateLimitConfig.js";

type RateLimitStore = Map<string, { count: number; resetAt: number }>;

// 为每个 Provider 创建独立的存储
const stores = new Map<string, RateLimitStore>();

/**
 * 清理过期的记录（避免内存泄漏）
 */
function cleanupExpiredRecords(store: RateLimitStore): void {
  const now = Date.now();
  for (const [key, record] of store.entries()) {
    if (now >= record.resetAt) {
      store.delete(key);
    }
  }
}

/**
 * 获取或创建 Provider 的存储
 */
function getOrCreateStore(provider: string): RateLimitStore {
  if (!stores.has(provider)) {
    stores.set(provider, new Map());
  }
  return stores.get(provider)!;
}

/**
 * 获取当前请求使用的 Provider
 * 
 * 注意：local-ai-service 默认使用 "local" provider
 */
async function getCurrentProvider(request: FastifyRequest): Promise<string> {
  // 优先从请求头读取
  const headerProvider = (request.headers["x-ai-provider"] || request.headers["X-AI-Provider"]) as string | undefined;
  if (headerProvider) {
    return headerProvider.toLowerCase().trim();
  }

  // local-ai-service 默认使用 "local" provider
  return "local";
}

/**
 * Provider 频率限制中间件
 * 仅应用于 /v1/ask 路由
 */
export async function providerRateLimitMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // 仅对 /v1/ask 应用
  if (!request.url.startsWith("/v1/ask") && !request.url.startsWith("/ask")) {
    return;
  }

  try {
    // 获取当前 Provider
    const provider = await getCurrentProvider(request);
    
    // 获取频率限制配置
    const config = await getRateLimitConfig(provider);
    
    // 获取客户端 IP
    const clientIp = request.ip || request.socket.remoteAddress || "unknown";
    
    // 获取或创建该 Provider 的存储
    const store = getOrCreateStore(provider);
    
    // 定期清理过期记录（每 100 次请求清理一次，避免性能影响）
    if (Math.random() < 0.01) {
      cleanupExpiredRecords(store);
    }
    
    const now = Date.now();
    const windowMs = config.timeWindow * 1000;
    const key = `${provider}:${clientIp}`;
    
    const record = store.get(key);
    
    if (!record || now >= record.resetAt) {
      // 创建新记录或重置
      store.set(key, { count: 1, resetAt: now + windowMs });
      
      // 设置响应头
      reply.header("X-RateLimit-Limit", String(config.max));
      reply.header("X-RateLimit-Remaining", String(config.max - 1));
      reply.header("X-RateLimit-Reset", String(Math.ceil((now + windowMs) / 1000)));
      
      return;
    }
    
    if (record.count >= config.max) {
      // 超过限制
      const retryAfter = Math.ceil((record.resetAt - now) / 1000);
      
      // 设置响应头
      reply.header("X-RateLimit-Limit", String(config.max));
      reply.header("X-RateLimit-Remaining", String(0));
      reply.header("X-RateLimit-Reset", String(Math.ceil(record.resetAt / 1000)));
      
      reply.code(429).send({
        ok: false,
        errorCode: "RATE_LIMIT_EXCEEDED",
        message: `Rate limit exceeded. Please try again after ${retryAfter} seconds.`,
      });
      
      return;
    }
    
    // 增加计数
    record.count++;
    
    // 设置响应头
    reply.header("X-RateLimit-Limit", String(config.max));
    reply.header("X-RateLimit-Remaining", String(config.max - record.count));
    reply.header("X-RateLimit-Reset", String(Math.ceil(record.resetAt / 1000)));
  } catch (error) {
    // 如果出错，记录日志但不阻止请求（降级处理）
    console.error("[RATE_LIMIT] Error in rate limit middleware:", error);
    // 继续处理请求
  }
}

