// GET /api/admin/question-processing/error-stats - 错误统计接口
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { success, internalError, badRequest } from "@/app/api/_lib/errors";
import { db } from "@/lib/db";
import { sql } from "kysely";

async function getErrorStats(req: Request) {
  const requestId = `api-error-stats-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  try {
    const url = new URL(req.url);
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");
    const sceneParam = url.searchParams.get("scene");
    
    // 默认取过去 7 天
    const to = toParam ? new Date(toParam) : new Date();
    const from = fromParam ? new Date(fromParam) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return badRequest("Invalid date format. Use YYYY-MM-DD");
    }
    
    // 1) 统计维度一：按错误码聚合（优先从 error_detail 中提取，否则使用 error_message）
    const byErrorCodeQuery = db
      .selectFrom("question_processing_task_items")
      .select([
        sql<string>`COALESCE(error_detail->>'errorCode', error_message, 'UNKNOWN_ERROR')`.as("errorCode"),
        sql<number>`COUNT(*)`.as("count"),
      ])
      .where("status", "=", "failed")
      .where("created_at", ">=", from)
      .where("created_at", "<=", to)
      .groupBy("errorCode")
      .orderBy("count", "desc");
    
    if (sceneParam) {
      // 如果指定了 scene，可以通过 operation 过滤（full_pipeline 对应 operation = 'full_pipeline'）
      byErrorCodeQuery.where("operation", "=", sceneParam);
    }
    
    const byErrorCode = await byErrorCodeQuery.execute();
    
    // 2) 统计维度二：按目标语言聚合
    const byTargetLanguageQuery = db
      .selectFrom("question_processing_task_items")
      .select([
        sql<string>`COALESCE(target_lang, 'unknown')`.as("targetLanguage"),
        sql<number>`COUNT(*) FILTER (WHERE status = 'failed')`.as("failedCount"),
        sql<number>`COUNT(*)`.as("totalCount"),
      ])
      .where("created_at", ">=", from)
      .where("created_at", "<=", to)
      .groupBy("targetLanguage")
      .orderBy("failedCount", "desc");
    
    if (sceneParam) {
      byTargetLanguageQuery.where("operation", "=", sceneParam);
    }
    
    const byTargetLanguage = await byTargetLanguageQuery.execute();
    
    // 3) 统计维度三：按错误阶段(errorStage)聚合（从 error_detail 中提取）
    const byErrorStageQuery = db
      .selectFrom("question_processing_task_items")
      .select([
        sql<string>`COALESCE(error_detail->>'errorStage', 'UNKNOWN')`.as("errorStage"),
        sql<number>`COUNT(*)`.as("count"),
      ])
      .where("status", "=", "failed")
      .where("created_at", ">=", from)
      .where("created_at", "<=", to)
      .groupBy("errorStage")
      .orderBy("count", "desc");
    
    if (sceneParam) {
      byErrorStageQuery.where("operation", "=", sceneParam);
    }
    
    const byErrorStage = await byErrorStageQuery.execute();
    
    // 4) Top N 问题题目列表（获取"问题最多的 questionId"）
    const topQuestionIdsQuery = db
      .selectFrom("question_processing_task_items")
      .select([
        "question_id",
        sql<number>`COUNT(*) FILTER (WHERE status = 'failed')`.as("failedCount"),
        sql<string>`MAX(COALESCE(error_detail->>'errorCode', error_message))`.as("lastErrorCode"),
        sql<string>`MAX(error_detail->>'errorStage')`.as("lastErrorStage"),
        sql<Date>`MAX(created_at)`.as("lastErrorAt"),
      ])
      .where("status", "=", "failed")
      .where("created_at", ">=", from)
      .where("created_at", "<=", to)
      .groupBy("question_id")
      .orderBy("failedCount", "desc")
      .limit(20);
    
    if (sceneParam) {
      topQuestionIdsQuery.where("operation", "=", sceneParam);
    }
    
    const topQuestionIds = await topQuestionIdsQuery.execute();
    
    return success({
      from: from.toISOString().split("T")[0],
      to: to.toISOString().split("T")[0],
      scene: sceneParam || null,
      byErrorCode: byErrorCode.map((row) => ({
        errorCode: row.errorCode,
        count: Number(row.count),
      })),
      byTargetLanguage: byTargetLanguage.map((row) => ({
        targetLanguage: row.targetLanguage,
        failedCount: Number(row.failedCount),
        totalCount: Number(row.totalCount),
      })),
      byErrorStage: byErrorStage.map((row) => ({
        errorStage: row.errorStage,
        count: Number(row.count),
      })),
      topQuestionIds: topQuestionIds.map((row) => ({
        questionId: Number(row.question_id),
        failedCount: Number(row.failedCount),
        lastErrorCode: row.lastErrorCode || null,
        lastErrorStage: row.lastErrorStage || null,
        lastErrorAt: row.lastErrorAt?.toISOString() || null,
      })),
    });
  } catch (e: any) {
    console.error(`[API Error Stats] [${requestId}] Error:`, e?.message, e?.stack);
    return internalError(e?.message || "Failed to fetch error stats");
  }
}

// 使用 withAdminAuth 包装
export const GET = withAdminAuth(getErrorStats);

