#!/bin/bash
# push_with_token.sh - 使用 token 推送

cd /Users/leoventory/desktop/kkdrivequiz

echo "=========================================="
echo "推送到 GitHub - localAiModule 分支"
echo "=========================================="
echo ""

# 检查是否已配置 token
if [ -z "$GITHUB_TOKEN" ]; then
    echo "⚠️  未设置 GITHUB_TOKEN 环境变量"
    echo ""
    echo "请设置 Personal Access Token 后执行："
    echo "  export GITHUB_TOKEN=your_token_here"
    echo "  ./push_with_token.sh"
    echo ""
    echo "或者直接使用 token 推送："
    echo "  git push https://YOUR_TOKEN@github.com/yzsnstotz/drivequiz20251102.git localAiModule"
    echo ""
    exit 1
fi

# 使用 token 推送
echo "使用 token 推送..."
git push https://${GITHUB_TOKEN}@github.com/yzsnstotz/drivequiz20251102.git localAiModule

if [ $? -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "✅ 推送成功！"
    echo "=========================================="
    echo ""
    echo "分支已推送到 GitHub:"
    echo "https://github.com/yzsnstotz/drivequiz20251102/tree/localAiModule"
else
    echo ""
    echo "=========================================="
    echo "❌ 推送失败"
    echo "=========================================="
    echo ""
    echo "请检查："
    echo "1. Token 是否有效"
    echo "2. Token 是否有 repo 权限"
    echo "3. 网络连接"
fi




