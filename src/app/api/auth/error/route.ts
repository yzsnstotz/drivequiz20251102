// src/app/api/auth/error/route.ts
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

/**
 * 自定义 NextAuth 错误端点：
 * - 统一处理所有 /api/auth/error 请求
 * - 没有 error 参数时，使用 "Default" 作为默认错误类型
 * - 始终重定向到 /login/error?error=<type>
 *
 * 这样既兼容 NextAuth v5 的内部调用，又修复直接访问返回 400 的问题。
 */
export function GET(request: NextRequest) {
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  const error = searchParams.get("error") ?? "Default";

  const redirectUrl = new URL("/login/error", url.origin);
  redirectUrl.searchParams.set("error", error);

  return NextResponse.redirect(redirectUrl.toString());
}

