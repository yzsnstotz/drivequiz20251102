// GET /api/admin/question-processing/tasks - 查询任务列表（task-level）
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { success, internalError } from "@/app/api/_lib/errors";
import { db } from "@/lib/db";
import { sql } from "kysely";

export const GET = withAdminAuth(async (req: Request) => {
  const requestId = `api-tasks-get-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  try {
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit")) || 50;
    const offset = Number(url.searchParams.get("offset")) || 0;
    const status = url.searchParams.get("status");

    // 查询任务列表
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

    // ✅ 修复 Task 4：为每个任务计算子任务统计
    const tasksWithProgress = await Promise.all(
      tasks.map(async (task) => {
        // 查询子任务统计
        const itemsStats = await db
          .selectFrom("question_processing_task_items")
          .select(({ fn, eb }) => [
            fn.count<number>("id").as("totalItems"),
            fn
              .count<number>("id")
              .filterWhere("status", "=", "succeeded")
              .as("completedItems"),
            fn
              .count<number>("id")
              .filterWhere("status", "=", "failed")
              .as("failedItems"),
          ])
          .where("task_id", "=", task.task_id)
          .executeTakeFirst();

        // ✅ 修复：totalItems 应该使用任务创建时确定的值
        // 如果任务有 total_questions，则 totalItems = total_questions × operations.length
        // 否则使用实际创建的任务项数量（向后兼容）
        const questionCount = task.total_questions || 0;
        const operationsCount = Array.isArray(task.operations) ? task.operations.length : 1;
        const totalItems = questionCount > 0 
          ? questionCount * operationsCount  // 任务创建时确定的值
          : Number(itemsStats?.totalItems || 0);  // 向后兼容：使用实际创建的任务项数量
        
        const completedItems = Number(itemsStats?.completedItems || 0);
        const failedItems = Number(itemsStats?.failedItems || 0);
        // ✅ 修复：使用数据库统计字段 succeeded_count，如果没有则使用 completedItems
        const succeededCount = task.succeeded_count ?? completedItems;

        // ✅ 修复 Task 4：按操作类型统计（包含所有状态）
        const perOperationStats = await db
          .selectFrom("question_processing_task_items")
          .select(({ fn }) => [
            "operation",
            fn.count<number>("id").as("total"),
            fn
              .count<number>("id")
              .filterWhere("status", "=", "succeeded")
              .as("succeeded"),
            fn
              .count<number>("id")
              .filterWhere("status", "=", "failed")
              .as("failed"),
            fn
              .count<number>("id")
              .filterWhere("status", "=", "processing")
              .as("processing"),
            fn
              .count<number>("id")
              .filterWhere("status", "=", "pending")
              .as("pending"),
          ])
          .where("task_id", "=", task.task_id)
          .groupBy("operation")
          .execute();

        const perOperation: Record<string, { total: number; succeeded: number; failed: number; processing: number; pending: number }> = {};
        perOperationStats.forEach((stat) => {
          perOperation[stat.operation] = {
            total: Number(stat.total || 0),
            succeeded: Number(stat.succeeded || 0),
            failed: Number(stat.failed || 0),
            processing: Number(stat.processing || 0),
            pending: Number(stat.pending || 0),
          };
        });

        // ✅ 修复：使用任务创建时确定的 total_questions，而不是动态计算
        // total_questions 在任务创建时就已经确定，不应随着任务项的变化而改变
        const questionCount = task.total_questions || 0;

        return {
          taskId: task.task_id,
          id: task.task_id, // 兼容字段
          createdAt: task.created_at?.toISOString() || new Date().toISOString(),
          status: task.status as "pending" | "processing" | "succeeded" | "failed" | "completed" | "cancelled",
          questionCount,
          operations: Array.isArray(task.operations) ? task.operations : [],
          progress: {
            totalItems,
            completedItems,
            failedItems,
            succeededCount, // ✅ 修复：添加 succeededCount 字段
            perOperation,
          },
        };
      })
    );

    // 查询总数
    let countQuery = db
      .selectFrom("batch_process_tasks")
      .select(({ fn }) => fn.count<number>("id").as("count"));

    if (status) {
      countQuery = countQuery.where("status", "=", status as any);
    }

    const total = await countQuery.executeTakeFirst();

    return success({
      tasks: tasksWithProgress,
      total: Number(total?.count || 0),
      limit,
      offset,
    });
  } catch (e: any) {
    console.error(`[API Tasks] [${requestId}] Error:`, e?.message, e?.stack);
    return internalError(e?.message || "Failed to fetch tasks");
  }
});

