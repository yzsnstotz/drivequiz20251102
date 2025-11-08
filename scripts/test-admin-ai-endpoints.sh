#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# 测试管理员 AI 端点脚本
# 测试端点：
#   - /api/admin/ai/logs
#   - /api/admin/ai/filters
#   - /api/admin/ai/rag/docs
# ============================================================

# 从环境变量读取配置
BASE_URL="${BASE_URL:-https://drivequiz20251102-app.vercel.app}"
ADMIN_TOKEN="${ADMIN_TOKEN:-}"
VERCEL_BYPASS_TOKEN="${VERCEL_BYPASS_TOKEN:-dgo9MHSPwyVg85bb2dcCab2HuUJ0Wuws}"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查必需参数
if [ -z "$ADMIN_TOKEN" ]; then
  echo -e "${RED}错误: ADMIN_TOKEN 环境变量未设置${NC}"
  exit 1
fi

# 构建 bypass 参数和 Cookie
if [ -n "$VERCEL_BYPASS_TOKEN" ]; then
  BYPASS_PARAMS="?x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=$VERCEL_BYPASS_TOKEN"
  BYPASS_COOKIE="x-vercel-protection-bypass=$VERCEL_BYPASS_TOKEN"
else
  BYPASS_PARAMS=""
  BYPASS_COOKIE=""
fi

echo "=========================================="
echo "测试管理员 AI 端点"
echo "=========================================="
echo "BASE_URL: $BASE_URL"
echo "ADMIN_TOKEN: ${ADMIN_TOKEN:0:20}..."
echo "VERCEL_BYPASS: ${VERCEL_BYPASS_TOKEN:+已设置}"
echo "=========================================="
echo ""

# 测试函数
test_endpoint() {
  local name="$1"
  local endpoint="$2"
  local method="${3:-GET}"
  local data="${4:-}"
  
  echo -e "${YELLOW}→ 测试: $name${NC}"
  echo "  端点: $method $endpoint"
  
  # 构建 URL：正确处理查询参数和 bypass 参数
  local url="${BASE_URL}${endpoint}"
  if [[ "$endpoint" == *"?"* ]]; then
    # 如果 endpoint 已经有查询参数，使用 & 连接 bypass 参数
    if [ -n "$VERCEL_BYPASS_TOKEN" ]; then
      url="${url}&x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=$VERCEL_BYPASS_TOKEN"
    fi
  else
    # 如果没有查询参数，使用 ? 连接 bypass 参数
    if [ -n "$VERCEL_BYPASS_TOKEN" ]; then
      url="${url}?x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=$VERCEL_BYPASS_TOKEN"
    fi
  fi
  
  local headers=(
    -H "Authorization: Bearer $ADMIN_TOKEN"
    -H "Content-Type: application/json"
  )
  
  if [ -n "$BYPASS_COOKIE" ]; then
    headers+=(-H "Cookie: $BYPASS_COOKIE")
  fi
  
  local response
  local status_code
  
  if [ "$method" = "POST" ]; then
    if [ -n "$data" ]; then
      response=$(curl -sS -w "\n%{http_code}" -X POST "$url" \
        "${headers[@]}" \
        -d "$data" 2>&1)
    else
      response=$(curl -sS -w "\n%{http_code}" -X POST "$url" \
        "${headers[@]}" 2>&1)
    fi
  else
    response=$(curl -sS -w "\n%{http_code}" "$url" \
      "${headers[@]}" 2>&1)
  fi
  
  # 提取 HTTP 状态码（最后一行）
  status_code=$(echo "$response" | tail -n1)
  # 提取响应体（除最后一行）
  body=$(echo "$response" | sed '$d')
  
  echo "  状态码: $status_code"
  
  if [ "$status_code" -ge 200 ] && [ "$status_code" -lt 300 ]; then
    echo -e "${GREEN}  ✓ 成功${NC}"
    # 尝试格式化 JSON 输出
    if command -v jq &> /dev/null; then
      echo "  响应:"
      echo "$body" | jq '.' 2>/dev/null || echo "$body" | head -c 200
    else
      echo "  响应: $(echo "$body" | head -c 200)..."
    fi
  else
    echo -e "${RED}  ✗ 失败 (HTTP $status_code)${NC}"
    echo "  错误响应:"
    echo "$body" | head -c 500
  fi
  
  echo ""
}

# 测试 1: /api/admin/ai/logs
test_endpoint "AI 日志列表" "/api/admin/ai/logs" "GET"

# 测试 1.1: /api/admin/ai/logs (带分页参数)
test_endpoint "AI 日志列表 (带分页)" "/api/admin/ai/logs?page=1&limit=10" "GET"

# 测试 2: /api/admin/ai/filters
test_endpoint "AI 过滤规则列表" "/api/admin/ai/filters" "GET"

# 测试 3: /api/admin/ai/rag/docs
test_endpoint "RAG 文档列表" "/api/admin/ai/rag/docs" "GET"

# 测试 3.1: /api/admin/ai/rag/docs (带分页参数)
test_endpoint "RAG 文档列表 (带分页)" "/api/admin/ai/rag/docs?page=1&limit=10" "GET"

# 测试 3.2: /api/admin/ai/rag/docs (带搜索参数)
test_endpoint "RAG 文档列表 (带搜索)" "/api/admin/ai/rag/docs?q=test&page=1&limit=5" "GET"

echo "=========================================="
echo "测试完成"
echo "=========================================="

