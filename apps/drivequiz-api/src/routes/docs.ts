import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { randomUUID } from "crypto";
import { getDb } from "../lib/db.js";
import { ensureAuth } from "../utils/auth.js";
import {
  validateDocumentInput,
  isPreChunked,
  validateChunkMetadata,
  formatValidationError,
} from "../utils/validator.js";
import { hashContent, verifyContentHash } from "../utils/hasher.js";
import { logEvent, logger } from "../utils/logger.js";
import { triggerVectorization } from "../services/vectorizer.js";
import {
  createOperation,
  logOperationDocument,
  updateOperationStatus,
} from "../services/operation-logger.js";
import {
  checkAndRejectDuplicate,
  recordUploadHistory,
} from "../services/upload-history.js";
import type { DocumentInput, DocumentUploadResponse } from "../types/document.js";
import type { ApiResponse } from "../types/common.js";

/**
 * 单文档上传路由
 */
export default async function docsRoute(app: FastifyInstance): Promise<void> {
  app.post(
    "/docs",
    async (
      req: FastifyRequest<{ Body: unknown }>,
      reply: FastifyReply
    ): Promise<ApiResponse<DocumentUploadResponse> | void> => {
      // 认证检查
      if (!ensureAuth(req, reply)) {
        return;
      }

      // 参数验证
      const validation = validateDocumentInput(req.body);
      if (!validation.success) {
        reply.code(400).send(formatValidationError(validation.error!));
        return;
      }

      const input = validation.data;

      // 验证分片元数据一致性
      const chunkValidation = validateChunkMetadata(input.meta);
      if (!chunkValidation.valid) {
        reply.code(400).send({
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: chunkValidation.error || "Invalid chunk metadata",
          },
        });
        return;
      }

      // 判断是否为预分片
      const preChunked = isPreChunked(input.meta);
      const enableServerChunk = process.env.RAG_ENABLE_SERVER_CHUNK === "true";

      // 如果不是预分片且未启用服务端分片，返回错误
      if (!preChunked && !enableServerChunk) {
        reply.code(400).send({
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Document must be pre-chunked by Datapull or server-side chunking must be enabled",
          },
        });
        return;
      }

      // 计算或验证内容哈希
      const contentHash = input.meta.contentHash || hashContent(input.content);
      if (input.meta.contentHash && !verifyContentHash(input.content, contentHash)) {
        reply.code(400).send({
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Content hash mismatch",
          },
        });
        return;
      }

      const db = getDb();
      const docId = `doc_${randomUUID()}`;
      const operationId = `op_${randomUUID()}`;

      try {
        // 检查上传历史，如果有重复则拒绝
        const duplicateCheck = await checkAndRejectDuplicate(
          input.url,
          contentHash,
          input.version
        );

        if (duplicateCheck) {
          // 记录拒绝到历史
          await recordUploadHistory({
            url: input.url,
            contentHash,
            version: input.version,
            title: input.title,
            sourceId: input.meta.sourceId,
            lang: input.lang,
            status: "rejected",
            rejectionReason: duplicateCheck.reason,
            operationId,
          });

          reply.code(409).send({
            success: false,
            error: {
              code: "DUPLICATE_DOCUMENT",
              message: duplicateCheck.reason,
            },
          });
          return;
        }

        // 检查重复文档（去重）- 保留原有的rag_documents检查
        const existing = await db
          .selectFrom("rag_documents")
          .select("doc_id")
          .where("url", "=", input.url)
          .where("content_hash", "=", contentHash)
          .where("version", "=", input.version)
          .executeTakeFirst();

        if (existing) {
          // 记录拒绝到历史
          await recordUploadHistory({
            url: input.url,
            contentHash,
            version: input.version,
            title: input.title,
            sourceId: input.meta.sourceId,
            lang: input.lang,
            status: "rejected",
            rejectionReason: "Document already exists in rag_documents",
            operationId,
          });

          reply.code(409).send({
            success: false,
            error: {
              code: "DUPLICATE_DOCUMENT",
              message: "Document already exists",
            },
          });
          return;
        }

        // 创建操作记录
        await createOperation(operationId, input.meta.sourceId, 1, {
          version: input.version,
          lang: input.lang,
        });

        // 记录上传历史（pending状态）
        await recordUploadHistory({
          url: input.url,
          contentHash,
          version: input.version,
          title: input.title,
          sourceId: input.meta.sourceId,
          lang: input.lang,
          status: "pending",
          operationId,
        });

        // 插入文档
        await db
          .insertInto("rag_documents")
          .values({
            doc_id: docId,
            title: input.title,
            url: input.url,
            content: input.content,
            content_hash: contentHash,
            version: input.version,
            lang: input.lang,
            source_id: input.meta.sourceId,
            doc_type: input.meta.type || null,
            vectorization_status: "pending",
          })
          .execute();

        // 记录操作文档结果
        await logOperationDocument(operationId, docId, "success");

        // 更新上传历史为成功状态
        await recordUploadHistory({
          url: input.url,
          contentHash,
          version: input.version,
          title: input.title,
          sourceId: input.meta.sourceId,
          lang: input.lang,
          status: "success",
          operationId,
          docId,
        });

        // 更新操作状态
        await updateOperationStatus(operationId, "success");

        // 异步触发向量化
        triggerVectorization({
          docId,
          content: input.content,
          lang: input.lang,
          meta: {
            sourceId: input.meta.sourceId,
            contentHash,
          },
        });

        // 记录日志
        logEvent("ingest.success", {
          docId,
          operationId,
          sourceId: input.meta.sourceId,
          prechunked: preChunked,
        });

        if (preChunked) {
          logEvent("ingest.prechunk.detected", {
            docId,
            chunkIndex: input.meta.chunkIndex,
            totalChunks: input.meta.totalChunks,
          });
        }

        // 返回成功响应
        reply.send({
          success: true,
          data: {
            docId,
            operationId,
          },
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error({
          event: "ingest.failed",
          docId,
          operationId,
          error: errorMessage,
        });

        // 记录失败
        await logOperationDocument(operationId, null, "failed", {
          code: "INTERNAL_ERROR",
          message: errorMessage,
        });
        await updateOperationStatus(operationId, "failed", 1);

        // 记录上传历史为失败状态
        try {
          await recordUploadHistory({
            url: input.url,
            contentHash,
            version: input.version,
            title: input.title,
            sourceId: input.meta.sourceId,
            lang: input.lang,
            status: "failed",
            rejectionReason: errorMessage,
            operationId,
          });
        } catch (historyError) {
          // 如果历史记录失败，只记录日志，不影响主流程
          logger.error({
            event: "upload.history.record.failed",
            operationId,
            error: historyError instanceof Error ? historyError.message : "Unknown error",
          });
        }

        reply.code(500).send({
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to ingest document",
          },
        });
      }
    }
  );
}

