#!/bin/bash

# 快速查询 Datapull 上传的分片

cd "$(dirname "$0")"

# 获取 Token
TOKEN=$(grep "^DRIVEQUIZ_API_TOKEN_SECRET=" .env | cut -d'=' -f2)

if [ -z "$TOKEN" ]; then
  echo "❌ 未找到 DRIVEQUIZ_API_TOKEN_SECRET"
  exit 1
fi

API_URL="http://localhost:8789/api/v1/rag"

echo "🔍 查询 Datapull 上传的分片..."
echo ""

# 查询操作记录列表
echo "📋 操作记录列表："
echo "---"
curl -s -X GET "$API_URL/operations?limit=5" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool 2>/dev/null || \
curl -s -X GET "$API_URL/operations?limit=5" \
  -H "Authorization: Bearer $TOKEN"

echo ""
echo ""

# 如果有操作记录，显示第一个操作的详情
OPERATION_ID=$(curl -s -X GET "$API_URL/operations?limit=1" \
  -H "Authorization: Bearer $TOKEN" | \
  python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', [{}])[0].get('operationId', ''))" 2>/dev/null)

if [ -n "$OPERATION_ID" ] && [ "$OPERATION_ID" != "None" ]; then
  echo "📄 最新操作的文档列表："
  echo "---"
  curl -s -X GET "$API_URL/operations/$OPERATION_ID" \
    -H "Authorization: Bearer $TOKEN" | python3 -m json.tool 2>/dev/null || \
  curl -s -X GET "$API_URL/operations/$OPERATION_ID" \
    -H "Authorization: Bearer $TOKEN"
else
  echo "ℹ️  暂无操作记录"
fi

echo ""
echo "💡 提示：使用 tsx scripts/query-documents.ts 查看更多详情"

