#!/bin/bash
set -e

echo "🔨 开始 Cloudflare 构建..."

# 安装依赖（包括 devDependencies 和可选依赖）
# 确保所有平台特定的原生模块都被安装
echo "📦 安装依赖..."
npm install --include=optional

# 验证关键依赖是否已安装
if [ ! -d "node_modules/@ast-grep/napi-linux-x64-gnu" ]; then
  echo "⚠️  警告: @ast-grep/napi-linux-x64-gnu 未找到，尝试重新安装..."
  npm install @ast-grep/napi-linux-x64-gnu --save-optional || true
fi

# 构建 OpenNext Cloudflare 版本
echo "🏗️  构建 OpenNext Cloudflare 版本..."
npx @opennextjs/cloudflare build

echo "✅ 构建完成！"

