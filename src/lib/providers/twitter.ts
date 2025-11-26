import type { OAuthConfig, OAuthUserConfig } from "@auth/core/providers";

/**
 * Twitter OAuth 2.0 提供商配置
 * 自定义实现以控制 scope 权限
 * 参考：https://developer.twitter.com/en/docs/authentication/oauth-2-0
 */

export interface TwitterProfile {
  data: {
    id: string;
    name: string;
    username: string;
    profile_image_url?: string;
  };
}

export default function TwitterProvider(
  options: OAuthUserConfig<TwitterProfile>
): OAuthConfig<TwitterProfile> {
  return {
    id: "twitter",
    name: "Twitter",
    type: "oauth",
    checks: ["pkce", "state"],
    authorization: {
      url: "https://x.com/i/oauth2/authorize",
      params: {
        // 请求 Twitter OAuth2 user context 所需的完整最小权限
        // 说明：
        // - users.read: 获取用户基本信息
        // - tweet.read: 目前 /2/users/me 等 v2 端点在 OAuth2 user context 下实际需要该 scope，否则容易返回 403
        // - offline.access: 获取 refresh token，支持长期登录
        scope: "users.read tweet.read offline.access",
        response_type: "code",
      },
    },
    token: {
      url: "https://api.x.com/2/oauth2/token",
      async request({ provider, params }) {
        console.log("[Twitter Provider] Token request started");
        console.log("[Twitter Provider] Token URL:", provider.token?.url);
        console.log("[Twitter Provider] Code:", params.code?.substring(0, 20) + "...");
        console.log("[Twitter Provider] Redirect URI:", params.redirect_uri);
        console.log("[Twitter Provider] Has code_verifier:", !!params.code_verifier);
        
        const body = new URLSearchParams();
        body.append("grant_type", "authorization_code");
        body.append("code", String(params.code || ""));
        body.append("redirect_uri", String(params.redirect_uri || ""));
        body.append("code_verifier", String(params.code_verifier || ""));

        // Twitter OAuth 2.0 使用 Basic Authentication
        const credentials = Buffer.from(
          `${provider.clientId}:${provider.clientSecret}`
        ).toString("base64");

        console.log("[Twitter Provider] Sending token request...");
        const response = await fetch(provider.token?.url as string, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${credentials}`,
          },
          body: body.toString(),
        });

        console.log("[Twitter Provider] Token response status:", response.status, response.statusText);
        console.log("[Twitter Provider] Token response headers:", Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
          const errorText = await response.text();
          console.error("[Twitter Provider] Token request error response:", errorText);
          throw new Error(`Twitter token request failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const tokens = await response.json();
        console.log("[Twitter Provider] Token response received");
        console.log("[Twitter Provider] Has access_token:", !!tokens.access_token);
        console.log("[Twitter Provider] Token type:", tokens.token_type);
        console.log("[Twitter Provider] Scope:", tokens.scope);
        
        return {
          access_token: tokens.access_token,
          expires_in: tokens.expires_in,
          refresh_token: tokens.refresh_token,
          token_type: tokens.token_type || "bearer",
          scope: tokens.scope,
        };
      },
    },
    userinfo: {
      url: "https://api.x.com/2/users/me",
      params: {
        "user.fields": "profile_image_url",
      },
      async request({ provider, tokens }) {
        console.log("[Twitter Provider] Userinfo request started");
        console.log("[Twitter Provider] Userinfo URL:", provider.userinfo?.url);
        console.log("[Twitter Provider] Has access_token:", !!(tokens as any).access_token);
        console.log("[Twitter Provider] Token type:", (tokens as any).token_type);
        console.log("[Twitter Provider] Scope from token:", (tokens as any).scope);
        console.log("[Twitter Provider] Access token (first 20 chars):", (tokens as any).access_token?.substring(0, 20) + "...");
        
        const url = new URL(provider.userinfo?.url as string);
        // 添加查询参数
        if (provider.userinfo?.params) {
          Object.entries(provider.userinfo.params).forEach(([key, value]) => {
            url.searchParams.set(key, String(value));
          });
        }

        console.log("[Twitter Provider] Final userinfo URL:", url.toString());

        const accessToken = (tokens as any).access_token;
        if (!accessToken) {
          throw new Error("Access token is missing from tokens");
        }

        const response = await fetch(url.toString(), {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "User-Agent": "NextAuth-Twitter-Provider",
          },
        });

        console.log("[Twitter Provider] Userinfo response status:", response.status, response.statusText);
        console.log("[Twitter Provider] Userinfo response headers:", Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
          const errorText = await response.text();
          console.error("[Twitter Provider] Userinfo request error response:", errorText);
          
          // 尝试解析错误响应
          let errorJson;
          try {
            errorJson = JSON.parse(errorText);
            console.error("[Twitter Provider] Parsed error:", JSON.stringify(errorJson, null, 2));
          } catch (e) {
            console.error("[Twitter Provider] Error response is not JSON:", errorText);
          }
          
          // 提供更详细的错误信息
          if (response.status === 403) {
            const detailedError = `Twitter API returned 403 Forbidden when accessing userinfo endpoint.

这通常表示 Twitter 应用配置问题，请检查：

1. ✅ Twitter Developer Portal → Settings → User authentication settings
   - App permissions: 必须设置为 "Read"（不是 "Read and write"）
   - Type of App: 必须设置为 "Web App"
   - Callback URI: 必须匹配 ${process.env.NEXTAUTH_URL}/api/auth/callback/twitter

2. ✅ 确保应用状态为 "Active"

3. ✅ 如果刚刚修改了配置，请等待 2-5 分钟让配置生效

4. ✅ 检查应用的 OAuth 2.0 设置是否已启用

当前请求信息：
- URL: ${url.toString()}
- Token type: ${(tokens as any).token_type}
- Scope: ${(tokens as any).scope || "unknown"}

如果问题持续存在，可能是 Twitter 应用需要审核或权限不足。`;
            console.error("[Twitter Provider]", detailedError);
            throw new Error(detailedError);
          }
          
          throw new Error(`Twitter userinfo request failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const profile = await response.json();
        console.log("[Twitter Provider] Userinfo response received");
        console.log("[Twitter Provider] Profile data:", JSON.stringify(profile, null, 2));
        
        return profile;
      },
    },
    async profile(profile: any) {
      console.log("[Twitter Provider] Profile function called with:", JSON.stringify(profile, null, 2));
      
      // 处理错误响应
      if (profile.status === 403 || profile.title === "Forbidden" || profile.detail === "Forbidden") {
        const errorMsg = `Twitter API returned 403 Forbidden. This usually means:
1. Your app doesn't have the required permissions (should be "Read" access)
2. The scope "users.read" is not enabled for your app
3. Your app may need to be approved by Twitter

Please check your Twitter Developer Portal settings:
- App permissions should be set to "Read"
- User authentication settings should be configured
- Callback URL should match: ${process.env.NEXTAUTH_URL}/api/auth/callback/twitter`;
        console.error("[Twitter Provider]", errorMsg);
        throw new Error(errorMsg);
      }

      // 检查 profile 结构
      if (!profile || !profile.data) {
        console.error("[Twitter Provider] Invalid profile structure:", JSON.stringify(profile, null, 2));
        throw new Error(`Invalid Twitter profile response. Expected structure: { data: { id, name, ... } }, but got: ${JSON.stringify(profile)}`);
      }

      return {
        id: profile.data.id,
        name: profile.data.name,
        email: null, // Twitter OAuth 2.0 不提供邮箱
        image: profile.data.profile_image_url || undefined,
      };
    },
    style: {
      bg: "#1da1f2",
      text: "#fff",
    },
    ...options,
  };
}

