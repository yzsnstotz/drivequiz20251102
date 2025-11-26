/**
 * ✅ Dynamic Route Declaration
 * 防止 Next.js 静态预渲染报错 (DYNAMIC_SERVER_USAGE)
 * 原因: NextAuth 需要访问 request headers 和动态上下文
 * 修复策略: 强制动态渲染 + 禁用缓存 + Node.js 运行时
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

import NextAuth from "next-auth";
import type { NextRequest } from "next/server";

// 延迟导入 authOptions，避免构建时模块解析问题
let handlers: { GET: any; POST: any } | null = null;

async function getHandlers() {
  if (!handlers) {
    const { authOptions } = await import("@/lib/auth");
    const nextAuth = NextAuth(authOptions);
    handlers = nextAuth.handlers;
  }
  return handlers;
}

// 路由层只做请求分发，不承载业务逻辑
// 符合 A1：路由层禁止承载业务逻辑，只做请求分发
export async function GET(req: NextRequest, context: any) {
  const { GET } = await getHandlers();
  return GET(req, context);
}

export async function POST(req: NextRequest, context: any) {
  const { POST } = await getHandlers();
  return POST(req, context);
}

