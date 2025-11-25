// Vercel Serverless Function 配置
export const runtime = "nodejs";
export const maxDuration = 300; // 300秒超时（Vercel Pro计划最多300秒，批量处理需要更长时间）

import { withAdminAuth, getAdminInfo } from "@/app/api/_lib/withAdminAuth";
import { badRequest, internalError, success, conflict, notFound, unauthorized } from "@/app/api/_lib/errors";
import { db } from "@/lib/db";
import { sql } from "kysely";
import { z } from "zod";
import {
  translateWithPolish,
  polishContent,
  generateCategoryAndTags,
  fillMissingContent,
  SubtaskDetail,
} from "../_lib/batchProcessUtils";
import { aiDb } from "@/lib/aiDb";

/**
 * 将服务器端日志追加到任务的 details 字段中
 */
async function appendServerLog(
  taskId: string,
  log: {
    timestamp: string;
    level: 'info' | 'warn' | 'error';
    message: string;
  }
) {
  try {
    // 获取当前任务的 details
    const task = await db
      .selectFrom("batch_process_tasks")
      .select(["details"])
      .where("task_id", "=", taskId)
      .executeTakeFirst();

    if (!task) return;

    const currentDetails = task.details as any;
    let detailsObj: any;
    let serverLogs: any[] = [];
    
    // 处理 details 可能是数组或对象的情况
    if (Array.isArray(currentDetails)) {
      // 如果是数组，转换为对象格式，保留数组内容
      detailsObj = {
        items: currentDetails,
        server_logs: []
      };
      serverLogs = [];
    } else if (currentDetails && typeof currentDetails === 'object') {
      // 如果是对象，保留现有结构
      detailsObj = currentDetails;
      serverLogs = currentDetails.server_logs || [];
    } else {
      // 如果是 null 或 undefined，创建新对象
      detailsObj = { server_logs: [] };
      serverLogs = [];
    }
    
    // 追加新日志（最多保留500条）
    serverLogs.push(log);
    if (serverLogs.length > 500) {
      serverLogs.shift(); // 移除最旧的日志
    }
    
    // 更新 server_logs
    detailsObj.server_logs = serverLogs;

    // 更新数据库
    await db
      .updateTable("batch_process_tasks")
      .set({
        details: sql`${JSON.stringify(detailsObj)}::jsonb`,
        updated_at: new Date(),
      })
      .where("task_id", "=", taskId)
      .execute();
  } catch (error) {
    // 静默失败，不影响主流程
    console.error(`[appendServerLog] Failed to append log for task ${taskId}:`, error);
  }
}

/**
 * 更新 details 字段，保留 server_logs
 */
async function updateDetailsWithServerLogs(
  taskId: string,
  detailsArray: any[]
): Promise<any> {
  try {
    // 获取当前任务的 details
    const task = await db
      .selectFrom("batch_process_tasks")
      .select(["details"])
      .where("task_id", "=", taskId)
      .executeTakeFirst();

    if (!task) {
      // 如果任务不存在，直接返回数组格式的对象
      return { items: detailsArray, server_logs: [] };
    }

    const currentDetails = task.details as any;
    let detailsObj: any;
    
    // 处理 details 可能是数组或对象的情况
    if (Array.isArray(currentDetails)) {
      // 如果是数组，转换为对象格式
      detailsObj = {
        items: detailsArray,
        server_logs: []
      };
    } else if (currentDetails && typeof currentDetails === 'object') {
      // 如果是对象，保留 server_logs，更新 items
      detailsObj = {
        ...currentDetails,
        items: detailsArray
      };
      // 确保 server_logs 存在
      if (!detailsObj.server_logs) {
        detailsObj.server_logs = [];
      }
    } else {
      // 如果是 null 或 undefined，创建新对象
      detailsObj = {
        items: detailsArray,
        server_logs: []
      };
    }
    
    return detailsObj;
  } catch (error) {
    console.error(`[updateDetailsWithServerLogs] Failed to get current details for task ${taskId}:`, error);
    // 如果出错，返回基本格式
    return { items: detailsArray, server_logs: [] };
  }
}

/**
 * 生成任务完成简报（从数据库真实核验）
 */
