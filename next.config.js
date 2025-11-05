/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 配置 basePath 以支持部署到 www.zalem.app/ai
  // 如果环境变量设置了 BASEPATH，使用环境变量；否则使用 /ai
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '/ai',
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