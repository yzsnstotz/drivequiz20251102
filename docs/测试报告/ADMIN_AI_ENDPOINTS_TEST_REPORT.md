# 🔍 Admin AI 端点测试报告

**测试日期**: 2025-11-04  
**测试环境**: Vercel Production  
**BASE_URL**: https://drivequiz20251102-app.vercel.app

---

## 📋 测试端点

### 1. `/api/admin/ai/logs`
- **功能**: 返回 AI 问答日志列表
- **方法**: GET
- **参数**: 
  - `page` (可选): 页码
  - `limit` (可选): 每页数量
  - `sortBy` (可选): 排序字段 (createdAt | id)
  - `order` (可选): 排序方向 (asc | desc)

### 2. `/api/admin/ai/filters`
- **功能**: 返回 AI 过滤规则列表
- **方法**: GET
- **参数**: 无

### 3. `/api/admin/ai/rag/docs`
- **功能**: 返回 RAG 文档列表
- **方法**: GET
- **参数**:
  - `page` (可选): 页码
  - `limit` (可选): 每页数量
  - `q` (可选): 关键词搜索
  - `lang` (可选): 语言过滤
  - `status` (可选): 状态过滤
  - `sortBy` (可选): 排序字段 (createdAt | updatedAt | title)
  - `sortOrder` (可选): 排序方向 (asc | desc)

---

## 🔧 测试配置

```bash
export BASE_URL="https://drivequiz20251102-app.vercel.app"
export AI_SERVICE_URL="https://zalem.onrender.com"
export ADMIN_TOKEN="eyJhbGciOiJIUzI1NiIsImtpZCI6IjRKYytuUHJWdFArSUxQUVQiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3ZkdG56anZtdnJjZHBsYXd3aWFlLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI2MWU4NjNiNi02MmZjLTRmZTItYjQyMi04MjBjMWE1NjU1ZWMiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzYyMTc5Mjg2LCJpYXQiOjE3NjIxNzU2ODYsImVtYWlsIjoiYWRtaW5AemFsZW0uYXBwIiwicGhvbmUiOiIiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJlbWFpbCIsInByb3ZpZGVycyI6WyJlbWFpbCJdfSwidXNlcl9tZXRhZGF0YSI6eyJlbWFpbF92ZXJpZmllZCI6dHJ1ZX0sInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjE3NjIxNzU2ODZ9XSwic2Vzc2lvbl9pZCI6ImI1NTNiMGYwLTZmMGUtNGIzNy04NzZmLWVkNWU4ZjZlZTgzOSIsImlzX2Fub255bW91cyI6ZmFsc2V9.5zuqEOp6yrZX8-PTjgcQvHs6mpiwl4Qpiho4urAzLUg"
export VERCEL_BYPASS_TOKEN="dgo9MHSPwyVg85bb2dcCab2HuUJ0Wuws"
```

---

## 🧪 测试结果

### 当前状态: ⚠️ 路由未部署

所有端点返回 **HTTP 404**，说明路由文件尚未部署到 Vercel 生产环境。

### ⚠️ 关于环境变量 AI_SERVICE_URL

**结论**: `AI_SERVICE_URL` 环境变量配置**不是导致 404 错误的原因**。

**分析**:
1. `/api/admin/ai/logs` - **不依赖** `AI_SERVICE_URL`，只查询数据库
2. `/api/admin/ai/filters` - **不依赖** `AI_SERVICE_URL`，只查询数据库
3. `/api/admin/ai/rag/docs` - GET 方法**不依赖** `AI_SERVICE_URL`，只有 POST 方法使用它

**已修复的问题**:
- 修复了 `rag/docs/route.ts` 中 POST 方法的路径重复问题
  - 如果 `AI_SERVICE_URL` 设置为 `https://zalem.onrender.com/v1`，会导致路径重复
  - 已修复为：先移除 `/v1` 后缀，再添加 `/v1/admin/rag/ingest`
  - 与 `/api/ai/ask` 的处理方式保持一致

### 测试详情

| 端点 | 状态码 | 状态 | 说明 |
|------|--------|------|------|
| `/api/admin/ai/logs` | 404 | ❌ 失败 | 路由未找到 |
| `/api/admin/ai/logs?page=1&limit=10` | 404 | ❌ 失败 | 路由未找到 |
| `/api/admin/ai/filters` | 404 | ❌ 失败 | 路由未找到 |
| `/api/admin/ai/rag/docs` | 404 | ❌ 失败 | 路由未找到 |
| `/api/admin/ai/rag/docs?page=1&limit=10` | 404 | ❌ 失败 | 路由未找到 |
| `/api/admin/ai/rag/docs?q=test&page=1&limit=5` | 404 | ❌ 失败 | 路由未找到 |

---

## 📁 文件位置

路由文件已存在于本地代码库：

