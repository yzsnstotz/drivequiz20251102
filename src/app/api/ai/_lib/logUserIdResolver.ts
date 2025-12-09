import "server-only";
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getUserInfo } from "@/app/api/_lib/withUserAuth";

function getCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((p) => p.trim());
  const item = parts.find((p) => p.startsWith(`${name}=`));
  if (!item) return null;
  return decodeURIComponent(item.substring(name.length + 1));
}

/**
 * 统一解析当前请求对应的“用户主键”（users.userid）：
 * - 返回值示例： "act-165" / "165"；未登录或解析失败 → null
 * - 不做 UUID 判定；不查 DB；不做任何映射
 * 优先级：
 *  1) session.user.id（视为 users.userid）
 *  2) USER_ID Cookie
 *  3) getUserInfo(req)?.userId
 */
export async function resolveUserIdForLogs(req: NextRequest): Promise<string | null> {
  const cookieHeader = req.headers.get("cookie");
  const candidates: string[] = [];

  // 1) Session.user.id
  try {
    const session = await auth();
    const sessionUserid = session?.user?.id;
    if (typeof sessionUserid === "string" && sessionUserid.trim()) {
      candidates.push(sessionUserid.trim());
    }
  } catch (err) {
    console.debug("[AI_DEBUG][auth_error]", err);
  }

  // 2) USER_ID Cookie
  const cookieUserid = getCookieValue(cookieHeader, "USER_ID");
  if (cookieUserid && cookieUserid.trim()) {
    candidates.push(cookieUserid.trim());
  }

  // 3) getUserInfo(req)?.userId
  try {
    const info = await getUserInfo(req);
    const infoUserid = info?.userId;
    if (typeof infoUserid === "string" && infoUserid.trim()) {
      candidates.push(infoUserid.trim());
    }
  } catch {
    // ignore getUserInfo errors
  }

  const unique = Array.from(new Set(candidates));
  if (unique.length > 0) {
    return unique[0];
  }
  return null;
}

