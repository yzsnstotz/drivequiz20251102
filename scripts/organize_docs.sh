#!/bin/bash

# 文档整理脚本
# 将根目录和docs目录下的文档按类型分类移动到docs下的对应文件夹

cd "$(dirname "$0")/.." || exit 1

DOCS_DIR="docs"

# 创建分类文件夹（如果不存在）
mkdir -p "$DOCS_DIR/实施报告"
mkdir -p "$DOCS_DIR/测试报告"
mkdir -p "$DOCS_DIR/配置指南"
mkdir -p "$DOCS_DIR/部署文档"
mkdir -p "$DOCS_DIR/问题诊断"
mkdir -p "$DOCS_DIR/Git相关"
mkdir -p "$DOCS_DIR/安全相关"
mkdir -p "$DOCS_DIR/数据库相关"
mkdir -p "$DOCS_DIR/架构文档"
mkdir -p "$DOCS_DIR/其他文档"

# 移动根目录下的文档
move_file() {
    local file="$1"
    local target_dir="$2"
    
    if [ -f "$file" ]; then
        echo "移动: $file -> $DOCS_DIR/$target_dir/"
        mv "$file" "$DOCS_DIR/$target_dir/"
    fi
}

# 实施报告
for file in *_实施报告.md *_COMPLETION_REPORT.md AI调用迁移修复完成报告.md AI调用统计与重试策略优化自检报告.md 指令0002实施报告.md; do
    [ -f "$file" ] && move_file "$file" "实施报告"
done

# 测试报告
for file in *_TEST_*.md TEST_*.md *_测试*.md ADMIN_AI_ENDPOINTS_TEST_REPORT.md AI_DATABASE_TEST_RESULTS.md SMOKE_TEST_COMPLETE_REPORT.md; do
    [ -f "$file" ] && move_file "$file" "测试报告"
done

# 配置指南
for file in *_GUIDE.md *_配置*.md *_SETUP.md CONFIGURATION_*.md COMPLETE_SETUP.md ACTIVATION_STATUS_CHECK.md; do
    [ -f "$file" ] && move_file "$file" "配置指南"
done

# 部署文档
for file in DEPLOY_* *_DEPLOYMENT*.md CLOUDFLARE_* RENDER_* VERCEL_* "# 🕒 Vercel Cron Job 配置文档.md"; do
    [ -f "$file" ] && move_file "$file" "部署文档"
done

# 问题诊断
for file in *_TROUBLESHOOTING.md *_分析报告.md *_问题分析*.md AI调用未迁移问题分析报告.md AI重构后问题分析报告.md 前台AI调用问题分析与修复报告.md 心跳服务问题分析报告.md 数据库请求溢出风险检查报告.md 429错误处理分析报告.md; do
    [ -f "$file" ] && move_file "$file" "问题诊断"
done

# Git相关
for file in GIT_* PUSH_* SSH_* README_GIT_* ADD_SSH_KEY_TO_GITHUB.md BRANCH_STATUS.md; do
    [ -f "$file" ] && move_file "$file" "Git相关"
done

# 安全相关
for file in SECURITY_* JWT_* ADMIN_AI_COMPLIANCE_AUDIT.md; do
    [ -f "$file" ] && move_file "$file" "安全相关"
done

# 数据库相关
for file in DATABASE_* *_MIGRATION*.md AI_DATABASE_*; do
    [ -f "$file" ] && move_file "$file" "数据库相关"
done

# 架构文档
for file in *_ARCHITECTURE.md *_FLOW.md *_STRUCTURE*.md AI_SERVICE_FLOW.md 接口调用链分析.md; do
    [ -f "$file" ] && move_file "$file" "架构文档"
done

# 其他文档
for file in CHANGELOG.md TROUBLESHOOTING.md FINAL_REPORT.md ACCEPTANCE_REVIEW_SUMMARY.md FUNCTIONAL_ACCEPTANCE_REVIEW.md VERSION_UPDATE_ISSUES.md QUESTIONS_STORAGE_README.md 题目类型与选项格式说明.md JSON_PACKAGE_UPDATE_ANALYSIS.md VECTOR_DIMENSION_MISMATCH_ANALYSIS.md PRODUCTION_ISSUES_REPORT.md HOW_TO_IDENTIFY_PAGES_VS_WORKERS.md; do
    [ -f "$file" ] && move_file "$file" "其他文档"
done

# 修复报告（移动到问题修复目录）
for file in FIX_* *_修复报告.md *_修复说明.md URL路径拼接修复报告.md 心跳服务问题修复报告.md 前台AI调用失败诊断报告.md LocalAIService_OPTIONS路由与配置中心修复报告.md AI_数据库连接修复说明.md 数据库配置修复说明.md; do
    if [ -f "$file" ]; then
        echo "移动: $file -> $DOCS_DIR/问题修复/"
        mkdir -p "$DOCS_DIR/问题修复"
        mv "$file" "$DOCS_DIR/问题修复/"
    fi
done

# AI相关报告
for file in AIASK_* AI_PROVIDER_* AI调用*; do
    if [ -f "$file" ]; then
        # 根据内容判断是实施报告还是问题诊断
        if [[ "$file" == *"实施"* ]] || [[ "$file" == *"COMPLETION"* ]]; then
            move_file "$file" "实施报告"
        elif [[ "$file" == *"分析"* ]] || [[ "$file" == *"检测"* ]]; then
            move_file "$file" "问题诊断"
        else
            move_file "$file" "其他文档"
        fi
    fi
done

echo "文档整理完成！"

