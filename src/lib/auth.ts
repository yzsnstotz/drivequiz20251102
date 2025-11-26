import type { NextAuthConfig } from "next-auth";
import NextAuth from "next-auth";
import { db } from "./db";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import TwitterProvider from "./providers/twitter";
import WeChatProvider from "./providers/wechat";
import type { Adapter } from "next-auth/adapters";
import { createPatchedKyselyAdapter } from "./auth-kysely-adapter";

// 配置验证：检查必要的环境变量
if (process.env.NODE_ENV === "development") {
  const requiredVars = {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    TWITTER_CLIENT_ID: process.env.TWITTER_CLIENT_ID,
    TWITTER_CLIENT_SECRET: process.env.TWITTER_CLIENT_SECRET,
  };

  const missingVars = Object.entries(requiredVars)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missingVars.length > 0) {
    console.warn("[NextAuth] ⚠️ 缺少必要的环境变量:", missingVars.join(", "));
  } else {
    console.log("[NextAuth] ✅ 环境变量检查通过");
    console.log("[NextAuth] NEXTAUTH_URL:", process.env.NEXTAUTH_URL);
    console.log("[NextAuth] Google Client ID:", process.env.GOOGLE_CLIENT_ID?.substring(0, 20) + "...");
    console.log("[NextAuth] Google Callback URL:", `${process.env.NEXTAUTH_URL}/api/auth/callback/google`);
    if (process.env.TWITTER_CLIENT_ID) {
      console.log("[NextAuth] Twitter Client ID:", process.env.TWITTER_CLIENT_ID?.substring(0, 20) + "...");
      console.log("[NextAuth] Twitter Callback URL:", `${process.env.NEXTAUTH_URL}/api/auth/callback/twitter`);
    }
  }
}

export const authOptions: NextAuthConfig = {
  adapter: createPatchedKyselyAdapter(db),
  debug: process.env.NODE_ENV === "development",
  // 允许将同一个邮箱关联到多个 OAuth 账户
  // 这对于支持多个登录方式的用户很重要
  allowDangerousEmailAccountLinking: true,
  providers: [
    // Google OAuth
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      // NextAuth 会自动使用 /api/auth/callback/google 作为回调地址
      // 不需要手动指定 callbackUrl
    }),
    // Facebook OAuth
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID || "",
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET || "",
    }),
    // Twitter OAuth 2.0（自定义 provider，限制 scope 权限）
    TwitterProvider({
      clientId: process.env.TWITTER_CLIENT_ID || "",
      clientSecret: process.env.TWITTER_CLIENT_SECRET || "",
    }),
    // 微信OAuth（自定义提供商）
    WeChatProvider({
      clientId: process.env.WECHAT_CLIENT_ID || "",
      clientSecret: process.env.WECHAT_CLIENT_SECRET || "",
      redirectUri: process.env.WECHAT_REDIRECT_URI || `${process.env.NEXTAUTH_URL}/api/auth/callback/wechat`,
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
            .select(["phone", "oauth_provider"])
            .where("id", "=", user.id.toString())
            .executeTakeFirst();

          if (dbUser) {
            // 添加电话号码信息到session
            (session.user as any).phone = dbUser.phone;
            (session.user as any).needsPhone = !dbUser.phone;
            (session.user as any).oauthProvider = dbUser.oauth_provider;
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
  session: {
    strategy: "database", // 使用数据库session策略
  },
  secret: process.env.NEXTAUTH_SECRET,
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

