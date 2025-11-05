# 🧱 ZALEM AI 问答模块数据库迁移与集成测试工作报告

**报告日期**: 2025-01-15  
**执行任务**: 数据库迁移、RPC 函数创建、环境变量配置及集成测试  
**状态**: ✅ 已完成

---

## 📋 任务概览

本次任务完成了 ZALEM AI 问答模块的数据库基础设施搭建，包括：

1. ✅ 创建 5 个数据库表（ai_logs, ai_filters, ai_rag_docs, ai_daily_summary, ai_vectors）
2. ✅ 创建 RPC 函数 match_documents（向量相似度检索）
3. ✅ 编写环境变量配置文档
4. ✅ 创建集成测试脚本（smoke-ai.sh）

---

## ✅ 已完成任务详情

### 1. 数据库迁移脚本

#### 1.1 表结构迁移脚本

**文件**: `src/migrations/20250115_create_ai_tables.sql`

**创建的 5 个表**:

| 表名 | 说明 | 关键字段 | 索引 |
|------|------|----------|------|
| `ai_logs` | 问答日志表 | user_id, question, answer, locale, model, rag_hits, cost_est, safety_flag | created_at, user_id, model |
| `ai_filters` | 禁答关键词规则表 | type, pattern | type (UNIQUE) |
| `ai_rag_docs` | RAG 文档元数据表 | title, url, version, chunks, uploaded_by, lang, tags, status | created_at, status, lang |
| `ai_daily_summary` | 每日汇总统计表 | date (PRIMARY KEY), total_calls, avg_cost, cache_hit_rate, rag_hit_rate, top_questions, new_topics | date |
| `ai_vectors` | 向量存储表 | doc_id, content, embedding (vector(1536)), source_title, source_url, version | embedding (ivfflat), doc_id, version |

**特性**:
- ✅ 使用 `CREATE TABLE IF NOT EXISTS` 避免重复执行错误
- ✅ 所有时间字段使用 `TIMESTAMPTZ` 类型
- ✅ 为高频查询字段创建索引
- ✅ `ai_vectors` 表支持 pgvector 扩展（带容错处理）
- ✅ 包含完整的回滚指令注释

**执行方式**:
```bash
# 在 Supabase SQL Editor 或本地 psql 中执行
psql -h your-host -U your-user -d your-database -f src/migrations/20250115_create_ai_tables.sql
```

#### 1.2 RPC 函数迁移脚本

**文件**: `src/migrations/20250115_create_match_documents_rpc.sql`

**函数签名**:
```sql
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id bigint,
  doc_id varchar,
  content text,
  source_title text,
  source_url text,
  version varchar,
  similarity float
)
```

**功能**:
- 根据查询向量和相似度阈值，返回最相似的文档片段
- 使用余弦相似度计算（`1 - (embedding <=> query_embedding)`）
- 支持自定义阈值和返回数量限制

**依赖**:
- 需要 `pgvector` 扩展支持
- 需要 `ai_vectors` 表已创建

**执行方式**:
```bash
# 在 Supabase SQL Editor 中执行
# 注意：必须先确保 pgvector 扩展已启用
```

---

### 2. 环境变量配置文档

**文件**: `docs/AI_ENV_SETUP.md`

**内容概览**:

#### 主站（Vercel / Next.js Web App）环境变量

| Key | 用途 | 必需 |
|-----|------|------|
| `OPENAI_API_KEY` | 调用 GPT-4o-mini | ✅ |
| `AI_MODEL` | 默认 AI 模型 | ❌ |
| `AI_SERVICE_URL` | 主站→AI-Service 调用地址 | ✅ |
| `AI_SERVICE_TOKEN` | Service Token（主站调用凭证） | ✅ |
| `SUPABASE_URL` | Supabase 项目 URL | ✅ |
| `SUPABASE_SERVICE_KEY` | 服务端密钥（AI-Service 用） | ✅ |
| `SUPABASE_ANON_KEY` | 前端匿名密钥（主站用） | ✅ |
| `AI_CACHE_REDIS_URL` | 可选 Redis 缓存连接 | ❌ |
| `AI_SERVICE_SUMMARY_URL` | Admin 监控页访问 AI 摘要接口 | ✅ |

#### AI-Service（Railway / Fastify App）环境变量

| Key | 用途 | 必需 |
|-----|------|------|
| `OPENAI_API_KEY` | 调用 GPT-4o-mini | ✅ |
| `AI_MODEL` | 默认 AI 模型 | ❌ |
| `PORT` | 服务端口 | ❌ |
| `HOST` | 服务监听地址 | ❌ |
| `SERVICE_TOKENS` | AI-Service 白名单 Token 列表（逗号分隔） | ✅ |
| `SUPABASE_URL` | Supabase 项目 URL | ✅ |
| `SUPABASE_SERVICE_KEY` | 服务端密钥（AI-Service 用） | ✅ |
| `AI_CACHE_REDIS_URL` | 可选 Redis 缓存连接 | ❌ |

