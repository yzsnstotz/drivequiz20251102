# 本地开发环境变量配置指南

## 📋 快速开始

### 1. 复制环境变量模板

```bash
# 从模板复制到本地配置文件
cp .env.example .env.local
```

### 2. 填写必需的环境变量

编辑 `.env.local` 文件，填写以下必需的环境变量：

#### 必需配置项

1. **数据库连接**
   - `DATABASE_URL` - 主应用数据库连接字符串
   - `AI_DATABASE_URL` - AI Service 数据库连接字符串

2. **Supabase 配置**
   - `SUPABASE_URL` - Supabase 项目 URL
   - `SUPABASE_SERVICE_KEY` - Supabase 服务端密钥

3. **JWT 认证**
   - `USER_JWT_SECRET` - 用户 JWT 密钥

## 🔑 获取环境变量值

### 1. 数据库连接字符串

#### 主应用数据库

从 Supabase Dashboard 获取：

1. 登录 [Supabase Dashboard](https://app.supabase.com)
2. 选择项目（DriveQuiz 主应用）
3. 进入 **Settings** → **Database**
4. 找到 **Connection string** → **URI**
5. 复制连接字符串，格式：
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?sslmode=require
   ```

#### AI Service 数据库

同样从 Supabase Dashboard 获取（AI Service 项目）：

1. 选择 AI Service 项目
2. 进入 **Settings** → **Database**
3. 复制连接字符串

### 2. Supabase 密钥

从 Supabase Dashboard 获取：

1. 登录 [Supabase Dashboard](https://app.supabase.com)
2. 选择项目
3. 进入 **Settings** → **API**
4. 复制以下密钥：
   - **service_role key** → `SUPABASE_SERVICE_KEY`
   - **anon key** → `SUPABASE_ANON_KEY`（可选）

### 3. JWT 密钥生成

生成安全的 JWT 密钥：

```bash
# 使用 OpenSSL
openssl rand -hex 32

# 或使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

将生成的密钥填入 `USER_JWT_SECRET`。

### 4. AI Service 配置

#### 使用本地 AI 服务（推荐）

```bash
USE_LOCAL_AI=true
LOCAL_AI_SERVICE_URL=http://localhost:8787
LOCAL_AI_SERVICE_TOKEN=your-local-token
```

#### 使用在线 AI 服务

```bash
USE_LOCAL_AI=false
AI_SERVICE_URL=https://ai.example.com
AI_SERVICE_TOKEN=your-service-token
```

### 5. OpenAI API 密钥（可选）

如果直接使用 OpenAI API（不通过 AI Service）：

1. 登录 [OpenAI Dashboard](https://platform.openai.com)
2. 进入 **API Keys**
3. 创建新的 API Key
4. 复制到 `OPENAI_API_KEY`

## 📝 环境变量说明

### 数据库连接

| 变量名 | 说明 | 必需 | 示例 |
|--------|------|------|------|
| `DATABASE_URL` | 主应用数据库连接字符串 | ✅ | `postgresql://postgres:password@db.example.supabase.co:5432/postgres?sslmode=require` |
| `POSTGRES_URL` | 备用数据库连接（Vercel 使用） | ❌ | 本地开发可复用 `DATABASE_URL` |
| `AI_DATABASE_URL` | AI Service 数据库连接字符串 | ✅ | `postgresql://postgres:password@db.example.supabase.co:5432/postgres?sslmode=require` |

### Supabase 配置

| 变量名 | 说明 | 必需 | 示例 |
|--------|------|------|------|
| `SUPABASE_URL` | Supabase 项目 URL | ✅ | `https://example.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase 服务端密钥 | ✅ | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `SUPABASE_ANON_KEY` | Supabase 前端匿名密钥 | ❌ | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |

### JWT 认证

| 变量名 | 说明 | 必需 | 示例 |
|--------|------|------|------|
| `USER_JWT_SECRET` | 用户 JWT 密钥（HS256） | ✅ | `a1b2c3d4e5f6...`（32 字节 hex） |
| `USER_JWT_PUBLIC_KEY` | 用户 JWT 公钥（RS256） | ❌ | PEM 格式公钥 |

### AI 服务配置

| 变量名 | 说明 | 必需 | 示例 |
|--------|------|------|------|
| `USE_LOCAL_AI` | 是否使用本地 AI 服务 | ❌ | `true` / `false` |
| `LOCAL_AI_SERVICE_URL` | 本地 AI 服务 URL | ❌ | `http://localhost:8787` |
| `LOCAL_AI_SERVICE_TOKEN` | 本地 AI 服务 Token | ❌ | `your-local-token` |
| `AI_SERVICE_URL` | 在线 AI 服务 URL | ❌ | `https://ai.example.com` |
| `AI_SERVICE_TOKEN` | 在线 AI 服务 Token | ❌ | `your-service-token` |

### OpenAI 配置（可选）

| 变量名 | 说明 | 必需 | 示例 |
|--------|------|------|------|
| `OPENAI_API_KEY` | OpenAI API 密钥 | ❌ | `sk-...` |
| `AI_MODEL` | AI 模型名称 | ❌ | `gpt-4o-mini` |
| `AI_REQUEST_TIMEOUT_MS` | AI 请求超时时间（毫秒） | ❌ | `30000` |

### 应用配置

| 变量名 | 说明 | 必需 | 示例 |
|--------|------|------|------|
| `NEXT_PUBLIC_APP_BASE_URL` | 应用基础 URL | ❌ | `http://localhost:3000` |
| `NEXT_PUBLIC_AI_API_BASE` | AI API 基础 URL | ❌ | 默认使用 `/api/ai/ask` |

### 开发环境配置

| 变量名 | 说明 | 必需 | 示例 |
|--------|------|------|------|
| `NODE_ENV` | Node.js 运行环境 | ❌ | `development` |
| `NODE_TLS_REJECT_UNAUTHORIZED` | 是否禁用 TLS 证书验证 | ❌ | `0`（仅本地开发） |

## ✅ 验证配置

### 1. 检查环境变量是否加载

```bash
# 检查必需的环境变量
node -e "
require('dotenv').config({ path: '.env.local' });
console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✅' : '❌');
console.log('AI_DATABASE_URL:', process.env.AI_DATABASE_URL ? '✅' : '❌');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '✅' : '❌');
console.log('SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY ? '✅' : '❌');
console.log('USER_JWT_SECRET:', process.env.USER_JWT_SECRET ? '✅' : '❌');
"
```

### 2. 测试数据库连接

```bash
# 测试主应用数据库连接
psql "$DATABASE_URL" -c "SELECT 1;"

# 测试 AI Service 数据库连接
psql "$AI_DATABASE_URL" -c "SELECT 1;"
```

### 3. 启动服务

```bash
# 启动主应用
npm run dev

# 启动本地 AI 服务（如果使用）
cd apps/local-ai-service
npm run dev
```

## 🐛 常见问题

### 1. 环境变量未加载

**症状**：服务启动时报错 "Missing required environment variables"

**解决方法**：
1. 确保 `.env.local` 文件在项目根目录
2. 检查文件名是否正确（`.env.local`，不是 `.env.local.txt`）
3. 重启开发服务器

### 2. 数据库连接失败

**症状**：连接数据库时报错

**解决方法**：
1. 检查连接字符串格式是否正确
2. 确认数据库服务是否运行
3. 检查网络连接和防火墙设置
4. 如果使用 Supabase，确认 IP 白名单设置

### 3. SSL 证书错误

**症状**：`SSL certificate verification failed`

**解决方法**：
1. 在 `.env.local` 中添加：`NODE_TLS_REJECT_UNAUTHORIZED=0`
2. ⚠️ **注意**：仅用于本地开发，生产环境请移除

### 4. JWT 验证失败

**症状**：用户认证失败

**解决方法**：
1. 检查 `USER_JWT_SECRET` 是否正确设置
2. 确保密钥长度足够（至少 32 字节）
3. 确认密钥格式正确（hex 字符串）

## 📚 相关文档

- [数据库分离报告](../DATABASE_SEPARATION_REPORT.md)
- [AI 服务环境变量配置](../docs/AI_ENV_SETUP.md)
- [数据库连接信息](../apps/web/DATABASE_CONNECTION_INFO.md)

## 🔒 安全提示

1. **不要提交 `.env.local` 到 Git**
   - 文件已添加到 `.gitignore`
   - 使用 `.env.example` 作为模板

2. **保护敏感信息**
   - 不要分享 `.env.local` 文件
   - 不要在代码中硬编码密钥

3. **定期轮换密钥**
   - 定期更新 JWT 密钥
   - 定期更新 API Token

4. **使用环境变量**
   - 生产环境使用 Vercel/Render 的环境变量配置
   - 不要在生产环境使用 `.env.local`

