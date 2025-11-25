# ⚠️ 向量维度不匹配问题分析

**问题**: 当前 RAG 搜索使用 `text-embedding-3-small`（1536维），但向量库是 768 维  
**影响**: ❌ **无法命中**，PostgreSQL pgvector 会报错

---

## 🔍 问题分析

### 当前实现

**代码位置**: `apps/ai-service/src/lib/rag.ts`

```31:31:apps/ai-service/src/lib/rag.ts
const EMBEDDING_MODEL = (process.env.EMBEDDING_MODEL || "text-embedding-3-small").trim();
```

**使用的模型**: `text-embedding-3-small`  
**向量维度**: **1536 维**

### 数据库配置

**迁移脚本**: `src/migrations/20250115_migrate_to_ollama_768d.sql`

```31:31:src/migrations/20250115_migrate_to_ollama_768d.sql
  embedding vector(768),  -- 改为 768 维（Ollama nomic-embed-text）
```

**数据库表**: `ai_vectors`  
**向量维度**: **768 维**

### 问题根源

1. **维度不匹配**: 代码生成 1536 维向量，但数据库期望 768 维
2. **PostgreSQL 错误**: pgvector 会拒绝维度不匹配的向量
3. **RAG 搜索失败**: 查询向量无法与存储向量进行相似度计算

---

## ❌ 当前状态：无法命中

### 错误场景

当调用 RAG 搜索时，会发生以下错误：

1. **向量生成阶段**（正常）:
   - 使用 `text-embedding-3-small` 生成 1536 维查询向量
   - ✅ 成功

2. **数据库查询阶段**（失败）:
   - 调用 `match_documents` RPC 函数
   - ❌ PostgreSQL 报错：`vector dimension mismatch: expected 768, got 1536`

3. **结果**:
   - RAG 搜索返回空结果
   - 代码安全降级，返回空字符串
   - 用户看不到错误，但 RAG 功能实际上不工作

---

## 🔧 解决方案

### 方案 1: 修改代码使用 768 维模型（推荐）

**适用场景**: 向量库已使用 768 维，需要保持一致性

#### 1.1 使用 Ollama nomic-embed-text

**修改环境变量**:
```bash
EMBEDDING_MODEL=nomic-embed-text
OPENAI_BASE_URL=http://localhost:11434/v1  # 如果使用本地 Ollama
```

**优点**:
- ✅ 零成本（本地运行）
- ✅ 数据隐私
- ✅ 无速率限制

**缺点**:
- ⚠️ 需要部署 Ollama 服务
- ⚠️ 需要服务器资源（8GB+ RAM）

#### 1.2 使用其他 768 维模型

**支持的 768 维模型**:
- `nomic-embed-text` (Ollama)
- `multilingual-e5-large` (768维)
- `paraphrase-multilingual-MiniLM-L12-v2` (384维，不匹配)

**修改代码**:
```typescript
// apps/ai-service/src/lib/rag.ts
const EMBEDDING_MODEL = (process.env.EMBEDDING_MODEL || "nomic-embed-text").trim();
```

---

### 方案 2: 修改数据库使用 1536 维

**适用场景**: 希望继续使用 OpenAI API

**执行迁移脚本**:
```sql
-- 使用 src/migrations/20251103_ai_core.sql
-- 该脚本创建 1536 维的 ai_vectors 表
```

**优点**:
- ✅ 无需修改代码
- ✅ 使用 OpenAI API（稳定可靠）

**缺点**:
- ⚠️ 需要重新向量化所有文档
- ⚠️ 成本较高（OpenAI API 费用）

---

### 方案 3: 支持动态维度（复杂）

**实现方式**: 修改代码和数据库，支持多种维度

**不推荐**: 实现复杂，维护成本高

---

## 🎯 推荐方案

### 短期（立即修复）

**使用 768 维模型**:
1. 确认数据库已执行 `20250115_migrate_to_ollama_768d.sql`
2. 设置环境变量：
   ```bash
   EMBEDDING_MODEL=nomic-embed-text
   OPENAI_BASE_URL=http://localhost:11434/v1  # 或远程 Ollama 服务
   ```
3. 验证 RAG 搜索是否正常工作

### 长期（优化）

**根据需求选择**:
- **成本优先**: 使用 Ollama 本地模型（768维）
- **稳定性优先**: 使用 OpenAI API（需要迁移到 1536维）

---

## 📋 验证步骤

### 1. 检查数据库维度

```sql
-- 检查表结构
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'ai_vectors' AND column_name = 'embedding';

-- 应该返回: vector(768) 或 vector(1536)
```

### 2. 检查 RPC 函数维度

```sql
-- 检查函数参数
SELECT pg_get_function_arguments(oid) 
FROM pg_proc 
WHERE proname = 'match_documents';

-- 应该返回: query_embedding vector(768) 或 vector(1536)
```

### 3. 测试 RAG 搜索

```bash
# 测试 RAG 搜索
curl -X POST https://your-ai-service.onrender.com/v1/ask \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "测试问题",
    "lang": "zh"
  }'

# 检查响应中是否包含 sources 字段
```

---

## ⚠️ 注意事项

1. **维度必须匹配**: 查询向量和存储向量必须使用相同的维度
2. **迁移成本**: 如果切换维度，需要重新向量化所有文档
3. **模型选择**: 不同模型的向量空间不同，不能直接混用

---

## 📝 总结

**当前状态**: ❌ **无法命中**（维度不匹配）

**根本原因**: 代码使用 1536 维模型，但数据库是 768 维

**推荐方案**: 
1. 修改环境变量使用 768 维模型（如 `nomic-embed-text`）
2. 或迁移数据库到 1536 维（需要重新向量化）

**下一步**: 确认数据库实际维度，然后选择对应的解决方案

---

**报告生成时间**: 2025-01-27  
**生成工具**: Cursor AI

