/**
 * ✅ Dynamic Route Declaration
 * 防止 Next.js 静态预渲染报错 (DYNAMIC_SERVER_USAGE)
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { success, badRequest, internalError, notFound } from "@/app/api/_lib/errors";

/**
 * GET /api/admin/users/[id]/behaviors
 * 获取用户行为记录（支持分页和无限滚动）
 * query:
 *  - limit?: number (default: 10, max: 50)
 *  - offset?: number (default: 0) - 用于分页
 *  - behaviorType?: string (可选，过滤特定行为类型)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAdminAuth(async (req: NextRequest) => {
    try {
      const { id } = await params;
      const userId = Number(id);
      if (isNaN(userId) || userId <= 0) {
        return badRequest("Invalid user ID");
      }

      const sp = req.nextUrl.searchParams;
      const limit = Math.min(Number(sp.get("limit") || 10), 50);
      const offset = Math.max(Number(sp.get("offset") || 0), 0);
      const behaviorType = sp.get("behaviorType") || null;

      // 验证用户是否存在
      const user = await db
        .selectFrom("users")
        .select(["id", "email", "userid"])
        .where("id", "=", userId)
        .executeTakeFirst();

      if (!user) {
        return notFound("User not found");
      }

      // 构建基础查询条件
      let baseQuery = db
        .selectFrom("user_behaviors")
        .where("user_id", "=", userId);

      // 如果指定了行为类型，则过滤
      if (behaviorType) {
        baseQuery = baseQuery.where("behavior_type", "=", behaviorType);
      }

      // 获取总数（用于判断是否还有更多数据）
      const totalCount = await baseQuery
        .select((eb) => eb.fn.countAll<number>().as("count"))
        .executeTakeFirst();

      // 获取分页数据
      const behaviors = await baseQuery
        .select([
          "id",
          "behavior_type",
          "ip_address",
          "user_agent",
          "client_type",
          "metadata",
          "created_at",
        ])
        .orderBy("created_at", "desc")
        .limit(limit)
        .offset(offset)
        .execute();

      // 格式化返回数据
      const records = behaviors.map((b) => ({
        id: b.id,
        behaviorType: b.behavior_type,
        ipAddress: b.ip_address ?? null,
        userAgent: b.user_agent ?? null,
        clientType: b.client_type ?? null,
        metadata: b.metadata ?? null,
        createdAt: b.created_at.toISOString(),
      }));

      const total = Number(totalCount?.count ?? 0);
      const hasMore = offset + limit < total;

      return success({
        userId,
        userid: user.userid,
        email: user.email,
        records,
        pagination: {
          limit,
          offset,
          total,
          hasMore,
        },
      });
    } catch (err: any) {
      return internalError(err?.message || "Internal Server Error");
    }
  })(req);
}

