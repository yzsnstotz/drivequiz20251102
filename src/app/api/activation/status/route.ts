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
import { executeSafely, executeWithRetry } from "@/lib/dbUtils";

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
// 检测是否在构建阶段
const IS_BUILD_TIME =
  typeof process.env.NEXT_PHASE !== "undefined" &&
  process.env.NEXT_PHASE === "phase-production-build";

// ✅ 修复：日志节流，每 5 秒最多打一次，避免刷屏
let lastActivationLogAt: number | null = null;
function diagActivationLog() {
  if (process.env.NODE_ENV !== "development") return;
  const now = Date.now();
  if (lastActivationLogAt && now - lastActivationLogAt < 5000) return;
  lastActivationLogAt = now;
  console.log("[Diag][ACTIVATION_ROUTE_HIT]", new Date().toISOString());
}

export async function GET(request: NextRequest) {
  // 构建阶段不做任何 DB 读写，直接返回一个安全的占位响应
  if (IS_BUILD_TIME) {
    return NextResponse.json(
      {
        ok: true,
        data: { valid: false, reasonCode: "BUILD_TIME_STUB" },
        buildTimeStub: true,
      },
      { status: 200 }
    );
  }

  // ✅ 修复：添加计数型日志，便于观察请求频次（节流：每 5 秒最多打一次）
  diagActivationLog();

  try {
    // 优先使用NextAuth Session（带重试机制）
    let email: string | null = null;
    let userId: string | null = null;

    try {
      // 使用重试机制获取 session
      const session = await executeWithRetry(
        async () => await auth(),
        { maxRetries: 2, retryDelay: 500 }
      );
      if (session?.user?.email) {
        email = session.user.email;
        userId = session.user.id?.toString() || null;
      }
    } catch (e: any) {
      // Session获取失败（可能是数据库连接问题），记录但不中断流程
      const errorMessage = e?.message || String(e);
      if (
        errorMessage.includes('Connection') ||
        errorMessage.includes('AdapterError') ||
        errorMessage.includes('timeout')
      ) {
        // 数据库连接问题，使用降级策略
        if (process.env.NODE_ENV === 'development') {
          console.warn('[GET /api/activation/status] Session fetch failed due to DB connection issue, using fallback');
        }
      } else {
        // 其他错误也记录
        if (process.env.NODE_ENV === 'development') {
          console.warn('[GET /api/activation/status] Session fetch failed:', errorMessage);
        }
      }
      // 继续尝试JWT方式
    }

    // 如果Session中没有email，尝试JWT
    if (!email) {
      try {
        const userInfo = await getUserInfo(request);
        if (userInfo?.userId) {
          userId = userInfo.userId;
          // 从数据库查询用户email（使用安全执行）
          const user = await executeSafely(
            async () =>
              await db
                .selectFrom("users")
                .select(["email"])
                .where("id", "=", userId)
                .executeTakeFirst(),
            null
          );
          if (user?.email) {
            email = user.email;
          }
        }
      } catch (e) {
        // JWT获取失败，继续流程
      }
    }

    // 如果没有登录态，尝试使用激活令牌（USER_TOKEN）回落判定
    let latestActivation: { id: number; email: string | null; activation_code: string; activated_at: Date } | null = null;
    if (!email) {
      const tokenCookie = request.cookies.get("USER_TOKEN")?.value || null;
      if (tokenCookie && tokenCookie.startsWith("act-")) {
        const parts = tokenCookie.split("-");
        const hexId = parts[parts.length - 1];
        const parsedId = parseInt(hexId, 16);
        if (!Number.isNaN(parsedId) && parsedId > 0) {
          latestActivation = (await executeSafely(
            async () =>
              await db
                .selectFrom("activations")
                .select(["id", "email", "activation_code", "activated_at"])
                .where("id", "=", parsedId)
                .executeTakeFirst(),
            null
          )) || null;
        }
      }
      if (!latestActivation) {
        const response = ok({ valid: false, reasonCode: "NOT_LOGGED_IN" });
        response.headers.set('Cache-Control', 'public, max-age=10, must-revalidate');
        return response;
      }
    }

    // 查找用户最新的激活记录（使用安全执行）
    if (!latestActivation) {
      latestActivation = (await executeSafely(
        async () =>
          await db
            .selectFrom("activations")
            .select(["id", "email", "activation_code", "activated_at"])
            .where("email", "=", email!)
            .orderBy("activated_at", "desc")
            .limit(1)
            .executeTakeFirst(),
        null
      )) || null;
    }

    if (!latestActivation) {
      const response = ok({ valid: false, reasonCode: "NO_ACTIVATION_RECORD" });
      // ✅ 修复：添加服务器级别缓存（10秒）
      response.headers.set('Cache-Control', 'public, max-age=10, must-revalidate');
      return response;
    }

    // 查找对应的激活码信息（使用安全执行）
    const activationCode = await executeSafely(
      async () =>
        await db
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
          .executeTakeFirst(),
      null
    );

    if (!activationCode) {
      const response = ok({ valid: false, reasonCode: "ACTIVATION_CODE_NOT_FOUND" });
      // ✅ 修复：添加服务器级别缓存（10秒）
      response.headers.set('Cache-Control', 'public, max-age=10, must-revalidate');
      return response;
    }

    // 检查激活码状态
    const status = String(activationCode.status || "").toLowerCase();
    if (status === "suspended" || status === "expired" || status === "disabled") {
      const response = ok({
        valid: false,
        reasonCode: "ACTIVATION_CODE_STATUS_INVALID",
        status,
      });
      // ✅ 修复：添加服务器级别缓存（10秒）
      response.headers.set('Cache-Control', 'public, max-age=10, must-revalidate');
      return response;
    }

    // 检查使用次数限制
    const usageLimit = Number(activationCode.usage_limit ?? 0);
    const usedCount = Number(activationCode.used_count ?? 0);
    if (usageLimit > 0 && usedCount >= usageLimit) {
      const response = ok({
        valid: false,
        reasonCode: "ACTIVATION_CODE_USAGE_EXCEEDED",
      });
      // ✅ 修复：添加服务器级别缓存（10秒）
      response.headers.set('Cache-Control', 'public, max-age=10, must-revalidate');
      return response;
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
        // 已过期，更新状态为 expired（使用安全执行，失败不影响返回结果）
        executeSafely(
          async () =>
            await db
              .updateTable("activation_codes")
              .set({
                status: "expired",
                updated_at: now,
              })
              .where("id", "=", activationCode.id)
              .execute(),
          undefined
        ).catch(() => {
          // 静默处理更新失败
        });

        const response = ok({
          valid: false,
          reasonCode: "ACTIVATION_CODE_EXPIRED",
          expiresAt: calculatedExpiresAt.toISOString(),
        });
        // ✅ 修复：添加服务器级别缓存（10秒）
        response.headers.set('Cache-Control', 'public, max-age=10, must-revalidate');
        return response;
      }
    }

    // 激活状态有效
    const response = ok({
      valid: true,
      activationCode: activationCode.code,
      activatedAt: latestActivation.activated_at.toISOString(),
      expiresAt: calculatedExpiresAt ? calculatedExpiresAt.toISOString() : null,
    });
    // ✅ 修复：添加服务器级别缓存（10秒）
    response.headers.set('Cache-Control', 'public, max-age=10, must-revalidate');
    return response;
  } catch (error: unknown) {
    // 记录错误
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[GET /api/activation/status] Error:", errorMessage);

    // 如果是数据库连接错误，返回降级响应（未激活状态）
    if (
      errorMessage.includes('Connection') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('AdapterError')
    ) {
      const response = ok({
        valid: false,
        reasonCode: "DATABASE_ERROR",
      });
      // ✅ 修复：添加服务器级别缓存（10秒）
      response.headers.set('Cache-Control', 'public, max-age=10, must-revalidate');
      return response;
    }

    // 其他错误返回通用错误响应
    return err("INTERNAL_ERROR", "Internal Server Error", 500);
  }
}
