import { z } from "zod";
import type { DocumentInput } from "../types/document.js";
import type { ApiResponse } from "../types/common.js";

/** 文档输入验证 Schema */
export const documentInputSchema = z.object({
  title: z.string().min(1).max(500),
  url: z.string().url().max(1000),
  content: z.string().min(100).max(2000),
  version: z.string().min(1).max(50),
  lang: z.enum(["ja", "zh", "en"]),
  meta: z.object({
    sourceId: z.string().min(1).max(100),
    type: z.enum(["official", "organization", "education"]).optional(),
    chunkIndex: z.number().int().positive().optional(),
    totalChunks: z.number().int().positive().optional(),
    contentHash: z.string().min(1).max(64).optional(),
  }),
});

/** 批量上传请求验证 Schema */
export const batchUploadSchema = z.object({
  docs: z
    .array(documentInputSchema)
    .min(1)
    .max(Number(process.env.MAX_BATCH_SIZE) || 100),
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
 * 验证文档输入
 * @param input 文档输入
 * @returns 验证结果
 */
export function validateDocumentInput(
  input: unknown
): { success: true; data: DocumentInput } | { success: false; error: ApiResponse["error"] } {
  try {
    const data = documentInputSchema.parse(input);
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      return {
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message: `Validation failed: ${firstError.path.join(".")} - ${firstError.message}`,
          details: {
            field: firstError.path.join("."),
            errors: error.errors,
          },
        },
      };
    }
    return {
      success: false,
      error: {
        code: "INVALID_REQUEST",
        message: "Invalid request format",
      },
    };
  }
}

/**
 * 判断是否为 Datapull 预分片文档
 * @param meta 元数据
 * @returns 是否为预分片
 */
export function isPreChunked(meta: DocumentInput["meta"]): boolean {
  return !!(
    meta.chunkIndex !== undefined &&
    meta.totalChunks !== undefined &&
    meta.contentHash
  );
}

/**
 * 验证分片元数据一致性
 * @param meta 元数据
 * @returns 验证结果
 */
export function validateChunkMetadata(meta: DocumentInput["meta"]): {
  valid: boolean;
  error?: string;
} {
  if (!isPreChunked(meta)) {
    return { valid: true };
  }

  const { chunkIndex, totalChunks } = meta;
  if (chunkIndex! > totalChunks!) {
    return {
      valid: false,
      error: "chunkIndex must be less than or equal to totalChunks",
    };
  }

  if (chunkIndex! < 1) {
    return {
      valid: false,
      error: "chunkIndex must be greater than 0",
    };
  }

  return { valid: true };
}

/**
 * 格式化验证错误响应
 * @param error 错误信息
 * @returns 格式化的错误响应
 */
export function formatValidationError(error: {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}): ApiResponse {
  return {
    success: false,
    error,
  };
}

