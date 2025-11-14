import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { badRequest, internalError, success, conflict, notFound } from "@/app/api/_lib/errors";
import { db } from "@/lib/db";
import { z } from "zod";
import {
  translateWithPolish,
  polishContent,
  generateCategoryAndTags,
  fillMissingContent,
} from "../_lib/batchProcessUtils";

// POST /api/admin/question-processing/batch-process - 创建批量处理任务
export const POST = withAdminAuth(async (req: Request) => {
  const requestId = `api-batch-process-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  let taskId: string | null = null;

  try {
    console.log(`[API BatchProcess] [${requestId}] Request received`);
    const body = await req.json().catch(() => ({}));

    const schema = z.object({
      questionIds: z.array(z.number()).optional(),
      operations: z.array(z.enum(["translate", "polish", "fill_missing", "category_tags"])),
      translateOptions: z
        .object({
          from: z.string(),
          to: z.string(),
        })
        .optional(),
      polishOptions: z
        .object({
          locale: z.string(),
        })
        .optional(),
      batchSize: z.number().optional().default(10),
      continueOnError: z.boolean().optional().default(true),
    });

    const input = schema.parse(body);
    const adminId = (req as any).adminId || null;

    console.log(`[API BatchProcess] [${requestId}] Input validated:`, {
      questionIdsCount: input.questionIds?.length || 0,
      operations: input.operations,
      batchSize: input.batchSize,
    });

    // 验证操作选项
    if (input.operations.includes("translate") && !input.translateOptions) {
      return badRequest("translateOptions is required when 'translate' operation is included");
    }

    if (input.operations.includes("polish") && !input.polishOptions) {
      return badRequest("polishOptions is required when 'polish' operation is included");
    }

    // 检查是否有正在处理的任务
    const processingTask = await db
      .selectFrom("batch_process_tasks")
      .select(["task_id", "status"])
      .where("status", "in", ["pending", "processing"])
      .orderBy("created_at", "asc")
      .executeTakeFirst();

    if (processingTask) {
      console.warn(`[API BatchProcess] [${requestId}] Another task is already processing: ${processingTask.task_id}`);
      return conflict(
        `Another task is already processing: ${processingTask.task_id}. Please wait for it to complete.`
      );
    }

    // 创建任务记录
    taskId = `task-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    console.log(`[API BatchProcess] [${requestId}] Creating task: ${taskId}`);

    const taskRecord = await db
      .insertInto("batch_process_tasks")
      .values({
        task_id: taskId,
        status: "pending",
        operations: input.operations,
        question_ids: input.questionIds && input.questionIds.length > 0 ? input.questionIds : null,
        translate_options: input.translateOptions ? (input.translateOptions as any) : null,
        polish_options: input.polishOptions ? (input.polishOptions as any) : null,
        batch_size: input.batchSize || 10,
        continue_on_error: input.continueOnError !== false,
        total_questions: 0,
        processed_count: 0,
        succeeded_count: 0,
        failed_count: 0,
        current_batch: 0,
        errors: null,
        details: null,
        created_by: adminId ? String(adminId) : null,
      })
      .returning(["id", "task_id"])
      .executeTakeFirst();

    console.log(`[API BatchProcess] [${requestId}] Task created: ${taskRecord?.task_id}`);

    // 获取要处理的题目列表
    let questions: Array<{
      id: number;
      content_hash: string;
      content: any;
      options: any;
      explanation: string | null;
    }> = [];

    if (input.questionIds && input.questionIds.length > 0) {
      console.log(`[API BatchProcess] [${requestId}] Loading specified questions: ${input.questionIds.length}`);
      questions = await db
        .selectFrom("questions")
        .select(["id", "content_hash", "content", "options", "explanation"])
        .where("id", "in", input.questionIds)
        .execute();
    } else {
      console.log(`[API BatchProcess] [${requestId}] Loading all questions`);
      questions = await db
        .selectFrom("questions")
        .select(["id", "content_hash", "content", "options", "explanation"])
        .execute();
    }

    console.log(`[API BatchProcess] [${requestId}] Questions loaded: ${questions.length}`);

    // 更新任务状态为处理中
    await db
      .updateTable("batch_process_tasks")
      .set({
        status: "processing",
        total_questions: questions.length,
        started_at: new Date(),
        updated_at: new Date(),
      })
      .where("task_id", "=", taskId)
      .execute();

    const results = {
      total: questions.length,
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [] as Array<{ questionId: number; error: string }>,
      details: [] as Array<{ questionId: number; operations: string[]; status: string }>,
    };

    // 分批处理（异步执行，不阻塞响应）
    processBatchAsync(requestId, taskId, questions, input, results).catch((error) => {
      console.error(`[API BatchProcess] [${requestId}] Async batch processing failed:`, error);
    });

    // 立即返回任务ID，不等待处理完成
    return success({
      taskId,
      total: questions.length,
      status: "processing",
      message: "Batch processing started. Use GET endpoint to check progress.",
    });
  } catch (e: any) {
    console.error(`[API BatchProcess] [${requestId}] Error:`, e?.message, e?.stack);

    // 如果任务已创建，更新状态为失败
    if (taskId) {
      try {
        await db
          .updateTable("batch_process_tasks")
          .set({
            status: "failed",
            completed_at: new Date(),
            updated_at: new Date(),
          })
          .where("task_id", "=", taskId)
          .execute();
      } catch (updateError) {
        console.error(`[API BatchProcess] [${requestId}] Failed to update task status:`, updateError);
      }
    }

    if (e instanceof z.ZodError) {
      return badRequest(`Validation error: ${e.errors.map((err) => err.message).join(", ")}`);
    }

    return internalError(e?.message || "Batch process failed");
  }
});