async function generateTaskSummary(
  taskId: string,
  results: {
    total: number;
    processed: number;
    succeeded: number;
    failed: number;
    errors: Array<{ questionId: number; error: string }>;
    details: Array<{ questionId: number; operations: string[]; status: string }>;
  },
  questions: Array<{ id: number; content_hash: string }>,
  input: {
    operations: ("translate" | "polish" | "fill_missing" | "category_tags")[];
    translateOptions?: { from: string; to: string | string[] };
    polishOptions?: { locale: string };
    batchSize: number;
    continueOnError: boolean;
  }
): Promise<{
  taskOverview: {
    taskId: string;
    operations: string[];
    totalQuestions: number;
    batchSize: number;
    translateOptions?: { from: string; to: string | string[] };
    polishOptions?: { locale: string };
    continueOnError: boolean;
  };
  completionStatus: {
    processed: number;
    succeeded: number;
    failed: number;
    successRate: number;
    verifiedFromDb: {
      actualProcessed: number;
      actualSucceeded: number;
      actualFailed: number;
      matches: boolean;
    };
  };
  operationBreakdown: Record<string, {
    attempted: number;
    succeeded: number;
    failed: number;
  }>;
  errorAnalysis: {
    totalErrors: number;
    uniqueErrorTypes: string[];
    topErrors: Array<{ error: string; count: number }>;
  };
  generatedAt: string;
}> {
  // 从数据库真实核验完成情况
  const taskRecord = await db
    .selectFrom("batch_process_tasks")
    .selectAll()
    .where("task_id", "=", taskId)
    .executeTakeFirst();

  const actualProcessed = taskRecord?.processed_count || 0;
  const actualSucceeded = taskRecord?.succeeded_count || 0;
  const actualFailed = taskRecord?.failed_count || 0;

  // 统计各操作的完成情况
  const operationBreakdown: Record<string, { attempted: number; succeeded: number; failed: number }> = {};
  input.operations.forEach(op => {
    operationBreakdown[op] = { attempted: 0, succeeded: 0, failed: 0 };
  });

  results.details.forEach(detail => {
    detail.operations.forEach(op => {
      if (operationBreakdown[op]) {
        operationBreakdown[op].attempted++;
        if (detail.status === "success") {
          operationBreakdown[op].succeeded++;
        } else {
          operationBreakdown[op].failed++;
        }
      }
    });
  });

  // 错误分析
  const errorTypes = new Map<string, number>();
  results.errors.forEach(err => {
    const errorType = err.error.split(":")[0] || err.error;
    errorTypes.set(errorType, (errorTypes.get(errorType) || 0) + 1);
  });

  const topErrors = Array.from(errorTypes.entries())
    .map(([error, count]) => ({ error, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    taskOverview: {
      taskId,
      operations: input.operations,
      totalQuestions: results.total,
      batchSize: input.batchSize,
      translateOptions: input.translateOptions,
      polishOptions: input.polishOptions,
      continueOnError: input.continueOnError,
    },
    completionStatus: {
      processed: results.processed,
      succeeded: results.succeeded,
      failed: results.failed,
      successRate: results.processed > 0 ? (results.succeeded / results.processed) * 100 : 0,
      verifiedFromDb: {
        actualProcessed,
        actualSucceeded,
        actualFailed,
        matches: actualProcessed === results.processed && 
                 actualSucceeded === results.succeeded && 
                 actualFailed === results.failed,
      },
    },
    operationBreakdown,
    errorAnalysis: {
      totalErrors: results.errors.length,
      uniqueErrorTypes: Array.from(errorTypes.keys()),
      topErrors,
    },
    generatedAt: new Date().toISOString(),
  };
}

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

    // ✅ 强制校验：如果 adminToken 拿不到，直接拒绝请求，不创建任务
    if (!adminToken) {
      console.error(
        `[API BatchProcess] [${requestId}] Admin token missing, abort batch process creation`
      );
      return unauthorized("Admin token is required for batch processing");
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
      type: "single" | "multiple" | "truefalse";
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
        .select(["id", "content_hash", "type", "content", "options", "explanation"])
        .where("id", "in", input.questionIds)
        .execute();
    } else {
      console.log(`[API BatchProcess] [${requestId}] Loading all questions`);
      questions = await db
        .selectFrom("questions")
        .select(["id", "content_hash", "type", "content", "options", "explanation"])
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
    // 注意：在Serverless环境中，需要确保异步任务能够执行
    // 使用立即执行的Promise确保任务开始执行
    console.log(`[API BatchProcess] [${requestId}] Starting async batch processing for task ${taskId}`);
    console.log(`[API BatchProcess] [${requestId}] Questions count: ${questions.length}, Operations: ${input.operations.join(", ")}, BatchSize: ${input.batchSize || 10}`);
    
    // 立即启动异步处理，不等待
    const processingPromise = (async () => {
      try {
        console.log(`[API BatchProcess] [${requestId}] 🔥 About to call processBatchAsync...`);
        // 记录调用日志
        await appendServerLog(taskId, {
          timestamp: new Date().toISOString(),
          level: 'info',
          message: `🔥 About to call processBatchAsync...`,
        });
        
        await processBatchAsync(requestId, taskId, questions, input, results, adminToken);
        console.log(`[API BatchProcess] [${requestId}] ✅ processBatchAsync completed successfully`);
        
        // 记录完成日志
        await appendServerLog(taskId, {
          timestamp: new Date().toISOString(),
          level: 'info',
          message: `✅ processBatchAsync completed successfully`,
        });
      } catch (error: any) {
        console.error(`[API BatchProcess] [${requestId}] ❌ processBatchAsync failed:`, error);
        console.error(`[API BatchProcess] [${requestId}] Error message:`, error?.message);
        console.error(`[API BatchProcess] [${requestId}] Error stack:`, error?.stack);
        throw error; // 重新抛出，让外层的 catch 处理
      }
    })();
    
    console.log(`[API BatchProcess] [${requestId}] Async processing promise created, task will start processing`);
    
    // 在Serverless环境中，确保至少等待一小段时间让任务开始执行
    // 这样可以避免函数在响应返回后立即被终止
    if (process.env.VERCEL) {
      console.log(`[API BatchProcess] [${requestId}] Vercel environment detected, waiting 100ms for task to start`);
      // Vercel环境：等待100ms确保任务开始执行
      processingPromise.catch(async (error) => {
        console.error(`[API BatchProcess] [${requestId}] Async batch processing failed:`, error);
        console.error(`[API BatchProcess] [${requestId}] Error stack:`, error?.stack);
        // 如果异步处理失败，更新任务状态为失败
        try {
          const detailsObj = await updateDetailsWithServerLogs(taskId, results.details);
          await db
            .updateTable("batch_process_tasks")
            .set({
              status: "failed",
              failed_count: results.failed,
              errors: sql`${JSON.stringify(results.errors)}::jsonb`,
              details: sql`${JSON.stringify(detailsObj)}::jsonb`,
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
      
      // 等待一小段时间确保任务开始执行
      await new Promise(resolve => setTimeout(resolve, 100));
      console.log(`[API BatchProcess] [${requestId}] Wait completed, returning response`);
    } else {
      // 本地环境：正常处理
      console.log(`[API BatchProcess] [${requestId}] Local environment, async processing started`);
      // 在本地环境也等待一小段时间，确保异步函数开始执行
      await new Promise(resolve => setTimeout(resolve, 200));
      console.log(`[API BatchProcess] [${requestId}] Wait completed in local environment, returning response`);
      processingPromise.catch(async (error) => {
        console.error(`[API BatchProcess] [${requestId}] Async batch processing failed:`, error);
        console.error(`[API BatchProcess] [${requestId}] Error stack:`, error?.stack);
        // 如果异步处理失败，更新任务状态为失败
        try {
          const detailsObj = await updateDetailsWithServerLogs(taskId, results.details);
          await db
            .updateTable("batch_process_tasks")
            .set({
              status: "failed",
              failed_count: results.failed,
              errors: sql`${JSON.stringify(results.errors)}::jsonb`,
              details: sql`${JSON.stringify(detailsObj)}::jsonb`,
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
    }

    // 立即返回任务ID，不等待处理完成
    // 注意：返回 taskId 和 task_id 两个字段以兼容不同的前端代码
    return success({
      taskId,
      task_id: taskId, // 兼容字段
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
  // 注意：不要移除引号，因为 JSON.stringify 会自动转义
  errorMsg = errorMsg
    .replace(/[\x00-\x1F\x7F]/g, "") // 移除控制字符
    .replace(/\r\n/g, " ") // 将换行符替换为空格
    .replace(/\n/g, " ") // 将换行符替换为空格
    .replace(/\r/g, " ") // 将回车符替换为空格
    .replace(/\t/g, " ") // 将制表符替换为空格
    .replace(/\s+/g, " ") // 将多个空格替换为单个空格
    .trim()
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
    type: "single" | "multiple" | "truefalse";
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
  // 立即记录函数被调用
  const startTime = new Date().toISOString();
  console.log(`[BatchProcess] [${requestId}] 🔥 processBatchAsync FUNCTION CALLED for task ${taskId}`);
  console.log(`[BatchProcess] [${requestId}] Function execution started at: ${startTime}`);
  
  // 将日志写入数据库
  await appendServerLog(taskId, {
    timestamp: startTime,
    level: 'info',
    message: `🔥 processBatchAsync FUNCTION CALLED for task ${taskId}`,
  });
  
  const batchSize = input.batchSize || 10;
  const totalBatches = Math.ceil(questions.length / batchSize);

  // ✅ Provider 配额耗尽标志位：用于优雅停止整批任务
  let providerQuotaExceeded = false;

  console.log(`[BatchProcess] [${requestId}] ========== Task ${taskId} STARTED ==========`);
  console.log(`[BatchProcess] [${requestId}] Questions: ${questions.length}, Operations: ${input.operations.join(", ")}, BatchSize: ${batchSize}, TotalBatches: ${totalBatches}`);
  console.log(`[BatchProcess] [${requestId}] Task ID: ${taskId}, Request ID: ${requestId}`);
  
  // 将启动日志写入数据库
  await appendServerLog(taskId, {
    timestamp: new Date().toISOString(),
    level: 'info',
    message: `========== Task ${taskId} STARTED ========== | Questions: ${questions.length}, Operations: ${input.operations.join(", ")}, BatchSize: ${batchSize}, TotalBatches: ${totalBatches}`,
  });
  
  // 立即更新数据库状态，确保任务已经开始执行（在Serverless环境中很重要）
  try {
    console.log(`[BatchProcess] [${requestId}] Updating task status to 'processing'...`);
    await appendServerLog(taskId, {
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `Updating task status to 'processing'...`,
    });
    
    const updateResult = await db
      .updateTable("batch_process_tasks")
      .set({
        status: "processing",
        total_questions: questions.length,
        updated_at: new Date(),
      })
      .where("task_id", "=", taskId)
      .execute();
    console.log(`[BatchProcess] [${requestId}] ✅ Task ${taskId} status updated to 'processing', total_questions set to ${questions.length}`);
    console.log(`[BatchProcess] [${requestId}] Update result:`, updateResult);
    
    await appendServerLog(taskId, {
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `✅ Task status updated to 'processing', total_questions set to ${questions.length}`,
    });
  } catch (updateError: any) {
    console.error(`[BatchProcess] [${requestId}] ❌ Failed to update task status at start:`, updateError?.message);
    console.error(`[BatchProcess] [${requestId}] Error stack:`, updateError?.stack);
    
    await appendServerLog(taskId, {
      timestamp: new Date().toISOString(),
      level: 'error',
      message: `❌ Failed to update task status at start: ${updateError?.message}`,
    });
    // 不抛出错误，继续执行
  }
  
  // 辅助函数：获取场景配置
  const getSceneConfig = async (sceneKey: string, locale: string = "zh"): Promise<{
    prompt: string;
    outputFormat: string | null;
    sceneName: string;
  } | null> => {
    try {
      const sceneConfig = await (aiDb as any)
        .selectFrom("ai_scene_config")
        .selectAll()
        .where("scene_key", "=", sceneKey)
        .where("enabled", "=", true)
        .executeTakeFirst();

      if (!sceneConfig) {
        return null;
      }

      // 强制只使用中文 prompt（忽略 locale 参数）
      // 原因：批量任务处理时，数据库中可能只有中文 prompt，其他语言的 prompt 可能不存在
      // 为了避免 scene_not_found 错误，统一使用中文 prompt
      let prompt = sceneConfig.system_prompt_zh;
      
      // 如果中文 prompt 不存在或为空，记录警告
      if (!prompt || prompt.trim() === "") {
        console.warn(`[getSceneConfig] 中文 prompt 不存在或为空，使用空字符串:`, { sceneKey, locale });
        prompt = "";
      }
      
      console.log(`[getSceneConfig] 使用中文 prompt (locale: ${locale}, 强制使用中文)`);

      return {
        prompt: prompt || "",
        outputFormat: sceneConfig.output_format || null,
        sceneName: sceneConfig.scene_name || sceneKey,
      };
    } catch (error) {
      console.error(`[getSceneConfig] Failed to get scene config for ${sceneKey}:`, error);
      return null;
    }
  };

  // 辅助函数：从AI日志中获取最近的回答
  const getLatestAiAnswer = async (questionText: string, scene: string, limit: number = 1): Promise<string | null> => {
    try {
      const logs = await (aiDb as any)
        .selectFrom("ai_logs")
        .select(["answer"])
        .where("question", "=", questionText.substring(0, 500)) // 只匹配前500个字符
        .where("from", "=", "batch_process") // 假设批量处理会设置这个字段
        .orderBy("created_at", "desc")
        .limit(limit)
        .execute();

      return logs.length > 0 ? logs[0].answer : null;
    } catch (error) {
      console.error(`[getLatestAiAnswer] Failed to get AI answer:`, error);
      return null;
    }
  };
  
  // 确保在Serverless环境中任务能够开始执行
  // 立即执行一个数据库操作，确保函数不会在响应返回后立即被终止
  try {
    // 验证数据库连接
    console.log(`[BatchProcess] [${requestId}] Verifying database connection...`);
    const taskRecord = await db
      .selectFrom("batch_process_tasks")
      .select(["task_id", "status", "total_questions", "processed_count"])
      .where("task_id", "=", taskId)
      .executeTakeFirst();
    console.log(`[BatchProcess] [${requestId}] ✅ Database connection verified`);
    console.log(`[BatchProcess] [${requestId}] Current task record:`, {
      task_id: taskRecord?.task_id,
      status: taskRecord?.status,
      total_questions: taskRecord?.total_questions,
      processed_count: taskRecord?.processed_count,
    });
    
    await appendServerLog(taskId, {
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `✅ Database connection verified | Status: ${taskRecord?.status}, Total: ${taskRecord?.total_questions}, Processed: ${taskRecord?.processed_count}`,
    });
  } catch (dbError: any) {
    console.error(`[BatchProcess] [${requestId}] ❌ Database connection failed:`, dbError?.message);
    console.error(`[BatchProcess] [${requestId}] Error stack:`, dbError?.stack);
    
    await appendServerLog(taskId, {
      timestamp: new Date().toISOString(),
      level: 'error',
      message: `❌ Database connection failed: ${dbError?.message}`,
    });
    throw new Error(`Database connection failed: ${dbError?.message}`);
  }

  try {
    console.log(`[BatchProcess] [${requestId}] Starting batch processing loop...`);
    await appendServerLog(taskId, {
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `Starting batch processing loop...`,
    });

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

  console.log(`[BatchProcess] [${requestId}] Starting to process ${questions.length} questions in ${totalBatches} batches`);
  
  for (let i = 0; i < questions.length; i += batchSize) {
    const batch = questions.slice(i, i + batchSize);
    const currentBatch = Math.floor(i / batchSize) + 1;
    
    console.log(`[BatchProcess] [${requestId}] ========== Batch ${currentBatch}/${totalBatches} ==========`);
    console.log(`[BatchProcess] [${requestId}] Processing batch ${currentBatch} with ${batch.length} questions`);

    // 检查任务是否已被取消
    if (await checkCancelled()) {
      console.log(`[BatchProcess] [${requestId}] ❌ Task ${taskId} cancelled at batch ${currentBatch}`);
      return;
    }

    // ✅ 检查 Provider 配额是否已耗尽
    if (providerQuotaExceeded) {
      console.log(
        `[BatchProcess] [${requestId}] Provider quota already exceeded, stop processing further batches`
      );
      break;
    }

    // 更新当前批次
    try {
      console.log(`[BatchProcess] [${requestId}] Updating task current_batch to ${currentBatch}...`);
      await db
        .updateTable("batch_process_tasks")
        .set({
          current_batch: currentBatch,
          updated_at: new Date(),
        })
        .where("task_id", "=", taskId)
        .execute();
      console.log(`[BatchProcess] [${requestId}] ✅ Task current_batch updated to ${currentBatch}`);
    } catch (updateError: any) {
      console.error(`[BatchProcess] [${requestId}] ❌ Failed to update current_batch:`, updateError?.message);
    }

    for (const question of batch) {
      console.log(`[BatchProcess] [${requestId}] --- Processing question ${question.id} ---`);
      // 在处理每个题目前检查任务是否已被取消
      if (await checkCancelled()) {
        console.log(`[BatchProcess] Task ${taskId} cancelled at question ${question.id}`);
        return;
      }

      // ✅ 检查 Provider 配额是否已耗尽
      if (providerQuotaExceeded) {
        console.log(
          `[BatchProcess] [${requestId}] Provider quota already exceeded, stop processing further questions`
        );
        break;
      }
      const questionResult = {
        questionId: question.id,
        operations: [] as string[],
        status: "success" as "success" | "failed",
        subtasks: [] as SubtaskDetail[], // 子任务详细信息
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
        // 注意：需要在每次操作前重新获取最新的 explanation，因为 fill_missing 可能会更新它
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

          // 记录操作开始日志
          const operationName = operation === 'translate' ? '翻译' :
                               operation === 'polish' ? '润色' :
                               operation === 'fill_missing' ? '填漏' :
                               operation === 'category_tags' ? '分类标签' :
                               operation;
          
          console.log(`[BatchProcess] [${requestId}] 正在进行题目ID ${question.id} 的${operationName}任务`);

          // 在执行每个操作前，重新从数据库获取最新的 explanation（如果 fill_missing 已经更新了它）
          const currentQuestion = await db
            .selectFrom("questions")
            .select(["explanation"])
            .where("id", "=", question.id)
            .executeTakeFirst();
          
          if (currentQuestion?.explanation) {
            if (typeof currentQuestion.explanation === "string") {
              explanation = currentQuestion.explanation;
            } else if (typeof currentQuestion.explanation === "object" && currentQuestion.explanation !== null) {
              explanation = currentQuestion.explanation.zh || explanation;
            }
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
                  // 在每次翻译前，重新从数据库获取最新的 explanation（确保获取到之前翻译的explanation）
                  const currentQuestionBeforeTranslate = await db
                    .selectFrom("questions")
                    .select(["content", "explanation"])
                    .where("id", "=", question.id)
                    .executeTakeFirst();

                  if (!currentQuestionBeforeTranslate) {
                    throw new Error("Question not found");
                  }

                  // 更新 sourceContent 中的 explanation，使用最新的多语言 explanation 对象
                  let currentExplanation: string | null = null;
                  if (currentQuestionBeforeTranslate.explanation) {
                    if (typeof currentQuestionBeforeTranslate.explanation === "string") {
                      currentExplanation = currentQuestionBeforeTranslate.explanation;
                    } else if (typeof currentQuestionBeforeTranslate.explanation === "object" && currentQuestionBeforeTranslate.explanation !== null) {
                      // 优先使用源语言（from）的explanation，如果没有则使用中文
                      const fromLang = input.translateOptions!.from;
                      currentExplanation = (currentQuestionBeforeTranslate.explanation as any)[fromLang] 
                        || currentQuestionBeforeTranslate.explanation.zh 
                        || null;
                    }
                  }

                  // 更新 sourceContent，使用最新的 explanation
                  const sourceContentWithLatestExplanation = {
                    ...sourceContent,
                    explanation: currentExplanation || undefined,
                  };

                  // 构建问题文本
                  const questionText = [
                    `Content: ${sourceContentWithLatestExplanation.content}`,
                    sourceContentWithLatestExplanation.options && sourceContentWithLatestExplanation.options.length ? `Options:\n- ${sourceContentWithLatestExplanation.options.join("\n- ")}` : ``,
                    sourceContentWithLatestExplanation.explanation ? `Explanation: ${sourceContentWithLatestExplanation.explanation}` : ``,
                  ]
                    .filter(Boolean)
                    .join("\n");

                  // 获取场景配置
                  const sceneKey = "question_translation";
                  const sceneConfig = await getSceneConfig(sceneKey, targetLang);

                  // 调用翻译函数（带详细信息）
                  const translateResult = await translateWithPolish({
                    source: sourceContentWithLatestExplanation,
                    from: input.translateOptions!.from,
                    to: targetLang,
                    questionType: question.type, // 传递题目类型（single/multiple/truefalse）
                    adminToken,
                    returnDetail: true,
                    mode: "batch", // ✅ 批量处理模式
                  });

                  // 处理返回结果（可能是结果对象或包含详细信息的对象）
                  let result: any;
                  let detail: SubtaskDetail | null = null;

                  if (translateResult && typeof translateResult === 'object' && 'result' in translateResult && 'detail' in translateResult) {
                    // 返回了详细信息
                    result = (translateResult as any).result;
                    detail = (translateResult as any).detail;
                  } else {
                    // 只返回了结果
                    result = translateResult;
                    // 创建详细信息
                    detail = {
                      operation: "translate",
                      scene: sceneKey,
                      sceneName: sceneConfig?.sceneName || sceneKey,
                      prompt: sceneConfig?.prompt || "",
                      expectedFormat: sceneConfig?.outputFormat || null,
                      question: questionText,
                      answer: "", // 无法获取，留空
                      status: "success",
                      timestamp: new Date().toISOString(),
                    };
                  }

                  // 记录子任务详细信息
                  if (detail) {
                    questionResult.subtasks.push(detail);
                  }

                  // 验证翻译结果
                  if (!result.content || result.content.trim().length === 0) {
                    throw new Error("Translation result is empty");
                  }

                  // 更新 content JSONB 对象，添加目标语言
                  let updatedContent: any;
                  if (typeof currentQuestionBeforeTranslate.content === "object" && currentQuestionBeforeTranslate.content !== null) {
                    updatedContent = { ...currentQuestionBeforeTranslate.content, [targetLang]: result.content };
                  } else if (typeof currentQuestionBeforeTranslate.content === "string") {
                    // 如果原本是字符串，转换为 JSONB 对象
                    updatedContent = { zh: currentQuestionBeforeTranslate.content, [targetLang]: result.content };
                  } else {
                    // 如果 content 为空或 null，直接创建新的 JSONB 对象
                    updatedContent = { [targetLang]: result.content };
                  }

                  // 更新 explanation JSONB 对象，添加目标语言
                  // 重要：必须合并所有已翻译的语言，不能覆盖
                  let updatedExplanation: any = null;
                  if (result.explanation) {
                    const explanationStr = typeof result.explanation === "string" 
                      ? result.explanation 
                      : String(result.explanation);
                    
                    if (currentQuestionBeforeTranslate.explanation && typeof currentQuestionBeforeTranslate.explanation === "object" && currentQuestionBeforeTranslate.explanation !== null) {
                      // 合并现有的多语言 explanation，添加新的目标语言
                      updatedExplanation = { ...currentQuestionBeforeTranslate.explanation, [targetLang]: explanationStr };
                    } else if (typeof currentQuestionBeforeTranslate.explanation === "string") {
                      // 如果原本是字符串，转换为 JSONB 对象并添加目标语言
                      updatedExplanation = { zh: currentQuestionBeforeTranslate.explanation, [targetLang]: explanationStr };
                    } else {
                      // 如果原本没有 explanation，创建新的 JSONB 对象
                      updatedExplanation = { [targetLang]: explanationStr };
                    }
                  } else if (currentQuestionBeforeTranslate.explanation) {
                    // 如果翻译结果没有 explanation，保留原有的 explanation
                    updatedExplanation = currentQuestionBeforeTranslate.explanation;
                  }

                  // 更新 options（如果需要支持多语言选项，可以类似处理）
                  // 目前 options 是共享的，不需要按语言区分

                  // 更新题目
                  await db
                    .updateTable("questions")
                    .set({
                      content: updatedContent as any,
                      explanation: updatedExplanation as any,
                      updated_at: new Date(),
                    })
                    .where("id", "=", question.id)
                    .execute();
                  
                  translateSuccessCount++;
                } catch (translateError: any) {
                  translateFailureCount++;
                  const errorMsg = sanitizeError(translateError) || "";
                  const msg = String(translateError?.message || "");

                  // ✅ 统一的配额耗尽处理（在所有批量操作的 catch 块最前面）
                  if (msg === "BATCH_PROVIDER_QUOTA_EXCEEDED") {
                    providerQuotaExceeded = true;

                    // ✅ 添加标准错误结构，方便前端 UI 展示
                    // 从错误对象中提取 provider 和 date 信息（如果可用）
                    const provider = (translateError as any)?.provider || "unknown";
                    const quotaDate = (translateError as any)?.date || new Date().toISOString().slice(0, 10);
                    
                    results.errors.push({
                      type: "provider_quota_exceeded",
                      provider: provider,
                      date: quotaDate,
                      message: "AI provider daily quota exceeded",
                      questionId: question.id,
                      error: "AI provider quota exceeded for today",
                    });

                    await db
                      .updateTable("batch_process_tasks")
                      .set({
                        status: "failed",
                        errors: sql`${JSON.stringify(results.errors)}::jsonb`,
                        updated_at: new Date(),
                      })
                      .where("task_id", "=", taskId)
                      .execute();

                    await appendServerLog(taskId, {
                      timestamp: new Date().toISOString(),
                      level: "error",
                      message: "🚨 Provider quota exceeded — batch terminated early",
                    });

                    // 向上抛出，不再继续其他题目
                    throw new Error("BATCH_PROVIDER_QUOTA_EXCEEDED");
                  }

                  console.error(
                    `[BatchProcess] [${requestId}] Translation failed: Q${question.id} -> ${targetLang}: ${errorMsg}`
                  );

                  // 记录服务器日志
                  await appendServerLog(taskId, {
                    timestamp: new Date().toISOString(),
                    level: 'error',
                    message: `❌ Translation failed: Q${question.id} -> ${targetLang}: ${errorMsg}`,
                  });

                  // 其他普通错误：按原逻辑处理
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
              const polishResult = await polishContent({
                text,
                locale: input.polishOptions.locale,
                questionType: question.type, // 传递题目类型
                adminToken,
                returnDetail: true,
                mode: "batch", // ✅ 批量处理模式
              });

              // 处理返回结果（可能是结果对象或包含详细信息的对象）
              let result: any;
              let detail: SubtaskDetail | null = null;

              if (polishResult && typeof polishResult === 'object' && 'result' in polishResult && 'detail' in polishResult) {
                result = (polishResult as any).result;
                detail = (polishResult as any).detail;
              } else {
                result = polishResult;
              }

              // 记录子任务详细信息
              if (detail) {
                questionResult.subtasks.push(detail);
                
                // 记录详细日志
                const aiProviderName = detail.aiProvider || 'unknown';
                const modelName = detail.model || 'unknown';
                console.log(`[BatchProcess] [${requestId}] 题目ID ${question.id} - 发起AI(${aiProviderName})请求: ${detail.question.substring(0, 100)}${detail.question.length > 100 ? '...' : ''}`);
                console.log(`[BatchProcess] [${requestId}] 题目ID ${question.id} - 获得AI回复(${aiProviderName}): ${detail.answer.substring(0, 200)}${detail.answer.length > 200 ? '...' : ''}`);
              }

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
              // 确保 options 是有效的 JSONB 格式
              const proposedOptionsJson = result.options && Array.isArray(result.options) && result.options.length > 0
                ? sql`${JSON.stringify(result.options)}::jsonb`
                : sql`null::jsonb`;
              
              await db
                .insertInto("question_polish_reviews")
                .values({
                  content_hash: question.content_hash,
                  locale: input.polishOptions.locale,
                  proposed_content: result.content,
                  proposed_options: proposedOptionsJson,
                  proposed_explanation: result.explanation || null,
                  status: "pending",
                })
                .execute();
              questionResult.operations.push("polish");
            }

            if (operation === "fill_missing") {
              const fillResult = await fillMissingContent({
                content,
                options: options || null,
                explanation: explanation || null,
                questionType: question.type, // 传递题目类型
                adminToken,
                returnDetail: true,
                mode: "batch", // ✅ 批量处理模式
              });

              // 处理返回结果（可能是结果对象或包含详细信息的对象）
              let result: any;
              let detail: SubtaskDetail | null = null;

              if (fillResult && typeof fillResult === 'object' && 'result' in fillResult && 'detail' in fillResult) {
                result = (fillResult as any).result;
                detail = (fillResult as any).detail;
              } else {
                result = fillResult;
              }

              // 记录子任务详细信息
              if (detail) {
                questionResult.subtasks.push(detail);
                
                // 记录详细日志
                const aiProviderName = detail.aiProvider || 'unknown';
                const modelName = detail.model || 'unknown';
                console.log(`[BatchProcess] [${requestId}] 题目ID ${question.id} - 发起AI(${aiProviderName})请求: ${detail.question.substring(0, 100)}${detail.question.length > 100 ? '...' : ''}`);
                console.log(`[BatchProcess] [${requestId}] 题目ID ${question.id} - 获得AI回复(${aiProviderName}): ${detail.answer.substring(0, 200)}${detail.answer.length > 200 ? '...' : ''}`);
              }

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
                // 如果是是非题，options 应该为 null
                if (question.type === "truefalse") {
                  updatedOptions = null;
                } else if (result.options && Array.isArray(result.options)) {
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

                  // 使用 sql 模板确保 JSONB 字段正确序列化
                  // 直接使用 JSON.stringify，Kysely 会正确处理参数化查询
                  await db
                    .updateTable("questions")
                    .set({
                      content: sql`${JSON.stringify(updatedContent)}::jsonb`,
                      options: updatedOptions !== null 
                        ? sql`${JSON.stringify(updatedOptions)}::jsonb` 
                        : sql`null::jsonb`,
                      explanation: updatedExplanation !== null 
                        ? sql`${JSON.stringify(updatedExplanation)}::jsonb` 
                        : sql`null::jsonb`,
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
              const categoryResult = await generateCategoryAndTags({
                content,
                options: options || null,
                explanation: explanation || null,
                adminToken,
                returnDetail: true,
                mode: "batch", // ✅ 批量处理模式
              });

              // 处理返回结果（可能是结果对象或包含详细信息的对象）
              let result: any;
              let detail: SubtaskDetail | null = null;

              if (categoryResult && typeof categoryResult === 'object' && 'result' in categoryResult && 'detail' in categoryResult) {
                result = (categoryResult as any).result;
                detail = (categoryResult as any).detail;
              } else {
                result = categoryResult;
              }

              // 记录子任务详细信息
              if (detail) {
                questionResult.subtasks.push(detail);
                
                // 记录详细日志
                const aiProviderName = detail.aiProvider || 'unknown';
                const modelName = detail.model || 'unknown';
                console.log(`[BatchProcess] [${requestId}] 题目ID ${question.id} - 发起AI(${aiProviderName})请求: ${detail.question.substring(0, 100)}${detail.question.length > 100 ? '...' : ''}`);
                console.log(`[BatchProcess] [${requestId}] 题目ID ${question.id} - 获得AI回复(${aiProviderName}): ${detail.answer.substring(0, 200)}${detail.answer.length > 200 ? '...' : ''}`);
              }

              console.log(`[BatchProcess] Category and tags result for Q${question.id}:`, {
                category: result.category,
                stage_tag: result.stage_tag,
                topic_tags: result.topic_tags,
              });

              // 更新题目的分类和标签（只更新非空值）
              const updates: any = {
                updated_at: new Date(),
              };
              
              // 更新 license_type_tag（新字段，JSONB 数组类型）
              // 根据文档和数据库实际类型，license_type_tag 是 JSONB 格式，存储数组
              if (result.license_type_tag && Array.isArray(result.license_type_tag) && result.license_type_tag.length > 0) {
                // 使用 JSON.stringify 将数组转换为 JSONB 格式
                updates.license_type_tag = sql`${JSON.stringify(result.license_type_tag)}::jsonb`;
              }
              // 更新 stage_tag
              if (result.stage_tag) {
                updates.stage_tag = result.stage_tag;
              }
              // 更新 topic_tags（TEXT[] 数组类型）
              // 根据文档和迁移文件，topic_tags 是 TEXT[] 类型
              if (result.topic_tags && Array.isArray(result.topic_tags) && result.topic_tags.length > 0) {
                // 使用 ARRAY 构造函数将数组转换为 PostgreSQL TEXT[] 格式
                const tags = result.topic_tags.map(tag => sql.literal(tag));
                updates.topic_tags = sql`ARRAY[${sql.join(tags, sql`, `)}]::text[]`;
              }
              // 不再更新 category（category 是卷类，不是标签）
              // 不再更新 license_types（使用 license_type_tag 替代）

              try {
                await db
                  .updateTable("questions")
                  .set(updates)
                  .where("id", "=", question.id)
                  .execute();
              } catch (dbError: any) {
                console.error(`[BatchProcess] Database update failed for Q${question.id}:`, {
                  error: dbError.message,
                  errorCode: dbError.code,
                  license_type_tag: result.license_type_tag,
                  stage_tag: result.stage_tag,
                  topic_tags: result.topic_tags,
                  updatesKeys: Object.keys(updates),
                });
                throw dbError;
              }
                
              console.log(`[BatchProcess] Updated category and tags for Q${question.id}`);
              questionResult.operations.push("category_tags");
            }
          } catch (opError: any) {
            const errorMsg = sanitizeError(opError);
            const msg = String(opError?.message || "");

            // ✅ 统一的配额耗尽处理（在所有批量操作的 catch 块最前面）
            if (msg === "BATCH_PROVIDER_QUOTA_EXCEEDED") {
              providerQuotaExceeded = true;

              // ✅ 添加标准错误结构，方便前端 UI 展示
              // 从错误对象中提取 provider 和 date 信息（如果可用）
              const provider = (opError as any)?.provider || "unknown";
              const quotaDate = (opError as any)?.date || new Date().toISOString().slice(0, 10);
              
              results.errors.push({
                type: "provider_quota_exceeded",
                provider: provider,
                date: quotaDate,
                message: "AI provider daily quota exceeded",
                questionId: question.id,
                error: "AI provider quota exceeded for today",
              });

              await db
                .updateTable("batch_process_tasks")
                .set({
                  status: "failed",
                  errors: sql`${JSON.stringify(results.errors)}::jsonb`,
                  updated_at: new Date(),
                })
                .where("task_id", "=", taskId)
                .execute();

              await appendServerLog(taskId, {
                timestamp: new Date().toISOString(),
                level: "error",
                message: "🚨 Provider quota exceeded — batch terminated early",
              });

              // 向上抛出，不再继续其他题目
              throw new Error("BATCH_PROVIDER_QUOTA_EXCEEDED");
            }

            console.error(`[BatchProcess] [${requestId}] Operation ${operation} failed: Q${question.id} - ${errorMsg}`);
            
            // 记录服务器日志
            await appendServerLog(taskId, {
              timestamp: new Date().toISOString(),
              level: 'error',
              message: `❌ Operation ${operation} failed: Q${question.id} - ${errorMsg}`,
            });
            
            if (!input.continueOnError) {
              throw opError;
            }
            
            // 标记题目处理失败，但继续处理其他操作
            questionResult.status = "failed";
            results.errors.push({
              questionId: question.id,
              error: `${operation}: ${errorMsg}`,
            });
            
            // 记录操作失败日志
            console.log(`[BatchProcess] [${requestId}] ⚠️ Operation ${operation} failed for Q${question.id}, continuing with next operation (continueOnError=true)`);
          }
        }

        results.processed++;
        if (questionResult.status === "success") {
          results.succeeded++;
        } else {
          results.failed++;
        }
        results.details.push(questionResult);

        console.log(`[BatchProcess] [${requestId}] ✅ Question ${question.id} processed: ${questionResult.status}, Operations: ${questionResult.operations.join(", ") || "none"}`);
        console.log(`[BatchProcess] [${requestId}] Current progress: ${results.processed}/${results.total} (✓${results.succeeded} ✗${results.failed})`);

        // 实时更新任务进度（每10个题目或最后一个题目时输出日志）
        if (results.processed % 10 === 0 || results.processed === results.total) {
          console.log(`[BatchProcess] [${requestId}] 📊 Progress update: ${results.processed}/${results.total} (✓${results.succeeded} ✗${results.failed})`);
        }
        
        // 更新任务进度（使用try-catch确保即使失败也能继续）
        // 每次题目处理完成后都更新，确保前端能看到最新进度
        try {
          console.log(`[BatchProcess] [${requestId}] 📝 Updating task progress in database for Q${question.id}...`);
          const detailsObj = await updateDetailsWithServerLogs(taskId, results.details);
          const updateResult = await db
            .updateTable("batch_process_tasks")
            .set({
              processed_count: results.processed,
              succeeded_count: results.succeeded,
              failed_count: results.failed,
              errors: sql`${JSON.stringify(results.errors)}::jsonb`,
              details: sql`${JSON.stringify(detailsObj)}::jsonb`,
              updated_at: new Date(),
            })
            .where("task_id", "=", taskId)
            .execute();
          console.log(`[BatchProcess] [${requestId}] ✅ Task progress updated in DB: processed=${results.processed}/${results.total}, succeeded=${results.succeeded}, failed=${results.failed}`);
          
          // 记录服务器日志
          await appendServerLog(taskId, {
            timestamp: new Date().toISOString(),
            level: 'info',
            message: `📊 Progress: ${results.processed}/${results.total} (✓${results.succeeded} ✗${results.failed}) - Q${question.id} ${questionResult.status}`,
          });
        } catch (updateError: any) {
          console.error(`[BatchProcess] [${requestId}] ❌ Failed to update task progress for Q${question.id}:`, updateError?.message);
          console.error(`[BatchProcess] [${requestId}] Error stack:`, updateError?.stack);
          
          // 记录服务器日志
          await appendServerLog(taskId, {
            timestamp: new Date().toISOString(),
            level: 'error',
            message: `❌ Failed to update task progress for Q${question.id}: ${updateError?.message}`,
          });
          // 不抛出错误，继续处理下一个题目
        }
      } catch (error: any) {
        const errorMsg = sanitizeError(error);
        console.error(`[BatchProcess] [${requestId}] ❌ Question ${question.id} processing failed: ${errorMsg}`);
        console.error(`[BatchProcess] [${requestId}] Error stack:`, error?.stack);
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

        // 更新进度（使用try-catch确保即使失败也能继续）
        try {
          const detailsObj = await updateDetailsWithServerLogs(taskId, results.details);
          await db
            .updateTable("batch_process_tasks")
            .set({
              processed_count: results.processed,
              succeeded_count: results.succeeded,
              failed_count: results.failed,
              errors: sql`${JSON.stringify(results.errors)}::jsonb`,
              details: sql`${JSON.stringify(detailsObj)}::jsonb`,
              updated_at: new Date(),
            })
            .where("task_id", "=", taskId)
            .execute();
        } catch (updateError: any) {
          console.error(`[BatchProcess] Failed to update task progress after error for Q${question.id}:`, updateError?.message);
          // 不抛出错误，继续处理下一个题目
        }
      }
    }
  }

  console.log(`[BatchProcess] [${requestId}] ========== All batches processed ==========`);
  console.log(`[BatchProcess] [${requestId}] Final results: processed=${results.processed}, succeeded=${results.succeeded}, failed=${results.failed}`);
  
  // 最终检查任务是否已被取消（可能在最后一批处理时被取消）
  console.log(`[BatchProcess] [${requestId}] Checking if task was cancelled...`);
  const finalCheck = await db
    .selectFrom("batch_process_tasks")
    .select(["status"])
    .where("task_id", "=", taskId)
    .executeTakeFirst();

  if (finalCheck?.status === "cancelled") {
    console.log(`[BatchProcess] [${requestId}] ❌ Task ${taskId} was cancelled, stopping`);
    return;
  }

  console.log(`[BatchProcess] [${requestId}] ✅ Task not cancelled, generating summary...`);
    // 生成任务完成简报（从数据库真实核验）
    const summary = await generateTaskSummary(taskId, results, questions, input);
    console.log(`[BatchProcess] [${requestId}] Summary generated`);
    
    // 更新任务状态为已完成
    // 根据处理结果决定最终状态：如果有失败的题目，标记为部分成功；如果全部成功，标记为完成
    const finalStatus = results.failed > 0 ? "completed" : "completed"; // 即使有失败，也标记为完成（因为 continueOnError 允许继续）
    
    console.log(`[BatchProcess] [${requestId}] Updating task status to '${finalStatus}'...`);
    const finalDetailsArray = [...results.details, { summary }];
    const finalDetailsObj = await updateDetailsWithServerLogs(taskId, finalDetailsArray);
    await db
      .updateTable("batch_process_tasks")
      .set({
        status: finalStatus,
        processed_count: results.processed,
        succeeded_count: results.succeeded,
        failed_count: results.failed,
        errors: sql`${JSON.stringify(results.errors)}::jsonb`,
        details: sql`${JSON.stringify(finalDetailsObj)}::jsonb`,
        completed_at: new Date(),
        updated_at: new Date(),
      })
      .where("task_id", "=", taskId)
      .execute();
      
    console.log(`[BatchProcess] [${requestId}] ========== Task ${taskId} COMPLETED ==========`);
    console.log(`[BatchProcess] [${requestId}] Final status: ${finalStatus}, succeeded: ${results.succeeded}, failed: ${results.failed}`);
    console.log(`[BatchProcess] [${requestId}] Summary:`, JSON.stringify(summary, null, 2));
  } catch (error: any) {
    const msg = String(error?.message || error);

    // ✅ 识别特殊错误码：Provider 配额耗尽
    if (msg === "BATCH_PROVIDER_QUOTA_EXCEEDED") {
      // 状态和 errors 前面已经写入，这里只补充日志即可
      console.warn(
        `[BatchProcess] [${requestId}] Task aborted due to provider quota exceeded`
      );
      await appendServerLog(taskId, {
        timestamp: new Date().toISOString(),
        level: 'warn',
        message: `Task aborted due to provider quota exhaustion`,
      });
      // 不再重新抛出错误，任务已优雅停止
      return;
    }

    // ✅ 检查是否状态已经是 failed 且 errors 中包含 provider 配额错误，则不再覆盖
    try {
      const current = await db
        .selectFrom("batch_process_tasks")
        .select(["status", "errors"])
        .where("task_id", "=", taskId)
        .executeTakeFirst();

      if (current?.status === "failed") {
        try {
          const errs = typeof current.errors === 'string' 
            ? JSON.parse(current.errors || "[]")
            : current.errors || [];
          if (Array.isArray(errs) && errs.some((e: any) => e.type === "provider_quota_exceeded")) {
            // 不覆盖状态，配额错误已经处理
            console.log(`[BatchProcess] [${requestId}] Task already marked as failed due to quota exceeded, skipping status update`);
            return;
          }
        } catch {
          // 忽略解析错误
        }
      }
    } catch (checkError) {
      // 忽略检查错误，继续正常处理
      console.warn(`[BatchProcess] [${requestId}] Failed to check current task status:`, checkError);
    }

    // 其他错误：原有逻辑
    console.error(`[BatchProcess] [${requestId}] ========== Task ${taskId} FAILED ==========`);
    console.error(`[BatchProcess] [${requestId}] Error message: ${error.message}`);
    console.error(`[BatchProcess] [${requestId}] Error stack:`, error?.stack);
    
    // 只有在处理过程中出现严重错误时才标记为失败
    // 如果所有题目都已处理完成，即使有错误也应该标记为完成（因为 continueOnError 允许继续）
    const shouldMarkAsFailed = results.processed < results.total;
    const finalStatus = shouldMarkAsFailed ? "failed" : "completed";
    
    // 更新任务状态
    try {
      const detailsObj = await updateDetailsWithServerLogs(taskId, results.details);
      await db
        .updateTable("batch_process_tasks")
        .set({
          status: finalStatus,
          processed_count: results.processed,
          succeeded_count: results.succeeded,
          failed_count: results.failed,
          errors: sql`${JSON.stringify(results.errors)}::jsonb`,
          details: sql`${JSON.stringify(detailsObj)}::jsonb`,
          completed_at: new Date(),
          updated_at: new Date(),
        })
        .where("task_id", "=", taskId)
        .execute();
      console.log(`[BatchProcess] Task ${taskId} status updated to ${finalStatus}`);
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
