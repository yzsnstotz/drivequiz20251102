#!/bin/bash
# 构建检查脚本
# 使用方法: ./scripts/check-build.sh

set -e

echo "🔍 开始构建检查..."
echo ""

# 1. TypeScript 类型检查
echo "📝 运行 TypeScript 类型检查..."
if npx tsc --noEmit > typecheck-errors.log 2>&1; then
  echo "✅ TypeScript 类型检查通过"
  rm -f typecheck-errors.log
else
  echo "❌ TypeScript 类型检查失败"
  echo "   错误日志已保存到: typecheck-errors.log"
  echo ""
  echo "前10个错误:"
  head -20 typecheck-errors.log
  echo ""
fi

# 2. ESLint 检查
echo ""
echo "🔍 运行 ESLint 检查..."
if npm run lint > lint-errors.log 2>&1; then
  echo "✅ ESLint 检查通过"
  rm -f lint-errors.log
else
  echo "⚠️  ESLint 检查有警告（不影响构建）"
  echo "   警告日志已保存到: lint-errors.log"
fi

# 3. 构建检查
echo ""
echo "🏗️  运行构建检查..."
if npm run build > build-errors.log 2>&1; then
  echo "✅ 构建成功！"
  rm -f build-errors.log
  exit 0
else
  echo "❌ 构建失败"
  echo "   错误日志已保存到: build-errors.log"
  echo ""
  echo "构建错误摘要:"
  grep -E "(Type error|Failed to compile|error TS)" build-errors.log | head -10
  echo ""
  
  # 尝试自动修复
  echo "🔧 尝试自动修复常见错误..."
  if command -v npx &> /dev/null; then
    npx tsx scripts/auto-fix-build-errors.ts 2>/dev/null || echo "   自动修复脚本未找到或执行失败"
  fi
  
  exit 1
fi

