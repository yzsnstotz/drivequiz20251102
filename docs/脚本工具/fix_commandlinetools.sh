#!/bin/bash
# fix_commandlinetools.sh - 修复 CommandLineTools

echo "=========================================="
echo "修复 CommandLineTools"
echo "=========================================="
echo ""

# 检查当前状态
echo "1. 检查当前状态..."
CURRENT_PATH=$(xcode-select --print-path 2>/dev/null)
echo "   当前路径: $CURRENT_PATH"

# 检查 xcrun 是否存在
if [ -f "/Library/Developer/CommandLineTools/usr/bin/xcrun" ]; then
    echo "   ✅ xcrun 文件存在"
else
    echo "   ❌ xcrun 文件缺失"
fi

echo ""
echo "2. 尝试修复方法..."
echo ""

# 方法 1: 重置 CommandLineTools
echo "方法 1: 重置 CommandLineTools"
echo "执行: sudo xcode-select --reset"
echo ""
echo "请手动在终端执行以下命令（需要管理员密码）："
echo "  sudo xcode-select --reset"
echo ""

# 方法 2: 重新安装 CommandLineTools
echo "方法 2: 重新安装 CommandLineTools"
echo "执行: xcode-select --install"
echo ""
echo "这会打开一个对话框，点击'安装'按钮"
echo "或者手动执行: xcode-select --install"
echo ""

# 检查是否可以自动执行
if command -v sudo &> /dev/null; then
    echo "3. 尝试自动修复（需要管理员权限）..."
    echo ""
    read -p "是否尝试自动修复？需要输入管理员密码 (y/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "执行: sudo xcode-select --reset"
        sudo xcode-select --reset 2>&1
        
        if [ $? -eq 0 ]; then
            echo "✅ 重置成功！"
            echo ""
            echo "验证修复结果..."
            xcode-select --print-path
            if xcrun --version &> /dev/null; then
                echo "✅ xcrun 现在可用！"
            else
                echo "⚠️  xcrun 仍然不可用，可能需要重新安装 CommandLineTools"
                echo "执行: xcode-select --install"
            fi
        else
            echo "❌ 重置失败"
        fi
    else
        echo "跳过自动修复"
    fi
else
    echo "3. 无法自动执行，需要手动操作"
fi

echo ""
echo "=========================================="
echo "修复指南"
echo "=========================================="
echo ""
echo "如果自动修复失败，请手动执行以下步骤："
echo ""
echo "步骤 1: 重置 CommandLineTools"
echo "  在终端执行: sudo xcode-select --reset"
echo "  输入管理员密码"
echo ""
echo "步骤 2: 如果重置失败，重新安装"
echo "  在终端执行: xcode-select --install"
echo "  会弹出对话框，点击'安装'"
echo "  等待安装完成（可能需要几分钟）"
echo ""
echo "步骤 3: 验证修复"
echo "  执行: xcrun --version"
echo "  应该显示版本号，而不是错误"
echo ""
echo "步骤 4: 验证 git 命令"
echo "  执行: git --version"
echo "  应该显示 git 版本号"
echo ""
echo "=========================================="

