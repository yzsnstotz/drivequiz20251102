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
import path from "path";

// 延迟初始化 NextAuth，避免构建时模块解析问题
// 使用绝对路径 require，完全绕过 webpack 的静态分析
let handler: ReturnType<typeof NextAuth> | null = null;

function getHandler() {
  if (!handler) {
    // 使用绝对路径 require，避免 webpack 构建时解析
    const authPath = path.join(process.cwd(), "src", "lib", "auth");
    const authModule = require(authPath);
    const { authOptions } = authModule;
    handler = NextAuth(authOptions);
  }
  return handler;
}

// NextAuth v5 正确用法：直接导出 handler 作为 GET 和 POST
// 路由层只做请求分发，不承载业务逻辑
// 符合 A1：路由层禁止承载业务逻辑，只做请求分发
const authHandler = getHandler();
export const { GET, POST } = authHandler;

