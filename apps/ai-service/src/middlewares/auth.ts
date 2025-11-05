// apps/ai-service/src/middlewares/auth.ts
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ServiceConfig } from "../index.js";

/** 从 Authorization 读取 Bearer token */
export function readBearerToken(req: FastifyRequest): string | null {
  const raw = (req.headers.authorization ||
    req.headers.Authorization) as string | undefined;
  if (!raw || typeof raw !== "string") return null;
  const m = raw.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

/** 校验 Service Token（抛错交给全局 errorHandler） */
export function ensureServiceAuth(req: FastifyRequest, config: ServiceConfig): void {
  const token = readBearerToken(req);
  if (!token) {
    const err: Error & { statusCode?: number } = new Error("Service token required");
    err.statusCode = 401; // AUTH_REQUIRED
    throw err;
  }
  if (!config.serviceTokens.has(token)) {
    const err: Error & { statusCode?: number } = new Error("Invalid service token");
    err.statusCode = 403; // FORBIDDEN
    throw err;
  }
}

/**
 * 作为 Fastify 路由 preHandler 使用：
 * - 在路由上配置：preHandler: serviceAuthPreHandler(app)
 */
export function serviceAuthPreHandler(app: FastifyInstance) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      ensureServiceAuth(req, app.config as ServiceConfig);
    } catch (e) {
      const err = e as Error & { statusCode?: number };
      const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 401;
      reply.code(status).send({
        ok: false,
        errorCode: status === 401 ? "AUTH_REQUIRED" : "FORBIDDEN",
        message: status === 401 ? "Service token required" : "Invalid service token",
      });
    }
  };
}

/**
 * 包装处理函数的工具（可替代 preHandler 使用）
 * 用法：handler: withServiceAuth(app, async (req, reply) => { ... })
 */
export function withServiceAuth<T extends FastifyRequest>(
  app: FastifyInstance,
  handler: (req: T, reply: FastifyReply) => Promise<void> | void
) {
  return async (req: T, reply: FastifyReply): Promise<void> => {
    try {
      ensureServiceAuth(req, app.config as ServiceConfig);
      await handler(req, reply);
    } catch (e) {
      const err = e as Error & { statusCode?: number };
      const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 401;
      reply.code(status).send({
        ok: false,
        errorCode: status === 401 ? "AUTH_REQUIRED" : "FORBIDDEN",
        message: status === 401 ? "Service token required" : "Invalid service token",
      });
    }
  };
}
