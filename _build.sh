#!/bin/bash
set -e

echo "🔨 开始 Cloudflare 构建..."

# 安装依赖（包括 devDependencies 和可选依赖）
# 确保所有平台特定的原生模块都被安装
echo "📦 安装依赖..."
npm install --include=optional

# 显式安装 Linux x64 的原生模块（Cloudflare 构建环境需要）
echo "📦 安装平台特定的原生模块..."
npm install @ast-grep/napi-linux-x64-gnu@0.35.0 --save-optional --force || true

# 验证关键依赖是否已安装
if [ ! -d "node_modules/@ast-grep/napi-linux-x64-gnu" ]; then
  echo "❌ 错误: @ast-grep/napi-linux-x64-gnu 安装失败"
  exit 1
fi

# 构建 OpenNext Cloudflare 版本
echo "🏗️  构建 OpenNext Cloudflare 版本..."
npx @opennextjs/cloudflare build

echo "✅ 构建完成！"

