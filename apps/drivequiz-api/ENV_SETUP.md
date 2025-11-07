# DriveQuiz API 环境变量配置说明

## ✅ 已完成的配置

所有必需的环境变量已添加到 `.env` 文件中：

### 必需的环境变量

1. **DRIVEQUIZ_API_TOKEN_SECRET** ✅
   - 用途：API 认证密钥（Bearer Token 验证）
   - 当前值：`drivequiz-api-secret-token-<timestamp>`
   - ⚠️ **请修改为安全的密钥**

2. **DRIVEQUIZ_DB_URL** ✅
   - 用途：数据库连接字符串
   - 当前值：AI Service 数据库连接字符串
   - 说明：使用 AI Service 数据库存储 RAG 文档

3. **AI_VECTORIZE_URL** ✅
   - 用途：向量化服务地址
   - 当前值：`http://localhost:8787/v1/admin/rag/ingest`
   - 说明：本地开发使用 localhost:8787，生产环境需要修改为实际地址

### 可选的环境变量

- `RAG_ENABLE_SERVER_CHUNK=false` - 是否启用服务端分片
- `MAX_BATCH_SIZE=100` - 批量上传最大文档数
- `PORT=8789` - 服务端口（避免与 local-ai-service 的 8788 端口冲突）
- `HOST=0.0.0.0` - 服务监听地址
- `LOG_LEVEL=info` - 日志级别
- `NODE_ENV=development` - 运行环境

## 🚀 启动服务

现在可以启动服务了：

```bash
cd apps/drivequiz-api
npm run dev
```

## ⚠️ 重要提示

### 1. 修改 API Token

**请务必修改 `DRIVEQUIZ_API_TOKEN_SECRET` 为安全的密钥**：

```bash
# 生成安全的随机密钥
openssl rand -hex 32

# 或使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

然后更新 `.env` 文件中的 `DRIVEQUIZ_API_TOKEN_SECRET`。

### 2. AI Service 地址

如果 AI Service 运行在不同端口或地址，请修改 `AI_VECTORIZE_URL`：

- **本地开发**：`http://localhost:8787/v1/admin/rag/ingest`
- **生产环境**：`https://ai.drivequiz.com/v1/admin/rag/ingest`

### 3. 数据库连接

当前使用 AI Service 数据库。如果需要使用独立的数据库，请修改 `DRIVEQUIZ_DB_URL`。

### 4. 执行数据库迁移

首次启动前，请执行数据库迁移：

```bash
npm run db:migrate
```

## 📝 查看配置

查看当前配置：

```bash
cat .env
```

## 🔧 重新配置

如果需要重新配置环境变量，可以运行：

```bash
./setup-env.sh
```

## ✅ 验证配置

验证环境变量是否正确加载：

```bash
node -e "require('dotenv').config(); console.log('DRIVEQUIZ_API_TOKEN_SECRET:', process.env.DRIVEQUIZ_API_TOKEN_SECRET ? '✅' : '❌'); console.log('DRIVEQUIZ_DB_URL:', process.env.DRIVEQUIZ_DB_URL ? '✅' : '❌'); console.log('AI_VECTORIZE_URL:', process.env.AI_VECTORIZE_URL ? '✅' : '❌');"
```

## 🐛 常见问题

### 1. 启动时报错 "Missing required environment variables"

**原因**：`.env` 文件中缺少必需的环境变量

**解决**：
1. 检查 `.env` 文件是否存在
2. 运行 `./setup-env.sh` 重新配置
3. 确保 `.env` 文件在 `apps/drivequiz-api/` 目录下

### 2. 数据库连接失败

**原因**：数据库连接字符串不正确或数据库不可访问

**解决**：
1. 检查 `DRIVEQUIZ_DB_URL` 是否正确
2. 确认数据库服务是否运行
3. 检查网络连接和防火墙设置

### 3. 向量化服务调用失败

**原因**：AI Service 未运行或地址不正确

**解决**：
1. 确认 AI Service 是否在运行（端口 8787）
2. 检查 `AI_VECTORIZE_URL` 是否正确
3. 测试 AI Service 健康检查：`curl http://localhost:8787/healthz`

## 📚 相关文档

- [README.md](./README.md) - 项目说明
- [接口联调文档](../../增加模块研发文档/Datapull协同API项目研发/🔌%20DriveQuiz%20API%20接口联调文档%20v1.1.md) - 接口联调文档
- [参数与接口统一规范](../../增加模块研发文档/Datapull协同API项目研发/📐%20DriveQuiz%20API%20参数与接口统一规范%20v1.1.md) - 规范文档

