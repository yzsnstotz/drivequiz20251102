import LineProvider from "next-auth/providers/line";

export function createLineProvider() {
  const clientId = process.env.LINE_CLIENT_ID ?? process.env.LINE_CHANNEL_ID ?? "";
  const clientSecret = process.env.LINE_CLIENT_SECRET ?? process.env.LINE_CHANNEL_SECRET ?? "";

  if (!clientId || !clientSecret) {
    console.warn("[auth][line] LINE_CLIENT_ID / LINE_CLIENT_SECRET (或 CHANNEL_ID/SECRET) 未配置，LINE 登录将不可用。");
    return null;
  }

  return LineProvider({
    clientId,
    clientSecret,
    checks: ["pkce"],
    authorization: {
      params: {
        scope: "profile openid email",
      },
    },
  });
}
