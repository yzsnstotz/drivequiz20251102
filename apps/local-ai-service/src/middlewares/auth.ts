import { FastifyRequest } from "fastify";
import type { LocalAIConfig } from "../lib/config.js";
import { logger } from "../lib/logger.js";

export function ensureServiceAuth(
  request: FastifyRequest,
  config: LocalAIConfig
): void {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    logger.warn(
      {
        event: "auth.missing_header",
        requestId: request.id ?? null,
      },
      "缺少 Authorization 头"
    );
    const err: Error & { statusCode?: number } = new Error("Missing Authorization header");
    err.statusCode = 401;
    throw err;
  }

  const token = authHeader.slice(7);
  if (!config.serviceTokens.has(token)) {
    logger.warn(
      {
        event: "auth.invalid_token",
        requestId: request.id ?? null,
      },
      "服务鉴权 token 校验失败"
    );
    const err: Error & { statusCode?: number } = new Error("Invalid service token");
    err.statusCode = 401;
    throw err;
  }

  logger.debug(
    {
      event: "auth.success",
      requestId: request.id ?? null,
    },
    "服务鉴权校验通过"
  );
}

