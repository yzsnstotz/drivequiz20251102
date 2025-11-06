import { FastifyRequest } from "fastify";
import type { LocalAIConfig } from "../lib/config.js";

export function ensureServiceAuth(
  request: FastifyRequest,
  config: LocalAIConfig
): void {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    const err: Error & { statusCode?: number } = new Error("Missing Authorization header");
    err.statusCode = 401;
    throw err;
  }

  const token = authHeader.slice(7);
  if (!config.serviceTokens.has(token)) {
    const err: Error & { statusCode?: number } = new Error("Invalid service token");
    err.statusCode = 401;
    throw err;
  }
}

