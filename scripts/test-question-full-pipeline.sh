#!/bin/bash

# 测试脚本：验证 question_full_pipeline 场景修复
# 用途：测试 /v1/ask 接口对 question_full_pipeline 场景的支持

set -e

# 配置
AI_SERVICE_URL="${AI_SERVICE_URL:-http://localhost:8788}"
SERVICE_TOKEN="${SERVICE_TOKEN:-your-service-token-here}"

echo "🧪 测试 question_full_pipeline 场景修复"
echo "=========================================="
echo "AI Service URL: $AI_SERVICE_URL"
echo ""

# 测试 1: 使用对象格式的 question
echo "📝 测试 1: 使用对象格式的 question（question_full_pipeline 场景）"
echo "----------------------------------------"

RESPONSE=$(curl -sS -X POST "${AI_SERVICE_URL}/v1/ask" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SERVICE_TOKEN}" \
  -H "X-AI-Provider: openai" \
  -d '{
    "scene": "question_full_pipeline",
    "sourceLanguage": "zh",
    "targetLanguage": "ja",
    "lang": "zh",
    "question": {
      "id": 1,
      "sourceLanguage": "zh",
      "questionText": "当前方的信号灯变为黄灯时，在已经接近停止位置但如果不紧急刹车不能停下来的情况下，可以直接进入。",
      "correctAnswer": "true",
      "type": "truefalse",
      "options": null,
      "explanation": "黄灯时，如果已经接近停止位置且不紧急刹车无法停下，可以继续通行。",
      "licenseTypeTag": null,
      "stageTag": null,
      "topicTags": []
    },
    "model": "gpt-4o-mini"
  }' \
  -w "\nHTTP_STATUS:%{http_code}")

HTTP_STATUS=$(echo "$RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS:/d')

echo "HTTP 状态码: $HTTP_STATUS"
echo "响应体:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

# 验证结果
if [ "$HTTP_STATUS" = "200" ]; then
  echo "✅ 测试 1 通过: HTTP 200 响应"
  
  # 检查是否包含 answer 字段
  if echo "$BODY" | jq -e '.data.answer' > /dev/null 2>&1; then
    echo "✅ 测试 1 通过: 响应包含 answer 字段"
  else
    echo "❌ 测试 1 失败: 响应缺少 answer 字段"
    exit 1
  fi
else
  echo "❌ 测试 1 失败: HTTP 状态码不是 200"
  echo "错误详情:"
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
  exit 1
fi

echo ""
echo "=========================================="
echo "✅ 所有测试通过！"
echo ""
echo "验证点："
echo "1. ✅ scene 参数正确传递（不再出现 'scene is not defined' 错误）"
echo "2. ✅ question 对象格式被正确解析"
echo "3. ✅ question_full_pipeline 场景被正确处理"
echo "4. ✅ 返回 HTTP 200 状态码"
echo "5. ✅ 响应包含有效的 answer 字段"

