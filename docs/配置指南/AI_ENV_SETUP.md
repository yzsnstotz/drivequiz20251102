# 📝 AI 问答模块环境变量配置指南

## 🔒 重要安全提示

**⚠️ 绝对不要将包含真实 API 密钥的 `.env` 或 `.env.local` 文件提交到 Git！**

- ✅ `.env` 和 `.env.local` 已在 `.gitignore` 中，不会被提交
- ✅ 使用 `.env.example` 作为模板
- ❌ 不要在公开仓库中暴露 OpenAI API Key、Supabase Service Key 等敏感信息

---

## 📋 环境变量清单

### 主站（Vercel / Next.js Web App）

以下环境变量需要在 **Vercel Dashboard** 或本地 `.env.local` 中配置：

| Key | 用途 | 必需 | 示例值 |
|-----|------|------|--------|
| `OPENAI_API_KEY` | 调用 GPT-4o-mini | ✅ | `sk-xxx...` |
| `AI_MODEL` | 默认 AI 模型 | ❌ | `gpt-4o-mini` |
| `AI_SERVICE_URL` | 主站→AI-Service 调用地址 | ✅ | `https://ai.zalem.app` |
| `AI_SERVICE_TOKEN` | Service Token（主站调用凭证） | ✅ | `svc_xxx...` |
| `SUPABASE_URL` | Supabase 项目 URL | ✅ | `https://xyz.supabase.co` |
| `SUPABASE_SERVICE_KEY` | 服务端密钥（AI-Service 用） | ✅ | `eyJxxx...` |
| `SUPABASE_ANON_KEY` | 前端匿名密钥（主站用） | ✅ | `eyJxxx...` |
| `AI_CACHE_REDIS_URL` | 可选 Redis 缓存连接 | ❌ | `redis://...` |
| `AI_SERVICE_SUMMARY_URL` | Admin 监控页访问 AI 摘要接口 | ✅ | `https://ai.zalem.app/v1/admin/daily-summary` |
| `RAILWAY_TOKEN` | 部署用 Token（仅 CI/CD） | ❌ | `xxx...` |

### AI-Service（Railway / Fastify App）

以下环境变量需要在 **Railway Dashboard** 或本地 `.env` 中配置：

| Key | 用途 | 必需 | 示例值 |
|-----|------|------|--------|
| `OPENAI_API_KEY` | 调用 GPT-4o-mini | ✅ | `sk-xxx...` |
| `AI_MODEL` | 默认 AI 模型 | ❌ | `gpt-4o-mini` |
| `PORT` | 服务端口 | ❌ | `8787` |
| `HOST` | 服务监听地址 | ❌ | `0.0.0.0` |
| `SERVICE_TOKENS` | AI-Service 白名单 Token 列表（逗号分隔） | ✅ | `svc_token1,svc_token2` |
| `SUPABASE_URL` | Supabase 项目 URL | ✅ | `https://xyz.supabase.co` |
| `SUPABASE_SERVICE_KEY` | 服务端密钥（AI-Service 用） | ✅ | `eyJxxx...` |
| `AI_CACHE_REDIS_URL` | 可选 Redis 缓存连接 | ❌ | `redis://...` |
| `NODE_ENV` | 运行环境 | ❌ | `production` / `development` |

---

## 🔧 配置步骤

### 1. 本地开发环境（主站）

```bash
# 在项目根目录创建或编辑 .env.local
cp .env.example .env.local

# 编辑 .env.local，添加以下变量：
OPENAI_API_KEY=sk-xxx...
AI_MODEL=gpt-4o-mini
AI_SERVICE_URL=http://localhost:8787
AI_SERVICE_TOKEN=svc_dev_token_123
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
AI_SERVICE_SUMMARY_URL=http://localhost:8787/v1/admin/daily-summary
```

### 2. 本地开发环境（AI-Service）

```bash
# 在 apps/ai-service 目录创建或编辑 .env
cd apps/ai-service
cat > .env <<EOF
OPENAI_API_KEY=sk-xxx...
AI_MODEL=gpt-4o-mini
PORT=8787
HOST=0.0.0.0
SERVICE_TOKENS=svc_dev_token_123
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NODE_ENV=development
EOF
```

### 3. 生产环境（Vercel - 主站）

1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 选择项目
3. 进入 **Settings** → **Environment Variables**
4. 添加上述所有必需的环境变量
5. 确保选择正确的环境（Production / Preview / Development）

### 4. 生产环境（Railway - AI-Service）

1. 登录 [Railway Dashboard](https://railway.app/dashboard)
2. 选择项目
3. 进入 **Variables** 标签页
4. 添加上述所有必需的环境变量

---

## ✅ 验证配置

### 验证主站环境变量

```bash
# 检查环境变量是否已设置
node -e "console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing');"
node -e "console.log('AI_SERVICE_URL:', process.env.AI_SERVICE_URL || '❌ Missing');"
node -e "console.log('SUPABASE_URL:', process.env.SUPABASE_URL || '❌ Missing');"
```

### 验证 AI-Service 环境变量

```bash
cd apps/ai-service
node -e "require('dotenv').config(); console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing');"
node -e "require('dotenv').config(); console.log('SERVICE_TOKENS:', process.env.SERVICE_TOKENS || '❌ Missing');"
```

---

## 🚨 常见问题

### Q: AI-Service 启动时报错 "Missing required environment variables"

**A:** 检查 `SERVICE_TOKENS`、`OPENAI_API_KEY`、`SUPABASE_URL`、`SUPABASE_SERVICE_KEY` 是否都已设置。

### Q: 主站调用 AI-Service 返回 401 Unauthorized

**A:** 检查：
1. `AI_SERVICE_TOKEN` 是否与 AI-Service 的 `SERVICE_TOKENS` 中的某个值匹配
2. 请求头是否正确设置：`Authorization: Bearer ${AI_SERVICE_TOKEN}`

### Q: Supabase 连接失败

**A:** 检查：
1. `SUPABASE_URL` 是否正确（包含 `https://`）
2. `SUPABASE_SERVICE_KEY` 或 `SUPABASE_ANON_KEY` 是否有效
3. Supabase 项目是否已启用 pgvector 扩展（用于 `ai_vectors` 表）

### Q: Redis 缓存未生效

**A:** `AI_CACHE_REDIS_URL` 是可选的。如果未设置，系统会使用内存缓存或跳过缓存。

---

## 📚 相关文档

- [主站环境变量配置指南](./ENV_SETUP.md)
- [Vercel 环境变量配置流程](./VERCEL_ENV_FLOW.md)
- [数据库迁移说明](../DATABASE_MIGRATION_README.md)

---

## 🔐 安全最佳实践

1. **永远不要在代码中硬编码 API 密钥**
2. **使用不同的密钥用于开发和生产环境**
3. **定期轮换 API 密钥**
4. **使用最小权限原则：**
   - 主站使用 `SUPABASE_ANON_KEY`（受限权限）
   - AI-Service 使用 `SUPABASE_SERVICE_KEY`（完整权限，仅服务端）
5. **监控 API 调用量，防止密钥泄露导致滥用**

