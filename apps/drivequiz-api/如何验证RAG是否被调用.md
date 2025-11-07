# 如何验证 AI 是否调用了 RAG

本文档介绍如何验证 AI 问答系统是否成功调用了 RAG（检索增强生成）功能。

---

## 📊 验证方法

### 方法一：查询数据库 `ai_logs` 表

最直接的方法是查询 `ai_logs` 表中的 `rag_hits` 字段。

#### SQL 查询示例

```sql
-- 查看最近的问答记录，检查 RAG 是否被调用
SELECT 
  id,
  question,
  answer,
  rag_hits,
  model,
  created_at
FROM ai_logs
ORDER BY created_at DESC
LIMIT 20;
```

#### 判断标准

- **`rag_hits > 0`**：✅ RAG 被成功调用，并检索到了相关内容
- **`rag_hits = 0`**：❌ RAG 未被调用或检索失败（返回空结果）

#### 详细查询示例

```sql
-- 统计 RAG 调用率
SELECT 
  COUNT(*) as total_queries,
  COUNT(CASE WHEN rag_hits > 0 THEN 1 END) as rag_used_count,
  ROUND(COUNT(CASE WHEN rag_hits > 0 THEN 1 END) * 100.0 / COUNT(*), 2) as rag_usage_rate
FROM ai_logs
WHERE created_at >= NOW() - INTERVAL '24 hours';
```

```sql
-- 查看特定问题的 RAG 调用情况
SELECT 
  question,
  rag_hits,
  answer,
  created_at
FROM ai_logs
WHERE question LIKE '%你的问题关键词%'
ORDER BY created_at DESC;
```

---

### 方法二：查看 API 响应中的 `sources` 字段

AI 服务在响应中会返回 `sources` 字段，如果 RAG 被调用，该字段会包含检索到的来源信息。

#### 响应格式

```json
{
  "ok": true,
  "answer": "AI的回答内容...",
  "sources": [
    {
      "title": "RAG Reference",
      "url": "https://example.com",
      "snippet": "相关文档片段..."
    }
  ],
  "model": "gpt-4",
  "ragHits": 1
}
```

#### 判断标准

- **`sources` 数组不为空**：✅ RAG 被调用并返回了结果
- **`sources` 数组为空或不存在**：❌ RAG 未被调用或检索失败

---

### 方法三：查看服务日志

#### AI Service 日志

查看 AI Service 的日志输出，查找 RAG 相关的日志：

```bash
# 查看服务日志
tail -f logs/ai-service.log | grep -i "rag"
```

#### 日志特征

- **成功调用**：日志中会显示 RAG 检索的结果数量
- **失败调用**：日志中会显示 RAG 检索失败的错误信息

---

### 方法四：检查 RAG 检索函数调用

#### 代码位置

- **AI Service**: `apps/ai-service/src/routes/ask.ts` (第 197 行)
- **Local AI Service**: `apps/local-ai-service/src/routes/ask.ts` (第 138 行)

#### 关键代码

```typescript
// 5) RAG 检索（可能为空）
const reference = await getRagContext(question, lang, config);

// 计算 RAG 命中数
const ragHits = reference ? 1 : 0; // 或 sources.length
```

---

## 🔍 详细验证步骤

### 步骤 1：检查数据库记录

1. 连接到数据库
2. 查询 `ai_logs` 表
3. 检查 `rag_hits` 字段值

```sql
-- 快速检查最近的记录
SELECT 
  id,
  LEFT(question, 50) as question_preview,
  rag_hits,
  created_at
FROM ai_logs
ORDER BY created_at DESC
LIMIT 10;
```

### 步骤 2：验证 RAG 数据源

确保 RAG 数据源存在且已向量化：

```sql
-- 检查向量数据是否存在
SELECT 
  COUNT(*) as total_vectors,
  COUNT(DISTINCT doc_id) as unique_docs,
  MAX(updated_at) as last_updated
FROM ai_vectors;
```

### 步骤 3：测试 RAG 检索

直接调用 RAG 检索函数进行测试：

