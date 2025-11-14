// Vercel Serverless Function 配置
export const runtime = "nodejs";
export const maxDuration = 300; // 300秒超时（Vercel Pro计划最多300秒，批量处理需要更长时间）

import { withAdminAuth, getAdminInfo } from "@/app/api/_lib/withAdminAuth";
import { badRequest, internalError, success, conflict, notFound } from "@/app/api/_lib/errors";
import { db } from "@/lib/db";
import { sql } from "kysely";
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
    const body = await req.json().catch(() => ({}));

    const schema = z.object({
      questionIds: z.array(z.number()).optional(),
      operations: z.array(z.enum(["translate", "polish", "fill_missing", "category_tags"])),
      translateOptions: z
        .object({
          from: z.string(),
          to: z.union([z.string(), z.array(z.string())]), // 支持单个语言或语言数组
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
    
    // 获取管理员 token，用于传递给 AI API 调用以跳过配额限制
    let adminToken: string | undefined = undefined;
    try {
      const adminInfo = await getAdminInfo(req as any);
      if (adminInfo) {
        adminToken = adminInfo.token;
      }
    } catch (e) {
      console.warn(`[API BatchProcess] [${requestId}] Failed to get admin token:`, (e as Error).message);
    }

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
      return conflict(
        `Another task is already processing: ${processingTask.task_id}. Please wait for it to complete.`
      );
    }

    // 创建任务记录
    taskId = `task-${Date.now()}-${Math.random().toString(36).substring(7)}`;

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
      explanation: {
        zh: string;
        en?: string;
        ja?: string;
        [key: string]: string | undefined;
      } | string | null; // 支持多语言对象或字符串（向后兼容）
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
    processBatchAsync(requestId, taskId, questions, input, results, adminToken).catch(async (error) => {
      console.error(`[API BatchProcess] [${requestId}] Async batch processing failed:`, error);
      // 如果异步处理失败，更新任务状态为失败
      try {
        await db
          .updateTable("batch_process_tasks")
          .set({
            status: "failed",
            failed_count: results.failed,
            errors: sql`${JSON.stringify(results.errors)}::jsonb`,
            details: sql`${JSON.stringify(results.details)}::jsonb`,
            completed_at: new Date(),
            updated_at: new Date(),
          })
          .where("task_id", "=", taskId)
          .execute();
        console.log(`[API BatchProcess] [${requestId}] Task ${taskId} status updated to failed`);
      } catch (updateError) {
        console.error(`[API BatchProcess] [${requestId}] Failed to update task status to failed:`, updateError);
      }
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
 * 清理错误信息，确保可以安全地存储到 JSONB 字段
 */
function sanitizeError(error: any): string {
  if (!error) return "Unknown error";
  
  let errorMsg = "";
  if (typeof error === "string") {
    errorMsg = error;
  } else if (error?.message) {
    errorMsg = String(error.message);
  } else if (error?.name) {
    errorMsg = String(error.name);
  } else {
    errorMsg = "Unknown error";
  }
  
  // 移除可能导致 JSON 解析错误的特殊字符，限制长度
  errorMsg = errorMsg
    .replace(/[\x00-\x1F\x7F]/g, "") // 移除控制字符
    .replace(/\\/g, "/") // 将反斜杠替换为斜杠
    .substring(0, 500); // 限制长度
  
  return errorMsg;
}

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
    explanation: {
      zh: string;
      en?: string;
      ja?: string;
      [key: string]: string | undefined;
    } | string | null; // 支持多语言对象或字符串（向后兼容）
  }>,
  input: {
    operations: ("translate" | "polish" | "fill_missing" | "category_tags")[];
    translateOptions?: { from: string; to: string | string[] };
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
  },
  adminToken?: string // 管理员 token，用于跳过配额限制
) {
  const batchSize = input.batchSize || 10;
  const totalBatches = Math.ceil(questions.length / batchSize);

  console.log(`[BatchProcess] Task ${taskId} started: ${questions.length} questions, operations: ${input.operations.join(", ")}`);
  
  try {

  // 辅助函数：检查任务是否已被取消，如果已取消则更新状态并返回 true
  let cancelledFlag = false; // 本地标志，避免重复查询
  const checkCancelled = async (): Promise<boolean> => {
    if (cancelledFlag) return true; // 如果已经标记为取消，直接返回
    
    const task = await db
      .selectFrom("batch_process_tasks")
      .select(["status"])
      .where("task_id", "=", taskId)
      .executeTakeFirst();
    
    if (task?.status === "cancelled") {
      cancelledFlag = true;
      return true;
    }
    return false;
  };

  for (let i = 0; i < questions.length; i += batchSize) {
    const batch = questions.slice(i, i + batchSize);
    const currentBatch = Math.floor(i / batchSize) + 1;

    // 检查任务是否已被取消
    if (await checkCancelled()) {
      console.log(`[BatchProcess] Task ${taskId} cancelled at batch ${currentBatch}`);
      return;
    }

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
      // 在处理每个题目前检查任务是否已被取消
      if (await checkCancelled()) {
        console.log(`[BatchProcess] Task ${taskId} cancelled at question ${question.id}`);
        return;
      }
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

        let options = Array.isArray(question.options)
          ? question.options
          : question.options
            ? [String(question.options)]
            : null;
        
        // 处理 explanation 字段：支持多语言对象或字符串（向后兼容）
        let explanation: string | null = null;
        if (question.explanation) {
          if (typeof question.explanation === "string") {
            explanation = question.explanation;
          } else if (typeof question.explanation === "object" && question.explanation !== null) {
            // 多语言对象，优先使用中文
            explanation = question.explanation.zh || null;
          }
        }

        // 执行各种操作（将 translate 放到最后）
        const sortedOperations = [...input.operations].sort((a, b) => {
          if (a === "translate") return 1; // translate 放到最后
          if (b === "translate") return -1;
          return 0;
        });

        for (const operation of sortedOperations) {
          // 在执行每个操作前检查是否已取消
          if (await checkCancelled()) {
            throw new Error("Task has been cancelled");
          }

          try {
            if (operation === "translate" && input.translateOptions) {
              // 支持多语言翻译：to 可以是字符串或字符串数组
              const targetLanguages = Array.isArray(input.translateOptions.to)
                ? input.translateOptions.to
                : [input.translateOptions.to];

              const sourceContent = {
                content,
                options: options || undefined,
                explanation: explanation || undefined,
              };

              // 为每个目标语言执行翻译
              let translateSuccessCount = 0;
              let translateFailureCount = 0;
              for (const targetLang of targetLanguages) {
                // 在每次翻译前检查是否已取消
                if (await checkCancelled()) {
                  throw new Error("Task has been cancelled");
                }

                try {
                  const result = await translateWithPolish({
                    source: sourceContent,
                    from: input.translateOptions!.from,
                    to: targetLang,
                    adminToken,
                  });

                  // 验证翻译结果
                  if (!result.content || result.content.trim().length === 0) {
                    throw new Error("Translation result is empty");
                  }

                  // 保存翻译结果
                  const existing = await db
                    .selectFrom("question_translations")
                    .select(["id"])
                    .where("content_hash", "=", question.content_hash)
                    .where("locale", "=", targetLang)
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
                        locale: targetLang,
                        content: result.content,
                        options: result.options ? (result.options as any) : null,
                        explanation: result.explanation || null,
                        source: "ai",
                      })
                      .execute();
                  }
                  translateSuccessCount++;
                } catch (translateError: any) {
                  translateFailureCount++;
                  const errorMsg = sanitizeError(translateError);
                  console.error(
                    `[BatchProcess] Translation failed: Q${question.id} -> ${targetLang}: ${errorMsg}`
                  );
                  
                  // 记录错误
                  results.errors.push({
                    questionId: question.id,
                    error: `translate(${targetLang}): ${errorMsg}`,
                  });
                  
                  if (!input.continueOnError) {
                    throw translateError;
                  }
                }
              }
              
              // 只有当至少有一个翻译成功时才标记操作成功
              if (translateSuccessCount > 0) {
                questionResult.operations.push("translate");
              }
              
              // 如果所有翻译都失败，标记题目处理失败
              if (translateFailureCount === targetLanguages.length) {
                questionResult.status = "failed";
              }
            }

            if (operation === "polish" && input.polishOptions) {
              const text = {
                content,
                options: options || undefined,
                explanation: explanation || undefined,
              };
              const result = await polishContent({
                text,
                locale: input.polishOptions.locale,
                adminToken,
              });

              // 在批量处理中，如果后续有翻译操作，直接应用润色结果到内存变量
              // 这样翻译操作会使用润色后的内容
              // 同时仍然创建润色建议记录（用于审核和历史记录）
              if (input.operations.includes("translate")) {
                // 更新内存变量，供后续翻译操作使用
                content = result.content;
                if (result.options) {
                  options = result.options;
                }
                if (result.explanation) {
                  explanation = result.explanation;
                }
              }

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
              const result = await fillMissingContent({
                content,
                options: options || null,
                explanation: explanation || null,
                adminToken,
              });

              // 更新题目内容（如果原内容缺失）
              const needsUpdate = !content || !options || !explanation;
              if (needsUpdate) {
                
                // 处理 content：确保始终是有效的 JSONB 对象
                let updatedContent: any;
                const newContentStr = String(result.content || content || "").trim();
                
                if (typeof question.content === "object" && question.content !== null) {
                  // 如果原本是对象，更新 zh 字段
                  if (newContentStr) {
                    updatedContent = { ...question.content, zh: newContentStr };
                  } else {
                    // 如果没有新内容，保持原对象
                    updatedContent = question.content;
                  }
                } else {
                  // 如果原本是字符串（旧格式），转换为 JSONB 对象
                  if (newContentStr) {
                    updatedContent = { zh: newContentStr };
                  } else {
                    // 如果没有新内容，将原字符串转换为 JSONB 对象
                    const oldContentStr = String(question.content || "").trim();
                    if (oldContentStr) {
                      updatedContent = { zh: oldContentStr };
                    } else {
                      // 如果原内容也为空，使用默认值
                      updatedContent = { zh: "" };
                    }
                  }
                }

                // 处理 options：确保始终是有效的 JSONB 数组或 null
                let updatedOptions: any = null;
                if (result.options && Array.isArray(result.options)) {
                  // 确保是有效的数组格式，过滤空值
                  updatedOptions = result.options
                    .filter((opt: any) => opt != null && String(opt).trim().length > 0)
                    .map((opt: any) => String(opt).trim());
                  // 如果数组为空，使用原值或设置为 null
                  if (updatedOptions.length === 0) {
                    if (question.options && Array.isArray(question.options) && question.options.length > 0) {
                      updatedOptions = question.options; // 保持原值
                    } else {
                      updatedOptions = null; // 设置为 null
                    }
                  }
                } else if (question.options) {
                  // 保持原有的 options（确保是数组格式）
                  if (Array.isArray(question.options)) {
                    updatedOptions = question.options;
                  } else {
                    // 如果不是数组，转换为数组或设置为 null
                    updatedOptions = null;
                  }
                }

                // 处理 explanation：确保始终是有效的 JSONB 对象或 null
                let updatedExplanation: any = null;
                if (result.explanation) {
                  // 确保 result.explanation 是字符串，然后构建 JSONB 对象
                  const explanationStr = String(result.explanation).trim();
                  if (explanationStr) {
                    updatedExplanation = { zh: explanationStr };
                  }
                } else if (question.explanation) {
                  // 保持原有的 explanation（可能是多语言对象或字符串）
                  if (typeof question.explanation === "string") {
                    const explanationStr = String(question.explanation).trim();
                    if (explanationStr) {
                      updatedExplanation = { zh: explanationStr };
                    }
                  } else if (typeof question.explanation === "object" && question.explanation !== null) {
                    // 已经是 JSONB 对象，直接使用
                    updatedExplanation = question.explanation;
                  }
                }

                // 验证所有字段都是有效的 JSONB 格式
                try {
                  // 验证 content 是对象
                  if (typeof updatedContent !== "object" || updatedContent === null) {
                    throw new Error(`Invalid content format: expected object, got ${typeof updatedContent}`);
                  }
                  
                  // 验证 options 是数组或 null
                  if (updatedOptions !== null && !Array.isArray(updatedOptions)) {
                    throw new Error(`Invalid options format: expected array or null, got ${typeof updatedOptions}`);
                  }
                  
                  // 验证 explanation 是对象或 null
                  if (updatedExplanation !== null && (typeof updatedExplanation !== "object" || updatedExplanation === null)) {
                    throw new Error(`Invalid explanation format: expected object or null, got ${typeof updatedExplanation}`);
                  }

                  console.log(`[BatchProcess] Updating question Q${question.id} with fill_missing result`, {
                    contentType: typeof updatedContent,
                    contentKeys: Object.keys(updatedContent || {}),
                    optionsType: Array.isArray(updatedOptions) ? "array" : updatedOptions === null ? "null" : typeof updatedOptions,
                    optionsLength: Array.isArray(updatedOptions) ? updatedOptions.length : null,
                    explanationType: updatedExplanation === null ? "null" : typeof updatedExplanation,
                  });

                  await db
                    .updateTable("questions")
                    .set({
                      content: updatedContent,
                      options: updatedOptions,
                      explanation: updatedExplanation,
                      updated_at: new Date(),
                    })
                    .where("id", "=", question.id)
                    .execute();
                } catch (dbError: any) {
                  console.error(`[BatchProcess] Database update failed for Q${question.id}:`, {
                    error: dbError.message,
                    content: JSON.stringify(updatedContent).substring(0, 100),
                    options: JSON.stringify(updatedOptions).substring(0, 100),
                    explanation: JSON.stringify(updatedExplanation).substring(0, 100),
                  });
                  throw dbError;
                }
              }
              questionResult.operations.push("fill_missing");
            }

            if (operation === "category_tags") {
              const result = await generateCategoryAndTags({
                content,
                options: options || null,
                explanation: explanation || null,
                adminToken,
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
            const errorMsg = sanitizeError(opError);
            console.error(`[BatchProcess] Operation ${operation} failed: Q${question.id} - ${errorMsg}`);
            
            if (!input.continueOnError) {
              throw opError;
            }
            
            // 标记题目处理失败，但继续处理其他操作
            questionResult.status = "failed";
            results.errors.push({
              questionId: question.id,
              error: `${operation}: ${errorMsg}`,
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

        // 实时更新任务进度（每10个题目或最后一个题目时输出日志）
        if (results.processed % 10 === 0 || results.processed === results.total) {
          console.log(`[BatchProcess] Progress: ${results.processed}/${results.total} (✓${results.succeeded} ✗${results.failed})`);
        }
        
        await db
          .updateTable("batch_process_tasks")
          .set({
            processed_count: results.processed,
            succeeded_count: results.succeeded,
            failed_count: results.failed,
            errors: sql`${JSON.stringify(results.errors)}::jsonb`,
            details: sql`${JSON.stringify(results.details)}::jsonb`,
            updated_at: new Date(),
          })
          .where("task_id", "=", taskId)
          .execute();
      } catch (error: any) {
        const errorMsg = sanitizeError(error);
        console.error(`[BatchProcess] Question ${question.id} processing failed: ${errorMsg}`);
        results.processed++;
        results.failed++;
        results.errors.push({
          questionId: question.id,
          error: errorMsg,
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
            errors: sql`${JSON.stringify(results.errors)}::jsonb`,
            details: sql`${JSON.stringify(results.details)}::jsonb`,
            updated_at: new Date(),
          })
          .where("task_id", "=", taskId)
          .execute();
      }
    }
  }

  // 最终检查任务是否已被取消（可能在最后一批处理时被取消）
  const finalCheck = await db
    .selectFrom("batch_process_tasks")
    .select(["status"])
    .where("task_id", "=", taskId)
    .executeTakeFirst();

  if (finalCheck?.status === "cancelled") {
    return;
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
  } catch (error: any) {
    console.error(`[BatchProcess] Task ${taskId} failed: ${error.message}`);
    
    // 更新任务状态为失败
    try {
      await db
        .updateTable("batch_process_tasks")
        .set({
          status: "failed",
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
      } catch (updateError) {
      console.error(`[BatchProcess] Failed to update task status:`, updateError);
    }
    
    // 重新抛出错误，让外层的 catch 处理
    throw error;
  }
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

// DELETE /api/admin/question-processing/batch-process - 取消或删除任务
export const DELETE = withAdminAuth(async (req: Request) => {
  const requestId = `api-batch-process-delete-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  try {
    const url = new URL(req.url);
    const taskId = url.searchParams.get("taskId");
    const action = url.searchParams.get("action") || "cancel"; // cancel 或 delete

    if (!taskId) {
      return badRequest("taskId is required");
    }

    // 查询任务当前状态
    const task = await db
      .selectFrom("batch_process_tasks")
      .select(["task_id", "status"])
      .where("task_id", "=", taskId)
      .executeTakeFirst();

    if (!task) {
      return notFound("Task not found");
    }

    if (action === "delete") {
      // 删除任务：只能删除已完成、失败或已取消的任务
      if (task.status === "pending" || task.status === "processing") {
        return badRequest(
          `Task cannot be deleted. Current status: ${task.status}. Please cancel the task first, or wait for it to complete.`
        );
      }

      console.log(`[API BatchProcess] [${requestId}] Deleting task: ${taskId}`);

      await db
        .deleteFrom("batch_process_tasks")
        .where("task_id", "=", taskId)
        .execute();

      console.log(`[API BatchProcess] [${requestId}] Task ${taskId} deleted successfully`);

      return success({
        taskId,
        status: "deleted",
        message: "Task deleted successfully",
      });
    } else {
      // 取消任务：只能取消 pending 或 processing 状态的任务
      if (task.status !== "pending" && task.status !== "processing") {
        return badRequest(
          `Task cannot be cancelled. Current status: ${task.status}. Only pending or processing tasks can be cancelled.`
        );
      }

      console.log(`[API BatchProcess] [${requestId}] Cancelling task: ${taskId}`);

      // 更新任务状态为已取消
      await db
        .updateTable("batch_process_tasks")
        .set({
          status: "cancelled",
          completed_at: new Date(),
          updated_at: new Date(),
        })
        .where("task_id", "=", taskId)
        .execute();

      console.log(`[API BatchProcess] [${requestId}] Task ${taskId} cancelled successfully`);

      return success({
        taskId,
        status: "cancelled",
        message: "Task cancelled successfully",
      });
    }
  } catch (e: any) {
    console.error(`[API BatchProcess] [${requestId}] Error:`, e?.message, e?.stack);
    return internalError(e?.message || "Failed to cancel/delete batch process task");
  }
});
