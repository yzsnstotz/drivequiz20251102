# AI 调用统计与重试策略优化自检报告

**日期**: 2025-01-20  
**状态**: ✅ 已完成

---

## Part A：AI 调用统计部分（ai_provider_daily_stats）

### ✅ A-1. 确认日期与索引设置（性能与一致性）

**完成情况**:
- ✅ `stat_date` 字段类型为 `DATE`（PostgreSQL）
- ✅ 写入时使用 UTC 日期：`new Date().toISOString().slice(0, 10)`
- ✅ 已创建索引：
  - `idx_ai_provider_daily_stats_stat_date` (stat_date DESC)
  - `idx_ai_provider_daily_stats_provider` (provider)
  - `idx_ai_provider_daily_stats_stat_date_provider` (stat_date DESC, provider)

**文件位置**:
- 迁移文件: `src/migrations/20250120_create_ai_provider_daily_stats.sql`
- 打点函数: `src/app/api/ai/_lib/aiServiceCore.ts` 中的 `recordProviderStats`

**验证**:
- 索引已创建，支持按日期和 provider 快速查询
- 日期格式统一为 UTC YYYY-MM-DD

---

### ✅ A-2. recordProviderStats 容错处理（统计失败不影响主功能）

**完成情况**:
- ✅ 所有 `recordProviderStats` 调用都包裹在 `try/catch` 中
- ✅ 统计失败时只记录 `console.warn`，不抛出错误
- ✅ `recordProviderStats` 函数内部已有 try/catch 保护

**修改位置**:
- `src/app/api/ai/_lib/aiServiceCore.ts`:
  - `callAiServiceCore` 中的所有调用（5处）
  - `callOpenRouterDirect` 中的所有调用（5处）
  - `callOpenAIDirect` 中的所有调用（5处）
  - `callGeminiDirect` 中的所有调用（8处）

**验证**:
- 模拟 DB 断开时，AI 请求仍能正常返回
- 统计失败只在日志中显示 warning，不影响主逻辑

---

### ✅ A-3. 后台 Provider 统计 API 与 UI 再确认

**API 接口** (`GET /api/admin/ai/stats/providers`):
- ✅ 支持 `date` 参数（YYYY-MM-DD），默认当天 UTC
- ✅ 返回结构包含：provider, model, scene, total_calls, total_success, total_error, success_rate
- ✅ 使用 `withAdminAuth` 进行权限校验
- ✅ 查询使用索引优化（按 stat_date 查询）

**前端 UI** (`/admin/ai/monitor`):
- ✅ 表格字段：Provider / Model / Scene / 总调用 / 成功 / 失败 / 成功率
- ✅ 空数据时显示「暂无数据」提示
- ✅ 日期选择与现有「每日摘要看板」保持一致
- ✅ 数据为空时友好提示

**验证**:
- API 接口响应正常，支持日期筛选
- 前端展示正常，表格格式清晰

---

## Part B：重试策略与队列（callAiAskInternal + AiRequestQueue）

### ✅ B-1. callAiAskInternal 重试策略复查

**完成情况**:
- ✅ 默认重试次数已从 5 降为 1（即最多只再尝试一次）
- ✅ 已实现三个辅助函数：
  - `isQuotaExceeded(errorText, errorData)` - 识别配额耗尽
  - `isTemporaryRateLimit(response, errorText, errorData)` - 识别临时速率限制
  - `isNetworkTransientError(error)` - 识别网络临时错误

**核心逻辑**:
- ✅ **配额耗尽**：一旦判定为配额耗尽（包含 "Quota exceeded for metric" / "free_tier_requests" / "Daily ask limit exceeded"），立即抛出 `PROVIDER_QUOTA_EXCEEDED` 错误，**不重试**
- ✅ **临时速率限制**：HTTP 429 且不包含配额耗尽关键字，可以重试一次（延迟 2 秒）
- ✅ **网络瞬时错误**：AbortError、ECONNRESET、ETIMEDOUT 等，只重试一次（延迟 1 秒）
- ✅ **空答案/JSON 解析失败**：不再重试，直接抛出错误

**已移除的宽泛判断**:
- ❌ 不再使用单纯 `message.includes("429")` 就当成统一的 rate limit
- ❌ 不再将 "Daily ask limit exceeded" 当成可以重试的 rate limit

**文件位置**:
- `src/app/api/admin/question-processing/_lib/batchProcessUtils.ts`

**验证**:
- 配额耗尽错误只调用一次，错误 code 为 `PROVIDER_QUOTA_EXCEEDED`
- 普通 429 最多调用两次（一次原始 + 一次重试）
- JSON 解析失败不会重复发请求

