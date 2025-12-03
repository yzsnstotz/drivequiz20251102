// Vercel Serverless Function 配置
export const runtime = "nodejs";
export const maxDuration = 300;

import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { badRequest, internalError, success, notFound } from "@/app/api/_lib/errors";
import { db } from "@/lib/db";

// POST /api/admin/question-processing/batch-process/retry - 重试失败的任务
export const POST = withAdminAuth(async (req: Request) => {
  const requestId = `api-batch-process-retry-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  try {
    const body = await req.json();
    const { taskId } = body;

    if (!taskId) {
      return badRequest("taskId is required");
    }

    // 查询原任务
    const originalTask = await db
      .selectFrom("batch_process_tasks")
      .selectAll()
      .where("task_id", "=", taskId)
      .executeTakeFirst();

    if (!originalTask) {
      return notFound("Original task not found");
    }

    // 只能重试 failed、cancelled 或 paused 状态的任务
    if (!["failed", "cancelled", "paused"].includes(originalTask.status)) {
      return badRequest(
        `Task cannot be retried. Current status: ${originalTask.status}. Only failed, cancelled, or paused tasks can be retried.`
      );
    }

    console.log(`[API BatchProcess] [${requestId}] Retrying task: ${taskId}`);

    // 提取已处理的题目ID和content_hash
    const processedQuestionIds = new Set<number>();
    const processedContentHashes = new Set<string>();

    if (originalTask.details && Array.isArray(originalTask.details)) {
      for (const detail of originalTask.details) {
        if (detail.questionId) {
          processedQuestionIds.add(detail.questionId);
        }
      }
    }

    // 从errors中提取失败的题目（这些也需要重试，但根据需求，跳过失败的题目，继续未完成的题目）
    // 所以这里只提取未处理的题目

    // 计算未处理的题目
    let pendingQuestionIds: number[] | null = null;
    let pendingContentHashes: string[] | null = null;

    if (originalTask.question_ids && originalTask.question_ids.length > 0) {
      // 通过question_ids指定
      pendingQuestionIds = originalTask.question_ids.filter(
        (id) => !processedQuestionIds.has(id)
      );
    } else {
      // 需要从数据库查询所有题目的content_hash，然后过滤
      // 这种情况比较复杂，暂时不支持
      return badRequest("Retrying tasks without explicit question_ids is not supported yet");
    }

    if (!pendingQuestionIds || pendingQuestionIds.length === 0) {
      return badRequest("No pending questions to retry. All questions have been processed.");
    }

    // 创建新任务
    const newTaskId = `task-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const newTask = await db
      .insertInto("batch_process_tasks")
      .values({
        task_id: newTaskId,
        status: "pending",
        operations: originalTask.operations,
        question_ids: pendingQuestionIds,
        translate_options: originalTask.translate_options,
        polish_options: originalTask.polish_options,
        batch_size: originalTask.batch_size,
        continue_on_error: originalTask.continue_on_error,
        total_questions: pendingQuestionIds.length,
        processed_count: 0,
        succeeded_count: 0,
        failed_count: 0,
        current_batch: 0,
        errors: null,
        details: null,
        created_by: originalTask.created_by,
        started_at: null,
        completed_at: null,
      })
      .returning(["task_id"])
      .executeTakeFirst();

    console.log(`[API BatchProcess] [${requestId}] Created retry task: ${newTaskId} with ${pendingQuestionIds.length} pending questions`);

    return success({
      originalTaskId: taskId,
      newTaskId: newTask?.task_id,
      pendingQuestionCount: pendingQuestionIds.length,
      message: "Retry task created successfully",
    });
  } catch (e: any) {
    console.error(`[API BatchProcess] [${requestId}] Error:`, e?.message, e?.stack);
    return internalError(e?.message || "Failed to retry batch process task");
  }
});

