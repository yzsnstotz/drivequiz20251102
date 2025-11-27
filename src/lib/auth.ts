import type { NextAuthConfig } from "next-auth";
import NextAuth from "next-auth";
import { db } from "./db";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import TwitterProvider from "./providers/twitter";
import WeChatProvider from "./providers/wechat";
import type { Adapter } from "next-auth/adapters";
import { createPatchedKyselyAdapter } from "./auth-kysely-adapter";
import { getAuthEnvConfig, getAuthBaseUrl } from "@/lib/env";

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

// v4: 精简日志 - 只输出 Google Provider 预期的 redirect_uri（唯一真相来源）
const googleCallbackUrl = `${authBaseUrl}/api/auth/callback/google`;
console.log("[NextAuth][Google] expected redirect_uri:", googleCallbackUrl);

export const authOptions: NextAuthConfig = {
  adapter: createPatchedKyselyAdapter(db),
  debug: process.env.NODE_ENV === "development",

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
      allowDangerousEmailAccountLinking: true, // 允许将同一个邮箱关联到多个 OAuth 账户
    }),
    // 微信OAuth（自定义提供商）
    WeChatProvider({
      clientId: process.env.WECHAT_CLIENT_ID || "",
      clientSecret: process.env.WECHAT_CLIENT_SECRET || "",
      // v4: 不手动配置 redirectUri，由 WeChatProvider 内部使用 getAuthBaseUrl() 生成
      redirectUri: process.env.WECHAT_REDIRECT_URI || undefined,
    } as any),
    // LINE OAuth（自定义 OAuth2 provider，绕过 OIDC issuer 校验）
    // 使用 type: "oauth" 而不是 oidc，避免 NextAuth 用全局 issuer 校验 LINE 的 JWT
    {
      id: "line",
      name: "LINE",
      type: "oauth", // 关键：用 OAuth 而不是 oidc，避开有问题的 issuer 校验
      clientId: process.env.LINE_CLIENT_ID || "",
      clientSecret: process.env.LINE_CLIENT_SECRET || "",
      // ✅ 新增 client 配置，覆盖默认 RS256
      client: {
        // 主要是这一行：把 id_token 签名算法从默认 RS256 改为 HS256
        id_token_signed_response_alg: "HS256",
        // 可以顺便指定认证方式（非必须，按需）
        token_endpoint_auth_method: "client_secret_basic",
      },
      // 使用 PKCE + state
      checks: ["pkce", "state"],
      authorization: {
        url: "https://access.line.me/oauth2/v2.1/authorize",
        params: {
          response_type: "code",
          scope: "profile", // 🔁 从 "openid profile email" 改成 "profile"，避免 LINE 返回 id_token
        },
      },
      token: "https://api.line.me/oauth2/v2.1/token",
      userinfo: "https://api.line.me/v2/profile",
      // 按 LINE Profile API 的返回结构映射用户信息
      async profile(profile: any) {
        // 典型结构：{ userId, displayName, pictureUrl, statusMessage? }
        return {
          id: profile.userId,
          name: profile.displayName,
          image: profile.pictureUrl,
          email: null, // 现在我们不走 email 了，统一设为 null
        };
      },
    },
  ],
  pages: {
    signIn: "/login",
    error: "/login/error", // 错误页面，方便错误展示
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // 处理 OAuthAccountNotLinked 错误：如果邮箱已存在，自动关联账户
      // 注意：这个 callback 在 NextAuth 检查账户关联之前执行
      // 如果邮箱已存在但账户未关联，NextAuth 会在后续步骤中抛出 OAuthAccountNotLinked 错误
      // 我们在这里预先检查并记录，以便在错误处理中处理
      if (user.email && account?.provider && account?.providerAccountId) {
        try {
          // 检查是否存在相同邮箱的用户
          const existingUser = await db
            .selectFrom("users")
            .select(["id", "phone", "oauth_provider"])
            .where("email", "=", user.email)
            .executeTakeFirst();

          if (existingUser) {
            // 检查该 OAuth 账户是否已关联
            const existingAccount = await db
              .selectFrom("oauth_accounts")
              .select(["user_id", "provider", "provider_account_id"])
              .where("provider", "=", account.provider)
              .where("provider_account_id", "=", account.providerAccountId)
              .executeTakeFirst();

            if (!existingAccount) {
              // 如果账户未关联，自动关联到现有用户
              console.log("[NextAuth] 检测到邮箱已存在，自动关联OAuth账户:", {
                email: user.email,
                provider: account.provider,
                userId: existingUser.id,
              });
              
              // 手动创建 oauth_accounts 记录
              await db
                .insertInto("oauth_accounts")
                .values({
                  user_id: existingUser.id,
                  provider: account.provider,
                  provider_account_id: account.providerAccountId,
                  access_token: account.access_token || null,
                  refresh_token: account.refresh_token || null,
                  expires_at: account.expires_at ? new Date(account.expires_at * 1000) : null,
                  token_type: account.token_type || null,
                  scope: account.scope || null,
                  id_token: account.id_token || null,
                  session_state: (account as any).session_state || null,
                  created_at: new Date(),
                  updated_at: new Date(),
                })
                .onConflict((oc) => oc
                  .columns(["provider", "provider_account_id"])
                  .doUpdateSet({
                    access_token: (eb) => eb.ref("excluded.access_token"),
                    refresh_token: (eb) => eb.ref("excluded.refresh_token"),
                    expires_at: (eb) => eb.ref("excluded.expires_at"),
                    token_type: (eb) => eb.ref("excluded.token_type"),
                    scope: (eb) => eb.ref("excluded.scope"),
                    id_token: (eb) => eb.ref("excluded.id_token"),
                    session_state: (eb) => eb.ref("excluded.session_state"),
                    updated_at: new Date(),
                  })
                )
                .execute();

              // 更新用户的 OAuth 提供商信息
              await db
                .updateTable("users")
                .set({
                  oauth_provider: account.provider,
                  updated_at: new Date(),
                })
                .where("id", "=", existingUser.id)
                .execute();

              // 将 user.id 设置为现有用户的 ID，以便 NextAuth 使用正确的用户
              // ⚠️ 注意：existingUser.id 现在已经是字符串类型，直接使用
              user.id = existingUser.id.toString();
            }
          }
        } catch (error) {
          console.error("[NextAuth] SignIn callback error (account linking):", error);
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
            .where("email", "=", email)
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
    async session({ session, user }) {
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
      return session;
    },
    async jwt({ token, user }) {
      // 首次登录时，将用户信息添加到token
      // ⚠️ 注意：user.id 现在是字符串类型（UUID），直接使用，不要 parseInt
      if (user?.id) {
        token.userId = user.id.toString();
      }
      return token;
    },
  },
  // ✅ 保留数据库 session 策略
  session: {
    strategy: "database",
  },

  // ✅ secret 同时兼容 NEXTAUTH_SECRET 与 AUTH_SECRET
  secret: authSecret || undefined,

  // ✅ 打开 Auth.js 内建 logger，捕获真实错误
  logger: {
    error(error: Error) {
      console.error("[NextAuth][Error][raw]", error);

      // 针对 AdapterError 展开 cause
      if ((error as any).type === "AdapterError") {
        const adapterError = error as any;
        console.error("[NextAuth][AdapterError][kind]", adapterError.kind);
        if (adapterError.cause) {
          console.error(
            "[NextAuth][AdapterError][cause]",
            adapterError.cause,
          );
          // 如果是 PG 错误，通常会有这些字段
          const c = adapterError.cause as any;
          if (c.code || c.detail || c.schema || c.table || c.constraint) {
            console.error("[NextAuth][AdapterError][pg-details]", {
              code: c.code,
              detail: c.detail,
              schema: c.schema,
              table: c.table,
              constraint: c.constraint,
              message: c.message,
            });
          }
        }
      }
    },
    warn(message: string) {
      console.warn("[NextAuth][Warn]", message);
    },
    debug(message: string) {
      // 只在本地和预览环境输出 debug，避免生产过多日志
      if (process.env.NODE_ENV !== "production") {
        console.log("[NextAuth][Debug]", message);
      }
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

