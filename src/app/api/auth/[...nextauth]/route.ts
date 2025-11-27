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
import { authOptions } from "@/lib/auth";

// NextAuth v5 正确用法：使用静态 import + 标准 handlers 解构
// 路由层只做请求分发，不承载业务逻辑
// 符合 A1：路由层禁止承载业务逻辑，只做请求分发

// 验证必要的环境变量（仅在生产环境记录警告）
if (process.env.NODE_ENV === "production") {
  if (!process.env.NEXTAUTH_SECRET && !process.env.AUTH_SECRET) {
    console.error("[NextAuth] ❌ NEXTAUTH_SECRET 或 AUTH_SECRET 未设置");
  }

  if (!process.env.NEXTAUTH_URL && !process.env.AUTH_URL) {
    console.error("[NextAuth] ❌ NEXTAUTH_URL 或 AUTH_URL 未设置");
  }
}

// 初始化 NextAuth handlers
const { handlers } = NextAuth(authOptions);

export const { GET, POST } = handlers;

