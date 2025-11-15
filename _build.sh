#!/bin/bash
set -e

echo "🔨 开始 Cloudflare 构建..."

# 安装依赖（包括 devDependencies，因为 @opennextjs/cloudflare 在 devDependencies 中）
echo "📦 安装依赖..."
npm install

# 构建 OpenNext Cloudflare 版本
echo "🏗️  构建 OpenNext Cloudflare 版本..."
npx @opennextjs/cloudflare build

echo "✅ 构建完成！"

