import { getDb } from "../lib/db.js";
import type { VectorizeTask, VectorizeResult } from "../types/vector.js";
import { logger, logEvent } from "../utils/logger.js";

const VECTORIZE_URL = process.env.AI_VECTORIZE_URL || "";
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000; // 1秒

/**
 * 指数退避延迟
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 触发向量化任务（异步）
 */
export async function triggerVectorization(
  task: VectorizeTask
): Promise<void> {
  // 异步执行，不阻塞主流程
  setImmediate(async () => {
    await vectorizeWithRetry(task);
  });
}

/**
 * 带重试的向量化任务
 */
async function vectorizeWithRetry(
  task: VectorizeTask,
  attempt: number = 1
): Promise<VectorizeResult> {
  const startTime = Date.now();
  logEvent("vectorize.start", {
    docId: task.docId,
    attempt,
  });

  try {
    // 更新状态为 processing
    await updateVectorizationStatus(task.docId, "processing");

    // 调用向量化服务
    const response = await fetch(VECTORIZE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DRIVEQUIZ_API_TOKEN_SECRET || ""}`,
      },
      body: JSON.stringify({
        docId: task.docId,
        content: task.content,
        lang: task.lang,
        meta: task.meta,
      }),
      signal: AbortSignal.timeout(60000), // 60秒超时
    });

    if (!response.ok) {
      throw new Error(`Vectorization failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    const durationMs = Date.now() - startTime;

    // 更新状态为 completed
    await updateVectorizationStatus(task.docId, "completed");

    logEvent("vectorize.completed", {
      docId: task.docId,
      durationMs,
    });

    return {
      docId: task.docId,
      status: "completed",
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // 如果还有重试次数，进行重试
    if (attempt < MAX_RETRIES) {
      const delayMs = RETRY_DELAY_BASE * Math.pow(2, attempt - 1);
      logger.warn({
        event: "vectorize.retry",
        docId: task.docId,
        attempt,
        nextAttempt: attempt + 1,
        delayMs,
        error: errorMessage,
      });

      await delay(delayMs);
      return vectorizeWithRetry(task, attempt + 1);
    }

    // 重试次数用尽，标记为失败
    await updateVectorizationStatus(task.docId, "failed");
    logEvent("vectorize.failed", {
      docId: task.docId,
      attempt,
      durationMs,
      error: errorMessage,
    });

    return {
      docId: task.docId,
      status: "failed",
      durationMs,
      error: {
        code: "VECTORIZATION_FAILED",
        message: errorMessage,
      },
    };
  }
}

/**
 * 更新文档向量化状态
 */
async function updateVectorizationStatus(
  docId: string,
  status: "pending" | "processing" | "completed" | "failed"
): Promise<void> {
  const db = getDb();
  await db
    .updateTable("rag_documents")
    .set({
      vectorization_status: status,
      updated_at: new Date(),
    })
    .where("doc_id", "=", docId)
    .execute();
}

