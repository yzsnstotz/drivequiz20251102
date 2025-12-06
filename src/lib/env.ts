// src/lib/env.ts

// v4: TLS 安全校验（生产环境 fail-fast）
const isProduction = process.env.NODE_ENV === "production";
if (isProduction && process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
  throw new Error(
    "\n" +
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
    "  [Security][FATAL] NODE_TLS_REJECT_UNAUTHORIZED=0 detected in production\n" +
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
    "\n" +
    "  This disables TLS certificate verification and is strictly forbidden.\n" +
    "  This is a critical security risk that could expose your application to\n" +
    "  man-in-the-middle attacks.\n" +
    "\n" +
    "  🔧 How to fix:\n" +
    "  1. Go to Vercel Dashboard > Your Project > Settings > Environment Variables\n" +
    "  2. Find and DELETE the variable: NODE_TLS_REJECT_UNAUTHORIZED\n" +
    "  3. Redeploy your application\n" +
    "\n" +
    "  ⚠️  Note: If you need this for database connections, use connection-level\n" +
    "     configuration (rejectUnauthorized: false) instead of a global env variable.\n" +
    "\n" +
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
  );
}

// v4: 在模块加载时双向同步 AUTH_URL ↔ NEXTAUTH_URL（简化版）
// Auth.js v5 推荐使用 AUTH_URL，而当前项目主要配置 NEXTAUTH_URL
// 通过此同步逻辑，确保框架内部使用统一的 base URL
if (process.env.NEXTAUTH_URL && !process.env.AUTH_URL) {
  process.env.AUTH_URL = process.env.NEXTAUTH_URL;
} else if (process.env.AUTH_URL && !process.env.NEXTAUTH_URL) {
  process.env.NEXTAUTH_URL = process.env.AUTH_URL;
}

type AuthEnvConfig = {
  secret: string;
  url: string;
};

/**
 * 获取 Auth Base URL（统一入口，强校验）
 * 
 * 生产环境要求：
 * - 必须存在 NEXTAUTH_URL 或 AUTH_URL（通过同步逻辑保证两者一致）
 * - 必须为 https:// 起始
 * - 不能包含尾部斜杠
 * 
 * 开发环境：
 * - 如果未设置，默认使用 http://localhost:3000（带警告）
 * - 允许非 https，但会给出警告
 * 
 * @returns Auth Base URL（不包含尾部斜杠）
 * @throws Error 生产环境配置不符合要求时抛出错误
 */
export function getAuthBaseUrl(): string {
  // 检测是否在构建阶段
  const IS_BUILD_TIME =
    typeof process.env.NEXT_PHASE !== "undefined" &&
    process.env.NEXT_PHASE === "phase-production-build";

  const nextAuthUrl = process.env.NEXTAUTH_URL;
  const authUrl = process.env.AUTH_URL ?? nextAuthUrl;

  // 构建阶段：返回默认值，跳过所有校验
  if (IS_BUILD_TIME) {
    return authUrl || nextAuthUrl || "http://localhost:3000";
  }

  // v4: 精简日志 - 只在启动时输出一次配置快照
  if (isProduction) {
    console.log("[NextAuth][Config] NODE_ENV=production, NEXTAUTH_URL=" + (nextAuthUrl || "未设置") + ", AUTH_URL=" + (authUrl || "未设置"));
  }

  // 生产环境：必须存在 base URL
  if (isProduction) {
    if (!authUrl) {
      throw new Error(
        `[NextAuth][Config] ❌ 生产环境必须设置 NEXTAUTH_URL 或 AUTH_URL 环境变量！\n` +
        `请在 Vercel Dashboard > Settings > Environment Variables 中添加：\n` +
        `  NEXTAUTH_URL=https://your-domain.vercel.app\n` +
        `\n详细配置指南请参考：docs/问题修复/Google_OAuth_redirect_uri_mismatch错误/修复指南.md`
      );
    }

    // 格式校验：必须为 https:// 起始
    if (!authUrl.startsWith("https://")) {
      throw new Error(
        `[NextAuth][Config] ❌ 生产环境的 base URL 必须使用 HTTPS！\n` +
        `当前值：${authUrl}\n` +
        `请修改为：https://your-domain.vercel.app`
      );
    }

    // 格式校验：不能包含尾部斜杠
    if (authUrl.endsWith("/")) {
      throw new Error(
        `[NextAuth][Config] ❌ base URL 不能包含尾部斜杠！\n` +
        `当前值：${authUrl}\n` +
        `请修改为：${authUrl.slice(0, -1)}`
      );
    }

    // 使用 URL 对象进行基本验证
    try {
      const url = new URL(authUrl);
      if (url.protocol !== "https:") {
        throw new Error(`协议必须是 https`);
      }
    } catch (error) {
      throw new Error(
        `[NextAuth][Config] ❌ base URL 格式无效：${authUrl}\n` +
        `请使用格式：https://your-domain.vercel.app`
      );
    }

    return authUrl;
  }

  // 开发环境：如果未设置，使用默认值（带警告）
  if (!authUrl) {
    const defaultUrl = "http://localhost:3000";
    console.warn(`[NextAuth][Config] ⚠️  NEXTAUTH_URL/AUTH_URL 未设置，使用默认值：${defaultUrl}`);
    return defaultUrl;
  }

  // 开发环境：检查格式（仅警告，不阻止启动）
  if (!authUrl.startsWith("https://") && !authUrl.startsWith("http://localhost")) {
    console.warn(`[NextAuth][Config] ⚠️  开发环境建议使用 http://localhost:3000，当前值：${authUrl}`);
  }

  if (authUrl.endsWith("/")) {
    console.warn(`[NextAuth][Config] ⚠️  base URL 不应包含尾部斜杠，当前值：${authUrl}`);
    // 开发环境自动修复尾部斜杠
    return authUrl.slice(0, -1);
  }

  return authUrl;
}

/**
 * 获取 Auth 环境配置（向后兼容）
 * 
 * @deprecated 建议直接使用 getAuthBaseUrl() 获取 base URL
 * 此函数保留用于向后兼容，但内部已改为使用 getAuthBaseUrl()
 */
export function getAuthEnvConfig(): AuthEnvConfig {
  const secret =
    process.env.NEXTAUTH_SECRET ??
    process.env.AUTH_SECRET ??
    "";

  // 使用统一的 getAuthBaseUrl() 获取 URL
  let url: string;
  try {
    url = getAuthBaseUrl();
  } catch (error) {
    // 如果 getAuthBaseUrl() 抛出错误，在生产环境应该阻止启动
    if (isProduction) {
      throw error;
    }
    // 开发环境：返回空字符串（虽然不应该发生，因为 getAuthBaseUrl() 有默认值）
    url = "";
  }

  if (isProduction && !secret) {
    console.error(
      "[NextAuth][Config] ❌ Auth secret is missing. Please set NEXTAUTH_SECRET or AUTH_SECRET in Vercel env."
    );
  }

  return { secret, url };
}

/**
 * 轻量环境变量校验（服务器侧）
 * - 仅在开发环境打印缺失项
 * - 生产环境由 getAuthBaseUrl 等强校验保证 fail-fast
 */
export function validateEnv(): void {
  const requiredEnv = [
    "NEXTAUTH_SECRET",
    "NEXTAUTH_URL",
  ];
  const missing = requiredEnv.filter((k) => !process.env[k] || process.env[k] === "");
  if (missing.length > 0 && process.env.NODE_ENV !== "production") {
    console.error("[env] Missing required env vars:", missing);
  }
}