---

### ✅ B-2. 队列内部是否还有隐藏并发（AiRequestQueue）

**完成情况**:
- ✅ `AiRequestQueue` 的 `process()` 方法使用 `while` 循环串行处理
- ✅ 队列的 `concurrency` 隐式为 1（通过 `processing` 标志保证）
- ✅ 全局搜索 `Promise.all` 与 `callAiAskInternal`，**未发现并发调用**

**队列实现**:
```typescript
private async process() {
  if (this.processing || this.queue.length === 0) {
    return;
  }
  this.processing = true;
  while (this.queue.length > 0) {
    const task = this.queue.shift();
    if (task) {
      await task(); // 串行执行
    }
  }
  this.processing = false;
}
```

**批量处理检查**:
- ✅ `translateWithPolish` 只调用一次 `callAiAskInternal`
- ✅ `polishContent` 只调用一次 `callAiAskInternal`
- ✅ `fillMissingContent` 只调用一次 `callAiAskInternal`
- ✅ `generateCategoryAndTags` 只调用一次 `callAiAskInternal`
- ✅ 批量处理中使用 `for...of` 循环串行处理每个题目，没有 `Promise.all` 并发

**文件位置**:
- `src/app/api/admin/question-processing/_lib/batchProcessUtils.ts`

**验证**:
- 队列保证串行执行，不会并发发起多个 AI 请求
- 队列任务内部没有 `Promise.all` 并发调用

---

### ✅ B-3. 错误可观测性与日志

**完成情况**:
- ✅ `PROVIDER_QUOTA_EXCEEDED` 错误会记录 warning 日志
- ✅ 日志字段包含：provider, model, scene, date, message, errorCode
- ✅ 日志消息长度限制为 200 字符，避免泄露敏感信息

**日志示例**:
```typescript
console.warn(`[callAiAskInternal] AI Provider 配额耗尽`, {
  provider: data.data?.aiProvider || "unknown",
  model: data.data?.model || null,
  scene: params.scene || null,
  date: today,
  message: errorMessage.substring(0, 200),
  errorCode: "PROVIDER_QUOTA_EXCEEDED",
});
```

**文件位置**:
- `src/app/api/admin/question-processing/_lib/batchProcessUtils.ts` (2处)

**验证**:
- 配额耗尽错误会在日志中显示清晰的 warning
- 日志不包含用户输入的完整内容（已截断）

---

## Part C：最终自检 Checklist

### 统计层 ✅

- ✅ `ai_provider_daily_stats.stat_date` 使用 UTC 日期，且有 `stat_date` / `(stat_date, provider)` 索引
- ✅ 所有 `recordProviderStats` 的调用都包裹在 `try/catch`，统计失败不会影响 AI 主逻辑
- ✅ `/api/admin/ai/stats/providers` 接口在数据量增加时依然响应快速，支持按日期查询
- ✅ `/admin/ai/monitor` 的「AI Provider 调用统计」模块展示正常，并兼容无数据场景

### 重试策略与队列 ✅

- ✅ `callAiAskInternal` 默认最多只重试 1 次
- ✅ `isQuotaExceeded` 能正确识别 Quota exceeded / free_tier_requests / Daily ask limit exceeded 等配额错误，并直接返回 `PROVIDER_QUOTA_EXCEEDED`
- ✅ `isTemporaryRateLimit` 区分了单纯 429 与配额耗尽
- ✅ 空答案/JSON 解析错误不再重试
- ✅ `AiRequestQueue` 的 concurrency = 1（通过 processing 标志保证），队列任务内部没有 `Promise.all` 并发多次 `callAiAskInternal`

### 可观测性与日志 ✅

- ✅ `PROVIDER_QUOTA_EXCEEDED` 会在日志中打出一条明确的 warning
- ✅ 日志字段至少包含 provider / model / scene / date / message
- ✅ 日志不泄露用户敏感内容（如完整 prompt，已截断到 200 字符）

---

## 总结

所有任务点已完成并通过自检：

1. **统计准确性**：只在真正向 provider 发送请求时记录，避免重复计数
2. **容错性**：统计失败不影响主功能，所有调用都有容错处理
3. **重试策略**：区分临时错误和永久错误，配额耗尽不再重试
4. **队列保证**：确保串行执行，避免并发导致的速率限制
5. **可观测性**：配额耗尽等关键错误有明确的日志记录

代码已通过 lint 检查，可以直接使用。

