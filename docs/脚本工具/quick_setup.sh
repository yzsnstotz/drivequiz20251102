#!/bin/bash
# quick_setup.sh - 快速设置脚本

cd /Users/leoventory/desktop/kkdrivequiz

echo "=========================================="
echo "Git 仓库完整设置"
echo "=========================================="

# 检查 git 是否可用
if ! command -v git &> /dev/null; then
    echo "❌ Git 命令不可用，请先修复 CommandLineTools"
    echo "执行: sudo xcode-select --reset"
    exit 1
fi

# 检查 git 命令是否正常
if ! git --version &> /dev/null; then
    echo "❌ Git 命令执行失败，请先修复 CommandLineTools"
    echo "执行: sudo xcode-select --reset"
    exit 1
fi

echo "✅ Git 命令可用"

# 配置用户
echo ""
echo "1. 配置用户信息..."
git config user.name "Auto" 2>/dev/null || git config user.name "User"
git config user.email "auto@example.com" 2>/dev/null || git config user.email "user@example.com"
echo "   ✅ 配置完成"

# 添加文件
echo ""
echo "2. 添加所有文件..."
git add .
if [ $? -eq 0 ]; then
    echo "   ✅ 文件已添加"
else
    echo "   ⚠️  添加文件可能失败"
fi

# 创建分支
echo ""
echo "3. 创建分支..."
git checkout -b localAiModule 2>/dev/null
if [ $? -eq 0 ]; then
    echo "   ✅ 分支已创建"
else
    echo "   ℹ️  分支可能已存在，继续执行..."
fi

# 提交
echo ""
echo "4. 提交..."
git commit -m "Initial commit: Add all cleaned project files to localAiModule branch"
if [ $? -eq 0 ]; then
    echo "   ✅ 提交成功"
else
    echo "   ⚠️  提交可能失败"
fi

# 验证
echo ""
echo "5. 验证..."
echo "   分支列表:"
git branch
echo ""
echo "   最新提交:"
git log --oneline -1
echo ""
echo "   分支引用:"
cat .git/refs/heads/localAiModule 2>/dev/null | head -c 10
echo "..."

# 推送
echo ""
echo "6. 推送到远程..."
echo "   执行: git push -u origin localAiModule"
echo "   如果需要身份验证，请使用 Personal Access Token"
read -p "   按 Enter 继续推送（或 Ctrl+C 取消）..."
git push -u origin localAiModule

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
    echo "⚠️  推送可能失败"
    echo "=========================================="
    echo ""
    echo "请检查："
    echo "1. GitHub 身份验证（使用 Personal Access Token）"
    echo "2. 网络连接"
    echo "3. 远程仓库权限"
fi

