# DriveQuiz 向量化服务优化需求清单

本文档列出 DriveQuiz 向量化服务需要优化的功能点，以配合 datapull 项目。

## 📋 优化优先级

### 🔴 P0 - 必须实现（影响集成）

### 1. 支持可选 docId

**当前状态**: `docId` 是必填字段  
**问题**: datapull 上传文档时还没有 `docId`  
**需求**: 支持可选 `docId`，如果没有提供则自动生成

**实现要求**:
```typescript
// 伪代码示例
interface IngestRequest {
  docId?: string;  // 改为可选
  title?: string;
  url?: string;
  content: string;  // 必填
  version?: string;
  lang?: string;    // 新增
  meta?: object;    // 新增
}

function ingest(request: IngestRequest) {
  const docId = request.docId || generateDocId();
  // ... 处理逻辑
}
```

**验收标准**:
- [ ] 不提供 `docId` 时自动生成
- [ ] 提供 `docId` 时使用提供的值
- [ ] 生成的 `docId` 格式一致（如 `doc_xxx`）

---

### 2. 添加 lang 字段支持

**当前状态**: 缺少语言代码字段  
**问题**: datapull 需要传递文档语言信息  
**需求**: 添加 `lang` 字段，支持 "ja" | "zh" | "en"

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

### 3. 添加 meta 字段支持

**当前状态**: 缺少元数据字段  
**问题**: datapull 需要传递源信息、类型等元数据  
**需求**: 添加 `meta` 字段，支持任意元数据对象

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

### 4. 统一响应格式

**当前状态**: 使用 `{ok: true, data: {...}}`  
**问题**: 与 datapull API 设计不一致  
**需求**: 统一响应格式，或保持兼容

**实现要求**:
```typescript
// 推荐格式（兼容现有格式）
interface IngestResponse {
  success: boolean;  // 新增，兼容 ok
  ok?: boolean;      // 保留，向后兼容
  docId: string;    // 新增
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

### 5. 添加超时控制

**当前状态**: 无超时控制  
**问题**: 向量化可能长时间等待  
**需求**: 设置超时（30-60秒）

**实现要求**:
```typescript
// 伪代码示例
async function ingestWithTimeout(request: IngestRequest) {
  const timeout = 60000;  // 60秒
  
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

### 6. 实现重试机制

**当前状态**: 无重试机制  
**问题**: OpenAI API 或 Supabase 临时故障时直接失败  
**需求**: 实现指数退避重试（最多3次）

**实现要求**:
```typescript
// 伪代码示例
async function ingestWithRetry(request: IngestRequest, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await ingestDocument(request);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const delay = Math.pow(2, i) * 1000;  // 指数退避
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

## 🟡 P1 - 建议实现（提升体验）

### 7. 添加关键日志

**当前状态**: 日志不足  
**问题**: 故障排查困难  
**需求**: 添加关键操作日志

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

### 8. 记录处理指标

**当前状态**: 无监控指标  
**问题**: 无法评估服务健康度  
**需求**: 记录处理指标

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

### 9. 实现速率限制

**当前状态**: 无速率限制  
**问题**: 可能触发 OpenAI API 速率限制  
**需求**: 实现请求队列/限流

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

## 🟢 P2 - 可选实现（长期优化）

### 10. 添加监控指标

**需求**: 集成监控系统（Prometheus、Grafana 等）

**验收标准**:
- [ ] 暴露监控指标端点
- [ ] 记录处理时间、成功率等指标
- [ ] 集成监控仪表盘

---

### 11. 实现成本监控

**需求**: 监控 OpenAI API 调用量和成本

**验收标准**:
- [ ] 记录每个请求的 token 数量
- [ ] 计算成本
- [ ] 提供成本统计接口

---

### 12. 添加告警机制

**需求**: 服务异常时告警

**验收标准**:
- [ ] 失败率超过阈值时告警
- [ ] 处理时间超过阈值时告警
- [ ] 支持多种告警方式（邮件、Slack 等）

---

## 📝 实现检查清单

### 高优先级（P0）

- [ ] 支持可选 docId
- [ ] 添加 lang 字段支持
- [ ] 添加 meta 字段支持
- [ ] 统一响应格式
- [ ] 添加超时控制
- [ ] 实现重试机制

### 中优先级（P1）

- [ ] 添加关键日志
- [ ] 记录处理指标
- [ ] 实现速率限制

### 低优先级（P2）

- [ ] 添加监控指标
- [ ] 实现成本监控
- [ ] 添加告警机制

---

## 🔗 相关文档

- [向量化服务集成评估](./vectorization-service-integration.md)
- [API 规范](./drivequiz-api-spec.md)
- [开发指南](./drivequiz-development-guide.md)

---

**文档版本**: v1.0.0  
**最后更新**: 2025-01-06

