import type { NextAuthConfig } from "next-auth";
import NextAuth from "next-auth";
import { db } from "@/lib/db";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import TwitterProvider from "./providers/twitter";
import WeChatProvider from "./providers/wechat";
import { createLineProvider } from "@/lib/providers/line";
import type { Adapter } from "next-auth/adapters";
import { createPatchedKyselyAdapter } from "./auth-kysely-adapter";
import { getAuthEnvConfig, getAuthBaseUrl, validateEnv } from "@/lib/env";
import { sql } from "kysely";
import { SignJWT } from "jose";

// 环境变量轻量校验（只在开发环境提示）
validateEnv();

// 解析环境变量配置
const { secret: authSecret } = getAuthEnvConfig();

// v4: 统一使用 getAuthBaseUrl() 获取 base URL（强校验）
let authBaseUrl: string;
try {
  authBaseUrl = getAuthBaseUrl();
} catch (error) {
  // 生产环境：如果 getAuthBaseUrl() 抛出错误，应该阻止启动
  if (process.env.NODE_ENV === "production") {
    throw error;
  }
  // 开发环境：使用默认值
  authBaseUrl = "http://localhost:3000";
}

// ✅ 修复：静音 Google redirect_uri 日志，只在明确启用 debug 时打印
const isDebug =
  process.env.NODE_ENV === "development" &&
  process.env.NEXTAUTH_DEBUG === "true";

// ✅ 修复：日志节流，每 5 秒最多打一次，避免刷屏
let lastSessionLogAt: number | null = null;
function diagSessionLog() {
  if (process.env.NODE_ENV !== "development") return;
  const now = Date.now();
  // 每 5 秒最多打一次
  if (lastSessionLogAt && now - lastSessionLogAt < 5000) return;
  lastSessionLogAt = now;
  console.log("[Diag][SESSION_ROUTE_HIT]", new Date().toISOString());
}

if (isDebug) {
  const googleCallbackUrl = `${authBaseUrl}/api/auth/callback/google`;
  console.log("[NextAuth][Google] expected redirect_uri:", googleCallbackUrl);
}

