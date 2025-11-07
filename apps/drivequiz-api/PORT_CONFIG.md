# DriveQuiz API 端口配置说明

## 📋 端口分配

为了避免端口冲突，各服务的端口分配如下：

| 服务 | 端口 | 说明 |
|------|------|------|
| **local-ai-service** | `8788` | 本地 AI 服务（Ollama） |
| **ai-service** | `8787` | AI 服务（生产环境） |
| **drivequiz-api** | `8789` | DriveQuiz API 服务 |

## ✅ 当前配置

### DriveQuiz API 端口

**环境变量**：`PORT=8789`

**配置文件**：`apps/drivequiz-api/.env`

```bash
PORT=8789
```

### 向量化服务地址

**环境变量**：`AI_VECTORIZE_URL`

**本地开发**：
```bash
AI_VECTORIZE_URL=http://localhost:8787/v1/admin/rag/ingest
```

**说明**：
- 本地开发时，向量化服务指向 `ai-service`（端口 8787）
- 如果使用 `local-ai-service`，需要确认其是否提供 `/v1/admin/rag/ingest` 接口

## 🔍 端口冲突检查

### 检查端口占用

```bash
# 检查 8788 端口（local-ai-service）
lsof -i :8788

# 检查 8787 端口（ai-service）
lsof -i :8787

# 检查 8789 端口（drivequiz-api）
lsof -i :8789
```

### 启动服务

```bash
# 启动 drivequiz-api（端口 8789）
cd apps/drivequiz-api
npm run dev

# 服务将在 http://localhost:8789 启动
```

## 📝 服务地址

### DriveQuiz API

- **本地开发**：`http://localhost:8789`
- **健康检查**：`http://localhost:8789/api/v1/rag/health`
- **API 基础路径**：`http://localhost:8789/api/v1/rag`

### 向量化服务

- **本地开发（ai-service）**：`http://localhost:8787/v1/admin/rag/ingest`
- **本地开发（local-ai-service）**：`http://localhost:8788/v1/admin/rag/ingest`（如果支持）

## ⚠️ 注意事项

1. **端口冲突**：
   - ✅ 已避免与 `local-ai-service`（8788）冲突
   - ✅ 已避免与 `ai-service`（8787）冲突
   - ✅ `drivequiz-api` 使用独立端口 8789

2. **向量化服务**：
   - 当前配置指向 `ai-service`（8787）
   - 如果使用 `local-ai-service`，需要确认其是否提供向量化接口
   - 生产环境需要修改为实际的服务地址

3. **服务启动顺序**：
   - 建议先启动向量化服务（ai-service 或 local-ai-service）
   - 再启动 drivequiz-api

## 🔧 修改端口

如果需要修改端口，编辑 `.env` 文件：

```bash
# 修改端口
PORT=8789  # 改为其他端口，如 8790
```

然后重启服务。

## ✅ 验证配置

验证端口配置：

```bash
# 检查环境变量
cd apps/drivequiz-api
node -e "require('dotenv').config(); console.log('PORT:', process.env.PORT || '未设置');"
```

期望输出：
```
PORT: 8789
```

---

**最后更新**：2025-01-XX  
**配置状态**：✅ 已配置

