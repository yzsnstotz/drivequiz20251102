import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { badRequest, success } from "@/app/api/_lib/errors";
import { aiDb } from "@/lib/aiDb";

// GET /api/admin/question-processing/task-ai-logs?taskId=xxx&limit=10
export const GET = withAdminAuth(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const taskId = url.searchParams.get("taskId");
    const limit = parseInt(url.searchParams.get("limit") || "10", 10);

    if (!taskId) {
      return badRequest("taskId is required");
    }

    // 从数据库获取任务信息，找到任务包含的题目 ID 列表
    const { db } = await import("@/lib/db");
    const task = await db
      .selectFrom("batch_process_tasks")
      .select(["question_ids", "operations", "task_id"])
      .where("task_id", "=", taskId)
      .executeTakeFirst();

    if (!task) {
      return badRequest("Task not found");
    }

    // 获取任务包含的题目 ID 列表
    const questionIds = task.question_ids || [];
    
    // 从 ai_logs 表中查询最近的相关日志
    // 只查询题目相关的日志，并且根据任务创建时间筛选（任务开始时间之后）
    let query = aiDb
      .selectFrom("ai_logs")
      .select(["id", "question", "answer", "model", "created_at", "locale", "ai_provider"])
      .where("from", "=", "question"); // 只查询题目相关的日志

    // 如果任务有题目 ID 列表，尝试从 question 字段中提取题目 ID 来筛选
    // 注意：question 字段是文本，可能包含题目内容，我们需要通过其他方式关联
    // 暂时返回最近的日志，但限制在任务创建时间之后
    if (task.task_id) {
      // 获取任务创建时间
      const taskInfo = await db
        .selectFrom("batch_process_tasks")
        .select(["created_at"])
        .where("task_id", "=", taskId)
        .executeTakeFirst();
      
      if (taskInfo && taskInfo.created_at) {
        query = query.where("created_at", ">=", taskInfo.created_at);
      }
    }

    const logs = await query
      .orderBy("created_at", "desc")
      .limit(limit)
      .execute();

    return success({
      logs: logs.map(log => ({
        question: log.question,
        answer: log.answer || "",
        model: log.model || "unknown",
        created_at: log.created_at.toISOString(),
        locale: log.locale || "zh",
        ai_provider: log.ai_provider || "unknown",
        taskId: taskId, // 添加任务 ID
        operations: task.operations || [], // 添加操作类型
      })),
    });
  } catch (e: any) {
    console.error("[GET /api/admin/question-processing/task-ai-logs] Error:", e);
    return badRequest(e?.message || "Failed to load AI logs");
  }
});