- ✅ `src/app/api/admin/ai/logs/route.ts`
- ✅ `src/app/api/admin/ai/filters/route.ts`
- ✅ `src/app/api/admin/ai/rag/docs/route.ts`

所有文件已提交到 Git（working tree clean）。

---

## 🚀 下一步操作

### 1. 确认部署状态

检查 Vercel 部署记录，确认最近是否有部署包含这些路由文件：

```bash
# 检查最近的 Git 提交
git log --oneline --all --grep="admin" | head -10
```

### 2. 触发重新部署

如果需要，可以手动触发 Vercel 重新部署：

- 在 Vercel Dashboard 中点击 "Redeploy"
- 或者推送一个空提交到 Git

### 3. 重新运行测试

部署完成后，运行测试脚本：

```bash
export BASE_URL="https://drivequiz20251102-app.vercel.app"
export ADMIN_TOKEN="<your-admin-token>"
export VERCEL_BYPASS_TOKEN="dgo9MHSPwyVg85bb2dcCab2HuUJ0Wuws"

./scripts/test-admin-ai-endpoints.sh
```

---

## 📝 测试脚本

已创建测试脚本：`scripts/test-admin-ai-endpoints.sh`

**使用方法**:

```bash
# 设置环境变量
export BASE_URL="https://drivequiz20251102-app.vercel.app"
export ADMIN_TOKEN="<your-admin-token>"
export VERCEL_BYPASS_TOKEN="dgo9MHSPwyVg85bb2dcCab2HuUJ0Wuws"

# 运行测试
./scripts/test-admin-ai-endpoints.sh
```

**功能**:
- 测试所有三个端点
- 测试带分页参数的端点
- 测试带搜索参数的 RAG 文档端点
- 彩色输出，清晰显示成功/失败状态
- 自动格式化 JSON 响应（如果安装了 jq）

---

## 🔍 手动测试命令

如果测试脚本不可用，可以使用以下 curl 命令手动测试：

### 测试 /api/admin/ai/logs

```bash
curl -sS "https://drivequiz20251102-app.vercel.app/api/admin/ai/logs?x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=dgo9MHSPwyVg85bb2dcCab2HuUJ0Wuws" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Cookie: x-vercel-protection-bypass=dgo9MHSPwyVg85bb2dcCab2HuUJ0Wuws" \
  | jq '.'
```

### 测试 /api/admin/ai/filters

```bash
curl -sS "https://drivequiz20251102-app.vercel.app/api/admin/ai/filters?x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=dgo9MHSPwyVg85bb2dcCab2HuUJ0Wuws" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Cookie: x-vercel-protection-bypass=dgo9MHSPwyVg85bb2dcCab2HuUJ0Wuws" \
  | jq '.'
```

### 测试 /api/admin/ai/rag/docs

```bash
curl -sS "https://drivequiz20251102-app.vercel.app/api/admin/ai/rag/docs?page=1&limit=10&x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=dgo9MHSPwyVg85bb2dcCab2HuUJ0Wuws" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Cookie: x-vercel-protection-bypass=dgo9MHSPwyVg85bb2dcCab2HuUJ0Wuws" \
  | jq '.'
```

---

## ✅ 预期响应格式

### /api/admin/ai/logs

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": 1,
        "userId": "user-id",
        "question": "问题内容",
        "answer": "回答内容",
        "language": "zh-CN",
        "model": "gpt-4",
        "ragHits": 3,
        "safetyFlag": "ok",
        "costEst": "0.001",
        "createdAt": "2025-11-04T00:00:00.000Z"
      }
    ]
  },
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

### /api/admin/ai/filters

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": "filter-id",
        "type": "not-driving",
        "pattern": "股票|恋爱",
        "createdAt": "2025-11-04T00:00:00.000Z",
        "updatedAt": "2025-11-04T00:00:00.000Z"
      }
    ]
  }
}
```

### /api/admin/ai/rag/docs

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": "doc-id",
        "title": "文档标题",
        "url": "https://example.com",
        "lang": "zh",
        "tags": ["tag1", "tag2"],
        "status": "ready",
        "version": "v1",
        "chunks": 10,
        "createdAt": "2025-11-04T00:00:00.000Z",
        "updatedAt": "2025-11-04T00:00:00.000Z"
      }
    ]
  },
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5
  }
}
```

---

## 📌 注意事项

1. **Token 过期**: ADMIN_TOKEN 可能已过期，需要重新生成
2. **Vercel Bypass**: 确保 VERCEL_BYPASS_TOKEN 正确设置
3. **部署延迟**: 如果刚提交代码，可能需要等待 2-5 分钟才能完成部署
4. **权限检查**: 确保 ADMIN_TOKEN 对应的用户具有管理员权限

---

**报告生成时间**: 2025-11-04

