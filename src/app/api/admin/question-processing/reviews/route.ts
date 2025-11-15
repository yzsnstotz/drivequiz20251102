import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { internalError, success } from "@/app/api/_lib/errors";
import { db } from "@/lib/db";

export const GET = withAdminAuth(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") || "";
    
    // 直接从数据库查询润色审核记录
    let query = db
      .selectFrom("question_polish_reviews")
      .selectAll()
      .orderBy("created_at", "desc");
    
    if (status) {
      query = query.where("status", "=", status as any);
    }
    
    const rows = await query.execute();
    
    return success(rows);
  } catch (error: any) {
    console.error("[Reviews API] Error:", error);
    return internalError(error?.message || "List reviews failed");
  }
});


