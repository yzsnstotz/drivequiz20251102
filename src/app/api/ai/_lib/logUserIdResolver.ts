import "server-only";
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getUserInfo } from "@/app/api/_lib/withUserAuth";

function isLikelyUuid(id: string | null | undefined): id is string {
  return typeof id === "string" && id.length >= 16;
}

/**
 * 统一解析 AI 日志写入使用的 userId（返回 users.id 或 null）：
 * - 首选 Session: auth() 获取 session.user.id
 * - 失败则回退 getUserInfo(req)，拿到 userid/act-* 后映射到 users.id
 * - 忽略 body/header/cookie 中传入的 userId/USER_ID
 */
export async function resolveUserIdForLogs(req: NextRequest): Promise<string | null> {
  // 1) Session 优先：直接拿 users.id
  try {
    const session = await auth();
    const sessionId = session?.user?.id;
    if (isLikelyUuid(sessionId)) {
      return sessionId;
    }
  } catch (error) {
    console.error("[logUserIdResolver] resolve session userId failed", error);
  }

  // 2) 回退：使用 getUserInfo，再映射到 users.id
  try {
    const userInfo = await getUserInfo(req).catch(() => null);
    const candidate = userInfo?.userId;
    if (!candidate) {
      return null;
    }

    // 2.1 candidate 本身像 UUID，直接用
    if (isLikelyUuid(candidate)) {
      return candidate;
    }

    // 2.2 candidate 是 userid/act-*，尝试映射到 users.id
    const row = await db
      .selectFrom("users")
      .select("id")
      .where("userid", "=", candidate)
      .executeTakeFirst();

    if (row?.id && isLikelyUuid(row.id)) {
      return row.id;
    }
  } catch (error) {
    console.error("[logUserIdResolver] fallback resolve userId failed", error);
  }

  // 3) 无法解析则匿名
  return null;
}

