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
import path from "path";

// 延迟初始化 NextAuth，避免构建时模块解析问题
// 使用绝对路径 require，完全绕过 webpack 的静态分析
let handlers: { GET: any; POST: any } | null = null;

function getHandlers() {
  if (!handlers) {
    // 使用绝对路径 require，避免 webpack 构建时解析
    const authPath = path.join(process.cwd(), "src", "lib", "auth");
    const authModule = require(authPath);
    const { authOptions } = authModule;
    const nextAuth = NextAuth(authOptions);
    handlers = nextAuth.handlers;
  }
  return handlers;
}

// 路由层只做请求分发，不承载业务逻辑
// 符合 A1：路由层禁止承载业务逻辑，只做请求分发
export function GET(req: NextRequest, context: any) {
  const { GET } = getHandlers();
  return GET(req, context);
}

export function POST(req: NextRequest, context: any) {
  const { POST } = getHandlers();
  return POST(req, context);
}

