# DriveQuiz API 快速参考

本文档是 DriveQuiz 团队和 datapull 团队的快速参考指南。

## 📚 文档导航

### 给 DriveQuiz 团队

1. **[开发指南](./drivequiz-development-guide.md)** - 完整的功能实现指南
2. **[API 规范](./drivequiz-api-spec.md)** - 详细的 API 接口规范
3. **[OpenAPI 规范](./drivequiz-api-spec.yaml)** - OpenAPI 格式的 API 规范

### 给 datapull 团队

1. **[集成联调清单](./drivequiz-integration-checklist.md)** - 完整的联调配合事项
2. **[项目结构文档](./project-structure.md)** - datapull 项目结构说明

---

## 🚀 快速开始

### DriveQuiz 团队需要实现的核心功能

#### 1. 必须实现的 API（P0）

| 接口 | 方法 | 路径 | 优先级 |
|------|------|------|--------|
| 健康检查 | GET | `/api/v1/rag/health` | P0 |
| 单文档上传 | POST | `/api/v1/rag/docs` | P0 |
| 批量文档上传 | POST | `/api/v1/rag/docs/batch` | P0 |
| 操作记录查询 | GET | `/api/v1/rag/operations` | P1 |
| 操作详情查询 | GET | `/api/v1/rag/operations/{operationId}` | P1 |

#### 2. 数据库表结构

- `rag_documents` - 存储文档内容
- `rag_operations` - 存储操作记录
- `rag_operation_documents` - 关联操作和文档

详细设计见 [开发指南](./drivequiz-development-guide.md#数据库设计)。

#### 3. 认证方式

- Bearer Token（必需）
- API Key（可选）

#### 4. 向量化集成

- 文档上传后自动触发向量化（异步）
- 维护向量化状态（pending/processing/completed/failed）

---

## 📋 关键实现要点

### 1. 单文档上传

```json
POST /api/v1/rag/docs
{
  "title": "文档标题",
  "url": "https://example.com",
  "content": "文档内容（100-2000字符）",
  "version": "2025Q1",
  "lang": "ja",
  "meta": {
    "sourceId": "gov_npa_driving",
    "type": "official"
  }
}
```

**必须实现**:
- ✅ 字段验证（title, url, content, version, lang）
- ✅ 内容长度验证（100-2000字符）
- ✅ contentHash 计算（SHA-256）
- ✅ 去重检查（url + contentHash + version）
- ✅ 数据库存储
- ✅ 操作记录创建
- ✅ 异步向量化触发

### 2. 批量文档上传

```json
POST /api/v1/rag/docs/batch
{
  "docs": [
    {"title": "文档1", "url": "...", "content": "...", "version": "2025Q1", "lang": "ja"},
    {"title": "文档2", "url": "...", "content": "...", "version": "2025Q1", "lang": "ja"}
  ],
  "sourceId": "gov_npa_driving"
}
```

**必须实现**:
- ✅ 批量验证（最多100个文档）
- ✅ 事务处理
- ✅ 部分成功处理（返回207）
- ✅ 操作记录关联

### 3. 错误处理

**错误码**:
- `UNAUTHORIZED` (401) - 认证失败
- `INVALID_REQUEST` (400) - 请求参数错误
- `CONTENT_TOO_SHORT` (400) - 内容过短
- `CONTENT_TOO_LONG` (400) - 内容过长
- `DUPLICATE_DOCUMENT` (409) - 文档已存在
- `RATE_LIMIT_EXCEEDED` (429) - 请求频率超限

**错误响应格式**:
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

---

## 🔄 联调流程

### 阶段 1: 基础接口联调（1-2天）

- [ ] 健康检查接口可访问
- [ ] 认证机制正常工作
- [ ] 错误处理正确

### 阶段 2: 单文档上传联调（1-2天）

- [ ] 单文档上传成功
- [ ] 验证逻辑正确
- [ ] 去重逻辑正确
- [ ] 操作记录正确

### 阶段 3: 批量上传联调（1-2天）

- [ ] 批量上传成功
- [ ] 事务处理正确
- [ ] 部分成功处理正确

### 阶段 4: 完整流程联调（2-3天）

- [ ] datapull 完整流程测试
- [ ] 向量化触发正常
- [ ] 性能满足要求

### 阶段 5: 生产环境准备（1-2天）

- [ ] 生产环境配置
- [ ] 生产环境测试
- [ ] 监控和告警配置

详细流程见 [集成联调清单](./drivequiz-integration-checklist.md)。

---

## 📞 需要配合的事项

### DriveQuiz 团队需要提供

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

### datapull 团队需要提供

1. **测试场景**
   - [ ] 测试用例清单
   - [ ] 测试数据样例
   - [ ] 测试脚本

2. **问题反馈**
   - [ ] 问题报告模板
   - [ ] 日志收集方法

---

## 📊 数据库设计概览

### rag_documents 表

```sql
CREATE TABLE rag_documents (
  id VARCHAR(255) PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  url VARCHAR(1000) NOT NULL,
  content TEXT NOT NULL,
  content_hash VARCHAR(64) NOT NULL,
  version VARCHAR(50) NOT NULL,
  lang VARCHAR(10) NOT NULL,
  source_id VARCHAR(100),
  doc_type VARCHAR(50),
  metadata JSONB,
  vector_id VARCHAR(255),
  vectorized_at TIMESTAMP,
  vectorization_status VARCHAR(50),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (url, content_hash, version)
);
```

### rag_operations 表

```sql
CREATE TABLE rag_operations (
  id VARCHAR(255) PRIMARY KEY,
  source_id VARCHAR(100),
  operation_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  docs_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  duration_ms INTEGER
);
```

详细设计见 [开发指南](./drivequiz-development-guide.md#数据库设计)。

---

## ✅ 交付清单

### DriveQuiz 团队必须交付

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

## 🔗 相关链接

- [完整开发指南](./drivequiz-development-guide.md)
- [API 规范文档](./drivequiz-api-spec.md)
- [OpenAPI 规范](./drivequiz-api-spec.yaml)
- [集成联调清单](./drivequiz-integration-checklist.md)
- [项目结构文档](./project-structure.md)

---

**文档版本**: v1.0.0  
**最后更新**: 2025-01-06

