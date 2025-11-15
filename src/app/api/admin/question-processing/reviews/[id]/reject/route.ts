import { withAdminAuth, getAdminInfo } from "@/app/api/_lib/withAdminAuth";
import { badRequest, internalError, success } from "@/app/api/_lib/errors";
import { db } from "@/lib/db";

export const POST = withAdminAuth(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    if (!id) return badRequest("Missing id");
    
    const body = await req.json().catch(() => ({}));
    const notes = body?.notes || "";

    const adminInfo = await getAdminInfo(req as any);
    const adminId = adminInfo?.id || null;

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

    // 更新润色记录状态
    await db
      .updateTable("question_polish_reviews")
      .set({
        status: "rejected",
        notes: notes || null,
        reviewed_by: adminId,
        reviewed_at: new Date(),
        updated_at: new Date(),
      })
      .where("id", "=", parseInt(id))
      .execute();

    return success({ ok: true });
  } catch (error: any) {
    console.error("[Reject Review] Error:", error);
    return internalError(error?.message || "Reject failed");
  }
});


