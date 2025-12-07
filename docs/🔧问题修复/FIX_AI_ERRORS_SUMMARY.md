# AI 板块错误修复总结

## ✅ 已修复的问题

### 1. 日志 API 路由修复
**文件**: `apps/web/app/api/admin/ai/logs/route.ts`

**问题**:
- ❌ 使用 `db`（主应用数据库）而不是 `aiDb`（AI Service 数据库）
- ❌ 缺少 CSV 导出功能
- ❌ 字段名错误（使用 `language` 而不是 `locale`）

**修复**:
- ✅ 改为使用 `aiDb` 连接 AI Service 数据库
- ✅ 添加 CSV 导出支持（`format=csv` 参数）
- ✅ 修正字段名为 `locale`（与数据库表结构一致）
- ✅ 添加筛选功能（日期范围、用户ID、语言、模型、搜索关键词）
- ✅ 添加 `sources` 字段支持（如果存在）

### 2. 配置 API 路由验证
**文件**: `apps/web/app/api/admin/ai/config/route.ts`

**状态**: ✅ 已确认使用 `aiDb`（正确）

### 3. API 路由位置验证
**状态**: ✅ 已确认以下路由存在于正确位置：
- `apps/web/app/api/admin/ai/summary/rebuild/route.ts` ✅
- `apps/web/app/api/admin/ai/cache/prewarm/route.ts` ✅

## ⚠️ 需要配置的环境变量

### 必需环境变量

在 `.env.local` 或生产环境（Vercel）中配置以下环境变量：

```bash
# AI Service 数据库连接（必需）
AI_DATABASE_URL=postgresql://postgres:zKV0rtIV1QOByu89@db.cgpmpfnjzlzbquakmmrj.supabase.co:5432/postgres?sslmode=require

# AI Service 配置（必需，用于调用 AI Service API）
AI_SERVICE_URL=https://ai.zalem.app
AI_SERVICE_TOKEN=<your-service-token>
AI_SERVICE_SUMMARY_URL=https://ai.zalem.app/v1/admin/daily-summary
```

### 数据库连接信息

**AI Service 数据库**:
- 数据库 ID: `cgpmpfnjzlzbquakmmrj`
- 密码: `zKV0rtIV1QOByu89`
- 连接方式: DIRECT（端口 5432）
- 连接字符串格式: `postgresql://postgres:zKV0rtIV1QOByu89@db.cgpmpfnjzlzbquakmmrj.supabase.co:5432/postgres?sslmode=require`

## 🧪 测试数据库连接

运行测试脚本验证数据库连接：

```bash
# 测试 AI 数据库连接
NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/test-ai-database-connection.ts
```

## 📋 修复后的功能

### 日志 API (`/api/admin/ai/logs`)

**新增功能**:
- ✅ CSV 导出（`?format=csv`）
- ✅ 日期范围筛选（`?from=YYYY-MM-DD&to=YYYY-MM-DD`）
- ✅ 用户ID筛选（`?userId=uuid`）
- ✅ 语言筛选（`?locale=zh`）
- ✅ 模型筛选（`?model=gpt-4o-mini`）
- ✅ 关键词搜索（`?q=keyword`）
- ✅ 多字段排序（`?sortBy=createdAt|ragHits|costEstimate`）
- ✅ Sources 字段支持（如果表中有该字段）

### 配置 API (`/api/admin/ai/config`)

**状态**: ✅ 已正确配置，使用 `aiDb` 连接

### 摘要重建 API (`/api/admin/ai/summary/rebuild`)

**状态**: ✅ 路由存在，需要确保 `AI_SERVICE_URL` 和 `AI_SERVICE_TOKEN` 已配置

### 缓存预热 API (`/api/admin/ai/cache/prewarm`)

**状态**: ✅ 路由存在，需要确保 `AI_SERVICE_URL` 和 `AI_SERVICE_TOKEN` 已配置

## 🔧 下一步操作

1. **配置环境变量**:
   - 在 `.env.local` 中添加 `AI_DATABASE_URL`
   - 确保 `AI_SERVICE_URL` 和 `AI_SERVICE_TOKEN` 已配置

2. **运行数据库迁移**:
   - 如果 `ai_config` 表不存在，执行迁移脚本：
     ```sql
     -- 在 Supabase SQL Editor 中执行
     -- 文件: src/migrations/20251108_create_ai_config.sql
     ```

3. **测试连接**:
   ```bash
   NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/test-ai-database-connection.ts
   ```

4. **重启开发服务器**:
   ```bash
   npm run dev
   ```

## 📝 注意事项

1. **数据库连接**:
   - 使用 DIRECT 连接方式（端口 5432），而不是连接池（端口 6543）
   - 确保 SSL 模式设置为 `require`

2. **环境变量**:
   - 本地开发: 在 `.env.local` 中配置
   - 生产环境: 在 Vercel Dashboard 中配置

3. **API 路由**:
   - 所有 AI 相关 API 路由现在都使用 `aiDb` 连接 AI Service 数据库
   - 确保 `AI_DATABASE_URL` 指向正确的数据库实例

## ✅ 验证清单

- [x] 日志 API 路由已修复（使用 `aiDb`）
- [x] CSV 导出功能已添加
- [x] 配置 API 路由已验证（使用 `aiDb`）
- [x] API 路由位置已验证
- [ ] `AI_DATABASE_URL` 环境变量已配置
- [ ] 数据库连接测试通过
- [ ] `ai_config` 表已创建（如果不存在）

## 🆕 2025-12-07 · AI-LOGS-20251207-001
- 模块：Admin / Web
- 根因：`AI_DATABASE_URL` 未配置导致后端返回 500；前端错误提示不足、CSV 导出失败提示不明确。
- 修复：
  - 后端 `/api/admin/ai/logs` 返回结构化错误码：`AI_DATABASE_URL_NOT_CONFIGURED`、`AI_DB_DNS_ERROR`、`AI_DB_TIMEOUT`、`AI_DB_CONNECTION_REFUSED`、`AI_DB_AUTH_FAILED`。
  - 前端 `/admin/ai/logs` 按 errorCode 显示明确提示；错误状态下禁用 CSV；导出失败解析 JSON 并提示。
- 执行报告：`docs/问题修复/2025-12-07/后台AI问答日志板块无法正常工作/执行报告/后台AI问答日志板块无法正常工作_执行报告.md`
