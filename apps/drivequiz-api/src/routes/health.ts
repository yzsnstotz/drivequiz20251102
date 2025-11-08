import type { FastifyInstance } from "fastify";
import { logEvent } from "../utils/logger.js";

/**
 * 健康检查路由
 */
export default async function healthRoute(app: FastifyInstance): Promise<void> {
  app.get("/health", async (_req, reply) => {
    logEvent("health.ok");
    reply.send({
      status: "ok",
      timestamp: new Date().toISOString(),
      version: "v1.1",
    });
  });
}

