/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 配置 basePath 以支持部署到子路径（如 www.zalem.app/ai）
  // 如果环境变量设置了 NEXT_PUBLIC_BASE_PATH，使用环境变量；否则使用空字符串（根路径）
  // 如果需要部署到 /ai 子路径，在 Vercel 环境变量中设置 NEXT_PUBLIC_BASE_PATH=/ai
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'github.com',
      },
    ],
  },
  eslint: {
    // 在构建时忽略 ESLint 警告，避免构建失败
    ignoreDuringBuilds: false,
    // 或者设置为 true 来完全忽略 ESLint（不推荐）
    // ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;