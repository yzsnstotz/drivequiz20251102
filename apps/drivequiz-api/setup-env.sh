#!/bin/bash

# DriveQuiz API 环境变量配置脚本

ENV_FILE=".env"

echo "🔧 配置 DriveQuiz API 环境变量..."
echo ""

# 检查 .env 文件是否存在
if [ ! -f "$ENV_FILE" ]; then
    echo "创建 .env 文件..."
    touch "$ENV_FILE"
fi

# 检查并添加必需的环境变量
add_env_var() {
    local key=$1
    local value=$2
    local comment=$3
    
    if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
        echo "✅ ${key} 已存在，跳过"
    else
        if [ -n "$comment" ]; then
            echo "" >> "$ENV_FILE"
            echo "# ${comment}" >> "$ENV_FILE"
        fi
        echo "${key}=${value}" >> "$ENV_FILE"
        echo "✅ 已添加 ${key}"
    fi
}

# 添加必需的环境变量
echo "添加必需的环境变量..."

# 数据库连接（使用 AI Service 数据库，因为 drivequiz-api 需要存储 RAG 文档）
add_env_var "DRIVEQUIZ_DB_URL" "postgresql://postgres:zKV0rtIV1QOByu89@db.cgpmpfnjzlzbquakmmrj.supabase.co:5432/postgres?sslmode=require" "数据库连接字符串（AI Service 数据库）"

# API 认证密钥
add_env_var "DRIVEQUIZ_API_TOKEN_SECRET" "drivequiz-api-secret-token-$(date +%s)" "API 认证密钥（请修改为安全的密钥）"

# 向量化服务地址（本地开发使用 localhost:8788，指向 local-ai-service）
add_env_var "AI_VECTORIZE_URL" "http://localhost:8788/v1/admin/rag/ingest" "向量化服务地址（Local AI Service - Ollama）"

# 可选配置
add_env_var "RAG_ENABLE_SERVER_CHUNK" "false" "是否启用服务端分片（默认 false，使用 Datapull 预分片）"
add_env_var "MAX_BATCH_SIZE" "100" "批量上传最大文档数"
add_env_var "PORT" "8789" "服务端口"
add_env_var "HOST" "0.0.0.0" "服务监听地址"
add_env_var "LOG_LEVEL" "info" "日志级别"
add_env_var "NODE_ENV" "development" "运行环境"

echo ""
echo "✅ 环境变量配置完成！"
echo ""
echo "⚠️  重要提示："
echo "1. 请检查 DRIVEQUIZ_API_TOKEN_SECRET 并修改为安全的密钥"
echo "2. 如果 AI Service 运行在不同端口，请修改 AI_VECTORIZE_URL"
echo "3. 生产环境请使用安全的数据库连接字符串"
echo ""
echo "📝 查看配置："
echo "   cat $ENV_FILE"
echo ""

