import type { FastifyRequest, FastifyReply } from "fastify";
import { logEvent } from "./logger.js";

/**
 * 从请求头中读取 Bearer Token
 * @param req Fastify 请求对象
 * @returns Token 字符串，如果不存在则返回 null
 */
export function readBearerToken(req: FastifyRequest): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * 验证 Token 是否有效
 * @param token Token 字符串
 * @returns 是否有效
 */
export function verifyToken(token: string | null): boolean {
  if (!token) {
    return false;
  }

  const secret = process.env.DRIVEQUIZ_API_TOKEN_SECRET;
  if (!secret) {
    // 如果未配置密钥，拒绝所有请求
    return false;
  }

  // 简单验证：直接比较 Token（生产环境应使用 JWT）
  // 这里可以根据需要实现 JWT 验证
  return token === secret;
}

/**
 * 认证中间件
 * @param req Fastify 请求对象
 * @param reply Fastify 响应对象
 * @returns 如果认证失败，返回 false；否则返回 true
 */
export function ensureAuth(
  req: FastifyRequest,
  reply: FastifyReply
): boolean {
  const token = readBearerToken(req);
  if (!verifyToken(token)) {
    logEvent("auth.unauthorized", {
      path: req.url,
      method: req.method,
    });
    reply.code(401).send({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid or missing token",
      },
    });
    return false;
  }
  return true;
}

