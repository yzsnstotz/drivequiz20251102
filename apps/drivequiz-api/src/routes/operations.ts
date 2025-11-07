import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { ensureAuth } from "../utils/auth.js";
import { logEvent } from "../utils/logger.js";
import {
  queryOperations,
  getOperationDetail,
} from "../services/operation-logger.js";
import type { PaginatedResponse, ApiResponse } from "../types/common.js";
import type { OperationRecord, OperationDetail } from "../types/operation.js";

/**
 * 操作记录查询路由
 */
export default async function operationsRoute(
  app: FastifyInstance
): Promise<void> {
  // 查询操作记录列表
  app.get(
    "/operations",
    async (
      req: FastifyRequest<{
        Querystring: {
          sourceId?: string;
          status?: string;
          startDate?: string;
          endDate?: string;
          page?: string;
          limit?: string;
        };
      }>,
      reply: FastifyReply
    ): Promise<PaginatedResponse<OperationRecord> | void> => {
      // 认证检查
      if (!ensureAuth(req, reply)) {
        return;
      }

      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;

      const result = await queryOperations({
        sourceId: req.query.sourceId,
        status: req.query.status as "pending" | "processing" | "success" | "failed" | undefined,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        page,
        limit,
      });

      logEvent("operations.query", {
        sourceId: req.query.sourceId,
        status: req.query.status,
        page,
        limit,
        total: result.total,
      });

      reply.send({
        success: true,
        data: result.data,
        pagination: {
          page,
          limit,
          total: result.total,
        },
      });
    }
  );

  // 查询操作详情
  app.get(
    "/operations/:operationId",
    async (
      req: FastifyRequest<{
        Params: { operationId: string };
      }>,
      reply: FastifyReply
    ): Promise<ApiResponse<OperationDetail> | void> => {
      // 认证检查
      if (!ensureAuth(req, reply)) {
        return;
      }

      const { operationId } = req.params;
      const detail = await getOperationDetail(operationId);

      if (!detail) {
        reply.code(404).send({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Operation not found",
          },
        });
        return;
      }

      logEvent("operations.detail", {
        operationId,
      });

      reply.send({
        success: true,
        data: detail,
      });
    }
  );
}

