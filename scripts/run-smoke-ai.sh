#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# AI 集成测试脚本运行器
# 自动从配置文件或环境变量读取参数
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/smoke-ai-config.sh"
SMOKE_SCRIPT="${SCRIPT_DIR}/smoke-ai.sh"
SMOKE_WITH_BYPASS_SCRIPT="${SCRIPT_DIR}/smoke-ai-with-bypass.sh"

# 显示使用方法
usage() {
  cat <<EOF
用法: $0 [选项]

选项:
  -c, --config FILE    指定配置文件路径（默认: scripts/smoke-ai-config.sh）
  -e, --env            从环境变量读取参数（覆盖配置文件）
  -h, --help          显示此帮助信息

配置文件方式（推荐）:
  1. 复制 smoke-ai-config.example.sh 为 smoke-ai-config.sh
  2. 编辑 smoke-ai-config.sh，填写实际值
  3. 运行: $0

环境变量方式:
  export BASE_URL="https://your-app.vercel.app"
  export AI_SERVICE_URL="https://your-ai-service.onrender.com"
  export ADMIN_TOKEN="Aa123456"
  export USER_TOKEN="your-user-jwt-token"
  export AI_SERVICE_TOKEN="svc_token_xxx"
  $0 --env

命令行参数方式:
  $0 -- BASE_URL AI_SERVICE_URL ADMIN_TOKEN USER_TOKEN AI_SERVICE_TOKEN

示例:
  $0
  $0 --env
  $0 --config /path/to/custom-config.sh
  $0 -- "https://app.vercel.app" "https://ai.onrender.com" "Aa123456" "user-token" "svc-token"
EOF
  exit 1
}

# 从配置文件读取
load_config_file() {
  if [ -f "$CONFIG_FILE" ]; then
    echo "📋 从配置文件加载: $CONFIG_FILE"
    # shellcheck source=./smoke-ai-config.sh
    source "$CONFIG_FILE"
  else
    echo "⚠️  配置文件不存在: $CONFIG_FILE"
    echo "💡 提示: 复制 smoke-ai-config.example.sh 为 smoke-ai-config.sh 并填写实际值"
    return 1
  fi
}

