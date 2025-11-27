/**
 * ✅ Dynamic Route Declaration
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withUserAuth, UserInfo } from "@/app/api/_lib/withUserAuth";

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
 * GET /api/user/license-preference
 * 获取用户的驾照类型和驾考阶段选择
 */
async function getHandler(
  req: NextRequest,
  userInfo: UserInfo
): Promise<Response> {
  try {
    const userId = userInfo.userId;

    const userProfile = await db
      .selectFrom("user_profiles")
      .select(["metadata"])
      .where("user_id", "=", userId)
      .executeTakeFirst();

    const metadata = userProfile?.metadata as
      | { licenseType?: string; stage?: string }
      | null
      | undefined;

    if (metadata?.licenseType && metadata?.stage) {
      return ok({
        licenseType: metadata.licenseType,
        stage: metadata.stage,
      });
    } else {
      return ok({ licenseType: null, stage: null });
    }
  } catch (error: unknown) {
    console.error("[GET /api/user/license-preference] Error:", error);
    return err(
      "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Internal Server Error",
      500
    );
  }
}

/**
 * POST /api/user/license-preference
 * 保存用户的驾照类型和驾考阶段选择
 */
async function postHandler(
  req: NextRequest,
  userInfo: UserInfo
): Promise<Response> {
  try {
    const body = await req.json().catch(() => ({}));
    const licenseType = body?.licenseType?.trim();
    const stage = body?.stage?.trim();

    // 验证参数
    if (!licenseType || !stage) {
      return err("VALIDATION_FAILED", "licenseType 和 stage 不能为空");
    }

    if (stage !== "provisional" && stage !== "regular") {
      return err("VALIDATION_FAILED", "stage 必须是 'provisional' 或 'regular'");
    }

    const userId = userInfo.userId;

    // 检查用户画像是否存在
    const existingProfile = await db
      .selectFrom("user_profiles")
      .select(["id", "metadata"])
      .where("user_id", "=", userId)
      .executeTakeFirst();

    const metadata = {
      licenseType,
      stage,
    };

    if (existingProfile) {
      // 更新现有画像
      await db
        .updateTable("user_profiles")
        .set({
          metadata: metadata as any,
          updated_at: new Date(),
        })
        .where("user_id", "=", userId)
        .execute();
    } else {
      // 创建新画像
      await db
        .insertInto("user_profiles")
        .values({
          user_id: userId,
          metadata: metadata as any,
          level: "beginner",
          language: "ja",
          goals: null,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .execute();
    }

    return ok({ licenseType, stage });
  } catch (error: unknown) {
    console.error("[POST /api/user/license-preference] Error:", error);
    return err(
      "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Internal Server Error",
      500
    );
  }
}

export const GET = withUserAuth(getHandler);
export const POST = withUserAuth(postHandler);
