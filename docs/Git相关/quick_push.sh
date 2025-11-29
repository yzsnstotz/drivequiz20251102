#!/bin/bash
# quick_push.sh - 快速推送脚本

cd /Users/leoventory/desktop/kkdrivequiz

echo "=========================================="
echo "推送到 GitHub - localAiModule 分支"
echo "=========================================="
echo ""

# 检查是否有 token 环境变量
if [ -n "$GITHUB_TOKEN" ]; then
    echo "✅ 检测到 GITHUB_TOKEN 环境变量"
    echo "使用 token 推送..."
    echo ""
    
    # 使用 token 推送
    git push https://${GITHUB_TOKEN}@github.com/yzsnstotz/drivequiz20251102.git localAiModule
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "=========================================="
        echo "✅ 推送成功！"
        echo "=========================================="
        echo ""
        echo "分支已推送到 GitHub:"
        echo "https://github.com/yzsnstotz/drivequiz20251102/tree/localAiModule"
        exit 0
    else
        echo ""
        echo "❌ 推送失败，请检查 token 是否有效"
        exit 1
    fi
fi

# 如果没有 token，提示用户
echo "⚠️  未设置 GITHUB_TOKEN 环境变量"
echo ""
echo "请选择以下方法之一："
echo ""
echo "方法 1: 使用环境变量（推荐）"
echo "  1. 创建 Personal Access Token: https://github.com/settings/tokens"
echo "  2. 执行: export GITHUB_TOKEN=your_token_here"
echo "  3. 执行: ./quick_push.sh"
echo ""
echo "方法 2: 直接在 URL 中使用 token"
echo "  git push https://YOUR_TOKEN@github.com/yzsnstotz/drivequiz20251102.git localAiModule"
echo ""
echo "方法 3: 使用交互式推送（会提示输入）"
echo "  git push -u origin localAiModule"
echo ""
echo "=========================================="
echo ""
read -p "是否尝试交互式推送？(y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "执行交互式推送..."
    git push -u origin localAiModule
else
    echo "取消推送"
    exit 1
fi




