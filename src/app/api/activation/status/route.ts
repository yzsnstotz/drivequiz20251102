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

    if (!dbUserId && !rawUserId) {
      return ok({ valid: false, reasonCode: "NO_USER" }, 200);
    }

    let user = await db
      .selectFrom("users")
      .select(["id", "email", "status", "activation_code_id"])
      .where("id", "=", (dbUserId || rawUserId) as string)
      .executeTakeFirst();

    if (!user && rawUserId) {
      user = await db
        .selectFrom("users")
        .select(["id", "email", "status", "activation_code_id"])
        .where("userid", "=", rawUserId)
        .executeTakeFirst();
    }

    if (!user) {
      return ok({ valid: false, reasonCode: "NO_USER" }, 200);
    }

    if (user.activation_code_id == null) {
      return ok({ valid: false, reasonCode: "NO_ACTIVATION_CODE" }, 200);
    }

    const activationCode = await db
      .selectFrom("activation_codes")
      .selectAll()
      .where("id", "=", user.activation_code_id)
      .executeTakeFirst();

    if (!activationCode) {
      return ok({ valid: false, reasonCode: "CODE_NOT_FOUND" }, 200);
    }

    const now = new Date();

    const status = String(activationCode.status || "").toLowerCase();
    if (status === "disabled" || status === "suspended") {
      return ok({ valid: false, reasonCode: "ACTIVATION_CODE_STATUS_INVALID", status }, 200);
    }

    const usageLimit = Number(activationCode.usage_limit ?? 0);
    const usedCount = Number(activationCode.used_count ?? 0);
    if (usageLimit > 0 && usedCount >= usageLimit) {
      return ok({ valid: false, reasonCode: "ACTIVATION_CODE_USAGE_EXCEEDED" }, 200);
    }

    let expiresAt: Date | null = null;
    if (
      activationCode.activation_started_at &&
      activationCode.validity_period &&
      activationCode.validity_unit
    ) {
      const start = new Date(activationCode.activation_started_at as unknown as string);
      if (!isNaN(start.getTime())) {
        const period = Number(activationCode.validity_period);
        const unit = activationCode.validity_unit;
        const d = new Date(start);
        switch (unit) {
          case "day":
            d.setDate(d.getDate() + period);
            break;
          case "month":
            d.setMonth(d.getMonth() + period);
            break;
          case "year":
            d.setFullYear(d.getFullYear() + period);
            break;
        }
        expiresAt = d;
      }
    } else if (activationCode.expires_at) {
      const fixed = new Date(activationCode.expires_at as unknown as string);
      if (!isNaN(fixed.getTime())) {
        expiresAt = fixed;
      }
    }

    if (expiresAt && expiresAt <= now) {
      await db
        .updateTable("activation_codes")
        .set({ status: "expired", updated_at: now })
        .where("id", "=", activationCode.id)
        .execute();

      return ok({ valid: false, reasonCode: "ACTIVATION_CODE_EXPIRED", expiresAt: expiresAt.toISOString() }, 200);
    }

    const lastActivation = await db
      .selectFrom("activations")
      .selectAll()
      .where("email", "=", user.email)
      .orderBy("activated_at", "desc")
      .executeTakeFirst();

    return ok({
      valid: true,
      reasonCode: null,
      activatedAt: lastActivation?.activated_at ? new Date(lastActivation.activated_at as unknown as string).toISOString() : null,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
    }, 200);
  } catch (_e) {
    return err("INTERNAL_ERROR", "Internal Server Error", 500);
  }
}
