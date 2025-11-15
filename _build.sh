#!/bin/bash
set -e

echo "🔨 开始 Cloudflare 构建..."

# 安装依赖
echo "📦 安装依赖..."
npm install

# 构建 OpenNext Cloudflare 版本
echo "🏗️  构建 OpenNext Cloudflare 版本..."
npm run cf:build

echo "✅ 构建完成！"