**文档包含**:
- ✅ 环境变量清单（主站 + AI-Service）
- ✅ 本地开发配置步骤
- ✅ 生产环境配置步骤（Vercel + Railway）
- ✅ 验证配置方法
- ✅ 常见问题解答
- ✅ 安全最佳实践

---

### 3. 集成测试脚本

**文件**: `scripts/smoke-ai.sh`

**功能**: 一键验证核心路由返回 200

**测试项清单**:

| # | 测试项 | 路由 | 方法 | 状态 |
|---|--------|------|------|------|
| 1 | 主站 /api/ai/ask | `/api/ai/ask` | POST | ✅ |
| 2 | AI-Service /v1/ask | `/v1/ask` | POST | ✅ |
| 3 | 日志落库验证 | 数据库查询 | SQL | ℹ️ 需手动验证 |
| 4 | Admin Logs API | `/api/admin/ai/logs` | GET | ✅ |
| 5 | Filters API (GET) | `/api/admin/ai/filters` | GET | ✅ |
| 6 | Filters API (POST) | `/api/admin/ai/filters` | POST | ✅ |
| 7 | RAG Docs API (GET) | `/api/admin/ai/rag/docs` | GET | ✅ |
| 8 | RAG Docs API (POST) | `/api/admin/ai/rag/docs` | POST | ✅ |
| 9 | Daily Summary | `/v1/admin/daily-summary` | GET | ✅ |
| 10 | 定时任务验证 | Railway logs | - | ℹ️ 需手动验证 |
| 11 | 前端 AIPage | `/api/ai/chat` | POST | ✅ |
| 12 | AI-Service Health | `/health` | GET | ✅ |

**使用方法**:
```bash
# 基本用法
./scripts/smoke-ai.sh "https://drivequiz.example.vercel.app" "https://ai.zalem.app" "admin_token" "user_token"

# 或从环境变量读取
export AI_SERVICE_URL="https://ai.zalem.app"
export AI_SERVICE_TOKEN="svc_xxx"
export ADMIN_TOKEN="admin_token"
export USER_TOKEN="user_token"
./scripts/smoke-ai.sh "https://drivequiz.example.vercel.app"
```

**特性**:
- ✅ 彩色输出（成功/失败/警告）
- ✅ 详细日志记录（保存到 `logs/smoke-ai-YYYYMMDD-HHMMSS.log`）
- ✅ 测试统计（通过/失败/跳过）
- ✅ 容错处理（缺少参数时跳过测试并提示）
- ✅ 支持从环境变量读取配置

---

## 📁 创建的文件清单

| 文件路径 | 说明 | 状态 |
|---------|------|------|
| `src/migrations/20250115_create_ai_tables.sql` | 数据库表迁移脚本（5个表） | ✅ |
| `src/migrations/20250115_create_match_documents_rpc.sql` | RPC 函数迁移脚本 | ✅ |
| `docs/AI_ENV_SETUP.md` | 环境变量配置文档 | ✅ |
| `scripts/smoke-ai.sh` | 集成测试脚本 | ✅ |

---

## 🔧 执行步骤

### 步骤 1: 执行数据库迁移

#### 1.1 创建表结构

在 **Supabase SQL Editor** 中执行：
```sql
-- 复制粘贴 src/migrations/20250115_create_ai_tables.sql 的内容
-- 或直接上传文件执行
```

或在本地 **psql** 中执行：
```bash
psql -h your-host -U your-user -d your-database -f src/migrations/20250115_create_ai_tables.sql
```

#### 1.2 创建 RPC 函数

在 **Supabase SQL Editor** 中执行：
```sql
-- 复制粘贴 src/migrations/20250115_create_match_documents_rpc.sql 的内容
-- 注意：必须先确保 pgvector 扩展已启用
```

**验证**:
```sql
-- 检查表是否创建成功
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('ai_logs', 'ai_filters', 'ai_rag_docs', 'ai_daily_summary', 'ai_vectors');

-- 检查 RPC 函数是否创建成功
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'match_documents';
```

### 步骤 2: 配置环境变量

#### 2.1 主站环境变量（Vercel）

1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 选择项目 → **Settings** → **Environment Variables**
3. 根据 `docs/AI_ENV_SETUP.md` 中的清单添加所有必需的环境变量

#### 2.2 AI-Service 环境变量（Railway）

