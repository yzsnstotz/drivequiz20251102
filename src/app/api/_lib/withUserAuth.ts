import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
 * 用户认证信息
 */
export interface UserInfo {
  userId: string; // 用户ID（可能是UUID或act-格式）
  userDbId?: string; // ✅ 数据库中的用户ID（users.id），现在也是字符串类型（UUID）
}

/**
 * 用户认证缓存（请求级别）
 */
const userInfoCache = new WeakMap<NextRequest, UserInfo | null>();

/**
 * 获取用户认证信息
 * 支持多种认证方式：
 * 1. NextAuth Session (优先)
 * 2. Authorization: Bearer <jwt>
 * 3. Cookie: USER_TOKEN
 * 4. Query参数: ?token=<jwt>
 */
export async function getUserInfo(req: NextRequest): Promise<UserInfo | null> {
  // 检查缓存
  if (userInfoCache.has(req)) {
    return userInfoCache.get(req) || null;
  }

  // 优先检查NextAuth session
  try {
    const session = await auth();
    if (session?.user?.id) {
      const userId = session.user.id.toString();
      // ⚠️ 注意：user.id 现在是字符串类型（UUID），不再使用 parseInt
      // userDbId 现在也是字符串类型，与 userId 相同
      const userInfo: UserInfo = {
        userId,
        userDbId: userId, // ✅ 现在 userDbId 也是字符串类型
      };
      userInfoCache.set(req, userInfo);
      return userInfo;
    }
  } catch (e) {
    // NextAuth session获取失败，继续尝试其他方式
    console.error("[UserAuth] NextAuth session error", (e as Error).message);
  }

  const USER_JWT_SECRET = process.env.USER_JWT_SECRET;

  // 获取JWT token
  let jwt: string | null = null;

  // 1) Authorization: Bearer <jwt>
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    jwt = authHeader.slice("Bearer ".length).trim();
  }

  // 2) Cookie（优先检查 USER_TOKEN，兼容移动端）
  if (!jwt) {
    try {
      let cookieJwt = req.cookies.get("USER_TOKEN")?.value;
      if (!cookieJwt) {
        cookieJwt = req.cookies.get("sb-access-token")?.value;
      }
      if (cookieJwt && cookieJwt.trim()) {
        jwt = cookieJwt.trim();
      }
    } catch (e) {
      console.error("[UserAuth] Cookie read error", (e as Error).message);
    }
  }

  // 3) Query参数（?token=<jwt>，便于测试/脚本）
  if (!jwt) {
    try {
      const url = new URL(req.url);
      const token = url.searchParams.get("token");
      if (token && token.trim()) {
        jwt = token.trim();
      }
    } catch (e) {
      console.error("[UserAuth] URL parsing error", (e as Error).message);
    }
  }

  if (!jwt) {
    userInfoCache.set(req, null);
    return null;
  }

  // 处理激活token格式（act-xxxxxxxx-xxxxxxxx）
  if (jwt.startsWith("act-")) {
    try {
      const parts = jwt.split("-");
      if (parts.length >= 3 && parts[0] === "act") {
        const activationId = parseInt(parts[parts.length - 1], 16);
        if (!isNaN(activationId) && activationId > 0) {
          const userId = `act-${activationId}`;
          
          // 尝试从数据库获取用户ID
          try {
            const activation = await db
              .selectFrom("activations")
              .select(["email"])
              .where("id", "=", activationId)
              .executeTakeFirst();
            
            if (activation) {
              const user = await db
                .selectFrom("users")
                .select(["id", "userid"])
                .where("email", "=", activation.email)
                .executeTakeFirst();
              
              if (user) {
                const userInfo: UserInfo = {
                  userId: user.userid || userId,
                  userDbId: user.id.toString(), // ✅ user.id 现在是字符串类型
                };
                userInfoCache.set(req, userInfo);
                return userInfo;
              }
            }
          } catch (e) {
            console.error("[UserAuth] Failed to fetch user from database", (e as Error).message);
          }
          
          // 如果数据库查询失败，使用激活token作为userId
          const userInfo: UserInfo = {
            userId,
          };
          userInfoCache.set(req, userInfo);
          return userInfo;
        }
      }
    } catch (e) {
      console.error("[UserAuth] Failed to parse activation token", (e as Error).message);
    }
    userInfoCache.set(req, null);
    return null;
  }

  // 验证标准JWT格式
  if (!USER_JWT_SECRET) {
    // 开发模式：允许跳过认证
    if (process.env.NODE_ENV === "development" || process.env.VERCEL_ENV === "preview") {
      try {
        const [header, payload] = jwt.split(".");
        if (!header || !payload) {
          userInfoCache.set(req, null);
          return null;
        }
        const json = JSON.parse(atobUrlSafe(payload)) as {
          sub?: string;
          user_id?: string;
          userId?: string;
          id?: string;
        };
        const userId = json.sub || json.user_id || json.userId || json.id || null;
        if (userId && typeof userId === "string") {
          const userInfo: UserInfo = {
            userId,
          };
          userInfoCache.set(req, userInfo);
          return userInfo;
        }
      } catch (e) {
        console.error("[UserAuth] Dev mode: parse error", (e as Error).message);
      }
    }
    userInfoCache.set(req, null);
    return null;
  }

  try {
    let secret: Uint8Array;
    try {
      const decodedSecret = Buffer.from(USER_JWT_SECRET, "base64");
      secret = new Uint8Array(decodedSecret);
    } catch {
      secret = new TextEncoder().encode(USER_JWT_SECRET);
    }

    const { payload } = await jwtVerify(jwt, secret);

    const payloadWithUserId = payload as {
      sub?: string;
      user_id?: string;
      userId?: string;
      id?: string;
    };
    const userId = payloadWithUserId.sub || payloadWithUserId.user_id || payloadWithUserId.userId || payloadWithUserId.id || null;

    if (!userId || typeof userId !== "string") {
      userInfoCache.set(req, null);
      return null;
    }

    // 验证是否为有效的UUID格式
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      userInfoCache.set(req, null);
      return null;
    }

    // 尝试从数据库获取用户ID
    try {
      const user = await db
        .selectFrom("users")
        .select(["id", "userid"])
        .where("userid", "=", userId)
        .executeTakeFirst();
      
      if (user) {
        const userInfo: UserInfo = {
          userId: user.userid || userId,
          userDbId: user.id.toString(), // ✅ user.id 现在是字符串类型
        };
        userInfoCache.set(req, userInfo);
        return userInfo;
      }
    } catch (e) {
      console.error("[UserAuth] Failed to fetch user from database", (e as Error).message);
    }

    const userInfo: UserInfo = {
      userId,
    };
    userInfoCache.set(req, userInfo);
    return userInfo;
  } catch (e) {
    console.error("[UserAuth] JWT verification failed", (e as Error).message);
    userInfoCache.set(req, null);
    return null;
  }
}

