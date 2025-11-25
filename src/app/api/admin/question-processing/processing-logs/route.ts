import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { badRequest, success, notFound } from "@/app/api/_lib/errors";
import { db } from "@/lib/db";
import { sql } from "kysely";

/**
 * GET /api/admin/question-processing/processing-logs?taskId=xxx
 * 获取批量处理任务的实时处理日志
 */
export const GET = withAdminAuth(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const taskId = url.searchParams.get("taskId");

    if (!taskId) {
      return badRequest("taskId is required");
    }

    // 获取任务信息
    const task = await db
      .selectFrom("batch_process_tasks")
      .select(["task_id", "status", "details", "processed_count", "total_questions"])
      .where("task_id", "=", taskId)
      .executeTakeFirst();

    if (!task) {
      return notFound("Task not found");
    }

    // 从 details 字段中提取处理日志
    // details 格式: [{ questionId, operations, status, subtasks: [...] }, server_logs: [...]]
    const logs: Array<{
      timestamp: string;
      level: 'info' | 'warn' | 'error';
      message: string;
      questionId?: number;
      operation?: string;
      aiProvider?: string;
      logType?: 'server' | 'task-processing';
    }> = [];

    // 首先添加服务器端日志
    const details = task.details as any;
    if (details && details.server_logs && Array.isArray(details.server_logs)) {
      details.server_logs.forEach((log: any) => {
        logs.push({
          timestamp: log.timestamp || new Date().toISOString(),
          level: log.level || 'info',
          message: log.message || '',
          logType: 'server',
        });
      });
    }

    // 然后添加题目处理日志
    if (task.details && Array.isArray(task.details)) {
      // 按时间顺序处理每个题目的详细信息
      task.details.forEach((detail: any) => {
        if (!detail.subtasks || !Array.isArray(detail.subtasks)) {
          return;
        }

        // 为每个子任务（操作）生成日志
        detail.subtasks.forEach((subtask: any) => {
          const operationName = subtask.operation === 'translate' ? '翻译' :
                               subtask.operation === 'polish' ? '润色' :
                               subtask.operation === 'fill_missing' ? '填漏' :
                               subtask.operation === 'category_tags' ? '分类标签' :
                               subtask.operation;

          // 从 subtask 中获取 AI provider 信息
          const aiProvider = subtask.aiProvider || 'unknown';
          const model = subtask.model || 'unknown';
          const aiProviderDisplay = aiProvider === 'gemini_direct' ? 'Google Gemini' :
                                   aiProvider === 'openai' || aiProvider === 'openai_direct' ? 'OpenAI' :
                                   aiProvider === 'openrouter' || aiProvider === 'openrouter_direct' ? 'OpenRouter' :
                                   aiProvider === 'local' ? 'Local AI' :
                                   aiProvider;

          // 添加操作开始日志
          logs.push({
            timestamp: subtask.timestamp || new Date().toISOString(),
            level: 'info',
            message: `正在进行题目ID ${detail.questionId} 的${operationName}任务`,
            questionId: detail.questionId,
            operation: subtask.operation,
            logType: 'task-processing',
          });

          // 添加 AI 请求日志（如果有问题文本）
          if (subtask.question) {
            const questionPreview = subtask.question.length > 150 
              ? subtask.question.substring(0, 150) + '...' 
              : subtask.question;
            logs.push({
              timestamp: subtask.timestamp || new Date().toISOString(),
              level: 'info',
              message: `发起AI(${aiProviderDisplay}${model !== 'unknown' ? `, ${model}` : ''})请求: ${questionPreview}`,
              questionId: detail.questionId,
              operation: subtask.operation,
              aiProvider: aiProviderDisplay,
              logType: 'task-processing',
            });
          }

          // 添加 AI 回复日志
          if (subtask.answer) {
            const answerPreview = subtask.answer.length > 200 
              ? subtask.answer.substring(0, 200) + '...' 
              : subtask.answer;
            logs.push({
              timestamp: subtask.timestamp || new Date().toISOString(),
              level: subtask.status === 'success' ? 'info' : 'error',
              message: `获得AI回复(${aiProviderDisplay}${model !== 'unknown' ? `, ${model}` : ''}): ${answerPreview}`,
              questionId: detail.questionId,
              operation: subtask.operation,
              aiProvider: aiProviderDisplay,
              logType: 'task-processing',
            });
          } else if (subtask.error) {
            logs.push({
              timestamp: subtask.timestamp || new Date().toISOString(),
              level: 'error',
              message: `AI请求失败(${aiProviderDisplay}): ${subtask.error}`,
              questionId: detail.questionId,
              operation: subtask.operation,
              aiProvider: aiProviderDisplay,
              logType: 'task-processing',
            });
          }
        });
      });
    }

    // 按时间戳排序
    logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return success({
      taskId: task.task_id,
      status: task.status,
      logs,
      progress: {
        processed: task.processed_count,
        total: task.total_questions,
      },
    });
  } catch (e: any) {
    console.error("[ProcessingLogs] Error:", e?.message, e?.stack);
    return badRequest(e?.message || "Failed to fetch processing logs");
  }
});