1. 登录 [Railway Dashboard](https://railway.app/dashboard)
2. 选择项目 → **Variables** 标签页
3. 根据 `docs/AI_ENV_SETUP.md` 中的清单添加所有必需的环境变量

### 步骤 3: 运行集成测试

```bash
# 设置环境变量
export BASE_URL="https://your-app.vercel.app"
export AI_SERVICE_URL="https://ai.zalem.app"
export AI_SERVICE_TOKEN="svc_xxx"
export ADMIN_TOKEN="admin_token"
export USER_TOKEN="user_token"

# 运行测试
./scripts/smoke-ai.sh "$BASE_URL" "$AI_SERVICE_URL" "$ADMIN_TOKEN" "$USER_TOKEN"
```

---

## ✅ 验证清单

### 数据库验证

- [ ] 所有 5 个表已创建
- [ ] 所有索引已创建
- [ ] `match_documents` RPC 函数已创建
- [ ] pgvector 扩展已启用（用于 ai_vectors 表）

### 环境变量验证

- [ ] 主站环境变量已配置（Vercel）
- [ ] AI-Service 环境变量已配置（Railway）
- [ ] 所有必需的环境变量已设置

### 集成测试验证

- [ ] 运行 `smoke-ai.sh` 所有测试通过
- [ ] 日志落库验证（手动执行 SQL 查询）
- [ ] 定时任务验证（检查 Railway logs）

---

## 🚨 注意事项

### 数据库相关

1. **pgvector 扩展**: 
   - `ai_vectors` 表需要 pgvector 扩展支持
   - 如果扩展未启用，表结构会创建但向量索引不会创建
   - 需要在 Supabase Dashboard 中手动启用 pgvector 扩展

2. **向量索引**:
   - ivfflat 索引需要数据量达到一定规模才能生效
   - 如果表为空，索引可能无法创建

3. **RPC 函数**:
   - `match_documents` 函数必须在 pgvector 扩展启用后才能创建
   - 函数使用 `STABLE` 修饰符，适合查询操作

### 环境变量相关

1. **密钥安全**:
   - 永远不要将真实密钥提交到 Git
   - 使用不同密钥用于开发和生产环境
   - 定期轮换 API 密钥

2. **Token 匹配**:
   - `AI_SERVICE_TOKEN`（主站）必须与 `SERVICE_TOKENS`（AI-Service）中的某个值匹配
   - Token 区分大小写

### 测试脚本相关

1. **依赖工具**:
   - 需要 `curl` 命令
   - 可选：`jq`（用于 JSON 格式化输出）

2. **网络连接**:
   - 测试脚本需要能够访问主站和 AI-Service
   - 如果使用本地环境，确保服务已启动

---

## 📊 测试结果示例

```bash
==========================================
ZALEM AI 问答模块集成测试
==========================================
主站 URL: https://drivequiz.example.vercel.app
AI-Service URL: https://ai.zalem.app
测试时间: 2025-01-15 10:30:00
==========================================

✅ 1. 主站 /api/ai/ask - HTTP 200
✅ 2. AI-Service /v1/ask - HTTP 200
⚠️  3. 日志落库验证 - 跳过（需手动验证）
✅ 4. Admin Logs API - HTTP 200
✅ 5. Filters API (GET) - HTTP 200
✅ 6. Filters API (POST) - HTTP 200
✅ 7. RAG Docs API (GET) - HTTP 200
✅ 8. RAG Docs API (POST) - HTTP 200
✅ 9. Daily Summary - HTTP 200
⚠️  10. 定时任务验证 - 跳过（需手动验证）
✅ 11. 前端 AIPage (/api/ai/chat) - HTTP 200
✅ 12. AI-Service Health Check - HTTP 200

==========================================
测试总结
==========================================
✅ 通过: 10
❌ 失败: 0
⚠️  跳过: 2
总计: 12
==========================================
完整日志已保存到: logs/smoke-ai-20250115-103000.log

✅ 所有测试通过！
```

---

## 📚 相关文档

- [数据库迁移说明](../DATABASE_MIGRATION_README.md)
- [环境变量配置指南](docs/AI_ENV_SETUP.md)
- [AI 问答模块研发文档](../驾考AI开发文档/🧩 ZALEM · AI问答模块 研发文档 v1.0.md)
- [当前研发进度与衔接说明](../驾考AI开发文档/🏠当前研发进度与衔接说明 v1.5.md)

---

## 🎯 下一步工作

1. [ ] **执行数据库迁移**: 在 Supabase SQL Editor 中执行迁移脚本
2. [ ] **配置环境变量**: 在 Vercel 和 Railway 中配置所有必需的环境变量
3. [ ] **运行集成测试**: 执行 `smoke-ai.sh` 验证所有路由
4. [ ] **实现日志落库**: 在 `ask.ts` 和 `chat/route.ts` 中调用后记录到 `ai_logs` 表
5. [ ] **接入 Admin 摘要 API**: 在 `/v1/admin/daily-summary` 中接入缓存读取
6. [ ] **AIPage 组件联调**: 验证前端组件与后端 API 端到端流程

---

## 📝 总结

✅ **数据库迁移脚本**: 已完成 5 个表的创建脚本和 RPC 函数脚本  
✅ **环境变量配置**: 已完成详细的配置文档  
✅ **集成测试脚本**: 已完成 12 项测试用例的自动化脚本  
✅ **工作报告**: 已完成完整的工作报告

所有任务已完成，可以开始执行数据库迁移和配置环境变量。

---

**报告生成时间**: 2025-01-15  
**执行人**: Cursor AI Assistant  
**状态**: ✅ 已完成

