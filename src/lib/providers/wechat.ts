import type { OAuthConfig, OAuthUserConfig } from "next-auth/providers";

/**
 * 微信OAuth提供商配置
 * 参考：https://developers.weixin.qq.com/doc/oplatform/en/Website_App/WeChat_Login/Wechat_Login.html
 */

export interface WeChatProfile {
  openid: string;
  nickname: string;
  sex: number;
  province: string;
  city: string;
  country: string;
  headimgurl: string;
  privilege: string[];
  unionid?: string;
}

export default function WeChatProvider(
  options: OAuthUserConfig<WeChatProfile>
): OAuthConfig<WeChatProfile> {
  return {
    id: "wechat",
    name: "WeChat",
    type: "oauth",
    authorization: {
      url: "https://open.weixin.qq.com/connect/qrconnect",
      params: {
        appid: options.clientId!,
        redirect_uri: (options as any).redirectUri || `${process.env.NEXTAUTH_URL}/api/auth/callback/wechat`,
        response_type: "code",
        scope: "snsapi_login",
        state: "STATE",
      },
    },
    token: {
      url: "https://api.weixin.qq.com/sns/oauth2/access_token",
      async request({ provider, params }: { provider: OAuthConfig<any>; params: any }) {
        const url = new URL(provider.token?.url as string);
        url.searchParams.set("appid", provider.clientId as string);
        url.searchParams.set("secret", provider.clientSecret as string);
        url.searchParams.set("code", params.code as string);
        url.searchParams.set("grant_type", "authorization_code");

        const response = await fetch(url.toString(), {
          method: "GET",
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`WeChat token request failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const text = await response.text();
        if (!text) {
          throw new Error("WeChat token response is empty");
        }

        let tokens;
        try {
          tokens = JSON.parse(text);
        } catch (e) {
          throw new Error(`WeChat token response is not valid JSON: ${text}`);
        }

        if (tokens.errcode) {
          throw new Error(`WeChat token error: ${tokens.errcode} - ${tokens.errmsg}`);
        }

        return {
          access_token: tokens.access_token,
          expires_in: tokens.expires_in,
          refresh_token: tokens.refresh_token,
          openid: tokens.openid,
          scope: tokens.scope,
          unionid: tokens.unionid,
        };
      },
    },
    userinfo: {
      url: "https://api.weixin.qq.com/sns/userinfo",
      async request({ provider, tokens }: { provider: OAuthConfig<any>; tokens: any }) {
        const url = new URL(provider.userinfo?.url as string);
        url.searchParams.set("access_token", (tokens as any).access_token);
        url.searchParams.set("openid", (tokens as any).openid);
        url.searchParams.set("lang", "zh_CN");

        const response = await fetch(url.toString(), {
          method: "GET",
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`WeChat userinfo request failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const text = await response.text();
        if (!text) {
          throw new Error("WeChat userinfo response is empty");
        }

        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          throw new Error(`WeChat userinfo response is not valid JSON: ${text}`);
        }

        if (data.errcode) {
          throw new Error(`WeChat userinfo error: ${data.errcode} - ${data.errmsg}`);
        }

        return data;
      },
    },
    clientId: options.clientId,
    clientSecret: options.clientSecret,
    profile(profile) {
      return {
        id: profile.openid,
        name: profile.nickname,
        email: null, // 微信不提供邮箱，使用openid作为唯一标识
        image: profile.headimgurl,
      };
    },
  };
}

