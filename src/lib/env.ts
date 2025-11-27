// src/lib/env.ts

// v3: 在模块加载时同步 AUTH_URL ← NEXTAUTH_URL
// Auth.js v5 推荐使用 AUTH_URL，而当前项目主要配置 NEXTAUTH_URL
// 通过此同步逻辑，确保框架内部使用统一的 base URL
if (process.env.NEXTAUTH_URL && !process.env.AUTH_URL) {
  // 将 NEXTAUTH_URL 同步给 AUTH_URL，确保 Auth.js v5 内部使用统一的 base URL
  process.env.AUTH_URL = process.env.NEXTAUTH_URL;

  if (process.env.NODE_ENV === "production") {
    console.log(
      "[NextAuth][Config] AUTH_URL 未设置，已在运行时自动同步为 NEXTAUTH_URL=",
      process.env.NEXTAUTH_URL,
    );
  } else {
    console.log(
      "[NextAuth][Config] (dev) AUTH_URL 同步自 NEXTAUTH_URL=",
      process.env.NEXTAUTH_URL,
    );
  }
}

type AuthEnvConfig = {
  secret: string;
  url: string;
};

/**
 * 获取 Auth Base URL（统一入口，强校验）
 * 
 * 生产环境要求：
 * - 必须存在 NEXTAUTH_URL
 * - 必须为 https:// 起始
 * - 不能包含尾部斜杠
 * 
 * 开发环境：
 * - 如果未设置 NEXTAUTH_URL，默认使用 http://localhost:3000（带警告）
 * - 允许非 https，但会给出警告
 * 
 * @returns Auth Base URL（不包含尾部斜杠）
 * @throws Error 生产环境配置不符合要求时抛出错误
 */
export function getAuthBaseUrl(): string {
  const isProduction = process.env.NODE_ENV === "production";
  const nextAuthUrl = process.env.NEXTAUTH_URL;
  const authUrl = process.env.AUTH_URL;

  // v3: 输出环境变量快照，便于排查
  console.log("[NextAuth][Config] 环境变量快照:", {
    NODE_ENV: process.env.NODE_ENV,
    NEXTAUTH_URL: nextAuthUrl,
    AUTH_URL: authUrl,
    AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST,
  });

  // 生产环境：必须存在 NEXTAUTH_URL
  if (isProduction) {
    if (!nextAuthUrl) {
      throw new Error(
        `[NextAuth][Config] ❌ 生产环境必须设置 NEXTAUTH_URL 环境变量！\n` +
        `请在 Vercel Dashboard > Settings > Environment Variables 中添加：\n` +
        `  NEXTAUTH_URL=https://your-domain.vercel.app\n` +
        `\n详细配置指南请参考：docs/问题修复/Google_OAuth_redirect_uri_mismatch错误/修复指南.md`
      );
    }

    // 格式校验：必须为 https:// 起始
    if (!nextAuthUrl.startsWith("https://")) {
      throw new Error(
        `[NextAuth][Config] ❌ 生产环境的 NEXTAUTH_URL 必须使用 HTTPS！\n` +
        `当前值：${nextAuthUrl}\n` +
        `请修改为：https://your-domain.vercel.app`
      );
    }

    // 格式校验：不能包含尾部斜杠
    if (nextAuthUrl.endsWith("/")) {
      throw new Error(
        `[NextAuth][Config] ❌ NEXTAUTH_URL 不能包含尾部斜杠！\n` +
        `当前值：${nextAuthUrl}\n` +
        `请修改为：${nextAuthUrl.slice(0, -1)}`
      );
    }

    // 使用 URL 对象进行基本验证
    try {
      const url = new URL(nextAuthUrl);
      if (url.protocol !== "https:") {
        throw new Error(`协议必须是 https`);
      }
    } catch (error) {
      throw new Error(
        `[NextAuth][Config] ❌ NEXTAUTH_URL 格式无效：${nextAuthUrl}\n` +
        `请使用格式：https://your-domain.vercel.app`
      );
    }

    // 生产环境启动时输出确认日志
    console.log(`[NextAuth][Config] ✅ 使用的 Auth Base URL: ${nextAuthUrl}`);
    return nextAuthUrl;
  }

  // 开发环境：如果未设置，使用默认值（带警告）
  if (!nextAuthUrl) {
    const defaultUrl = "http://localhost:3000";
    console.warn(
      `[NextAuth][Config] ⚠️  NEXTAUTH_URL 未设置，使用默认值：${defaultUrl}\n` +
      `建议在 .env.local 中设置 NEXTAUTH_URL=${defaultUrl}`
    );
    return defaultUrl;
  }

  // 开发环境：检查格式（仅警告，不阻止启动）
  if (!nextAuthUrl.startsWith("https://") && !nextAuthUrl.startsWith("http://localhost")) {
    console.warn(
      `[NextAuth][Config] ⚠️  开发环境建议使用 http://localhost:3000\n` +
      `当前值：${nextAuthUrl}\n` +
      `注意：生产环境必须使用 HTTPS！`
    );
  }

  if (nextAuthUrl.endsWith("/")) {
    console.warn(
      `[NextAuth][Config] ⚠️  NEXTAUTH_URL 不应包含尾部斜杠\n` +
      `当前值：${nextAuthUrl}\n` +
      `建议修改为：${nextAuthUrl.slice(0, -1)}`
    );
    // 开发环境自动修复尾部斜杠
    return nextAuthUrl.slice(0, -1);
  }

  console.log(`[NextAuth][Config] ✅ 使用的 Auth Base URL: ${nextAuthUrl}`);
  return nextAuthUrl;
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
    // 但在向后兼容函数中，我们仍然返回空字符串（调用方需要处理）
    if (process.env.NODE_ENV === "production") {
      // 生产环境：重新抛出错误
      throw error;
    }
    // 开发环境：返回空字符串（虽然不应该发生，因为 getAuthBaseUrl() 有默认值）
    url = "";
  }

  if (process.env.NODE_ENV === "production") {
    if (!secret) {
      console.error(
        "[NextAuth][Config] ❌ Auth secret is missing. Please set NEXTAUTH_SECRET or AUTH_SECRET in Vercel env."
      );
    }
  }

  return { secret, url };
}
