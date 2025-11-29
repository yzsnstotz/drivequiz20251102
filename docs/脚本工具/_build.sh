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

# 确保 _routes.json 存在（Cloudflare Pages 路由配置）
if [ ! -f ".open-next/_routes.json" ]; then
  echo "📝 创建 _routes.json 路由配置文件..."
  mkdir -p .open-next
  cat > .open-next/_routes.json << 'EOF'
{
  "version": 1,
  "include": ["/*"],
  "exclude": []
}
EOF
fi

# 验证构建输出
if [ ! -f ".open-next/worker.js" ]; then
  echo "❌ 错误: worker.js 文件不存在，构建失败"
  exit 1
else
  echo "✅ worker.js 文件已生成"
fi

# Cloudflare Pages 需要 _worker.js 作为入口点
# 将 worker.js 复制为 _worker.js（Pages 标准入口点）
if [ -f ".open-next/worker.js" ] && [ ! -f ".open-next/_worker.js" ]; then
  echo "📝 创建 _worker.js（Cloudflare Pages 入口点）..."
  cp .open-next/worker.js .open-next/_worker.js
  echo "✅ _worker.js 已创建"
fi

echo "✅ 构建完成！"