```bash
# 如果使用 AI Service
curl -X POST http://localhost:3001/v1/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "测试问题",
    "lang": "zh"
  }'
```

检查响应中的 `ragHits` 和 `sources` 字段。

---

## 📈 监控指标

### 1. RAG 调用率

```sql
-- 计算 RAG 调用率（最近 24 小时）
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as total_queries,
  COUNT(CASE WHEN rag_hits > 0 THEN 1 END) as rag_used,
  ROUND(COUNT(CASE WHEN rag_hits > 0 THEN 1 END) * 100.0 / COUNT(*), 2) as rag_rate
FROM ai_logs
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;
```

### 2. RAG 命中数分布

```sql
-- 查看 RAG 命中数的分布
SELECT 
  rag_hits,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM ai_logs
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY rag_hits
ORDER BY rag_hits;
```

### 3. 每日 RAG 统计

```sql
-- 查看每日 RAG 使用情况
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_queries,
  COUNT(CASE WHEN rag_hits > 0 THEN 1 END) as rag_used,
  AVG(rag_hits) as avg_rag_hits
FROM ai_logs
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

---

## ⚠️ 常见问题

### 问题 1：`rag_hits` 始终为 0

**可能原因：**
1. RAG 数据源未向量化
2. Supabase RPC 函数 `match_documents` 未配置
3. 向量相似度阈值过高，没有匹配结果
4. RAG 检索函数调用失败

**解决方法：**
1. 检查 `ai_vectors` 表是否有数据
2. 检查 Supabase RPC 函数是否正常
3. 降低相似度阈值（默认 0.75）
4. 查看服务日志中的错误信息

### 问题 2：`rag_hits` 值不准确

**当前实现：**
- AI Service: `ragHits = sources.length`（基于 sources 数组长度）
- Local AI Service: `ragHits = reference ? 1 : 0`（基于是否有 reference）

**注意：** 当前实现可能不能完全反映实际检索到的文档数量，而是基于是否有返回结果。

### 问题 3：RAG 调用但无结果

**可能原因：**
1. 向量相似度低于阈值（默认 0.75）
2. 查询问题与知识库内容不匹配
3. 语言不匹配（查询语言与向量化语言不一致）

**解决方法：**
1. 检查相似度阈值设置
2. 验证知识库内容是否相关
3. 确保查询语言与向量化语言一致

---

## 🛠️ 调试工具

### 1. 直接测试 RAG 检索

```typescript
// 在代码中添加调试日志
const reference = await getRagContext(question, lang, config);
console.log('[DEBUG] RAG Reference:', reference ? 'Found' : 'Empty');
console.log('[DEBUG] RAG Length:', reference?.length || 0);
```

### 2. 检查 Supabase RPC

```sql
-- 直接调用 Supabase RPC 测试
SELECT * FROM match_documents(
  query_embedding := ARRAY[0.1, 0.2, ...], -- 测试向量
  match_threshold := 0.75,
  match_count := 5
);
```

### 3. 查看向量数据

```sql
-- 查看向量数据示例
SELECT 
  doc_id,
  LEFT(content, 100) as content_preview,
  source_title,
  source_url,
  updated_at
FROM ai_vectors
LIMIT 10;
```

---

## 📝 总结

验证 RAG 是否被调用的最佳方法：

1. ✅ **查询 `ai_logs` 表的 `rag_hits` 字段**（最可靠）
2. ✅ **检查 API 响应中的 `sources` 字段**（实时验证）
3. ✅ **查看服务日志**（调试用）
4. ✅ **监控 RAG 调用率**（长期统计）

**关键指标：**
- `rag_hits > 0`：RAG 被调用 ✅
- `rag_hits = 0`：RAG 未被调用 ❌
- `sources` 数组不为空：RAG 返回了结果 ✅

---

## 🔗 相关文档

- [AI 问答模块研发文档](../../增加模块研发文档/驾考AI开发文档/🧩%20ZALEM%20·%20AI问答模块%20研发文档%20v1.0.md)
- [RAG 数据上传指南](./DATA_STORAGE.md)
- [数据库表结构说明](./OPERATION_FLOW.md)

