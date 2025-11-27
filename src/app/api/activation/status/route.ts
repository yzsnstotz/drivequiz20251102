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
import { auth } from "@/lib/auth";
import { getUserInfo } from "@/app/api/_lib/withUserAuth";

/**
 * 统一成功响应
 */
function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

/**
 * 统一错误响应
 */
function err(errorCode: string, message: string, status = 400) {
  return NextResponse.json(
    { ok: false, errorCode, message },
    { status }
  );
}

/**
 * GET /api/activation/status
 * 检查当前用户的激活状态
 * 支持Session和JWT两种认证方式
 */
export async function GET(request: NextRequest) {
  try {
    // 优先使用NextAuth Session
    let email: string | null = null;
    let userId: string | null = null;

    try {
      const session = await auth();
      if (session?.user?.email) {
        email = session.user.email;
        userId = session.user.id?.toString() || null;
      }
    } catch (e) {
      // Session获取失败，继续尝试JWT
    }

    // 如果Session中没有email，尝试JWT
    if (!email) {
      const userInfo = await getUserInfo(request);
      if (userInfo?.userId) {
        userId = userInfo.userId;
        // 从数据库查询用户email
        const user = await db
          .selectFrom("users")
          .select(["email"])
          .where("id", "=", userId)
          .executeTakeFirst();
        if (user?.email) {
          email = user.email;
        }
      }
    }

    if (!email) {
      return ok({ valid: false, reason: "未登录或无法获取用户信息" });
    }

    // 查找用户最新的激活记录
    const latestActivation = await db
      .selectFrom("activations")
      .select(["id", "email", "activation_code", "activated_at"])
      .where("email", "=", email)
      .orderBy("activated_at", "desc")
      .limit(1)
      .executeTakeFirst();

    if (!latestActivation) {
      return ok({ valid: false, reason: "未找到激活记录" });
    }

    // 查找对应的激活码信息
    const activationCode = await db
      .selectFrom("activation_codes")
      .select([
        "id",
        "code",
        "status",
        "expires_at",
        "validity_period",
        "validity_unit",
        "activation_started_at",
        "usage_limit",
        "used_count",
      ])
      .where("code", "=", latestActivation.activation_code)
      .executeTakeFirst();

    if (!activationCode) {
      return ok({ valid: false, reason: "激活码不存在" });
    }

    // 检查激活码状态
    const status = String(activationCode.status || "").toLowerCase();
    if (status === "suspended" || status === "expired" || status === "disabled") {
      return ok({
        valid: false,
        reason: `激活码状态不可用: ${status}`,
        status,
      });
    }

    // 检查使用次数限制
    const usageLimit = Number(activationCode.usage_limit ?? 0);
    const usedCount = Number(activationCode.used_count ?? 0);
    if (usageLimit > 0 && usedCount >= usageLimit) {
      return ok({
        valid: false,
        reason: "激活码已达到使用上限",
      });
    }

    // 计算实际到期时间
    const now = new Date();
    let calculatedExpiresAt: Date | null = null;

    if (
      activationCode.activation_started_at &&
      activationCode.validity_period &&
      activationCode.validity_unit
    ) {
      // 基于激活开始时间和有效期计算
      const startDate = new Date(
        activationCode.activation_started_at as unknown as string
      );
      if (!isNaN(startDate.getTime())) {
        calculatedExpiresAt = new Date(startDate);
        const period = Number(activationCode.validity_period);
        const unit = activationCode.validity_unit;

        switch (unit) {
          case "day":
            calculatedExpiresAt.setDate(calculatedExpiresAt.getDate() + period);
            break;
          case "month":
            calculatedExpiresAt.setMonth(calculatedExpiresAt.getMonth() + period);
            break;
          case "year":
            calculatedExpiresAt.setFullYear(
              calculatedExpiresAt.getFullYear() + period
            );
            break;
        }
      }
    } else if (activationCode.expires_at) {
      // 兼容旧数据（固定到期时间）
      calculatedExpiresAt = new Date(
        activationCode.expires_at as unknown as string
      );
    }

    // 检查是否已过期
    if (calculatedExpiresAt && !isNaN(calculatedExpiresAt.getTime())) {
      if (calculatedExpiresAt.getTime() < now.getTime()) {
        // 已过期，更新状态为 expired
        await db
          .updateTable("activation_codes")
          .set({
            status: "expired",
            updated_at: now,
          })
          .where("id", "=", activationCode.id)
          .execute();

        return ok({
          valid: false,
          reason: "激活码已过期",
          expiresAt: calculatedExpiresAt.toISOString(),
        });
      }
    }

    // 激活状态有效
    return ok({
      valid: true,
      activationCode: activationCode.code,
      activatedAt: latestActivation.activated_at.toISOString(),
      expiresAt: calculatedExpiresAt ? calculatedExpiresAt.toISOString() : null,
    });
  } catch (error: unknown) {
    console.error("[GET /api/activation/status] Error:", error);

    let errorMessage = "Internal Server Error";
    let errorCode = "INTERNAL_ERROR";

    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return err(errorCode, errorMessage, 500);
  }
}

