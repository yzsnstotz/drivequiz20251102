#!/bin/bash

# 整理脚本和其他工具文件

cd "$(dirname "$0")/.." || exit 1

DOCS_DIR="docs"

# 移动文件函数
move_file() {
    local file="$1"
    local target_dir="$2"
    
    if [ -f "$file" ]; then
        echo "移动: $file -> $DOCS_DIR/$target_dir/"
        mkdir -p "$DOCS_DIR/$target_dir"
        mv "$file" "$DOCS_DIR/$target_dir/"
    fi
}

# Git相关脚本
for file in create_git_repo.py execute_git_operations.py manual_git_init.py setup_git_branch.py push_with_token.sh quick_push.sh force_git_operations.sh final_push.sh; do
    [ -f "$file" ] && move_file "$file" "Git相关"
done

# 测试脚本
for file in test-*.sh final-test-report.sh; do
    [ -f "$file" ] && move_file "$file" "测试脚本"
done

# 环境修复和工具脚本
for file in fix_commandlinetools.sh auto_fix_commandlinetools.sh fix-env.sh quick_setup.sh _build.sh; do
    [ -f "$file" ] && move_file "$file" "脚本工具"
done

# 部署配置文件（保留在根目录，因为可能被CI/CD使用，但也可以移动到docs）
# 这里先移动到docs/部署配置，如果CI/CD需要可以再移回
for file in docker-compose.yml render.yaml; do
    if [ -f "$file" ]; then
        echo "注意: $file 可能被CI/CD使用，移动到 $DOCS_DIR/部署配置/（如需使用请移回根目录）"
        move_file "$file" "部署配置"
    fi
done

# 临时文件和其他
for file in cookies.txt vercel.cookies; do
    if [ -f "$file" ]; then
        echo "移动临时文件: $file -> $DOCS_DIR/其他文档/"
        move_file "$file" "其他文档"
    fi
done

echo "脚本和工具文件整理完成！"
echo ""
echo "注意："
echo "1. 部署配置文件（docker-compose.yml, render.yaml）已移动到 docs/部署配置/"
echo "   如果CI/CD需要这些文件，请将它们移回根目录"
echo "2. package.json, package-lock.json, tsconfig.json, vercel.json 等核心配置文件保留在根目录"

