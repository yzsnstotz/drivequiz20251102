# DriveQuiz RAG Ingestion API 开发指南

本文档面向 DriveQuiz 开发团队，用于实现与 datapull 项目对接的 RAG 数据入库 API。

## 📋 目录

1. [概述](#概述)
2. [需要实现的功能](#需要实现的功能)
3. [数据库设计](#数据库设计)
4. [API 实现清单](#api-实现清单)
5. [向量化集成](#向量化集成)
6. [认证系统](#认证系统)
7. [错误处理](#错误处理)
8. [测试要求](#测试要求)
9. [联调配合事项](#联调配合事项)
10. [环境配置](#环境配置)

---

## 概述

### 项目背景

datapull 项目是一个本地服务，用于从各个目标网站（JAF、警察厅、MLIT 等）抓取信息，然后通过 API 上传到 DriveQuiz 的 RAG 数据库。

### 对接方式

- **通信方式**: HTTPS REST API
- **认证方式**: Bearer Token 或 API Key
- **数据格式**: JSON
- **API 版本**: v1

### 完整 API 规范

请参考：
- [Markdown 规范](./drivequiz-api-spec.md)
- [OpenAPI 规范](./drivequiz-api-spec.yaml)

---

## 需要实现的功能

### 核心功能（必须实现）

#### 1. 健康检查接口 ✅

**优先级**: P0（最高）  
**接口**: `GET /api/v1/rag/health`

**功能要求**:
- 检查 API 服务是否可用
- 返回服务状态和版本信息

**实现要点**:
- 简单快速响应（< 100ms）
- 可用于负载均衡健康检查
- 不需要认证

---

#### 2. 单文档上传接口 ✅

**优先级**: P0（最高）  
**接口**: `POST /api/v1/rag/docs`

**功能要求**:
- 接收单个文档分片
- 验证文档内容（长度、格式等）
- 存储文档到数据库
- 触发向量化（异步）
- 返回文档 ID 和操作 ID

**实现要点**:
- 支持内容去重（基于 contentHash）
- 支持版本管理（基于 version）
- 异步触发向量化，不阻塞响应
- 完整的错误处理和验证

---

#### 3. 批量文档上传接口 ✅

**优先级**: P0（最高）  
**接口**: `POST /api/v1/rag/docs/batch`

**功能要求**:
- 接收最多 100 个文档分片
- 批量处理和验证
- 支持部分成功（返回 207 Multi-Status）
- 返回批量操作 ID 和每个文档的处理结果

**实现要点**:
- 使用事务保证数据一致性
- 批量处理提高效率
- 支持部分失败的情况
- 返回详细的处理结果

---

#### 4. 操作记录查询接口 ✅

**优先级**: P1（高）  
**接口**: `GET /api/v1/rag/operations`

**功能要求**:
- 查询历史操作记录
- 支持多种过滤条件（sourceId、status、日期范围等）
- 支持分页查询

**实现要点**:
- 高效的查询性能（索引优化）
- 支持复杂的过滤组合
- 分页信息完整

---

#### 5. 操作详情查询接口 ✅

**优先级**: P1（高）  
**接口**: `GET /api/v1/rag/operations/{operationId}`

**功能要求**:
- 查询单个操作的详细信息
- 包含操作中的所有文档列表
- 包含操作统计信息（成功数、失败数等）

**实现要点**:
- 关联查询操作和文档
- 返回完整的操作历史

---

### 辅助功能（建议实现）

#### 6. 版本替换接口

**优先级**: P2（中）  
**接口**: `POST /api/v1/rag/docs/versions/{version}/replace`

**功能要求**:
- 用新版本替换旧版本的所有文档
- 支持 dry-run 模式
- 返回替换的文档数量

**实现要点**:
- 软删除旧版本文档
- 支持回滚机制

---

#### 7. 文档查询接口（调试用）

**优先级**: P3（低）  
**接口**: `GET /api/v1/rag/docs`

**功能要求**:
- 查询已上传的文档
- 支持多种过滤条件
- 支持分页查询

**实现要点**:
- 仅用于调试和验证
- 可限制返回内容大小

---

## 数据库设计

### 表结构设计

#### 1. `rag_documents` 表

存储文档内容和元数据。

```sql
CREATE TABLE rag_documents (
  id VARCHAR(255) PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  url VARCHAR(1000) NOT NULL,
  content TEXT NOT NULL,
  content_hash VARCHAR(64) NOT NULL,  -- SHA-256 hash
  version VARCHAR(50) NOT NULL,
  lang VARCHAR(10) NOT NULL,  -- 'ja', 'zh', 'en'
  source_id VARCHAR(100),
  doc_type VARCHAR(50),  -- 'official', 'organization', 'education'
  
  -- 元数据（JSON）
  metadata JSONB,
  
  -- 向量化相关
  vector_id VARCHAR(255),  -- 向量数据库中的 ID
  vectorized_at TIMESTAMP,
  vectorization_status VARCHAR(50),  -- 'pending', 'processing', 'completed', 'failed'
  
  -- 时间戳
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- 索引
  INDEX idx_url_hash_version (url, content_hash, version),
  INDEX idx_source_id (source_id),
  INDEX idx_version (version),
  INDEX idx_vector_status (vectorization_status),
  INDEX idx_created_at (created_at)
);

-- 唯一约束：同一 URL + contentHash + version 只能有一条记录
CREATE UNIQUE INDEX idx_unique_doc ON rag_documents(url, content_hash, version);
```

#### 2. `rag_operations` 表

存储操作记录。

```sql
CREATE TABLE rag_operations (
  id VARCHAR(255) PRIMARY KEY,
  source_id VARCHAR(100),
  operation_type VARCHAR(50) NOT NULL,  -- 'single', 'batch', 'replace'
  status VARCHAR(50) NOT NULL,  -- 'pending', 'processing', 'success', 'failed'
  
  -- 统计信息
  docs_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  
  -- 元数据（JSON）
  metadata JSONB,
  
  -- 时间戳
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_ms INTEGER,
  
  -- 错误信息
  error_message TEXT,
  error_details JSONB,
  
  -- 索引
  INDEX idx_source_id (source_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  INDEX idx_operation_type (operation_type)
);
```

#### 3. `rag_operation_documents` 表

关联操作和文档（用于批量操作）。

```sql
CREATE TABLE rag_operation_documents (
  id VARCHAR(255) PRIMARY KEY,
  operation_id VARCHAR(255) NOT NULL,
  document_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL,  -- 'success', 'failed', 'duplicate'
  error_message TEXT,
  error_details JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  FOREIGN KEY (operation_id) REFERENCES rag_operations(id) ON DELETE CASCADE,
  FOREIGN KEY (document_id) REFERENCES rag_documents(id) ON DELETE CASCADE,
  
  INDEX idx_operation_id (operation_id),
  INDEX idx_document_id (document_id)
);
```

### 数据库索引建议

```sql
-- 文档查询优化
CREATE INDEX idx_documents_source_version ON rag_documents(source_id, version);
CREATE INDEX idx_documents_lang ON rag_documents(lang);

-- 操作查询优化
CREATE INDEX idx_operations_source_status ON rag_operations(source_id, status);
CREATE INDEX idx_operations_date_range ON rag_operations(created_at, status);
```

---

## API 实现清单

### 1. 健康检查接口

**实现检查项**:
- [ ] 实现 `GET /api/v1/rag/health` 端点
- [ ] 返回 `{status: "ok", timestamp: ISO8601, version: "v1"}`
- [ ] 响应时间 < 100ms
- [ ] 不需要认证
- [ ] 可用于负载均衡健康检查

**测试用例**:
```bash
curl -X GET https://your-domain.com/api/v1/rag/health
```

---

### 2. 单文档上传接口

**实现检查项**:
- [ ] 实现 `POST /api/v1/rag/docs` 端点
- [ ] 验证必填字段（title, url, content, version, lang）
- [ ] 验证内容长度（100-2000 字符）
- [ ] 计算 contentHash（SHA-256）
- [ ] 检查重复（基于 url + contentHash + version）
- [ ] 存储文档到数据库
- [ ] 创建操作记录
- [ ] 异步触发向量化
- [ ] 返回文档 ID 和操作 ID
- [ ] 完整的错误处理

**测试用例**:
```bash
curl -X POST https://your-domain.com/api/v1/rag/docs \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "测试文档",
    "url": "https://example.com",
    "content": "这是测试内容...",
    "version": "2025Q1",
    "lang": "ja"
  }'
```

---

### 3. 批量文档上传接口

**实现检查项**:
- [ ] 实现 `POST /api/v1/rag/docs/batch` 端点
- [ ] 验证文档数量（最多 100 个）
- [ ] 批量验证文档内容
- [ ] 使用事务保证数据一致性
- [ ] 支持部分成功（返回 207）
- [ ] 创建批量操作记录
- [ ] 关联操作和文档
- [ ] 返回详细的处理结果
- [ ] 完整的错误处理

**测试用例**:
```bash
curl -X POST https://your-domain.com/api/v1/rag/docs/batch \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "docs": [
      {
        "title": "文档1",
        "url": "https://example.com/1",
        "content": "内容1...",
        "version": "2025Q1",
        "lang": "ja"
      },
      {
        "title": "文档2",
        "url": "https://example.com/2",
        "content": "内容2...",
        "version": "2025Q1",
        "lang": "ja"
      }
    ]
  }'
```

---

### 4. 操作记录查询接口

**实现检查项**:
- [ ] 实现 `GET /api/v1/rag/operations` 端点
- [ ] 支持 sourceId 过滤
- [ ] 支持 status 过滤
- [ ] 支持日期范围过滤
- [ ] 支持分页（page, limit）
- [ ] 返回分页信息
- [ ] 查询性能优化（索引）

**测试用例**:
```bash
curl -X GET "https://your-domain.com/api/v1/rag/operations?sourceId=gov_npa_driving&status=success&page=1&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 5. 操作详情查询接口

**实现检查项**:
- [ ] 实现 `GET /api/v1/rag/operations/{operationId}` 端点
- [ ] 查询操作基本信息
- [ ] 关联查询操作中的文档列表
- [ ] 返回操作统计信息
- [ ] 处理操作不存在的情况

**测试用例**:
```bash
curl -X GET https://your-domain.com/api/v1/rag/operations/op_xyz789 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 向量化集成

### 向量化服务说明

**重要**: DriveQuiz 已经有一个向量化服务 `POST /v1/admin/rag/ingest`，**不需要重新实现向量化功能**，只需要：

1. **优化现有服务**（见下方详细需求）
2. **在文档上传 API 中调用现有服务**（异步触发）

### 向量化服务评估

**服务可用性**: ⭐⭐⭐⭐☆ (4/5) - 可用，但需要优化

#### 现有功能

**现有服务**: `POST /v1/admin/rag/ingest`

**已实现功能**:
- ✅ 文本智能分片（500-800字符/片，带重叠）
- ✅ 批量生成向量嵌入（OpenAI text-embedding-3-small，1536维）
- ✅ 批量写入向量数据库（Supabase pgvector）
- ✅ 部分失败容忍（单个分片失败不影响整体）
- ✅ 成本可控（$0.02/1M tokens，单文档约 $0.0006）

#### 需要优化的功能

**高优先级问题（P0 - 必须实现）**:

1. **支持可选 docId**（当前必填）
   - 问题：datapull 上传文档时还没有 `docId`
   - 需求：支持可选 `docId`，如果没有提供则自动生成

2. **添加 lang 字段支持**（当前缺少）
   - 问题：缺少语言代码字段
   - 需求：添加 `lang` 字段，支持 "ja" | "zh" | "en"

3. **添加 meta 字段支持**（当前缺少）
   - 问题：缺少元数据字段（sourceId, type 等）
   - 需求：添加 `meta` 字段，支持任意元数据对象

4. **统一响应格式**（当前不一致）
   - 问题：使用 `{ok: true, data: {...}}`，与 datapull API 设计不一致
   - 需求：统一响应格式，使用 `{success: true, docId: "...", ...}` 或保持兼容

5. **添加超时控制**（当前无超时）
   - 问题：向量化可能长时间等待
   - 需求：设置超时（30-60秒）

6. **实现重试机制**（当前无重试）
   - 问题：OpenAI API 或 Supabase 临时故障时直接失败
   - 需求：实现指数退避重试（最多3次）

**中优先级问题（P1 - 建议实现）**:

7. **添加关键日志**（当前日志不足）
   - 问题：故障排查困难
   - 需求：记录向量化开始、完成、失败等关键操作

8. **记录处理指标**（当前无监控）
   - 问题：无法评估服务健康度
   - 需求：记录处理时间、分片数量等指标

9. **实现速率限制**（当前无限制）
   - 问题：可能触发 OpenAI API 速率限制
   - 需求：实现请求队列/限流（最多10个并发）

**低优先级问题（P2 - 可选实现）**:

10. **添加监控指标**（集成 Prometheus、Grafana 等）
11. **实现成本监控**（监控 OpenAI API 调用量和成本）
12. **添加告警机制**（服务异常时告警）

详细优化需求见：[优化需求清单](./drivequiz-optimization-requirements.md)

### 向量化触发机制

文档上传后，需要异步触发向量化流程。

#### 实现方式（推荐）

**文档上传 API 内部调用向量化服务**：

```python
# 伪代码示例
def ingest_document(doc_data):
    # 1. 存储文档到数据库
    doc = save_document(doc_data)
    
    # 2. 创建操作记录
    operation = create_operation(doc.id)
    
    # 3. 异步调用向量化服务
    vectorization_queue.enqueue({
        'docId': doc.id,
        'title': doc.title,
        'url': doc.url,
        'content': doc.content,
        'version': doc.version,
        'lang': doc.lang,
        'meta': doc.metadata
    })
    
    # 4. 更新文档状态为 pending
    doc.vectorization_status = 'pending'
    doc.save()
    
    return {
        'docId': doc.id,
        'operationId': operation.id
    }

# 向量化任务处理
async def vectorize_document_task(payload):
    try:
        # 调用向量化服务
        response = await call_vectorization_service(
            url='https://ai-service/v1/admin/rag/ingest',
            method='POST',
            headers={'Authorization': f'Bearer {SERVICE_TOKEN}'},
            data=payload
        )
        
        # 更新文档状态
        doc = Document.objects.get(id=payload['docId'])
        doc.vectorization_status = 'completed'
        doc.vectorized_at = now()
        doc.save()
        
    except Exception as e:
        # 更新文档状态为失败
        doc = Document.objects.get(id=payload['docId'])
        doc.vectorization_status = 'failed'
        doc.error_message = str(e)
        doc.save()
```

#### 向量化状态管理

文档需要维护向量化状态：

- `pending`: 等待向量化
- `processing`: 正在向量化
- `completed`: 向量化完成
- `failed`: 向量化失败

#### 向量化失败处理

- 记录错误信息
- 支持重试机制（调用向量化服务时重试）
- 通知管理员（可选）

### 向量化服务调用示例

```python
# 调用向量化服务
async def call_vectorization_service(payload):
    response = await http_client.post(
        'https://ai-service/v1/admin/rag/ingest',
        headers={
            'Authorization': f'Bearer {SERVICE_TOKEN}',
            'Content-Type': 'application/json'
        },
        json={
            'docId': payload.get('docId'),  # 可选：如果提供则使用，否则自动生成
            'title': payload.get('title'),
            'url': payload.get('url'),
            'content': payload['content'],  # 必填
            'version': payload.get('version', 'v1'),
            'lang': payload.get('lang', 'ja'),  # 需要优化：添加支持，默认 'ja'
            'meta': payload.get('meta')  # 需要优化：添加支持
        },
        timeout=60  # 60秒超时（需要优化：添加超时控制）
    )
    return response.json()
```

### 向量化服务优化实现清单

#### P0 - 必须实现（影响集成）

**1. 支持可选 docId**

**实现要求**:
```typescript
// 伪代码示例
interface IngestRequest {
  docId?: string;  // 改为可选
  content: string;  // 必填
  // ... 其他字段
}

function ingest(request: IngestRequest) {
  const docId = request.docId || generateDocId();  // 自动生成
  // ... 处理逻辑
}
```

**验收标准**:
- [ ] 不提供 `docId` 时自动生成
- [ ] 提供 `docId` 时使用提供的值
- [ ] 生成的 `docId` 格式一致（如 `doc_xxx`）

---

**2. 添加 lang 字段支持**

**实现要求**:
```typescript
interface IngestRequest {
  // ... 其他字段
  lang?: "ja" | "zh" | "en";  // 新增
}

// 存储到数据库
{
  lang: request.lang || "ja",  // 默认值
  // ... 其他字段
}
```

**验收标准**:
- [ ] 支持 "ja"、"zh"、"en" 三种语言
- [ ] 未提供时使用默认值（建议 "ja"）
- [ ] 语言信息存储到数据库

---

**3. 添加 meta 字段支持**

**实现要求**:
```typescript
interface IngestRequest {
  // ... 其他字段
  meta?: {
    sourceId?: string;
    type?: string;
    chunkIndex?: number;
    totalChunks?: number;
    [key: string]: any;  // 支持其他字段
  };
}

// 存储到数据库（JSONB）
{
  metadata: JSON.stringify(request.meta || {}),
  // ... 其他字段
}
```

**验收标准**:
- [ ] 支持任意元数据对象
- [ ] 元数据存储到数据库（JSONB 格式）
- [ ] 元数据可以用于查询和过滤

---

**4. 统一响应格式**

**实现要求**:
```typescript
// 推荐格式（兼容现有格式）
interface IngestResponse {
  success: boolean;  // 新增，兼容 ok
  ok?: boolean;      // 保留，向后兼容
  docId: string;     // 新增
  operationId?: string;  // 新增
  data: {
    chunks: number;
    version: string;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}
```

**验收标准**:
- [ ] 响应包含 `success` 和 `docId`
- [ ] 保留 `ok` 字段（向后兼容）
- [ ] 错误响应格式统一

---

**5. 添加超时控制**

**实现要求**:
```typescript
// 伪代码示例
async function ingestWithTimeout(request: IngestRequest) {
  const timeout = 60000;  // 60秒（可配置）
  
  return Promise.race([
    ingestDocument(request),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Timeout")), timeout)
    )
  ]);
}
```

**验收标准**:
- [ ] 超时设置可配置（环境变量）
- [ ] 超时后返回错误响应
- [ ] 超时错误信息清晰

---

**6. 实现重试机制**

**实现要求**:
```typescript
// 伪代码示例
async function ingestWithRetry(request: IngestRequest, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await ingestDocument(request);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const delay = Math.pow(2, i) * 1000;  // 指数退避（1s, 2s, 4s）
      await sleep(delay);
    }
  }
}
```

**验收标准**:
- [ ] 重试次数可配置（最多3次）
- [ ] 使用指数退避（1s, 2s, 4s）
- [ ] 重试后记录日志

---

#### P1 - 建议实现（提升体验）

**7. 添加关键日志**

**实现要求**:
```typescript
// 伪代码示例
logger.info("Vectorization started", { docId, contentLength });
logger.info("Chunks created", { docId, chunkCount });
logger.info("Vectorization completed", { docId, duration });
logger.error("Vectorization failed", { docId, error });
```

**验收标准**:
- [ ] 记录向量化开始、完成、失败
- [ ] 记录处理时间、分片数量
- [ ] 日志格式统一（JSON）

---

**8. 记录处理指标**

**实现要求**:
```typescript
// 伪代码示例
const metrics = {
  processingTime: Date.now() - startTime,
  chunkCount: chunks.length,
  success: true,
  error: null
};

// 存储到数据库或发送到监控系统
recordMetrics(metrics);
```

**验收标准**:
- [ ] 记录处理时间
- [ ] 记录分片数量
- [ ] 记录成功/失败状态

---

**9. 实现速率限制**

**实现要求**:
```typescript
// 伪代码示例
import pQueue from 'p-queue';

const queue = new pQueue({
  concurrency: 10,  // 最多10个并发
  interval: 1000,   // 每秒最多10个请求
});

async function ingestWithRateLimit(request: IngestRequest) {
  return queue.add(() => ingestDocument(request));
}
```

**验收标准**:
- [ ] 控制并发数（最多10个）
- [ ] 控制请求频率（每秒最多10个）
- [ ] 超过限制时返回 429 错误

---

#### P2 - 可选实现（长期优化）

**10. 添加监控指标**

**需求**: 集成监控系统（Prometheus、Grafana 等）

**验收标准**:
- [ ] 暴露监控指标端点
- [ ] 记录处理时间、成功率等指标
- [ ] 集成监控仪表盘

---

**11. 实现成本监控**

**需求**: 监控 OpenAI API 调用量和成本

**验收标准**:
- [ ] 记录每个请求的 token 数量
- [ ] 计算成本
- [ ] 提供成本统计接口

---

**12. 添加告警机制**

**需求**: 服务异常时告警

**验收标准**:
- [ ] 失败率超过阈值时告警
- [ ] 处理时间超过阈值时告警
- [ ] 支持多种告警方式（邮件、Slack 等）

---

### 向量化服务优化检查清单

#### 高优先级（P0）

- [ ] 支持可选 docId（如果没有提供则自动生成）
- [ ] 添加 lang 字段支持（"ja" | "zh" | "en"）
- [ ] 添加 meta 字段支持（任意元数据对象）
- [ ] 统一响应格式（使用 `{success: true, ...}` 或保持兼容）
- [ ] 添加超时控制（30-60秒，可配置）
- [ ] 实现重试机制（指数退避，最多3次）

#### 中优先级（P1）

- [ ] 添加关键日志（记录向量化开始、完成、失败）
- [ ] 记录处理指标（处理时间、分片数量等）
- [ ] 实现速率限制（控制并发数和请求频率）

#### 低优先级（P2）

- [ ] 添加监控指标（集成 Prometheus、Grafana 等）
- [ ] 实现成本监控（监控 OpenAI API 调用量和成本）
- [ ] 添加告警机制（服务异常时告警）

---

### 向量化服务测试清单

#### 基础功能测试

- [ ] 向量化服务可访问
- [ ] 认证机制正常工作
- [ ] 支持可选 docId（不提供时自动生成）
- [ ] 支持 lang 和 meta 字段
- [ ] 响应格式正确

#### 错误处理测试

- [ ] 超时处理正确（超时后返回错误）
- [ ] 重试机制正常工作（指数退避，最多3次）
- [ ] 错误响应格式正确

#### 性能测试

- [ ] 单文档向量化时间 < 10秒
- [ ] 批量处理正常（建议最多10个并发）
- [ ] 部分失败处理正确（单个分片失败不影响整体）

#### 集成测试

- [ ] datapull 完整流程测试
- [ ] 文档上传后自动向量化
- [ ] 向量化状态查询

---

## 认证系统

### Token 生成

需要在 DriveQuiz 管理后台提供 Token 生成功能。

#### Token 格式

**方式 1: JWT Token（推荐）**

```json
{
  "sub": "datapull_service",
  "iat": 1704542400,
  "exp": 1704628800,
  "scope": "rag:ingest"
}
```

**方式 2: 简单 API Key**

生成随机字符串作为 API Key，存储在数据库中。

#### Token 验证

```python
# 伪代码示例
def verify_token(token):
    # 从数据库或缓存中验证 token
    api_key = APIKey.objects.filter(
        key=token,
        is_active=True,
        expires_at__gt=now()
    ).first()
    
    if not api_key:
        raise UnauthorizedError("Invalid or expired token")
    
    return api_key.user
```

#### Token 管理

- Token 过期时间设置
- Token 撤销功能
- Token 使用记录（可选）

---

## 错误处理

### 错误码实现

实现以下错误码：

| 错误码 | HTTP 状态码 | 说明 |
|--------|------------|------|
| `UNAUTHORIZED` | 401 | 认证失败 |
| `FORBIDDEN` | 403 | 权限不足 |
| `INVALID_REQUEST` | 400 | 请求参数错误 |
| `INVALID_CONTENT` | 400 | 内容格式错误 |
| `CONTENT_TOO_SHORT` | 400 | 内容过短（< 100 字符） |
| `CONTENT_TOO_LONG` | 400 | 内容过长（> 2000 字符） |
| `DUPLICATE_DOCUMENT` | 409 | 文档已存在 |
| `RATE_LIMIT_EXCEEDED` | 429 | 请求频率超限 |
| `INTERNAL_ERROR` | 500 | 服务器内部错误 |
| `SERVICE_UNAVAILABLE` | 503 | 服务暂时不可用 |

### 错误响应格式

```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Missing required field: content",
    "details": {
      "field": "content",
      "reason": "content is required and must be non-empty"
    }
  }
}
```

### 速率限制

实现速率限制：

- **单文档上传**: 100 次/分钟
- **批量上传**: 10 次/分钟
- **查询操作**: 200 次/分钟

响应头包含速率限制信息：

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704542400
```

---

## 测试要求

### 单元测试

- [ ] 每个 API 端点都有单元测试
- [ ] 测试覆盖率达到 80% 以上
- [ ] 测试各种边界情况

### 集成测试

- [ ] 测试完整的文档上传流程
- [ ] 测试批量上传流程
- [ ] 测试操作记录查询
- [ ] 测试错误处理

### 性能测试

- [ ] 单文档上传响应时间 < 500ms
- [ ] 批量上传（100 个文档）响应时间 < 5s
- [ ] 支持并发请求（至少 10 个并发）

### 测试用例清单

#### 健康检查

- [ ] 正常请求返回 200
- [ ] 返回正确的 JSON 格式

#### 单文档上传

- [ ] 正常上传成功
- [ ] 缺少必填字段返回 400
- [ ] 内容过短返回 400
- [ ] 内容过长返回 400
- [ ] 重复文档返回 409 或跳过
- [ ] 无效 Token 返回 401
- [ ] 验证 contentHash 计算

#### 批量上传

- [ ] 正常批量上传成功
- [ ] 部分成功返回 207
- [ ] 超过 100 个文档返回 400
- [ ] 空文档数组返回 400
- [ ] 验证事务一致性

#### 操作记录查询

- [ ] 正常查询返回列表
- [ ] sourceId 过滤正确
- [ ] status 过滤正确
- [ ] 日期范围过滤正确
- [ ] 分页功能正确

---

## 联调配合事项

### 环境准备

#### 1. 开发环境

- [ ] 提供开发环境 API 地址
- [ ] 提供开发环境 API Token
- [ ] 提供数据库连接信息（如需要）

#### 2. 测试环境

- [ ] 提供测试环境 API 地址
- [ ] 提供测试环境 API Token
- [ ] 提供测试数据清理机制

#### 3. 生产环境

- [ ] 提供生产环境 API 地址
- [ ] 提供生产环境 API Token（需要安全传输）
- [ ] 提供监控和告警机制

### 联调测试清单

#### 阶段 1: 基础接口联调

- [ ] 健康检查接口可访问
- [ ] 单文档上传接口可访问
- [ ] 认证机制正常工作
- [ ] 错误处理正确

#### 阶段 2: 功能联调

- [ ] 单文档上传成功
- [ ] 批量文档上传成功
- [ ] 操作记录正确保存
- [ ] 操作记录查询正确

#### 阶段 3: 性能联调

- [ ] 批量上传性能满足要求
- [ ] 并发请求处理正常
- [ ] 速率限制正常工作

#### 阶段 4: 完整流程联调

- [ ] datapull 完整抓取和上传流程
- [ ] 向量化触发正常
- [ ] 数据去重正常工作
- [ ] 版本管理正常工作

### 联调配合事项清单

#### 需要 DriveQuiz 团队提供

1. **API 地址**
   - [ ] 开发环境 API 地址
   - [ ] 测试环境 API 地址
   - [ ] 生产环境 API 地址

2. **认证信息**
   - [ ] 开发环境 API Token
   - [ ] 测试环境 API Token
   - [ ] 生产环境 API Token（安全传输）

3. **API 文档**
   - [ ] 完整的 API 文档
   - [ ] 错误码说明
   - [ ] 速率限制说明

4. **测试支持**
   - [ ] 测试数据准备
   - [ ] 测试环境数据清理
   - [ ] 测试反馈和问题修复

5. **监控和告警**
   - [ ] API 监控仪表盘
   - [ ] 错误告警机制
   - [ ] 性能监控

#### 需要 datapull 团队提供

1. **测试场景**
   - [ ] 测试用例清单
   - [ ] 测试数据样例
   - [ ] 测试脚本

2. **问题反馈**
   - [ ] 问题报告模板
   - [ ] 日志收集方法
   - [ ] 问题复现步骤

### 联调时间表建议

#### Week 1: 基础接口联调

- Day 1-2: 健康检查和单文档上传
- Day 3-4: 批量上传和操作记录
- Day 5: 问题修复和总结

#### Week 2: 功能联调

- Day 1-2: 完整流程测试
- Day 3-4: 性能测试
- Day 5: 问题修复和优化

#### Week 3: 生产环境准备

- Day 1-2: 生产环境部署
- Day 3-4: 生产环境测试
- Day 5: 上线准备

---

## 环境配置

### 环境变量

DriveQuiz 需要配置以下环境变量：

```bash
# API 配置
RAG_API_BASE_PATH=/api/v1/rag
RAG_API_VERSION=v1

# 数据库配置
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# 向量化配置
VECTOR_DB_URL=...
VECTOR_DB_API_KEY=...

# 认证配置
JWT_SECRET=...
API_KEY_TABLE=api_keys

# 速率限制配置
RATE_LIMIT_ENABLED=true
RATE_LIMIT_SINGLE=100
RATE_LIMIT_BATCH=10
RATE_LIMIT_QUERY=200

# 日志配置
LOG_LEVEL=info
LOG_FORMAT=json
```

### 部署要求

- [ ] 支持 HTTPS（必需）
- [ ] 支持负载均衡
- [ ] 支持健康检查
- [ ] 支持监控和告警
- [ ] 支持日志收集

---

## 交付清单

### 必须交付

- [ ] 所有 API 端点实现完成
- [ ] 数据库表结构创建完成
- [ ] 认证系统实现完成
- [ ] 向量化集成完成
- [ ] 操作记录功能完成
- [ ] 错误处理完成
- [ ] 单元测试和集成测试完成
- [ ] API 文档更新完成

### 建议交付

- [ ] 性能测试报告
- [ ] 监控仪表盘
- [ ] 部署文档
- [ ] 运维手册

---

## 联系方式

如有问题，请联系：

- **API 规范问题**: 参考 `docs/drivequiz-api-spec.md`
- **联调问题**: 联系 datapull 团队
- **技术问题**: 联系 DriveQuiz 开发团队

---

## 附录

### A. 参考文档

- [API 规范文档](./drivequiz-api-spec.md)
- [OpenAPI 规范](./drivequiz-api-spec.yaml)
- [项目结构文档](./project-structure.md)
- [向量化服务集成评估](./vectorization-service-integration.md)
- [向量化服务优化需求](./drivequiz-optimization-requirements.md)

### B. 示例代码

请参考 `docs/drivequiz-api-spec.md` 中的示例代码。

### C. 常见问题

#### Q: 如何处理重复文档？

A: 基于 `url + contentHash + version` 组合判断重复。如果文档已存在，可以选择：
- 跳过（返回 409 或成功但不创建新记录）
- 更新（替换旧文档）

建议在 API 文档中明确说明。

#### Q: 向量化失败如何处理？

A: 记录错误信息，更新文档状态为 `failed`，支持手动或自动重试。

#### Q: 如何支持版本替换？

A: 实现 `POST /api/v1/rag/docs/versions/{version}/replace` 接口，软删除旧版本文档，标记为已替换。

---

**文档版本**: v1.0.0  
**最后更新**: 2025-01-06

