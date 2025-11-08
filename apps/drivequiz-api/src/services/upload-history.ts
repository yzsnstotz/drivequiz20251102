import { getDb } from "../lib/db.js";
import { logger } from "../utils/logger.js";

/**
 * 检查历史记录中是否存在重复的上传
 * @param url 文档URL
 * @param contentHash 内容哈希
 * @param version 版本
 * @returns 如果存在重复，返回历史记录；否则返回null
 */
export async function checkUploadHistory(
  url: string,
  contentHash: string,
  version: string
): Promise<{
  id: number;
  url: string;
  content_hash: string;
  version: string;
  status: string;
  uploaded_at: Date;
} | null> {
  const db = getDb();
  
  const history = await db
    .selectFrom("rag_upload_history")
    .selectAll()
    .where("url", "=", url)
    .where("content_hash", "=", contentHash)
    .where("version", "=", version)
    .orderBy("uploaded_at", "desc")
    .executeTakeFirst();

  return history || null;
}

/**
 * 记录上传历史（无论成功还是失败）
 * @param params 上传参数
 * @returns 历史记录ID
 */
export async function recordUploadHistory(params: {
  url: string;
  contentHash: string;
  version: string;
  title: string;
  sourceId: string;
  lang: string;
  status: "pending" | "success" | "rejected" | "failed";
  rejectionReason?: string;
  operationId?: string;
  docId?: string;
}): Promise<number> {
  const db = getDb();
  
  try {
    // 先检查是否已存在相同的记录
    const existing = await checkUploadHistory(
      params.url,
      params.contentHash,
      params.version
    );

    if (existing) {
      // 如果已存在，更新状态
      await db
        .updateTable("rag_upload_history")
        .set({
          status: params.status,
          rejection_reason: params.rejectionReason || null,
          operation_id: params.operationId || null,
          doc_id: params.docId || null,
        })
        .where("id", "=", existing.id)
        .execute();
      
      logger.info({
        event: "upload.history.updated",
        historyId: existing.id,
        url: params.url,
        status: params.status,
      });
      
      return existing.id;
    } else {
      // 如果不存在，插入新记录
      const result = await db
        .insertInto("rag_upload_history")
        .values({
          url: params.url,
          content_hash: params.contentHash,
          version: params.version,
          title: params.title,
          source_id: params.sourceId,
          lang: params.lang,
          status: params.status,
          rejection_reason: params.rejectionReason || null,
          operation_id: params.operationId || null,
          doc_id: params.docId || null,
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      
      logger.info({
        event: "upload.history.recorded",
        historyId: result.id,
        url: params.url,
        status: params.status,
      });
      
      return result.id;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error({
      event: "upload.history.failed",
      url: params.url,
      error: errorMessage,
    });
    throw error;
  }
}

/**
 * 检查并拒绝重复的上传
 * @param url 文档URL
 * @param contentHash 内容哈希
 * @param version 版本
 * @returns 如果存在重复，返回拒绝原因；否则返回null
 */
export async function checkAndRejectDuplicate(
  url: string,
  contentHash: string,
  version: string
): Promise<{ reason: string; historyId: number } | null> {
  const history = await checkUploadHistory(url, contentHash, version);
  
  if (history) {
    // 如果历史记录状态是success或pending，则拒绝
    if (history.status === "success" || history.status === "pending") {
      return {
        reason: `Document already exists in upload history (status: ${history.status}, uploaded at: ${history.uploaded_at.toISOString()})`,
        historyId: history.id,
      };
    }
    // 如果历史记录状态是rejected或failed，也拒绝（避免重复尝试）
    if (history.status === "rejected" || history.status === "failed") {
      return {
        reason: `Document was previously ${history.status} (uploaded at: ${history.uploaded_at.toISOString()})`,
        historyId: history.id,
      };
    }
  }
  
  return null;
}

