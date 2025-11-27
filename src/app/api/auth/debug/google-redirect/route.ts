/**
 * Google OAuth redirect_uri 诊断接口（v4 精简版）
 * 
 * 用途：用于调试和验证服务器视角的 redirect_uri 配置
 * 
 * 访问方式：GET /api/auth/debug/google-redirect
 * 
 * 返回信息：
 * - NODE_ENV: 当前环境
 * - baseUrl: 服务器使用的 base URL（来自 getAuthBaseUrl()）
 * - expectedRedirectUri: 服务器预期的回调 URI
 * 
 * v4: 精简返回字段，只保留必要信息
 */

import { NextResponse } from "next/server";
import { getAuthBaseUrl } from "@/lib/env";

export async function GET() {
  try {
    const baseUrl = getAuthBaseUrl();
    const expectedRedirectUri = `${baseUrl}/api/auth/callback/google`;

    return NextResponse.json(
      {
        NODE_ENV: process.env.NODE_ENV,
        baseUrl,
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
      },
      { status: 500 },
    );
  }
}

