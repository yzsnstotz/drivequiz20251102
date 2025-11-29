#!/bin/bash
# 使用JWT token测试本地AI服务

JWT_TOKEN="eyJhbGciOiJIUzI1NiIsImtpZCI6IjRKYytuUHJWdFArSUxQUVQiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3ZkdG56anZtdnJjZHBsYXd3aWFlLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiJjYmNjMWJiYy1iOWIxLTQ4ZjQtYjQ0Zi03ZGJlZWQ3OGMzYWQiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzYyMTc5MjE5LCJpYXQiOjE3NjIxNzU2MTksImVtYWlsIjoidGVzdEB6YWxlbS5hcHAiLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImVtYWlsIiwicHJvdmlkZXJzIjpbImVtYWlsIl19LCJ1c2VyX21ldGFkYXRhIjp7ImVtYWlsX3ZlcmlmaWVkIjp0cnVlfSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJwYXNzd29yZCIsInRpbWVzdGFtcCI6MTc2MjE3NTYxOX1dLCJzZXNzaW9uX2lkIjoiZmExMzAzMGItODczMC00YTk3LWE3MTItYTVjYzFiMzJiYmU4IiwiaXNfYW5vbnltb3VzIjpmYWxzZX0.iVM5lEHkF8ND9GIcY47TGVPnpHWrUxjF-Kvb6kU7yHc"

echo "=========================================="
echo "测试主站路由（使用JWT token）"
echo "=========================================="
echo ""

echo "📝 测试问题：日本驾考中，超速行驶的处罚是什么？"
echo ""

RESPONSE=$(curl -s -X POST http://localhost:3000/api/ai/ask \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{"question": "日本驾考中，超速行驶的处罚是什么？", "locale": "zh-CN"}' \
  --max-time 30)

echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

echo "=========================================="
echo "检查结果"
echo "=========================================="
if echo "$RESPONSE" | grep -q "llama3.2:3b"; then
  echo "✅ 成功！使用的是本地AI服务（llama3.2:3b）"
elif echo "$RESPONSE" | grep -q "gpt-4o-mini"; then
  echo "⚠️  仍在使用在线AI服务（gpt-4o-mini）"
  echo "   请确保主站已重启并加载了 USE_LOCAL_AI=true"
else
  echo "❓ 无法确定使用的服务，请检查响应"
fi
