/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // basePath 用于部署到子路径（如 /ai），部署到子域名（如 ai.zalem.app）时保持为空
  // 如果环境变量设置了 NEXT_PUBLIC_BASE_PATH，使用环境变量；否则使用空字符串（根路径）
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  images: {
    // 配置允许的外部图片域名
    // 注意：以 / 开头的本地路径不需要在此配置
    // 如果需要添加新的图片域名，请在此添加相应的 remotePatterns 配置
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
      {
        protocol: 'https',
        hostname: 'encrypted-tbn0.gstatic.com',
      },
      {
        protocol: 'https',
        hostname: '*.gstatic.com',
      },
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
      },
      // 如果需要添加其他图片域名，请在此添加，例如：
      // {
      //   protocol: 'https',
      //   hostname: 'your-image-cdn.com',
      // },
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