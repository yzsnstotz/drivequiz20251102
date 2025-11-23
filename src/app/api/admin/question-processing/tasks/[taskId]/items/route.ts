// GET /api/admin/question-processing/tasks/[taskId]/items - 查询任务详情（item-level，含 questionId）
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { success, internalError, notFound, badRequest } from "@/app/api/_lib/errors";
import { db } from "@/lib/db";

async function getTaskItems(
  req: Request,
  taskId: string
) {
  const requestId = `api-task-items-get-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  try {
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit")) || 100;
    const offset = Number(url.searchParams.get("offset")) || 0;
    const operation = url.searchParams.get("operation");
    const status = url.searchParams.get("status");
    const targetLang = url.searchParams.get("targetLang");

    if (!taskId) {
      return badRequest("taskId is required");
    }

    // 验证任务是否存在，并获取 details 字段（包含子任务详情）
    const task = await db
      .selectFrom("batch_process_tasks")
      .select(["task_id", "details"])
      .where("task_id", "=", taskId)
      .executeTakeFirst();

    if (!task) {
      return notFound("Task not found");
    }

    // 查询子任务列表
    let query = db
      .selectFrom("question_processing_task_items")
      .selectAll()
      .where("task_id", "=", taskId)
      .orderBy("question_id", "asc")
      .orderBy("operation", "asc")
      .orderBy("target_lang", "asc")
      .limit(limit)
      .offset(offset);

    if (operation) {
      query = query.where("operation", "=", operation);
    }

    if (status) {
      query = query.where("status", "=", status as any);
    }

    if (targetLang) {
      query = query.where("target_lang", "=", targetLang);
    }

    const items = await query.execute();

    // ✅ 从 task.details 中提取子任务详情（请求体和回复体）
    const details = task.details as any;
    const detailsArray = Array.isArray(details) 
      ? details 
      : (details && details.items && Array.isArray(details.items)) 
        ? details.items 
        : [];

    // 构建子任务详情映射：questionId -> operation -> targetLang -> SubtaskDetail
    // 注意：由于 details 中的 subtask 可能没有 targetLang，我们需要通过 items 中的 targetLang 来匹配
    const subtaskDetailsMap: Record<number, Record<string, any[]>> = {};
    detailsArray.forEach((detailItem: any) => {
      if (detailItem && detailItem.subtasks && Array.isArray(detailItem.subtasks)) {
        const questionId = detailItem.questionId;
        if (!subtaskDetailsMap[questionId]) {
          subtaskDetailsMap[questionId] = {};
        }
        detailItem.subtasks.forEach((subtask: any) => {
          const op = subtask.operation;
          if (!subtaskDetailsMap[questionId][op]) {
            subtaskDetailsMap[questionId][op] = [];
          }
          subtaskDetailsMap[questionId][op].push(subtask);
        });
      }
    });

    // ✅ 格式化返回数据（包含请求体和回复体详情）
    const formattedItems = items.map((item) => {
      const questionId = Number(item.question_id);
      const op = item.operation;
      const targetLang = item.target_lang;
      
      // 从 details 中查找对应的子任务详情
      // 对于 translate 操作，需要匹配 targetLang；其他操作取第一个匹配的
      let subtaskDetail: any = null;
      const subtasksForOp = subtaskDetailsMap[questionId]?.[op];
      if (subtasksForOp && subtasksForOp.length > 0) {
        if (op === "translate" && targetLang) {
          // translate 操作：尝试匹配 targetLang，如果没有匹配则取第一个
          subtaskDetail = subtasksForOp.find((s: any) => s.targetLang === targetLang) || subtasksForOp[0];
        } else {
          // 其他操作：直接取第一个
          subtaskDetail = subtasksForOp[0];
        }
      }

      // 📊 解析调试数据（新格式，从数据库字段读取）
      let aiRequest = null;
      let aiResponse = null;
      let processedData = null;
      let errorDetail = null;
      
      try {
        if (item.ai_request) {
          aiRequest = typeof item.ai_request === 'string' 
            ? JSON.parse(item.ai_request) 
            : item.ai_request;
        }
      } catch (e) {
        console.error(`[API Task Items] Failed to parse ai_request for item ${item.id}`);
      }
      
      try {
        if (item.ai_response) {
          aiResponse = typeof item.ai_response === 'string' 
            ? JSON.parse(item.ai_response) 
            : item.ai_response;
        }
      } catch (e) {
        console.error(`[API Task Items] Failed to parse ai_response for item ${item.id}`);
      }
      
      try {
        if (item.processed_data) {
          processedData = typeof item.processed_data === 'string' 
            ? JSON.parse(item.processed_data) 
            : item.processed_data;
        }
      } catch (e) {
        console.error(`[API Task Items] Failed to parse processed_data for item ${item.id}`);
      }
      
      // ✅ A-3: 解析 error_detail
      try {
        if (item.error_detail) {
          errorDetail = typeof item.error_detail === 'string' 
            ? JSON.parse(item.error_detail) 
            : item.error_detail;
        }
      } catch (e) {
        console.error(`[API Task Items] Failed to parse error_detail for item ${item.id}`);
      }

      return {
        id: Number(item.id),
        taskId: taskId,
        questionId: questionId,
        operation: item.operation as "translate" | "polish" | "fill_missing" | "category_tags",
        targetLang: item.target_lang,
        status: item.status as "pending" | "processing" | "succeeded" | "failed" | "skipped",
        errorMessage: item.error_message,
        startedAt: item.started_at?.toISOString() || null,
        finishedAt: item.finished_at?.toISOString() || null,
        // 📊 新格式：直接从数据库字段返回
        aiRequest,
        aiResponse,
        processedData,
        // ✅ A-3: 返回 error_detail
        errorDetail,
        // ✅ 兼容旧格式（保留以防前端还在使用）
        requestBody: subtaskDetail ? {
          prompt: subtaskDetail.prompt || null,
          question: subtaskDetail.question || null,
          expectedFormat: subtaskDetail.expectedFormat || null,
          scene: subtaskDetail.scene || null,
          sceneName: subtaskDetail.sceneName || null,
        } : null,
        responseBody: subtaskDetail ? {
          answer: subtaskDetail.answer || null,
          aiProvider: subtaskDetail.aiProvider || null,
          model: subtaskDetail.model || null,
          status: subtaskDetail.status || null,
          error: subtaskDetail.error || null,
          timestamp: subtaskDetail.timestamp || null,
        } : null,
      };
    });

    // 查询总数
    let countQuery = db
      .selectFrom("question_processing_task_items")
      .select(({ fn }) => fn.count<number>("id").as("count"))
      .where("task_id", "=", taskId);

    if (operation) {
      countQuery = countQuery.where("operation", "=", operation);
    }

    if (status) {
      countQuery = countQuery.where("status", "=", status);
    }

    if (targetLang) {
      countQuery = countQuery.where("target_lang", "=", targetLang);
    }

    const total = await countQuery.executeTakeFirst();

    return success({
      items: formattedItems,
      total: Number(total?.count || 0),
      limit,
      offset,
    });
  } catch (e: any) {
    console.error(`[API Task Items] [${requestId}] Error:`, e?.message, e?.stack);
    return internalError(e?.message || "Failed to fetch task items");
  }
}

// 使用 withAdminAuth 包装，并处理动态路由参数
export const GET = withAdminAuth(
  async (req: Request, { params }: { params: Promise<{ taskId: string }> }) => {
    const { taskId } = await params;
    if (!taskId) {
      return badRequest("taskId is required");
    }
    return getTaskItems(req, taskId);
  },
);