/**
 * 工具函数：Base64 URL安全解码
 */
function atobUrlSafe(b64url: string): string {
  const pad = "=".repeat((4 - (b64url.length % 4)) % 4);
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64").toString("utf8");
}

/**
 * 统一错误响应
 */
function unauthorized(message: string) {
  return NextResponse.json(
    { ok: false, errorCode: "AUTH_REQUIRED", message },
    { status: 401 }
  );
}

function badRequest(errorCode: string, message: string) {
  return NextResponse.json(
    { ok: false, errorCode, message },
    { status: 400 }
  );
}

function internalError(message: string, errorCode = "INTERNAL_ERROR") {
  return NextResponse.json(
    { ok: false, errorCode, message },
    { status: 500 }
  );
}

/**
 * 用户认证中间件
 * 用法：withUserAuth(handler)
 */
export function withUserAuth<T extends (...args: any[]) => Promise<Response>>(
  handler: (req: NextRequest, userInfo: UserInfo, ...rest: any[]) => Promise<Response>
): T {
  return (async (req: NextRequest, ...rest: any[]) => {
    const userInfo = await getUserInfo(req);

    if (!userInfo || !userInfo.userId) {
      return unauthorized("需要登录才能访问此资源");
    }

    try {
      return await handler(req, userInfo, ...rest);
    } catch (error) {
      console.error("[UserAuth] Handler error:", error);
      return internalError("服务器内部错误");
    }
  }) as T;
}

