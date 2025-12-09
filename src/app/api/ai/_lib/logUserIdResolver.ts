import "server-only";
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getUserInfo } from "@/app/api/_lib/withUserAuth";

function getCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`${name}=([^;]+)`));
  if (!match || !match[1]) return null;
  return decodeURIComponent(match[1]);
}

/**
 * 统一解析当前请求对应的“用户主键”（users.userid）
 * 返回示例：
 *  - "act-165"
 *  - "165"
 *  - 未登录或解析失败 → null
 */
export async function resolveUserIdForLogs(req: NextRequest): Promise<string | null> {
  const cookieHeader = req.headers.get("cookie");
  const candidates: string[] = [];

  // 1. Session.user.id —— 视为 users.userid
  try {
    const session = await auth();
    const sessionUserid = session?.user?.id;
    if (typeof sessionUserid === "string" && sessionUserid.trim() !== "") {
      candidates.push(sessionUserid.trim());
    }
  } catch (err) {
    console.debug("[AI_DEBUG][auth_error]", err);
  }

  // 2. USER_ID Cookie（如 act-165）
  const cookieUserid = getCookieValue(cookieHeader, "USER_ID");
  if (cookieUserid && cookieUserid.trim() !== "") {
    candidates.push(cookieUserid.trim());
  }

  // 3. 兼容旧的 getUserInfo(req)
  try {
    const info = await getUserInfo(req);
    const infoUserid = info?.userId;
    if (typeof infoUserid === "string" && infoUserid.trim() !== "") {
      candidates.push(infoUserid.trim());
    }
  } catch {
    // 忽略 getUserInfo 错误
  }

  const unique = Array.from(new Set(candidates));
  if (unique.length > 0) {
    return unique[0];
  }

  // 没有任何候选 → 匿名
  return null;
}

