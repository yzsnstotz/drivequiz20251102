import { getDb } from "../lib/db.js";
import type { Status, ISODate, LangCode } from "../types/common.js";
import type { OperationRecord, OperationDetail } from "../types/operation.js";
import { logger } from "../utils/logger.js";

/**
 * 创建操作记录
 */
export async function createOperation(
  operationId: string,
  sourceId: string,
  docsCount: number,
  metadata: {
    version: string;
    lang: LangCode;
    crawlerVersion?: string;
  }
): Promise<void> {
  const db = getDb();
  await db
    .insertInto("rag_operations")
    .values({
      operation_id: operationId,
      source_id: sourceId,
      status: "pending",
      docs_count: docsCount,
      failed_count: 0,
      metadata: metadata as Record<string, unknown>,
      completed_at: null,
    })
    .execute();
}

/**
 * 更新操作状态
 */
export async function updateOperationStatus(
  operationId: string,
  status: Status,
  failedCount?: number
): Promise<void> {
  const db = getDb();
  const updateData: {
    status: Status;
    failed_count?: number;
    completed_at?: Date;
    updated_at: Date;
  } = {
    status,
    updated_at: new Date(),
  };

  if (failedCount !== undefined) {
    updateData.failed_count = failedCount;
  }

  if (status === "success" || status === "failed") {
    updateData.completed_at = new Date();
  }

  await db
    .updateTable("rag_operations")
    .set(updateData)
    .where("operation_id", "=", operationId)
    .execute();
}

/**
 * 记录操作文档结果
 */
export async function logOperationDocument(
  operationId: string,
  docId: string | null,
  status: "success" | "failed",
  error?: { code: string; message: string }
): Promise<void> {
  const db = getDb();
  await db
    .insertInto("rag_operation_documents")
    .values({
      operation_id: operationId,
      doc_id: docId,
      status,
      error_code: error?.code || null,
      error_message: error?.message || null,
    })
    .execute();
}

/**
 * 查询操作记录列表
 */
export async function queryOperations(params: {
  sourceId?: string;
  status?: Status;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}): Promise<{
  data: OperationRecord[];
  total: number;
}> {
  const db = getDb();
  const page = params.page || 1;
  const limit = params.limit || 20;
  const offset = (page - 1) * limit;

  let query = db.selectFrom("rag_operations").selectAll();

  if (params.sourceId) {
    query = query.where("source_id", "=", params.sourceId);
  }

  if (params.status) {
    query = query.where("status", "=", params.status);
  }

  if (params.startDate) {
    query = query.where("created_at", ">=", new Date(params.startDate));
  }

  if (params.endDate) {
    query = query.where("created_at", "<=", new Date(params.endDate));
  }

  const [data, countResult] = await Promise.all([
    query
      .orderBy("created_at", "desc")
      .limit(limit)
      .offset(offset)
      .execute(),
    query
      .select((eb) => eb.fn.countAll().as("total"))
      .executeTakeFirst(),
  ]);

  const total = Number(countResult?.total || 0);

  return {
    data: data.map((row) => ({
      operationId: row.operation_id,
      sourceId: row.source_id,
      status: row.status as Status,
      docsCount: row.docs_count,
      failedCount: row.failed_count,
      createdAt: row.created_at.toISOString(),
      completedAt: row.completed_at?.toISOString(),
      metadata: row.metadata as {
        version: string;
        lang: LangCode;
        crawlerVersion?: string;
      },
    })),
    total,
  };
}

/**
 * 查询操作详情（含文档列表）
 */
export async function getOperationDetail(
  operationId: string
): Promise<OperationDetail | null> {
  const db = getDb();

  const operation = await db
    .selectFrom("rag_operations")
    .selectAll()
    .where("operation_id", "=", operationId)
    .executeTakeFirst();

  if (!operation) {
    return null;
  }

  const documents = await db
    .selectFrom("rag_operation_documents")
    .leftJoin("rag_documents", "rag_operation_documents.doc_id", "rag_documents.doc_id")
    .select([
      "rag_operation_documents.doc_id",
      "rag_documents.url",
      "rag_documents.title",
      "rag_operation_documents.status",
      "rag_operation_documents.error_code",
      "rag_operation_documents.error_message",
    ])
    .where("rag_operation_documents.operation_id", "=", operationId)
    .execute();

  return {
    operationId: operation.operation_id,
    sourceId: operation.source_id,
    status: operation.status as Status,
    docsCount: operation.docs_count,
    failedCount: operation.failed_count,
    createdAt: operation.created_at.toISOString(),
    completedAt: operation.completed_at?.toISOString(),
    metadata: operation.metadata as {
      version: string;
      lang: LangCode;
      crawlerVersion?: string;
    },
    documents: documents.map((doc) => ({
      docId: doc.doc_id || "",
      url: doc.url || "",
      title: doc.title || "",
      status: doc.status as "success" | "failed",
      error:
        doc.error_code && doc.error_message
          ? {
              code: doc.error_code,
              message: doc.error_message,
            }
          : undefined,
    })),
  };
}

