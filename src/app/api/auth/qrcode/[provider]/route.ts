import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { setQRToken, getQRToken, deleteQRToken } from "../_lib/qrTokenStore";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params;

    // 生成临时token
    const token = randomBytes(32).toString("hex");
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15分钟过期

    console.log("[QR Code] Generating token:", token);
    console.log("[QR Code] Expires at:", new Date(expiresAt).toISOString());
    console.log("[QR Code] Current time:", new Date().toISOString());
    console.log("[QR Code] Time until expiry (ms):", expiresAt - Date.now());

    setQRToken(token, provider, expiresAt);

    // 对于微信和LINE，调用平台API获取二维码
    let qrUrl: string | null = null;

    if (provider === "wechat") {
      // 微信扫码登录：需要先获取二维码ticket
      // 注意：微信扫码登录需要企业认证，这里提供基础实现框架
      const appId = process.env.WECHAT_CLIENT_ID;
      if (appId) {
        // 微信扫码登录API调用
        // 实际使用时需要调用微信开放平台的接口获取二维码ticket
        // 这里返回一个占位URL，实际应该调用微信API
        // 参考：https://developers.weixin.qq.com/doc/oplatform/en/Website_App/WeChat_Login/Wechat_Login.html
        qrUrl = `https://mp.weixin.qq.com/cgi-bin/showqrcode?ticket=${token}`;
      }
    } else if (provider === "line") {
      // LINE QR Code登录
      const clientId = process.env.LINE_CLIENT_ID;
      // v4: 使用统一的 getAuthBaseUrl() 生成 redirect_uri
      const { getAuthBaseUrl } = await import("@/lib/env");
      const authBaseUrl = getAuthBaseUrl();
      const redirectUri = process.env.LINE_REDIRECT_URI || `${authBaseUrl}/api/auth/callback/line`;
      
      if (clientId) {
        try {
          // LINE QR Code登录需要生成授权URL
          // 参考：https://developers.line.biz/en/docs/line-login/integrate-line-login/
          const state = token; // 使用token作为state
          const nonce = randomBytes(16).toString("hex");
          
          // LINE QR Code登录URL（按照LINE官方文档格式）
          // 注意：LINE OAuth 2.1 的授权端点
          const lineAuthUrl = new URL("https://access.line.me/oauth2/v2.1/authorize");
          
          // 按照 LINE 官方文档顺序设置参数
          // URL.searchParams.set() 会自动进行 URL 编码，不需要手动编码
          lineAuthUrl.searchParams.set("response_type", "code");
          lineAuthUrl.searchParams.set("client_id", String(clientId).trim()); // 确保是字符串并去除空格
          lineAuthUrl.searchParams.set("redirect_uri", String(redirectUri)); // searchParams.set 会自动编码
          lineAuthUrl.searchParams.set("state", String(state));
          lineAuthUrl.searchParams.set("scope", "profile openid email");
          lineAuthUrl.searchParams.set("nonce", String(nonce));
          // 注意：移除 bot_prompt 参数，它不是必需的，可能导致 400 错误
          
          const finalUrl = lineAuthUrl.toString();
          console.log("[QR Code] LINE authorization URL:", finalUrl);
          console.log("[QR Code] Redirect URI (raw):", redirectUri);
          console.log("[QR Code] Client ID:", clientId);
          console.log("[QR Code] Client ID type:", typeof clientId);
          console.log("[QR Code] Client ID length:", clientId?.length);
          
          // 验证 URL 格式和参数
          try {
            const testUrl = new URL(finalUrl);
            console.log("[QR Code] URL validation passed");
            console.log("[QR Code] Parsed search params:", {
              response_type: testUrl.searchParams.get("response_type"),
              client_id: testUrl.searchParams.get("client_id"),
              redirect_uri: testUrl.searchParams.get("redirect_uri"),
              state: testUrl.searchParams.get("state"),
              scope: testUrl.searchParams.get("scope"),
              nonce: testUrl.searchParams.get("nonce"),
            });
          } catch (e) {
            console.error("[QR Code] URL validation failed:", e);
          }
          
          qrUrl = lineAuthUrl.toString();
        } catch (error) {
          console.error("LINE QR code generation error:", error);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      token,
      qrUrl,
    });
  } catch (error) {
    console.error("QR code generation error:", error);
    return NextResponse.json(
      { ok: false, message: "Failed to generate QR code" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    await params; // Next.js 15 requires awaiting params
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { ok: false, message: "Token is required" },
        { status: 400 }
      );
    }

    const tokenData = getQRToken(token);

    if (!tokenData) {
      return NextResponse.json({
        ok: true,
        status: "expired",
      });
    }

    if (Date.now() > tokenData.expiresAt) {
      deleteQRToken(token);
      return NextResponse.json({
        ok: true,
        status: "expired",
      });
    }

    return NextResponse.json({
      ok: true,
      status: tokenData.status,
    });
  } catch (error) {
    console.error("QR code status check error:", error);
    return NextResponse.json(
      { ok: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

