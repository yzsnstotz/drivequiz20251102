# 本地向量化服务配置说明

## 概述

`local-ai-service` 现在提供了向量化服务端点 `/v1/admin/rag/ingest`，使用 Ollama 的 `nomic-embed-text` 模型（768维）进行向量化。

## 配置步骤

### 1. 配置 local-ai-service 的 SERVICE_TOKENS

在 `apps/local-ai-service/.env.local` 或 `.env` 中配置 `SERVICE_TOKENS`，确保包含 `drivequiz-api` 使用的 token：

```bash
# local-ai-service 服务令牌（多个用逗号分隔）
SERVICE_TOKENS=drivequiz-api-secret-token-xxx,local_ai_token_dev_12345
```

**重要**：`SERVICE_TOKENS` 必须包含 `drivequiz-api` 的 `DRIVEQUIZ_API_TOKEN_SECRET` 值，否则 `drivequiz-api` 无法调用向量化服务。

### 2. 配置 drivequiz-api 的 AI_VECTORIZE_URL

在 `apps/drivequiz-api/.env` 中配置向量化服务地址：

```bash
# 向量化服务地址（指向 local-ai-service）
AI_VECTORIZE_URL=http://localhost:8788/v1/admin/rag/ingest
```

### 3. 确保 token 匹配

确保 `drivequiz-api` 的 `DRIVEQUIZ_API_TOKEN_SECRET` 在 `local-ai-service` 的 `SERVICE_TOKENS` 中：

**drivequiz-api/.env**:
```bash
DRIVEQUIZ_API_TOKEN_SECRET=drivequiz-api-secret-token-xxx
```

**local-ai-service/.env.local**:
```bash
SERVICE_TOKENS=drivequiz-api-secret-token-xxx,local_ai_token_dev_12345
```

## 服务端点

### POST /v1/admin/rag/ingest

向量化文档端点，接收文档内容，进行分片、向量化、存储。

**请求头**:
```
Authorization: Bearer <SERVICE_TOKEN>
Content-Type: application/json
```

**请求体**:
```json
{
  "docId": "doc-123",
  "title": "文档标题",
  "url": "https://example.com/doc",
  "content": "文档内容...",
  "version": "v1",
  "lang": "zh"
}
```

**响应**:
```json
{
  "ok": true,
  "data": {
    "docId": "doc-123",
    "chunks": 5,
    "version": "v1"
  }
}
```

## 工作流程

1. `drivequiz-api` 接收到文档数据
2. `drivequiz-api` 异步调用 `local-ai-service` 的 `/v1/admin/rag/ingest` 端点
3. `local-ai-service` 对文档进行分片（500-800字符，带重叠）
4. `local-ai-service` 使用 Ollama `nomic-embed-text` 模型生成 768 维向量
5. `local-ai-service` 批量写入 `ai_vectors` 表
6. `local-ai-service` 更新 `ai_rag_docs.chunks` 统计

## 验证配置

### 1. 检查 local-ai-service 是否运行

```bash
curl http://localhost:8788/healthz
```

### 2. 测试向量化端点

```bash
curl -X POST http://localhost:8788/v1/admin/rag/ingest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer drivequiz-api-secret-token-xxx" \
  -d '{
    "docId": "test-doc-1",
    "title": "测试文档",
    "content": "这是一个测试文档内容，用于验证向量化服务是否正常工作。",
    "version": "v1"
  }'
```

### 3. 检查 drivequiz-api 日志

查看 `drivequiz-api` 的日志，确认向量化任务是否成功触发和执行。

## 注意事项

1. **向量维度**：确保数据库中的 `ai_vectors` 表使用 `vector(768)` 类型（已通过迁移完成）
2. **Ollama 模型**：确保 `nomic-embed-text` 模型已在 Ollama 中加载
3. **服务启动顺序**：先启动 `local-ai-service`，再启动 `drivequiz-api`
4. **Token 安全**：生产环境请使用安全的 token，不要使用默认值

## 故障排查

### 问题：401 Unauthorized

**原因**：`drivequiz-api` 的 token 不在 `local-ai-service` 的 `SERVICE_TOKENS` 中

**解决**：检查并更新 `local-ai-service` 的 `SERVICE_TOKENS` 配置

### 问题：502 Bad Gateway

**原因**：Ollama 服务未运行或模型未加载

**解决**：
1. 检查 Ollama 是否运行：`curl http://localhost:11434/api/tags`
2. 检查模型是否加载：`ollama list`
3. 如果模型未加载：`ollama pull nomic-embed-text`

### 问题：向量维度不匹配

**原因**：数据库表仍使用 1536 维向量

**解决**：执行迁移脚本 `20250115_migrate_to_ollama_768d.sql`

