#!/bin/bash

# 修复 .env.local 文件中的 DATABASE_URL
# 将连接池 URL 改为直接连接 URL

ENV_FILE=".env.local"
BACKUP_FILE=".env.local.backup"

# 检查 .env.local 是否存在
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ .env.local 文件不存在"
    echo "正在创建 .env.local 文件..."
    
    cat > "$ENV_FILE" << EOF
# Supabase 数据库连接配置
# 项目 ID: vdtnzjvmvrcdplawwiae
# 密码: iK7USyhmI0IfWEfZ

# 数据库连接字符串（直接连接）
DATABASE_URL=postgresql://postgres:iK7USyhmI0IfWEfZ@db.vdtnzjvmvrcdplawwiae.supabase.co:5432/postgres?sslmode=require

# 管理员 Token（用于后台管理 API 鉴权）
ADMIN_TOKEN=your-admin-token-here

# 服务器时区（建议使用 UTC）
TZ=UTC
EOF
    echo "✅ 已创建 .env.local 文件"
else
    echo "📋 备份现有的 .env.local 文件..."
    cp "$ENV_FILE" "$BACKUP_FILE"
    echo "✅ 备份保存为 $BACKUP_FILE"
    
    echo ""
    echo "🔄 更新 DATABASE_URL 为直接连接..."
    
    # 使用 sed 替换连接字符串
    # 匹配各种可能的格式并替换为正确的直接连接格式
    sed -i '' \
        -e 's|DATABASE_URL=.*pooler.*|DATABASE_URL=postgresql://postgres:iK7USyhmI0IfWEfZ@db.vdtnzjvmvrcdplawwiae.supabase.co:5432/postgres?sslmode=require|g' \
        -e 's|DATABASE_URL=.*:6543.*|DATABASE_URL=postgresql://postgres:iK7USyhmI0IfWEfZ@db.vdtnzjvmvrcdplawwiae.supabase.co:5432/postgres?sslmode=require|g' \
        "$ENV_FILE"
    
    # 如果文件中没有 DATABASE_URL 或者替换失败，直接添加
    if ! grep -q "^DATABASE_URL=" "$ENV_FILE"; then
        echo "DATABASE_URL=postgresql://postgres:iK7USyhmI0IfWEfZ@db.vdtnzjvmvrcdplawwiae.supabase.co:5432/postgres?sslmode=require" >> "$ENV_FILE"
    fi
    
    echo "✅ DATABASE_URL 已更新"
fi

echo ""
echo "📝 当前 DATABASE_URL 配置："
grep "^DATABASE_URL=" "$ENV_FILE" | sed 's/\(:password\)[^@]*\(@\)/\1****\2/' | sed 's/iK7USyhmI0IfWEfZ/****/g'

echo ""
echo "✅ 修复完成！"
echo ""
echo "下一步："
echo "1. 重启开发服务器（npm run dev）"
echo "2. 访问 http://localhost:3000/api/admin/diagnose 验证连接"
echo "3. 如果连接成功，运行数据库初始化：npx tsx scripts/init-cloud-database.ts"

