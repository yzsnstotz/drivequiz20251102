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

    // 从 ai_logs 表中查询最近的相关日志
    // 注意：这里需要根据任务的操作类型来筛选
    // 暂时返回最近的日志，后续可以根据任务的具体内容来筛选
    const logs = await aiDb
      .selectFrom("ai_logs")
      .select(["id", "question", "answer", "model", "created_at", "locale", "ai_provider"])
      .where("from", "=", "question") // 只查询题目相关的日志
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
      })),
    });
  } catch (e: any) {
    console.error("[GET /api/admin/question-processing/task-ai-logs] Error:", e);
    return badRequest(e?.message || "Failed to load AI logs");
  }
});

