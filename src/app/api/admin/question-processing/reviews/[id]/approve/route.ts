import { withAdminAuth, getAdminInfo } from "@/app/api/_lib/withAdminAuth";
import { badRequest, internalError, success } from "@/app/api/_lib/errors";
import { db } from "@/lib/db";

export const POST = withAdminAuth(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    if (!id) return badRequest("Missing id");
    
    const adminInfo = await getAdminInfo(req as any);
    const adminId = adminInfo?.id ? String(adminInfo.id) : null;

    // 获取润色记录
    const review = await db
      .selectFrom("question_polish_reviews")
      .selectAll()
      .where("id", "=", parseInt(id))
      .executeTakeFirst();

    if (!review) {
      return badRequest("Review not found");
    }

    if (review.status !== "pending") {
      return badRequest("Review is not pending");
    }

    // 获取对应的题目
    const question = await db
      .selectFrom("questions")
      .selectAll()
      .where("content_hash", "=", review.content_hash)
      .executeTakeFirst();

    if (!question) {
      return badRequest("Question not found");
    }

    // 更新题目内容
    const locale = review.locale;
    let updatedContent: any = question.content;
    if (typeof updatedContent === "object" && updatedContent !== null) {
      updatedContent = { ...updatedContent, [locale]: review.proposed_content };
    } else {
      updatedContent = { [locale]: review.proposed_content };
    }

    let updatedOptions = question.options;
    if (review.proposed_options && Array.isArray(review.proposed_options)) {
      updatedOptions = review.proposed_options;
    }

    let updatedExplanation: any = question.explanation;
    if (review.proposed_explanation) {
      if (typeof updatedExplanation === "object" && updatedExplanation !== null) {
        updatedExplanation = { ...updatedExplanation, [locale]: review.proposed_explanation };
      } else {
        updatedExplanation = { [locale]: review.proposed_explanation };
      }
    }

    // 更新题目
    await db
      .updateTable("questions")
      .set({
        content: updatedContent,
        options: updatedOptions,
        explanation: updatedExplanation,
        updated_at: new Date(),
      })
      .where("content_hash", "=", review.content_hash)
      .execute();

    // 更新润色记录状态
    await db
      .updateTable("question_polish_reviews")
      .set({
        status: "approved",
        reviewed_by: adminId,
        reviewed_at: new Date(),
        updated_at: new Date(),
      })
      .where("id", "=", parseInt(id))
      .execute();

    // 记录到历史表
    await db
      .insertInto("question_polish_history")
      .values({
        content_hash: review.content_hash,
        locale: review.locale,
        old_content: typeof question.content === "string" ? question.content : (question.content?.[locale] || question.content?.zh || null),
        old_options: question.options,
        old_explanation: typeof question.explanation === "string" ? question.explanation : (question.explanation?.[locale] || question.explanation?.zh || null),
        new_content: review.proposed_content,
        new_options: review.proposed_options,
        new_explanation: review.proposed_explanation,
        approved_by: adminId, // 注意：question_polish_history 表中的 approved_by 也是 string | null
      })
      .execute();

    return success({ ok: true });
  } catch (error: any) {
    console.error("[Approve Review] Error:", error);
    return internalError(error?.message || "Approve failed");
  }
});


