import type { OAuthConfig, OAuthUserConfig } from "next-auth/providers";
import { getAuthBaseUrl } from "@/lib/env";

/**
 * LINE OAuth提供商配置
 * 参考：https://developers.line.biz/en/docs/line-login/
 * 
 * v4: 使用统一的 getAuthBaseUrl() 生成 redirect_uri，不再手动配置
 */

export interface LineProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
  email?: string;
}

export default function LineProvider(
  options: OAuthUserConfig<LineProfile>
): OAuthConfig<LineProfile> {
  // v4: 使用统一的 base URL 生成 redirect_uri（唯一真相来源）
  const authBaseUrl = getAuthBaseUrl();
  const defaultRedirectUri = `${authBaseUrl}/api/auth/callback/line`;

  return {
    id: "line",
    name: "LINE",
    type: "oauth",
    checks: ["pkce", "state"],
    authorization: {
      url: "https://access.line.me/oauth2/v2.1/authorize",
      params: {
        response_type: "code",
        scope: "profile openid email",
        // v4: 不设置 redirect_uri，让 NextAuth 自动处理（基于 AUTH_URL 和 provider id）
      },
    },
    token: {
      url: "https://api.line.me/oauth2/v2.1/token",
      async request({ provider, params }: { provider: OAuthConfig<LineProfile>; params: any }) {
        const body = new URLSearchParams();
        body.append("grant_type", "authorization_code");
        body.append("code", String(params.code || ""));
        // v4: 使用统一的 base URL 生成 redirect_uri（优先使用 NextAuth 传递的，否则使用默认值）
        const redirectUri = params.redirect_uri || (provider as any).callbackUrl || (provider as any).redirectUri || defaultRedirectUri;
        body.append("redirect_uri", String(redirectUri));
        body.append("client_id", String(provider.clientId || "")); // 确保是字符串
        body.append("client_secret", String(provider.clientSecret || ""));

        console.log("[LINE Provider] Token request URL:", provider.token?.url);
        console.log("[LINE Provider] Redirect URI:", redirectUri);

        const response = await fetch(provider.token?.url as string, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        });

        console.log("[LINE Provider] Token response status:", response.status, response.statusText);
        console.log("[LINE Provider] Response headers:", Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
          const errorText = await response.text();
          console.error("[LINE Provider] Token request error response:", errorText);
          throw new Error(`LINE token request failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          const text = await response.text();
          console.error("[LINE Provider] Unexpected content type:", contentType);
          console.error("[LINE Provider] Response body:", text);
          throw new Error(`LINE token response is not JSON. Content-Type: ${contentType}, Body: ${text.substring(0, 200)}`);
        }

        const text = await response.text();
        if (!text) {
          throw new Error("LINE token response is empty");
        }

        let tokens;
        try {
          tokens = JSON.parse(text);
        } catch (e) {
          console.error("[LINE Provider] JSON parse error:", e);
          console.error("[LINE Provider] Response text:", text);
          throw new Error(`LINE token response is not valid JSON: ${text.substring(0, 200)}`);
        }

        if (tokens.error) {
          throw new Error(`LINE token error: ${tokens.error} - ${tokens.error_description || tokens.error_description}`);
        }

        // LINE 返回的 ID token 使用 HS256 算法签名
        // 在 src/lib/auth.ts 中已经通过包装配置了 client.id_token_signed_response_alg: "HS256"
        // 因此直接返回完整 tokens，让 NextAuth 使用正确的算法验证
        return tokens;
      },
    },
    userinfo: {
      url: "https://api.line.me/v2/profile",
      async request({ provider, tokens }: { provider: OAuthConfig<LineProfile>; tokens: any }) {
        console.log("[LINE Provider] Userinfo request started");
        const response = await fetch(provider.userinfo?.url as string, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${(tokens as any).access_token}`,
          },
        });

        console.log("[LINE Provider] Userinfo response status:", response.status, response.statusText);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`LINE userinfo request failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const text = await response.text();
        if (!text) {
          throw new Error("LINE userinfo response is empty");
        }

        let profile;
        try {
          profile = JSON.parse(text);
        } catch (e) {
          throw new Error(`LINE userinfo response is not valid JSON: ${text}`);
        }

        // 如果id_token存在，尝试解析获取email
        let email: string | undefined;
        if ((tokens as any).id_token) {
          try {
            const payload = JSON.parse(
              Buffer.from((tokens as any).id_token.split(".")[1], "base64").toString()
            );
            email = payload.email;
          } catch (e) {
            // 忽略解析错误
          }
        }

        return {
          ...profile,
          email: email || profile.email,
        };
      },
    },
    // 确保 clientId 和 clientSecret 是字符串类型
    clientId: String(options.clientId || "").trim(),
    clientSecret: String(options.clientSecret || "").trim(),
    // 注意：NextAuth 会自动处理回调地址，格式为 {NEXTAUTH_URL}/api/auth/callback/{provider_id}
    // 例如：http://localhost:3000/api/auth/callback/line
    // 注意：client.id_token_signed_response_alg 配置已在 src/lib/auth.ts 中通过包装添加
    // 这里不再重复配置，避免配置冲突
    profile(profile) {
      return {
        id: profile.userId,
        name: profile.displayName,
        email: profile.email,
        image: profile.pictureUrl,
      };
    },
  };
}