# 验证必需的环境变量
validate_env() {
  local missing=()
  
  [ -z "${BASE_URL:-}" ] && missing+=("BASE_URL")
  [ -z "${AI_SERVICE_URL:-}" ] && missing+=("AI_SERVICE_URL")
  [ -z "${ADMIN_TOKEN:-}" ] && missing+=("ADMIN_TOKEN")
  [ -z "${USER_TOKEN:-}" ] && missing+=("USER_TOKEN")
  [ -z "${AI_SERVICE_TOKEN:-}" ] && missing+=("AI_SERVICE_TOKEN")
  
  if [ ${#missing[@]} -gt 0 ]; then
    echo "❌ 缺少必需的环境变量:"
    printf "   - %s\n" "${missing[@]}"
    echo ""
    echo "💡 请使用以下方式之一提供参数:"
    echo "   1. 配置文件: 复制 smoke-ai-config.example.sh 为 smoke-ai-config.sh"
    echo "   2. 环境变量: export BASE_URL=... (然后使用 --env)"
    echo "   3. 命令行参数: $0 -- BASE_URL AI_SERVICE_URL ..."
    exit 1
  fi
}

# 显示配置信息（隐藏敏感信息）
show_config() {
  echo "📋 测试配置:"
  echo "   BASE_URL: $BASE_URL"
  echo "   AI_SERVICE_URL: $AI_SERVICE_URL"
  echo "   ADMIN_TOKEN: ${ADMIN_TOKEN:0:8}***"
  echo "   USER_TOKEN: ${USER_TOKEN:0:8}***"
  echo "   AI_SERVICE_TOKEN: ${AI_SERVICE_TOKEN:0:8}***"
  if [ -n "${VERCEL_BYPASS_TOKEN:-}" ]; then
    echo "   VERCEL_BYPASS_TOKEN: ${VERCEL_BYPASS_TOKEN:0:8}*** (已启用)"
  fi
  echo ""
}

# 主逻辑
main() {
  local use_env=false
  local config_file=""
  
  # 解析参数
  while [ $# -gt 0 ]; do
    case "$1" in
      -h|--help)
        usage
        ;;
      -e|--env)
        use_env=true
        shift
        ;;
      -c|--config)
        config_file="$2"
        shift 2
        ;;
      --)
        shift
        # 命令行参数方式
        if [ $# -eq 5 ]; then
          BASE_URL="$1"
          AI_SERVICE_URL="$2"
          ADMIN_TOKEN="$3"
          USER_TOKEN="$4"
          AI_SERVICE_TOKEN="$5"
          validate_env
          show_config
          if [ -n "${VERCEL_BYPASS_TOKEN:-}" ] && [ -f "$SMOKE_WITH_BYPASS_SCRIPT" ]; then
            exec "$SMOKE_WITH_BYPASS_SCRIPT" "$BASE_URL" "$AI_SERVICE_URL" "$ADMIN_TOKEN" "$USER_TOKEN" "$AI_SERVICE_TOKEN" "$VERCEL_BYPASS_TOKEN"
          else
            exec "$SMOKE_SCRIPT" "$BASE_URL" "$AI_SERVICE_URL" "$ADMIN_TOKEN" "$USER_TOKEN" "$AI_SERVICE_TOKEN"
          fi
        else
          echo "❌ 需要 5 个参数: BASE_URL AI_SERVICE_URL ADMIN_TOKEN USER_TOKEN AI_SERVICE_TOKEN"
          exit 1
        fi
        ;;
      *)
        echo "❌ 未知参数: $1"
        usage
        ;;
    esac
  done
  
  # 如果指定了配置文件
  if [ -n "$config_file" ]; then
    CONFIG_FILE="$config_file"
  fi
  
  # 加载配置
  if [ "$use_env" = true ]; then
    echo "📋 从环境变量读取配置"
  else
    if ! load_config_file; then
      echo ""
      echo "💡 或者使用环境变量方式:"
      echo "   export BASE_URL=..."
      echo "   export AI_SERVICE_URL=..."
      echo "   export ADMIN_TOKEN=..."
      echo "   export USER_TOKEN=..."
      echo "   export AI_SERVICE_TOKEN=..."
      echo "   $0 --env"
      exit 1
    fi
  fi
  
  # 验证配置
  validate_env
  
  # 显示配置
  show_config
  
  # 选择使用的脚本（如果提供了 VERCEL_BYPASS_TOKEN，使用支持 bypass 的脚本）
  local selected_script="$SMOKE_SCRIPT"
  if [ -n "${VERCEL_BYPASS_TOKEN:-}" ]; then
    if [ -f "$SMOKE_WITH_BYPASS_SCRIPT" ]; then
      selected_script="$SMOKE_WITH_BYPASS_SCRIPT"
      echo "🔓 使用 Vercel Bypass 模式"
    else
      echo "⚠️  警告: VERCEL_BYPASS_TOKEN 已设置，但 smoke-ai-with-bypass.sh 不存在"
      echo "   将使用普通模式（可能无法访问受保护的端点）"
    fi
  fi
  
  # 执行测试脚本
  echo "🚀 开始执行集成测试..."
  echo ""
  
  if [ "$selected_script" = "$SMOKE_WITH_BYPASS_SCRIPT" ]; then
    exec "$selected_script" "$BASE_URL" "$AI_SERVICE_URL" "$ADMIN_TOKEN" "$USER_TOKEN" "$AI_SERVICE_TOKEN" "$VERCEL_BYPASS_TOKEN"
  else
    exec "$selected_script" "$BASE_URL" "$AI_SERVICE_URL" "$ADMIN_TOKEN" "$USER_TOKEN" "$AI_SERVICE_TOKEN"
  fi
}

main "$@"

