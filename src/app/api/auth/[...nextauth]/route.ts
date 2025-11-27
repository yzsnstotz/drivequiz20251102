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
import { getAuthEnvConfig } from "@/lib/env";

// NextAuth v5 正确用法：使用静态 import + 标准 handlers 解构
// 路由层只做请求分发，不承载业务逻辑
// 符合 A1：路由层禁止承载业务逻辑，只做请求分发

// 验证必要的环境变量（仅在生产环境记录警告）
if (process.env.NODE_ENV === "production") {
  const { secret, url } = getAuthEnvConfig();

  if (!secret) {
    console.error(
      "[NextAuth][Route] ❌ Auth secret missing. Please set NEXTAUTH_SECRET or AUTH_SECRET."
    );
  }

  if (!url) {
    console.error(
      "[NextAuth][Route] ❌ Auth URL missing. Please set NEXTAUTH_URL or AUTH_URL."
    );
  }
}

// 初始化 NextAuth handlers
const { handlers } = NextAuth(authOptions);

// 包装 handlers 以添加错误日志（不改变返回结构，仅用于增加上下文）
export const GET = async (req: Request) => {
  try {
    return await handlers.GET!(req);
  } catch (error) {
    console.error("[NextAuth][GET] Unhandled error in /api/auth route:", error);
    throw error;
  }
};

export const POST = async (req: Request) => {
  try {
    return await handlers.POST!(req);
  } catch (error) {
    console.error("[NextAuth][POST] Unhandled error in /api/auth route:", error);
    throw error;
  }
};

