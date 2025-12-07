# 🔧 Cursor 问题诊断报告

Issue ID: AI-LOGS-20251207-001

## 1. 问题概要（Summary）
- 问题名称: 后台 AI 问答日志板块无法正常工作
- 问题等级: High
- 触发时间: 2025-12-07 00:00:00
- 触发环境: production（假设为线上环境）
- 相关模块: admin / web / ai-service / src/lib/aiDb
- 当前状态: 可复现

## 2. 复现路径（Reproduce Steps）
- 前端操作步骤:
  - 打开管理后台页面 `/_/admin/ai/logs` 或 `/admin/ai/logs`
  - 使用管理员口令登录后，页面显示“暂无数据”或报错提示
  - 点击“导出 CSV”，下载失败或返回错误
- API 调用:
  - `GET /api/admin/ai/logs?page=1&limit=20&sortBy=createdAt&order=desc`
  - 需要在请求头携带 `Authorization: Bearer <ADMIN_TOKEN>`
- 请求示例:
```
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
     "http://localhost:3000/api/admin/ai/logs?page=1&limit=20&sortBy=createdAt&order=desc"
```
- 操作系统 / 浏览器 / Node 版本: N/A
- 复现截图: N/A

## 3. 实际输出（Actual Behavior）
- 前端日志:
  - Admin 页面显示错误提示，或列表为空（“暂无数据”）。
  - 下载 CSV 时报错：`Download CSV failed`（浏览器控制台）。
- 后端返回:
  - 当 `AI_DATABASE_URL` 未配置时，接口返回 500：
    - 错误代码与信息来源于 `src/app/api/admin/ai/logs/route.ts:151`（`AI_DATABASE_URL is not configured`）。
  - 当数据库连接失败（DNS/超时/拒绝/认证）时，接口统一返回 500，服务端日志包含具体分类：
    - DNS 错误: `enotfound`/`getaddrinfo`（`src/app/api/admin/ai/logs/route.ts:437-443`）
    - 连接超时: `timeout`/`timed out`（`src/app/api/admin/ai/logs/route.ts:444-446`）
    - 连接拒绝: `connection refused`（`src/app/api/admin/ai/logs/route.ts:448-450`）
    - 认证失败: `authentication`/`password`（`src/app/api/admin/ai/logs/route.ts:452-454`）
- 服务器日志（摘录模式）:
  - `[GET /api/admin/ai/logs] [req-...] [Step 1] AI_DATABASE_URL exists: false`
  - `❌ AI_DATABASE_URL is not configured!`（`src/app/api/admin/ai/logs/route.ts:148-152`）
  - 或 `❌ DNS resolution error detected` / `❌ Connection timeout detected` / `❌ Connection refused` / `❌ Authentication error`（根据实际报错分类）
- 本地运行日志: N/A（未执行本地服务以采集日志）

## 4. 期望行为（Expected Behavior）
- 管理后台“AI 日志”页面正常加载，显示分页列表、筛选、排序与 CSV 导出。
- API `GET /api/admin/ai/logs` 成功返回数据与分页信息；当无数据时返回空列表而非错误。
- 连接错误与环境问题通过页面友好提示，引导正确配置。

## 5. 代码定位（Code Snapshot）
- 相关文件列表（绝对路径）:
  - `/Users/leo/Desktop/v3/src/app/api/admin/ai/logs/route.ts`
  - `/Users/leo/Desktop/v3/src/app/admin/ai/logs/page.tsx`
  - `/Users/leo/Desktop/v3/src/lib/aiDb.ts`
  - `/Users/leo/Desktop/v3/apps/web/app/api/ai/chat/route.ts`（主站代理 AI 服务并写入 `ai_logs`）
  - 迁移: `/Users/leo/Desktop/v3/src/migrations/20250115_create_ai_tables.sql`
  - 迁移: `/Users/leo/Desktop/v3/src/migrations/20250116_add_ai_logs_metadata_fields.sql`
  - 迁移: `/Users/leo/Desktop/v3/src/migrations/20251105_add_sources_to_ai_logs.sql`
  - 迁移: `/Users/leo/Desktop/v3/src/migrations/20251109_change_ai_logs_user_id_to_text.sql`
  - 迁移: `/Users/leo/Desktop/v3/src/migrations/20251112_add_context_tag_to_ai_logs.sql`
