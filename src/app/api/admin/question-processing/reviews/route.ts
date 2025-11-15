import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { internalError, success } from "@/app/api/_lib/errors";
import { db } from "@/lib/db";
import { sql } from "kysely";

export const GET = withAdminAuth(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") || "";
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const offset = parseInt(url.searchParams.get("offset") || "0");
    
    // 查询润色审核记录，并关联题目表获取题目ID和卷类
    let query = db
      .selectFrom("question_polish_reviews")
      .leftJoin("questions", "questions.content_hash", "question_polish_reviews.content_hash")
      .select([
        "question_polish_reviews.id",
        "question_polish_reviews.content_hash",
        "question_polish_reviews.locale",
        "question_polish_reviews.proposed_content",
        "question_polish_reviews.proposed_options",
        "question_polish_reviews.proposed_explanation",
        "question_polish_reviews.status",
        "question_polish_reviews.notes",
        "question_polish_reviews.created_by",
        "question_polish_reviews.reviewed_by",
        "question_polish_reviews.created_at",
        "question_polish_reviews.reviewed_at",
        "question_polish_reviews.updated_at",
        "question_polish_reviews.category",
        "questions.id as question_id",
        "questions.category as question_category",
        "questions.content as original_content",
        "questions.options as original_options",
        "questions.explanation as original_explanation",
      ])
      .orderBy("question_polish_reviews.created_at", "desc")
      .limit(limit)
      .offset(offset);
    
    if (status) {
      query = query.where("question_polish_reviews.status", "=", status as any);
    }
    
    const rows = await query.execute();
    
    // 获取总数
    let countQuery = db
      .selectFrom("question_polish_reviews")
      .select(sql<number>`count(*)::int`.as("count"));
    
    if (status) {
      countQuery = countQuery.where("status", "=", status as any);
    }
    
    const countResult = await countQuery.executeTakeFirst();
    const total = countResult?.count || 0;
    
    return success({
      reviews: rows,
      total,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error("[Reviews API] Error:", error);
    return internalError(error?.message || "List reviews failed");
  }
});


