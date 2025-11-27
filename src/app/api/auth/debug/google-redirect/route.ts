/**
 * Google OAuth redirect_uri 诊断接口
 * 
 * 用途：用于调试和验证服务器视角的 redirect_uri 配置
 * 
 * 访问方式：GET /api/auth/debug/google-redirect
 * 
 * 返回信息：
 * - NODE_ENV: 当前环境
 * - NEXTAUTH_URL: 环境变量值
 * - AUTH_URL: 环境变量值（应与 NEXTAUTH_URL 一致）
 * - AUTH_TRUST_HOST: 环境变量值
 * - expectedRedirectUri: 服务器预期的回调 URI
 * 
 * 注意：此接口仅用于调试，生产环境建议添加访问控制
 */

import { NextResponse } from "next/server";
import { getAuthBaseUrl } from "@/lib/env";

export async function GET() {
  try {
    const authBaseUrl = getAuthBaseUrl();
    const expectedRedirectUri = `${authBaseUrl}/api/auth/callback/google`;

    return NextResponse.json(
      {
        message: "Google OAuth redirect_uri diagnostics",
        NODE_ENV: process.env.NODE_ENV,
        NEXTAUTH_URL: process.env.NEXTAUTH_URL,
        AUTH_URL: process.env.AUTH_URL,
        AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST,
        expectedRedirectUri,
        note: "请在 Google Cloud Console 中将 expectedRedirectUri 精确加入 Authorized redirect URIs",
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to get auth base URL",
        message: error instanceof Error ? error.message : String(error),
        NODE_ENV: process.env.NODE_ENV,
        NEXTAUTH_URL: process.env.NEXTAUTH_URL,
        AUTH_URL: process.env.AUTH_URL,
      },
      { status: 500 },
    );
  }
}