export const authOptions: NextAuthConfig = {
  adapter: createPatchedKyselyAdapter(db),
  // ✅ 修复：收敛 NextAuth 噪音日志，只在明确启用时打印
  debug: isDebug,

  // v4: 显式设置 trustHost，确保 Auth.js 使用 AUTH_URL 而不是请求 Host
  trustHost: true,

  providers: [
    // Google OAuth
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      // v4: 不手动配置 redirectUri，由 Auth.js 根据 AUTH_URL 自动生成
      allowDangerousEmailAccountLinking: true,
    }),
    // Facebook OAuth
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID || "",
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET || "",
      allowDangerousEmailAccountLinking: true, // 允许将同一个邮箱关联到多个 OAuth 账户
    }),
    // Twitter OAuth 2.0（自定义 provider，限制 scope 权限）
    TwitterProvider({
      clientId: process.env.TWITTER_CLIENT_ID || "",
      clientSecret: process.env.TWITTER_CLIENT_SECRET || "",
      allowDangerousEmailAccountLinking: false,
    }),
    // 微信OAuth（自定义提供商）
    WeChatProvider({
      clientId: process.env.WECHAT_CLIENT_ID || "",
      clientSecret: process.env.WECHAT_CLIENT_SECRET || "",
      // v4: 不手动配置 redirectUri，由 WeChatProvider 内部使用 getAuthBaseUrl() 生成
      redirectUri: process.env.WECHAT_REDIRECT_URI || undefined,
    } as any),
    ...(() => {
      const lineProvider = createLineProvider();
      return lineProvider ? [lineProvider as any] : [];
    })(),
  ],
  cookies: {
    pkceCodeVerifier: {
      name: "authjs.pkce.code_verifier",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    callbackUrl: {
      name: "authjs.callback-url",
      options: {
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  pages: {
    signIn: "/login",
    error: "/login/error", // 错误页面，方便错误展示
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "line") {
        const rawEmail =
          (profile as any)?.email ?? (typeof (user as any)?.email === "string" ? (user as any).email : null);
        const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : null;
        if (email) {
          try {
            const existingUser = await db
              .selectFrom("users")
              .select(["id", "email"]) 
              .where(sql`LOWER(email) = ${email}` as unknown as any)
              .executeTakeFirst();
            if (existingUser) {
              (user as any).email = existingUser.email;
            } else {
              (user as any).email = email;
            }
          } catch {}
        } else {
          const secret = authSecret || process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "";
          const enc = new TextEncoder();
          const payload: Record<string, any> = {
            provider: "line",
            providerAccountId: account?.providerAccountId,
            displayName: (profile as any)?.name ?? (profile as any)?.displayName ?? undefined,
            avatar: (profile as any)?.picture ?? (profile as any)?.avatarUrl ?? undefined,
          };
          const token = await new SignJWT(payload)
            .setProtectedHeader({ alg: "HS256" })
            .setIssuedAt()
            .setExpirationTime("10m")
            .sign(enc.encode(secret));
          return `/login/email-binding?provider=line&token=${encodeURIComponent(token)}`;
        }
      }
      if (account?.provider === "google") {
        const rawEmail =
          (profile as any)?.email ?? (typeof (user as any)?.email === "string" ? (user as any).email : null);
        const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : null;
        if (!email) {
          return false;
        }
        try {
          const existingUserByLower = await db
            .selectFrom("users")
            .select(["id", "email"]) 
            .where(sql`LOWER(email) = ${email}` as unknown as any)
            .executeTakeFirst();
          if (existingUserByLower) {
            (user as any).email = existingUserByLower.email;
          } else {
            (user as any).email = email;
          }
        } catch {}
      }
      if (
        account?.error === "OAuthSignin" ||
        account?.error === "OAuthCallback" ||
        account?.error === "OAuthCreateAccount"
      ) {
        console.error("[OAuth Error]", account?.error);
        return "/login/error";
      }
      try {
        console.log("[signIn] provider:", account?.provider);
        console.log("[signIn] user.email:", (user as any)?.email);
        console.log("[signIn] profile.email:", (profile as any)?.email);
        console.log("[signIn] account.email:", (account as any)?.email);
      } catch {}

      if (account?.type === "oauth") {
        const providerEmailRaw = (profile as any)?.email || (account as any)?.email || "";
        const providerEmail = typeof providerEmailRaw === "string" ? providerEmailRaw.trim() : "";
        const isPlaceholder = providerEmail !== "" && providerEmail.endsWith("@oauth.local");
        if (!providerEmail || isPlaceholder) {
          (user as any).needsEmailBinding = true;
        }
      }

      // ⚠️ OAuth 首次登录时 user.id 只是 NextAuth 内部 UUID，不是 DB users.id
      // 这里不要再 parseInt，也不要直接拿它当 DB 主键用
      // 如果有 email 就用 email 查 DB 用户
      const email = (user as any).email ?? null;
      let dbUser = null;

      if (email) {
        try {
          dbUser = await db
            .selectFrom("users")
            .select(["id", "phone", "oauth_provider"])
            .where(sql`LOWER(email) = ${String(email).trim().toLowerCase()}` as unknown as any)
            .executeTakeFirst();

          // 如果用户没有电话号码，标记需要输入电话号码
          if (dbUser && !dbUser.phone) {
            // 保存OAuth提供商信息
            if (account?.provider) {
              await db
                .updateTable("users")
                .set({
                  oauth_provider: account.provider,
                  updated_at: new Date(),
                })
                .where("id", "=", dbUser.id)
                .execute();
            }
            // 返回特殊标识，表示需要输入电话号码
            // 这将在session回调中处理
          }
        } catch (error) {
          console.error("[NextAuth] SignIn callback error (phone check):", error);
        }
      }
      return true;
    },
    async session({ session, user, token }) {
      // ✅ 修复：添加计数型日志，便于观察 session 请求频次（节流：每 5 秒最多打一次）
      diagSessionLog();

      // 将用户ID添加到session（user.id 现在已经是字符串类型）
      if (user?.id) {
        session.user.id = user.id.toString();
        
        try {
          // 检查用户是否有电话号码
          // ⚠️ 注意：user.id 现在是字符串类型（UUID），直接使用，不要 parseInt
          const dbUser = await db
            .selectFrom("users")
            .select(["phone", "oauth_provider", "email"])
            .where("id", "=", user.id.toString())
            .executeTakeFirst();

          if (dbUser) {
            // 添加电话号码信息到session
            (session.user as any).phone = dbUser.phone;
            (session.user as any).needsPhone = !dbUser.phone;
            (session.user as any).oauthProvider = dbUser.oauth_provider;

            // 检查激活状态
            if (dbUser.email) {
              try {
                const latestActivation = await db
                  .selectFrom("activations")
                  .select(["id", "email", "activation_code", "activated_at"])
                  .where("email", "=", dbUser.email)
                  .orderBy("activated_at", "desc")
                  .limit(1)
                  .executeTakeFirst();

                if (latestActivation) {
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

                  if (activationCode) {
                    const status = String(activationCode.status || "").toLowerCase();
                    const now = new Date();
                    let calculatedExpiresAt: Date | null = null;

                    if (
                      activationCode.activation_started_at &&
                      activationCode.validity_period &&
                      activationCode.validity_unit
                    ) {
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
                      calculatedExpiresAt = new Date(
                        activationCode.expires_at as unknown as string
                      );
                    }

                    const isValid =
                      status !== "suspended" &&
                      status !== "expired" &&
                      status !== "disabled" &&
                      (!calculatedExpiresAt ||
                        !isNaN(calculatedExpiresAt.getTime()) &&
                          calculatedExpiresAt.getTime() >= now.getTime()) &&
                      (Number(activationCode.usage_limit ?? 0) === 0 ||
                        Number(activationCode.used_count ?? 0) <
                          Number(activationCode.usage_limit ?? 0));

                    (session.user as any).isActivated = isValid;
                    if (calculatedExpiresAt) {
                      (session.user as any).activationExpiresAt =
                        calculatedExpiresAt.toISOString();
                    }
                  } else {
                    (session.user as any).isActivated = false;
                  }
                } else {
                  (session.user as any).isActivated = false;
                }
              } catch (activationError) {
                console.error("Session callback activation check error:", activationError);
                (session.user as any).isActivated = false;
              }
            }
          }
        } catch (error) {
          console.error("Session callback error:", error);
        }
      }
      if ((token as any)?.needsEmailBinding) {
        (session as any).needsEmailBinding = true;
      }
      try {
        console.log("[session] needsEmailBinding:", (session as any)?.needsEmailBinding);
      } catch {}
      return session;
    },
    async jwt({ token, user }) {
      // 首次登录时，将用户信息添加到token
      // ⚠️ 注意：user.id 现在是字符串类型（UUID），直接使用，不要 parseInt
      if (user?.id) {
        token.userId = user.id.toString();
      }
      if ((user as any)?.needsEmailBinding) {
        (token as any).needsEmailBinding = true;
      }
      try {
        console.log("[jwt] needsEmailBinding:", (token as any)?.needsEmailBinding);
      } catch {}
      return token;
    },
  },
  // ✅ 保留数据库 session 策略
  session: {
    strategy: "database",
  },

  // ✅ secret 同时兼容 NEXTAUTH_SECRET 与 AUTH_SECRET
  secret: authSecret || undefined,

  // ✅ 修复：自定义 logger，静音 Google redirect_uri 噪音日志
  logger: {
    error(code: string, metadata?: any) {
      console.error("[NextAuth][Error]", code, metadata);
    },
    warn(code: string, metadata?: any) {
      // ✅ 修复：静音 Google redirect_uri 的噪音日志
      if (
        typeof code === "string" &&
        (code.includes("OAUTH_CALLBACK") ||
          code.includes("expected redirect_uri") ||
          (typeof metadata === "string" && metadata.includes("expected redirect_uri")) ||
          (metadata && typeof metadata === "object" && metadata.providerId === "google"))
      ) {
        // 静音 Google OAuth callback 的噪音日志
        return;
      }
      // 如果以后还有其它想静音的 code，可以在这里加
      console.warn("[NextAuth][Warn]", code, metadata);
    },
    debug(code: string, metadata?: any) {
      if (!isDebug) return;
      console.log("[NextAuth][Debug]", code, metadata);
    },
  } as any,

  // 添加错误处理和配置验证
  events: {
    async signIn({ user, account, profile }) {
      if (process.env.NODE_ENV === "development") {
        console.log("[NextAuth] SignIn event:", {
          userId: user?.id,
          provider: account?.provider,
          accountId: account?.providerAccountId,
        });
      }
    },
    // ⚠️ NextAuth v5 中 events.error 回调已被移除
    // 错误处理现在通过其他方式（如 middleware 或全局错误处理）进行
  },
};

// NextAuth v5: 导出 auth 函数用于获取会话
export const { auth } = NextAuth(authOptions);
