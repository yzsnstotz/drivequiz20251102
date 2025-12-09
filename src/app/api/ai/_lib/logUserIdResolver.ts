import "server-only";
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 统一解析 AI 日志写入使用的 userId：
 * - 仅信任 NextAuth Session 的 session.user.id（users.id，UUID）
 * - 若无登录或非 UUID，返回 null
 * - 忽略 body/header/cookie 中的任何 userId/USER_ID
 */
export async function resolveUserIdForLogs(_req: NextRequest): Promise<string | null> {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (typeof userId !== "string") {
      return null;
    }

    if (!uuidRegex.test(userId)) {
      return null;
    }

    return userId;
  } catch (error) {
    console.error("[logUserIdResolver] resolve session userId failed", error);
    return null;
  }
}

