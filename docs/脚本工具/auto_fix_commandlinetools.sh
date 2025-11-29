#!/bin/bash
# auto_fix_commandlinetools.sh - 自动修复 CommandLineTools

echo "=========================================="
echo "自动修复 CommandLineTools"
echo "=========================================="
echo ""

# 检查是否需要 sudo
if [ "$EUID" -ne 0 ]; then
    echo "⚠️  需要管理员权限来修复 CommandLineTools"
    echo ""
    echo "请执行以下命令（需要输入密码）："
    echo "  sudo $0"
    echo ""
    echo "或者手动执行："
    echo "  sudo xcode-select --reset"
    echo ""
    exit 1
fi

echo "✅ 已有管理员权限，开始修复..."
echo ""

# 方法 1: 重置
echo "1. 尝试重置 CommandLineTools..."
xcode-select --reset

if [ $? -eq 0 ]; then
    echo "   ✅ 重置成功"
else
    echo "   ⚠️  重置失败"
fi

# 检查修复结果
echo ""
echo "2. 验证修复结果..."
sleep 2

if xcrun --version &> /dev/null; then
    echo "   ✅ xcrun 现在可用！"
    xcrun --version
else
    echo "   ❌ xcrun 仍然不可用"
    echo "   需要重新安装 CommandLineTools"
    echo ""
    echo "   执行: xcode-select --install"
    exit 1
fi

# 验证 git
echo ""
echo "3. 验证 git 命令..."
if git --version &> /dev/null; then
    echo "   ✅ git 现在可用！"
    git --version
else
    echo "   ⚠️  git 仍然不可用"
fi

echo ""
echo "=========================================="
echo "修复完成！"
echo "=========================================="
echo ""
echo "现在可以执行 git 操作了："
echo "  cd /Users/leoventory/desktop/kkdrivequiz"
echo "  ./quick_setup.sh"

