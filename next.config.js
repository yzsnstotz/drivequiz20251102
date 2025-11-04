/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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