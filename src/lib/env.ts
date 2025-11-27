// src/lib/env.ts

type AuthEnvConfig = {
  secret: string;
  url: string;
};

export function getAuthEnvConfig(): AuthEnvConfig {
  const secret =
    process.env.NEXTAUTH_SECRET ??
    process.env.AUTH_SECRET ??
    "";

  // 优先使用 NEXTAUTH_URL，如果没有则使用 AUTH_URL
  // 如果都没有，尝试从 Vercel 环境变量中获取（Vercel 会自动设置 VERCEL_URL）
  let url =
    process.env.NEXTAUTH_URL ??
    process.env.AUTH_URL ??
    "";

  // 如果都没有设置，尝试使用 Vercel 提供的环境变量
  if (!url && process.env.VERCEL_URL) {
    // Vercel 自动提供的 URL（不包含协议）
    url = `https://${process.env.VERCEL_URL}`;
    console.warn("[NextAuth][Config] ⚠️ 使用 VERCEL_URL 作为回退方案:", url);
    console.warn("[NextAuth][Config] 建议在 Vercel 环境变量中明确设置 NEXTAUTH_URL 或 AUTH_URL");
  }

  if (process.env.NODE_ENV === "production") {
    if (!secret) {
      console.error(
        "[NextAuth][Config] ❌ Auth secret is missing. Please set NEXTAUTH_SECRET or AUTH_SECRET in Vercel env."
      );
    }

    if (!url) {
      console.error(
        "[NextAuth][Config] ❌ Auth URL is missing. Please set NEXTAUTH_URL or AUTH_URL in Vercel env."
      );
      console.error(
        "[NextAuth][Config] 这会导致 OAuth redirect_uri_mismatch 错误！"
      );
      console.error(
        "[NextAuth][Config] 请在 Vercel Dashboard > Settings > Environment Variables 中添加："
      );
      console.error(
        "[NextAuth][Config]   NEXTAUTH_URL=https://your-domain.vercel.app"
      );
    }
  }

  return { secret, url };
}

