#!/bin/bash
# 测试本地AI服务脚本

JWT_TOKEN="eyJhbGciOiJIUzI1NiIsImtpZCI6IjRKYytuUHJWdFArSUxQUVQiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3ZkdG56anZtdnJjZHBsYXd3aWFlLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiJjYmNjMWJiYy1iOWIxLTQ4ZjQtYjQ0Zi03ZGJlZWQ3OGMzYWQiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzYyMTc5MjE5LCJpYXQiOjE3NjIxNzU2MTksImVtYWlsIjoidGVzdEB6YWxlbS5hcHAiLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImVtYWlsIiwicHJvdmlkZXJzIjpbImVtYWlsIl19LCJ1c2VyX21ldGFkYXRhIjp7ImVtYWlsX3ZlcmlmaWVkIjp0cnVlfSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJwYXNzd29yZCIsInRpbWVzdGFtcCI6MTc2MjE3NTYxOX1dLCJzZXNzaW9uX2lkIjoiZmExMzAzMGItODczMC00YTk3LWE3MTItYTVjYzFiMzJiYmU4IiwiaXNfYW5vbnltb3VzIjpmYWxzZX0.iVM5lEHkF8ND9GIcY47TGVPnpHWrUxjF-Kvb6kU7yHc"

echo "=== 测试本地AI服务健康检查 ==="
curl -s http://localhost:8788/healthz | python3 -m json.tool 2>/dev/null || curl -s http://localhost:8788/healthz
echo ""
echo ""

echo "=== 测试主站路由（应该使用本地AI服务） ==="
curl -X POST http://localhost:3000/api/ai/ask \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{"question": "日本驾考中，超速行驶的处罚是什么？", "locale": "zh-CN"}' \
  2>&1 | python3 -m json.tool 2>/dev/null | head -30 || curl -X POST http://localhost:3000/api/ai/ask \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{"question": "日本驾考中，超速行驶的处罚是什么？", "locale": "zh-CN"}' \
  2>&1 | head -30
echo ""
echo ""

echo "=== 检查响应中的模型 ==="
echo "如果看到 'llama3.2:3b'，说明使用的是本地AI服务 ✅"
echo "如果看到 'gpt-4o-mini'，说明仍在使用在线AI服务 ⚠️"
