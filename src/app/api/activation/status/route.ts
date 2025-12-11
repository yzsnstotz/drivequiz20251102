/**
 * ✅ Dynamic Route Declaration
 * 防止 Next.js 静态预渲染报错 (DYNAMIC_SERVER_USAGE)
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserInfo } from "@/app/api/_lib/withUserAuth";
import { getUserEffectiveEntitlement } from "@/lib/entitlements";

/**
 * 统一成功响应
 */
function ok<T>(data: T, status = 200) {
  const res = NextResponse.json({ ok: true, data }, { status });
  res.headers.set("Cache-Control", "private, max-age=0, no-store");
  return res;
}

/**
 * 统一错误响应
 */
function err(errorCode: string, message: string, status = 400) {
  const res = NextResponse.json({ ok: false, errorCode, message }, { status });
  res.headers.set("Cache-Control", "private, max-age=0, no-store");
  return res;
}

/**
 * GET /api/activation/status
 * 检查当前用户的激活状态
 * 支持Session和JWT两种认证方式
 */
export async function GET(request: NextRequest) {
  try {
    const userInfo = await getUserInfo(request);
    const dbUserId = userInfo?.userDbId || null;
    const rawUserId = userInfo?.userId || null;

    const userIdForQuery = dbUserId ?? rawUserId ?? null;
    if (!userIdForQuery) {
      return ok({ valid: false, reasonCode: "NO_USER" }, 200);
    }

    const now = new Date();
    const { entitlement, reasonCode } = await getUserEffectiveEntitlement(db, userIdForQuery, now);

    // 若有激活码权益，保持 activatedAt 输出兼容
    let activatedAt: string | null = null;
    if (entitlement?.source === "code") {
      const user = await db
        .selectFrom("users")
        .select(["email"])
        .where("id", "=", userIdForQuery)
        .executeTakeFirst();
      if (!user && rawUserId) {
        const userByUid = await db
          .selectFrom("users")
          .select(["email"])
          .where("userid", "=", rawUserId)
          .executeTakeFirst();
        if (userByUid) {
          const lastActivation = await db
            .selectFrom("activations")
            .selectAll()
            .where("email", "=", userByUid.email)
            .orderBy("activated_at", "desc")
            .executeTakeFirst();
          if (lastActivation?.activated_at) {
            activatedAt = new Date(lastActivation.activated_at as unknown as string).toISOString();
          }
        }
      } else if (user) {
        const lastActivation = await db
          .selectFrom("activations")
          .selectAll()
          .where("email", "=", user.email)
          .orderBy("activated_at", "desc")
          .executeTakeFirst();
        if (lastActivation?.activated_at) {
          activatedAt = new Date(lastActivation.activated_at as unknown as string).toISOString();
        }
      }
    }

    if (!entitlement) {
      return ok({ valid: false, reasonCode: reasonCode ?? "NO_ENTITLEMENT" }, 200);
    }

    return ok(
      {
        valid: true,
        reasonCode: null,
        source: entitlement.source,
        plan: entitlement.plan,
        activatedAt,
        expiresAt: entitlement.validUntil ? entitlement.validUntil.toISOString() : null,
        validFrom: entitlement.validFrom ? entitlement.validFrom.toISOString() : null,
      },
      200
    );
  } catch (_e) {
    return err("INTERNAL_ERROR", "Internal Server Error", 500);
  }
}
