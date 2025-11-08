#!/bin/bash
# 测试AI服务切换脚本

JWT_TOKEN="eyJhbGciOiJIUzI1NiIsImtpZCI6IjRKYytuUHJWdFArSUxQUVQiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3ZkdG56anZtdnJjZHBsYXd3aWFlLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiJjYmNjMWJiYy1iOWIxLTQ4ZjQtYjQ0Zi03ZGJlZWQ3OGMzYWQiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzYyMTc5MjE5LCJpYXQiOjE3NjIxNzU2MTksImVtYWlsIjoidGVzdEB6YWxlbS5hcHAiLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImVtYWlsIiwicHJvdmlkZXJzIjpbImVtYWlsIl19LCJ1c2VyX21ldGFkYXRhIjp7ImVtYWlsX3ZlcmlmaWVkIjp0cnVlfSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJwYXNzd29yZCIsInRpbWVzdGFtcCI6MTc2MjE3NTYxOX1dLCJzZXNzaW9uX2lkIjoiZmExMzAzMGItODczMC00YTk3LWE3MTItYTVjYzFiMzJiYmU4IiwiaXNfYW5vbnltb3VzIjpmYWxzZX0.iVM5lEHkF8ND9GIcY47TGVPnpHWrUxjF-Kvb6kU7yHc"

echo "=========================================="
echo "测试本地AI服务"
echo "=========================================="
echo ""

echo "1. 测试本地AI服务健康检查"
curl -s http://localhost:8788/healthz | python3 -m json.tool 2>/dev/null | head -10 || curl -s http://localhost:8788/healthz
echo ""
echo ""

echo "2. 测试本地AI服务问答接口"
curl -X POST http://localhost:8788/v1/ask \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer local_ai_token_dev_12345" \
  -d '{"question": "日本驾考", "lang": "zh"}' \
  --max-time 10 \
  2>&1 | python3 -m json.tool 2>/dev/null | head -15 || curl -X POST http://localhost:8788/v1/ask \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer local_ai_token_dev_12345" \
  -d '{"question": "日本驾考", "lang": "zh"}' \
  --max-time 10 \
  2>&1 | head -15
echo ""
echo ""

echo "3. 测试主站路由（需要主站重启后测试）"
echo "⚠️  注意：如果主站没有重启，可能仍在使用在线AI服务"
curl -X POST http://localhost:3000/api/ai/ask \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{"question": "日本驾考", "locale": "zh-CN"}' \
  --max-time 15 \
  2>&1 | python3 -m json.tool 2>/dev/null | grep -E "model|answer" | head -5 || echo "请求超时或失败"
echo ""
echo ""

echo "=========================================="
echo "检查结果"
echo "=========================================="
echo "✅ 如果看到 'llama3.2:3b' 模型，说明使用本地AI服务"
echo "⚠️  如果看到 'gpt-4o-mini' 模型，说明仍使用在线AI服务（需要重启主站）"