/**
 * 异步批量处理函数（不阻塞响应）
 */
async function processBatchAsync(
  requestId: string,
  taskId: string,
  questions: Array<{
    id: number;
    content_hash: string;
    content: any;
    options: any;
    explanation: string | null;
  }>,
  input: {
    operations: ("translate" | "polish" | "fill_missing" | "category_tags")[];
    translateOptions?: { from: string; to: string };
    polishOptions?: { locale: string };
    batchSize: number;
    continueOnError: boolean;
  },
  results: {
    total: number;
    processed: number;
    succeeded: number;
    failed: number;
    errors: Array<{ questionId: number; error: string }>;
    details: Array<{ questionId: number; operations: string[]; status: string }>;
  }
) {
  const batchSize = input.batchSize || 10;
  const totalBatches = Math.ceil(questions.length / batchSize);

  for (let i = 0; i < questions.length; i += batchSize) {
    const batch = questions.slice(i, i + batchSize);
    const currentBatch = Math.floor(i / batchSize) + 1;

    console.log(`[API BatchProcess] [${requestId}] Processing batch ${currentBatch}/${totalBatches}`);

    // 更新当前批次
    await db
      .updateTable("batch_process_tasks")
      .set({
        current_batch: currentBatch,
        updated_at: new Date(),
      })
      .where("task_id", "=", taskId)
      .execute();

    for (const question of batch) {
      const questionResult = {
        questionId: question.id,
        operations: [] as string[],
        status: "success" as "success" | "failed",
      };

      try {
        // 获取题目内容
        let content: string;
        if (typeof question.content === "string") {
          content = question.content;
        } else if (question.content && typeof question.content === "object") {
          content = question.content.zh || question.content.en || question.content.ja || "";
        } else {
          content = "";
        }

        const options = Array.isArray(question.options)
          ? question.options
          : question.options
            ? [String(question.options)]
            : null;
        const explanation = question.explanation || null;

        // 执行各种操作
        for (const operation of input.operations) {
          try {
            if (operation === "translate" && input.translateOptions) {
              console.log(
                `[API BatchProcess] [${requestId}] Translating question ${question.id}: ${input.translateOptions.from} -> ${input.translateOptions.to}`
              );
              const sourceContent = {
                content,
                options: options || undefined,
                explanation: explanation || undefined,
              };
              const result = await translateWithPolish({
                source: sourceContent,
                from: input.translateOptions.from,
                to: input.translateOptions.to,
              });

              // 保存翻译结果
              const existing = await db
                .selectFrom("question_translations")
                .select(["id"])
                .where("content_hash", "=", question.content_hash)
                .where("locale", "=", input.translateOptions.to)
                .executeTakeFirst();

              if (existing) {
                await db
                  .updateTable("question_translations")
                  .set({
                    content: result.content,
                    options: result.options ? (result.options as any) : null,
                    explanation: result.explanation || null,
                    updated_at: new Date(),
                  })
                  .where("id", "=", existing.id)
                  .execute();
              } else {
                await db
                  .insertInto("question_translations")
                  .values({
                    content_hash: question.content_hash,
                    locale: input.translateOptions.to,
                    content: result.content,
                    options: result.options ? (result.options as any) : null,
                    explanation: result.explanation || null,
                    source: "ai",
                  })
                  .execute();
              }
              questionResult.operations.push("translate");
            }

            if (operation === "polish" && input.polishOptions) {
              console.log(`[API BatchProcess] [${requestId}] Polishing question ${question.id}`);
              const text = {
                content,
                options: options || undefined,
                explanation: explanation || undefined,
              };
              const result = await polishContent({
                text,
                locale: input.polishOptions.locale,
              });

              // 创建润色建议（待审核）
              await db
                .insertInto("question_polish_reviews")
                .values({
                  content_hash: question.content_hash,
                  locale: input.polishOptions.locale,
                  proposed_content: result.content,
                  proposed_options: result.options ? (result.options as any) : null,
                  proposed_explanation: result.explanation || null,
                  status: "pending",
                })
                .execute();
              questionResult.operations.push("polish");
            }

            if (operation === "fill_missing") {
              console.log(`[API BatchProcess] [${requestId}] Filling missing content for question ${question.id}`);
              const result = await fillMissingContent({
                content,
                options: options || null,
                explanation: explanation || null,
              });

              // 更新题目内容（如果原内容缺失）
              const needsUpdate = !content || !options || !explanation;
              if (needsUpdate) {
                let updatedContent: any;
                if (typeof question.content === "object" && question.content !== null) {
                  updatedContent = { ...question.content, zh: result.content || content };
                } else {
                  updatedContent = result.content || content;
                }

                await db
                  .updateTable("questions")
                  .set({
                    content: updatedContent,
                    options: result.options ? (result.options as any) : question.options,
                    explanation: result.explanation || question.explanation,
                    updated_at: new Date(),
                  })
                  .where("id", "=", question.id)
                  .execute();
              }
              questionResult.operations.push("fill_missing");
            }

            if (operation === "category_tags") {
              console.log(`[API BatchProcess] [${requestId}] Generating category and tags for question ${question.id}`);
              const result = await generateCategoryAndTags({
                content,
                options: options || null,
                explanation: explanation || null,
              });

              // 更新题目的分类和标签
              await db
                .updateTable("questions")
                .set({
                  category: result.category || undefined,
                  stage_tag: result.stage_tag || undefined,
                  topic_tags: result.topic_tags || undefined,
                  updated_at: new Date(),
                })
                .where("id", "=", question.id)
                .execute();
              questionResult.operations.push("category_tags");
            }
          } catch (opError: any) {
            console.error(
              `[API BatchProcess] [${requestId}] Operation ${operation} failed for question ${question.id}:`,
              opError.message
            );
            if (!input.continueOnError) {
              throw opError;
            }
            questionResult.status = "failed";
            results.errors.push({
              questionId: question.id,
              error: `${operation}: ${opError.message}`,
            });
          }
        }

        results.processed++;
        if (questionResult.status === "success") {
          results.succeeded++;
        } else {
          results.failed++;
        }
        results.details.push(questionResult);

        // 实时更新任务进度
        await db
          .updateTable("batch_process_tasks")
          .set({
            processed_count: results.processed,
            succeeded_count: results.succeeded,
            failed_count: results.failed,
            errors: results.errors as any,
            details: results.details as any,
            updated_at: new Date(),
          })
          .where("task_id", "=", taskId)
          .execute();
      } catch (error: any) {
        console.error(`[API BatchProcess] [${requestId}] Question ${question.id} processing failed:`, error.message);
        results.processed++;
        results.failed++;
        results.errors.push({
          questionId: question.id,
          error: error.message || "Unknown error",
        });
        results.details.push({
          questionId: question.id,
          operations: [],
          status: "failed",
        });

        if (!input.continueOnError) {
          throw error;
        }

        // 更新进度
        await db
          .updateTable("batch_process_tasks")
          .set({
            processed_count: results.processed,
            succeeded_count: results.succeeded,
            failed_count: results.failed,
            errors: results.errors as any,
            details: results.details as any,
            updated_at: new Date(),
          })
          .where("task_id", "=", taskId)
          .execute();
      }
    }
  }

  // 更新任务状态为已完成
  await db
    .updateTable("batch_process_tasks")
    .set({
      status: "completed",
      processed_count: results.processed,
      succeeded_count: results.succeeded,
      failed_count: results.failed,
      errors: results.errors as any,
      details: results.details as any,
      completed_at: new Date(),
      updated_at: new Date(),
    })
    .where("task_id", "=", taskId)
    .execute();

  console.log(`[API BatchProcess] [${requestId}] Batch processing completed for task ${taskId}`);
}

