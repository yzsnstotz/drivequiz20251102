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

  const url =
    process.env.NEXTAUTH_URL ??
    process.env.AUTH_URL ??
    "";

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
    }
  }

  return { secret, url };
}