- 关键代码片段:
```
// src/app/api/admin/ai/logs/route.ts:144-153
const hasAiDbUrl = !!process.env.AI_DATABASE_URL;
if (!hasAiDbUrl) {
  return internalError(
    "AI_DATABASE_URL environment variable is not configured. Please configure it in Vercel Dashboard for Preview/Production environments."
  );
}

// 根据信息架构动态检测 columns（sources / from / ai_provider / cached / cache_source）
// 并构建分页查询与 CSV 导出
```
```
// src/lib/aiDb.ts:272-304
const isSupabase = parsed.host.includes("supabase.com") ||
                   parsed.host.includes("supabase.co") ||
                   parsed.sslEnabled;
const ssl = isSupabase || parsed.sslEnabled ? { rejectUnauthorized: false } : undefined;
const poolConfig = { host: parsed.host, port: parsed.port, database: parsed.database, user: parsed.user,
  password: parsed.password, ssl, max: 10, min: 1, idleTimeoutMillis: 20000,
  connectionTimeoutMillis: 15000, statement_timeout: 40000, query_timeout: 40000 };
```

## 6. 配置与环境（Config & Env）
- 关键环境变量:
  - `AI_DATABASE_URL`: AI 日志查询数据库连接（必须配置，直连 5432，`sslmode=require`）
  - `SUPABASE_URL` / `SUPABASE_SERVICE_KEY`: 主站写入 `ai_logs` 时使用的 Supabase REST 凭据（如果缺失，日志不会落库）
  - `ADMIN_TOKEN`: 管理后台鉴权令牌（未配置或无效会导致 401 未授权）
- 连接方式:
  - 直连 Supabase 主库或只读副本，需启用 SSL 且接受自签名证书。

## 7. 问题影响范围（Impact Analysis）
- 管理后台日志页无法使用（查询、筛选、导出均受影响）。
- 无法进行每日摘要统计与运营分析（`/api/admin/ai/summary` 基于 `ai_logs`）。
- 若日志未落库，影响数据审计、成本追踪与安全审查回溯。
- 生产环境可见性下降，运营与质量监控受阻。

## 8. 根因假设（Root Cause Hypothesis）
- `AI_DATABASE_URL` 未配置或配置错误（最可能）。
- 数据库连接问题：DNS 解析失败、连接超时、连接拒绝、认证失败。
- 主站写日志失败：`SUPABASE_URL`/`SUPABASE_SERVICE_KEY` 缺失或权限不足，导致 `ai_logs` 表无数据。
- 数据库迁移未执行：`sources`/`from`/`ai_provider`/`cached`/`cache_source` 列不存在，前端显示信息缺失（次要）。
- 管理员未登录或口令无效：返回 401（页面报“未授权”）。

## 9. 之前采取过的措施（History & Prior Actions）
- 2025-12-02 修复 `AI 配置中心 500 错误`：
  - 在 `src/lib/aiDb.ts` 增加 Supabase SSL 配置与自签名证书接受（`rejectUnauthorized: false`）。
  - 在 `src/app/api/admin/ai/config/route.ts` 增强错误分类与环境变量检查。
  - 参考: `/Users/leo/Desktop/v3/docs/问题修复/20251202/AI配置中心500错误修复/执行报告/AI配置中心500错误修复_执行报告.md`
- 脚本与文档提醒：
  - 多个脚本用于校验 `AI_DATABASE_URL` 配置（`scripts/test-ai-db-connection*.ts`）。
  - 文档明确直连字符串示例与错误分类（`docs/🔧问题修复/FIX_AI_ERRORS_SUMMARY.md`、`FIX_POOLER_AUTH_ERROR.md`）。

## 10. 建议修复方向（Suggested Fixes）
- 方案 A（推荐）: 在部署环境立即配置并验证 `AI_DATABASE_URL`（直连，含 `sslmode=require`）。
- 方案 B: 在主站检查并确保 `SUPABASE_URL` 与 `SUPABASE_SERVICE_KEY` 正确，确认日志写库成功。
- 方案 C: 运行数据库迁移，确保 `ai_logs` 表包含可选元数据列（sources / from / ai_provider / cached / cache_source）。
- 方案 D: 在 Admin 首屏检测并提示未授权与缺少环境配置的明确引导（提升可观测性）。

## 11. 需要决策的点（Decision Needed）
- 本次问题是否为生产环境阻塞项（若是，需提升优先级）。
- 是否采用统一的直连策略替代 Pooler（避免认证差异）。
- 是否在主站添加日志写库失败的报警（现为静默失败）。

## 12. 附录（Attachments）
- 路由与代码快照:
  - `src/app/api/admin/ai/logs/route.ts:144-153`、`251-263`、`382-425`、`426-459`
  - `src/lib/aiDb.ts:241-349`、`423-472`
- 迁移文件清单:
  - `src/migrations/20250115_create_ai_tables.sql`
  - `src/migrations/20250116_add_ai_logs_metadata_fields.sql`
  - `src/migrations/20251105_add_sources_to_ai_logs.sql`
  - `src/migrations/20251109_change_ai_logs_user_id_to_text.sql`
  - `src/migrations/20251112_add_context_tag_to_ai_logs.sql`