// GET /api/admin/question-processing/batch-process - 查询任务状态
export const GET = withAdminAuth(async (req: Request) => {
  const requestId = `api-batch-process-get-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  try {
    const url = new URL(req.url);
    const taskId = url.searchParams.get("taskId");
    const status = url.searchParams.get("status");
    const limit = Number(url.searchParams.get("limit")) || 50;
    const offset = Number(url.searchParams.get("offset")) || 0;

    // 如果提供了taskId，查询单个任务
    if (taskId) {
      console.log(`[API BatchProcess] [${requestId}] Fetching task: ${taskId}`);
      const task = await db
        .selectFrom("batch_process_tasks")
        .selectAll()
        .where("task_id", "=", taskId)
        .executeTakeFirst();

      if (!task) {
        return notFound("Task not found");
      }

      return success(task);
    }

    // 否则查询所有任务
    console.log(`[API BatchProcess] [${requestId}] Fetching tasks`, { status, limit, offset });
    let query = db
      .selectFrom("batch_process_tasks")
      .selectAll()
      .orderBy("created_at", "desc")
      .limit(limit)
      .offset(offset);

    if (status) {
      query = query.where("status", "=", status as any);
    }

    const tasks = await query.execute();
    const total = await db
      .selectFrom("batch_process_tasks")
      .select(({ fn }) => fn.count<number>("id").as("count"))
      .executeTakeFirst();

    return success({
      tasks,
      total: Number(total?.count || 0),
      limit,
      offset,
    });
  } catch (e: any) {
    console.error(`[API BatchProcess] [${requestId}] Error:`, e?.message, e?.stack);
    return internalError(e?.message || "Failed to fetch batch process tasks");
  }
});
