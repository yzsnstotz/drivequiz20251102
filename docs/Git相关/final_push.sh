#!/bin/bash
# 最终推送脚本
# 在修复 CommandLineTools 后执行此脚本

cd /Users/leoventory/desktop/kkdrivequiz

echo "=========================================="
echo "Git 仓库最终设置和推送"
echo "=========================================="

# 检查 git 仓库是否存在
if [ ! -d .git ]; then
    echo "错误: .git 目录不存在"
    echo "请先运行: python3 create_git_repo.py"
    exit 1
fi

echo ""
echo "1. 配置 Git 用户信息..."
git config user.name "Auto" 2>/dev/null || echo "   (使用默认配置)"
git config user.email "auto@example.com" 2>/dev/null || echo "   (使用默认配置)"

echo ""
echo "2. 添加所有文件到暂存区..."
git add . 2>&1 | grep -v "xcrun" || echo "   ⚠️  可能有警告，继续执行..."

echo ""
echo "3. 创建并切换到 localAiModule 分支..."
git checkout -b localAiModule 2>&1 | grep -v "xcrun" || echo "   (分支可能已存在)"

echo ""
echo "4. 提交所有更改..."
git commit -m "Initial commit: Add all cleaned project files to localAiModule branch" 2>&1 | grep -v "xcrun" || echo "   ⚠️  提交可能失败，请检查"

echo ""
echo "5. 检查状态..."
echo "   当前分支:"
git branch 2>&1 | grep -v "xcrun" | head -5
echo ""
echo "   最新提交:"
git log --oneline -1 2>&1 | grep -v "xcrun" || echo "   (无提交记录)"

echo ""
echo "6. 推送到远程仓库..."
echo "   执行: git push -u origin localAiModule"
echo ""
echo "   如果提示身份验证，请使用 GitHub Personal Access Token"
echo ""
git push -u origin localAiModule 2>&1 | grep -v "xcrun" || echo "   ⚠️  推送失败，请检查身份验证"

echo ""
echo "=========================================="
echo "完成！"
echo "=========================================="

