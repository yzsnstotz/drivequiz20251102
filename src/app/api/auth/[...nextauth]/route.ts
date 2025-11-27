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
import { getAuthEnvConfig, getAuthBaseUrl } from "@/lib/env";

// NextAuth v5 正确用法：使用静态 import + 标准 handlers 解构
// 路由层只做请求分发，不承载业务逻辑
// 符合 A1：路由层禁止承载业务逻辑，只做请求分发

// 验证必要的环境变量（仅在生产环境记录警告）
// 注意：getAuthBaseUrl() 在生产环境会抛出错误，这里捕获并记录
if (process.env.NODE_ENV === "production") {
  try {
    const { secret } = getAuthEnvConfig();
    // 尝试获取 base URL（如果配置错误会抛出错误）
    getAuthBaseUrl();

    if (!secret) {
      console.error(
        "[NextAuth][Route] ❌ Auth secret missing. Please set NEXTAUTH_SECRET or AUTH_SECRET."
      );
    }
  } catch (error) {
    // getAuthBaseUrl() 在生产环境配置错误时会抛出错误
    // 这里记录错误，实际错误会在模块加载时抛出，阻止应用启动
    console.error("[NextAuth][Route] ❌ 配置验证失败:", error instanceof Error ? error.message : error);
  }
}

// 初始化 NextAuth handlers
const { handlers } = NextAuth(authOptions);

// ✅ NextAuth v5 正确用法：直接导出 handlers，不包装
// 包装函数会改变请求对象类型，导致 NextAuth 无法解析 action
// 错误日志由 NextAuth logger 配置处理（已在 src/lib/auth.ts 中配置）
export const { GET, POST } = handlers;

