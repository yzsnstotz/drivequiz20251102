# RAG Docs API 数据库连接信息

## 📊 数据库连接配置

### API 路由
- **路径**: `/api/admin/ai/rag/docs`
- **文件位置**: `apps/web/app/api/admin/ai/rag/docs/route.ts` 或 `src/app/api/admin/ai/rag/docs/route.ts`

### 数据库连接方式
- ✅ **使用直接数据库连接** (Kysely)
- ✅ **连接来源**: `import { aiDb } from "@/lib/aiDb"`
- ✅ **配置文件**: `src/lib/aiDb.ts`
- ✅ **环境变量**: `AI_DATABASE_URL`

---

## 🔑 环境变量名称

### 主要环境变量

**`AI_DATABASE_URL`** (必需)
- AI Service 数据库连接字符串
- 格式：`postgresql://user:password@host:port/database?sslmode=require`

### 环境变量读取逻辑

```typescript
// src/lib/aiDb.ts (第 130-139 行)
function getAiConnectionString(): string {
  const connectionString = process.env.AI_DATABASE_URL;
  
  if (!connectionString) {
    console.error('[AI DB] AI_DATABASE_URL is not configured!');
    return 'postgresql://placeholder:placeholder@placeholder:5432/placeholder';
  }
  
  return connectionString;
}
```

**注意：**
- ✅ 使用 `AI_DATABASE_URL` 环境变量
- ✅ 连接到 AI Service 数据库（不是主应用数据库）
- ❌ 不使用 `DATABASE_URL` 或 `POSTGRES_URL`

---

## 🗄️ 数据库表

### 查询的表
- **表名**: `ai_rag_docs`
- **用途**: 存储 RAG 文档元数据

### 表结构字段
- `id` - 主键
- `title` - 文档标题
- `url` - 文档URL
- `lang` - 语言代码
- `tags` - 标签数组
- `status` - 状态
- `version` - 版本号
- `chunks` - 分片数量
- `created_at` - 创建时间
- `updated_at` - 更新时间

---

## 🔍 检查环境变量

### 在 Vercel 中检查

1. 登录 Vercel 控制台
2. 进入项目设置
3. 查看 **Environment Variables** 部分
4. 查找以下变量：
   - `AI_DATABASE_URL` (必需)

### 在本地开发中检查

```bash
# 检查环境变量
echo $AI_DATABASE_URL

# 或在 .env.local 文件中查看
cat .env.local | grep AI_DATABASE_URL
```

---

## ⚠️ 常见问题

### 问题 1: 环境变量未设置

**症状：**
- 500 错误
- 错误信息：`Database query failed: ...`
- 日志中可能看到 "AI_DATABASE_URL is not configured!"

**解决方法：**
1. 在 Vercel 项目设置中添加 `AI_DATABASE_URL` 环境变量
2. 确保环境变量值正确（AI Service 数据库连接字符串）
3. 重新部署应用

### 问题 2: 环境变量格式错误

**症状：**
- 连接失败
- 错误信息：`connection refused` 或 `authentication failed`

**解决方法：**
1. 检查连接字符串格式
2. 确保包含所有必需部分：`postgresql://user:password@host:port/database`
3. 验证用户名、密码、主机、端口、数据库名是否正确

### 问题 3: 数据库表不存在

**症状：**
- 500 错误
- 错误信息：`relation "ai_rag_docs" does not exist`

**解决方法：**
1. 执行数据库迁移脚本创建表
2. 检查数据库连接是否指向正确的数据库实例

---

## 📝 环境变量示例

### Supabase AI Service 数据库连接字符串格式

```bash
# AI Service 数据库 DIRECT 连接（端口 5432）
AI_DATABASE_URL=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres?sslmode=require
```

**示例（实际配置）：**
```bash
AI_DATABASE_URL=postgresql://postgres:zKV0rtIV1QOByu89@db.cgpmpfnjzlzbquakmmrj.supabase.co:5432/postgres?sslmode=require
```

### 本地 PostgreSQL 连接字符串格式

```bash
AI_DATABASE_URL=postgresql://postgres:password@localhost:5432/ai_database
```

---

## 🔗 相关文件

- **数据库配置**: `src/lib/aiDb.ts` (AI Service 数据库)
- **API 路由**: `apps/web/app/api/admin/ai/rag/docs/route.ts`
- **数据库迁移**: `src/migrations/20250115_create_ai_tables.sql`

---

## 📋 快速检查清单

- [ ] 环境变量 `AI_DATABASE_URL` 已设置
- [ ] 环境变量格式正确
- [ ] 数据库连接字符串包含所有必需部分
- [ ] 数据库服务正在运行
- [ ] 数据库表 `ai_rag_docs` 已创建（在 AI Service 数据库中）
- [ ] 数据库用户有访问表的权限
- [ ] 连接到正确的数据库实例（AI Service 数据库，不是主应用数据库）

