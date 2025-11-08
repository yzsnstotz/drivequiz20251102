import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { randomUUID } from "crypto";
import pLimit from "p-limit";
import { z } from "zod";
import { getDb } from "../lib/db.js";
import { ensureAuth } from "../utils/auth.js";
import {
  validateDocumentInput,
  isPreChunked,
  validateChunkMetadata,
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
import type { BatchUploadRequest, IngestResult } from "../types/operation.js";
import type { ApiResponse } from "../types/common.js";

const MAX_BATCH_SIZE = Number(process.env.MAX_BATCH_SIZE) || 100;
const CONCURRENT_LIMIT = 10;

/** 批量上传请求验证 Schema */
const batchUploadSchema = z.object({
  docs: z.array(z.any()).min(1).max(MAX_BATCH_SIZE),
  sourceId: z.string().min(1).max(100),
  batchMetadata: z
    .object({
      totalDocs: z.number().int().positive(),
      crawledAt: z.string().datetime(),
      crawlerVersion: z.string().max(50),
    })
    .optional(),
});

/**
 * 批量文档上传路由
 */
export default async function docsBatchRoute(
  app: FastifyInstance
): Promise<void> {
  app.post(
    "/docs/batch",
    async (
      req: FastifyRequest<{ Body: unknown }>,
      reply: FastifyReply
    ): Promise<ApiResponse<IngestResult> | void> => {
      // 认证检查
      if (!ensureAuth(req, reply)) {
        return;
      }

      // 验证请求格式
      let body: BatchUploadRequest;
      try {
        body = batchUploadSchema.parse(req.body) as BatchUploadRequest;
      } catch (error) {
        if (error instanceof z.ZodError) {
          reply.code(400).send({
            success: false,
            error: {
              code: "INVALID_REQUEST",
              message: `Validation failed: ${error.errors[0].message}`,
              details: {
                errors: error.errors,
              },
            },
          });
          return;
        }
        reply.code(400).send({
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Invalid request format",
          },
        });
        return;
      }

      const operationId = `op_batch_${randomUUID()}`;
      const limit = pLimit(CONCURRENT_LIMIT);
      const results: IngestResult["results"] = [];
      let processed = 0;
      let failed = 0;

      // 创建操作记录
      await createOperation(operationId, body.sourceId, body.docs.length, {
        version: body.docs[0]?.version || "unknown",
        lang: body.docs[0]?.lang || "ja",
        crawlerVersion: body.batchMetadata?.crawlerVersion,
      });

      logEvent("ingest.batch.start", {
        operationId,
        sourceId: body.sourceId,
        totalDocs: body.docs.length,
      });

      // 并发处理文档
      const promises = body.docs.map((doc, index) =>
        limit(async () => {
          try {
            // 验证单个文档
            const validation = validateDocumentInput(doc);
            if (!validation.success) {
              failed++;
              results.push({
                index,
                status: "failed",
                error: validation.error!,
              });
              await logOperationDocument(operationId, null, "failed", validation.error!);
              return;
            }

            const input = validation.data;

            // 验证分片元数据
            const chunkValidation = validateChunkMetadata(input.meta);
            if (!chunkValidation.valid) {
              failed++;
              results.push({
                index,
                status: "failed",
                error: {
                  code: "INVALID_REQUEST",
                  message: chunkValidation.error || "Invalid chunk metadata",
                },
              });
              await logOperationDocument(operationId, null, "failed", {
                code: "INVALID_REQUEST",
                message: chunkValidation.error || "Invalid chunk metadata",
              });
              return;
            }

            // 判断是否为预分片
            const preChunked = isPreChunked(input.meta);
            const enableServerChunk = process.env.RAG_ENABLE_SERVER_CHUNK === "true";

            if (!preChunked && !enableServerChunk) {
              failed++;
              results.push({
                index,
                status: "failed",
                error: {
                  code: "INVALID_REQUEST",
                  message: "Document must be pre-chunked by Datapull or server-side chunking must be enabled",
                },
              });
              await logOperationDocument(operationId, null, "failed", {
                code: "INVALID_REQUEST",
                message: "Document must be pre-chunked",
              });
              return;
            }

            // 计算或验证内容哈希
            const contentHash = input.meta.contentHash || hashContent(input.content);
            if (input.meta.contentHash && !verifyContentHash(input.content, contentHash)) {
              failed++;
              results.push({
                index,
                status: "failed",
                error: {
                  code: "INVALID_REQUEST",
                  message: "Content hash mismatch",
                },
              });
              await logOperationDocument(operationId, null, "failed", {
                code: "INVALID_REQUEST",
                message: "Content hash mismatch",
              });
              return;
            }

            const db = getDb();
            const docId = `doc_${randomUUID()}`;

            // 检查上传历史，如果有重复则拒绝
            const duplicateCheck = await checkAndRejectDuplicate(
              input.url,
              contentHash,
              input.version
            );

            if (duplicateCheck) {
              failed++;
              results.push({
                index,
                status: "failed",
                error: {
                  code: "DUPLICATE_DOCUMENT",
                  message: duplicateCheck.reason,
                },
              });
              await logOperationDocument(operationId, null, "failed", {
                code: "DUPLICATE_DOCUMENT",
                message: duplicateCheck.reason,
              });
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
              failed++;
              results.push({
                docId: existing.doc_id,
                index,
                status: "failed",
                error: {
                  code: "DUPLICATE_DOCUMENT",
                  message: "Document already exists",
                },
              });
              await logOperationDocument(operationId, existing.doc_id, "failed", {
                code: "DUPLICATE_DOCUMENT",
                message: "Document already exists",
              });
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
              return;
            }

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
            processed++;

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

            results.push({
              docId,
              index,
              status: "success",
            });
          } catch (error) {
            failed++;
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            logger.error({
              event: "ingest.batch.item.failed",
              operationId,
              index,
              error: errorMessage,
            });

            results.push({
              index,
              status: "failed",
              error: {
                code: "INTERNAL_ERROR",
                message: errorMessage,
              },
            });

            await logOperationDocument(operationId, null, "failed", {
              code: "INTERNAL_ERROR",
              message: errorMessage,
            });

            // 记录上传历史为失败状态
            try {
              // 尝试从input获取信息（如果可用）
              if (validation.success) {
                const input = validation.data;
                const contentHash = input.meta.contentHash || hashContent(input.content);
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
              }
            } catch (historyError) {
              // 如果历史记录失败，只记录日志，不影响主流程
              logger.error({
                event: "upload.history.record.failed",
                operationId,
                index,
                error: historyError instanceof Error ? historyError.message : "Unknown error",
              });
            }
          }
        })
      );

      // 等待所有任务完成
      await Promise.all(promises);

      // 更新操作状态
      const finalStatus = failed === 0 ? "success" : processed > 0 ? "success" : "failed";
      await updateOperationStatus(operationId, finalStatus, failed);

      // 记录日志
      if (failed === 0) {
        logEvent("ingest.batch.completed", {
          operationId,
          processed,
        });
      } else {
        logEvent("ingest.batch.partial", {
          operationId,
          processed,
          failed,
        });
      }

      // 返回响应（部分成功时返回 207）
      const statusCode = failed === 0 ? 200 : processed > 0 ? 207 : 400;
      reply.code(statusCode).send({
        success: true,
        data: {
          processed,
          failed,
          operationId,
          results,
        },
      });
    }
  );
}

