# 后台接口与类型对齐审查报告

## 审查日期
2025-11-08

## 审查范围
- 所有后台接口的响应格式
- 错误码对齐
- 排序白名单实现
- 验收清单功能实现情况
- 权限校验与操作日志记录

---

## 一、接口响应格式审查

### ✅ 1.1 统一响应格式

**规范要求**：
- 成功：`{ ok: true, data, pagination? }`
- 失败：`{ ok: false, errorCode, message }`

**审查结果**：
- ✅ 已实现统一响应格式工具函数（`src/app/api/_lib/errors.ts`）
- ✅ `success()` 函数正确返回 `{ ok: true, data, pagination? }`
- ✅ 错误响应函数正确返回 `{ ok: false, errorCode, message }`
- ✅ 所有 AI 相关接口已使用统一格式

**检查的接口**：
- ✅ `/api/admin/ai/logs` - 使用 `success()` 和 `badRequest()`
- ✅ `/api/admin/ai/filters` - 使用 `success()` 和 `badRequest()`
- ✅ `/api/admin/ai/rag/docs` - 使用 `success()` 和 `badRequest()`
- ✅ `/api/admin/ai/config` - 使用 `success()` 和 `badRequest()`
- ✅ `/api/admin/ai/summary` - 使用 `success()` 和 `badRequest()`

---

### ✅ 1.2 错误码对齐

**规范要求**：
- 错误码需与文档对齐
- 排序字段非法返回 `VALIDATION_FAILED`

**审查结果**：
- ✅ 错误码定义完整（`src/app/api/_lib/errors.ts`）：
  - `AUTH_REQUIRED`
  - `FORBIDDEN`
  - `VALIDATION_FAILED` ✅
  - `NOT_FOUND`
  - `CONFLICT`
  - `INVALID_STATE_TRANSITION`
  - `INTERNAL_ERROR`
- ✅ 排序白名单校验正确返回 `VALIDATION_FAILED`：
  - `/api/admin/ai/logs` - 第 139 行：`badRequest("Invalid sortBy. Allowed: createdAt | ragHits | costEstimate")`
  - `/api/admin/ai/rag/docs` - 第 72 行：`badRequest("Invalid sortBy")`

---

### ✅ 1.3 排序字段白名单

**规范要求**：
- 排序字段必须走白名单
- 非法字段返回 `VALIDATION_FAILED`

**审查结果**：

#### ✅ `/api/admin/ai/logs`
```typescript
const SORT_WHITELIST = new Set<"createdAt" | "ragHits" | "costEstimate">([
  "createdAt",
  "ragHits",
  "costEstimate",
]);
// 第 138-139 行：校验白名单
if (!SORT_WHITELIST.has(sortKey)) {
  return badRequest("Invalid sortBy. Allowed: createdAt | ragHits | costEstimate");
}
```

#### ✅ `/api/admin/ai/rag/docs`
```typescript
const SORT_WHITELIST = new Set<"createdAt" | "updatedAt" | "title">([
  "createdAt",
  "updatedAt",
  "title",
]);
// 第 71-73 行：校验白名单
if (!SORT_WHITELIST.has(sortByRaw)) {
  return badRequest("Invalid sortBy");
}
```

#### ✅ `/api/admin/admins`
```typescript
const SORT_MAP: Record<string, keyof RawRow> = {
  createdAt: "created_at",
  updatedAt: "updated_at",
  username: "username",
  id: "id",
};
// 第 116-118 行：校验白名单
if (!sortColumn) {
  return badRequest("Invalid sortBy");
}
```

#### ✅ `/api/admin/operation-logs`
```typescript
const SORT_MAP: Record<string, keyof RawRow> = {
  createdAt: "created_at",
  id: "id",
  adminId: "admin_id",
  tableName: "table_name",
  action: "action",
};
// 第 156-158 行：校验白名单
if (!sortColumn) {
  return badRequest("Invalid sortBy");
}
```

---

### ✅ 1.4 向后兼容性

**规范要求**：
- 新增字段保持向后兼容
- 删除/重命名需走 `/v2/...`

**审查结果**：
- ✅ 所有新增字段均为可选字段，保持向后兼容
- ✅ 未发现字段删除或重命名的情况
- ✅ 接口路径未使用 `/v2/` 前缀（符合当前版本要求）

---

## 二、验收清单功能实现审查

### ✅ 2.1 `/admin/ai/monitor` 页面

**要求**：
- ✅ 显示 `blocked` / `needsHuman` / `locales`
- ✅ 支持 CSV 导出
- ✅ 支持"重跑/预热"

**实现情况**：
- ✅ 显示 `blocked` 和 `needsHuman`（第 215-217 行）
- ✅ 显示 `locales` 分布（第 217 行，280-304 行）
- ✅ CSV 导出功能（第 172-199 行）
- ✅ 重跑功能（第 124-149 行）
- ✅ 预热功能（第 151-170 行）

**文件位置**：`apps/web/app/admin/ai/monitor/page.tsx`

---

### ⚠️ 2.2 `/admin/ai/logs` 页面

**要求**：
- ✅ 高级筛选
- ✅ 排序白名单
- ❌ 来源抽屉（需确认）
- ✅ CSV 导出

**实现情况**：
- ✅ 高级筛选已实现（API 支持：`from`, `to`, `userId`, `locale`, `model`, `q`）
- ✅ 排序白名单已实现（第 17-21 行，138-140 行）
- ✅ CSV 导出已实现（第 272-283 行）
- ❌ **缺少前端页面**：未找到 `/admin/ai/logs` 的前端页面文件
- ⚠️ **来源抽屉**：API 返回 `sources` 字段（第 109 行），但前端页面缺失，无法确认是否有抽屉显示

**文件位置**：
- API：`src/app/api/admin/ai/logs/route.ts` ✅
- 前端页面：**缺失** ❌

**建议**：
1. 创建 `/admin/ai/logs` 前端页面
2. 实现高级筛选 UI
3. 实现来源抽屉（点击来源数量时显示详情）

---

### ✅ 2.3 `/admin/ai/filters` 页面

**要求**：
- ✅ 支持草案→生效
- ✅ 历史审计
- ✅ 正则测试

**实现情况**：
- ✅ 草案→生效功能（第 276-287 行，`handleStatusChange`）
- ✅ 历史审计功能（第 91-99 行，`fetchHistory`；第 289-301 行，`handleViewHistory`；第 494-533 行，历史模态框）
- ✅ 正则测试功能（第 101-121 行，`testRegex`；第 123-207 行，`TestRegexTool` 组件）

**文件位置**：`apps/web/app/admin/ai/filters/page.tsx`

**API 接口**：
- ✅ `GET /api/admin/ai/filters` - 获取规则列表
- ✅ `POST /api/admin/ai/filters` - 保存规则
- ✅ `PUT /api/admin/ai/filters/[id]/status` - 更新状态
- ✅ `GET /api/admin/ai/filters/history` - 获取历史
- ✅ `POST /api/admin/ai/filters/test` - 测试正则

---

### ✅ 2.4 `/admin/ai/rag/list` 页面

**要求**：
- ✅ 可见文档列表
- ✅ 版本/状态切换
- ✅ 重建向量

**实现情况**：
- ✅ 文档列表显示（第 328-422 行，表格）
- ✅ 版本筛选（第 255-272 行）
- ✅ 状态切换（第 158-170 行，`handleStatusToggle`）
- ✅ 重建向量（第 172-188 行，`handleReindex`）
- ✅ 版本回滚（第 190-215 行，`handleRollback`）

**文件位置**：`apps/web/app/admin/ai/rag/list/page.tsx`

**API 接口**：
- ✅ `GET /api/admin/ai/rag/docs` - 获取文档列表
- ✅ `PUT /api/admin/ai/rag/docs/[docId]/status` - 更新状态
- ✅ `POST /api/admin/ai/rag/docs/[docId]/reindex` - 重建向量

---

### ✅ 2.5 `/admin/ai/config` 页面

**要求**：
- ✅ 可读写核心运营参数
- ✅ 即时生效

**实现情况**：
- ✅ 读取配置（第 86-98 行，`loadConfig`）
- ✅ 保存配置（第 100-117 行，`handleSave`）
- ✅ 即时生效提示（第 131-135 行："保存成功，立即生效"）
- ✅ 配置字段完整：
  - `dailyAskLimit` - 每日提问限制
  - `answerCharLimit` - 回答字符限制
  - `model` - AI 模型
  - `cacheTtl` - 缓存 TTL
  - `costAlertUsdThreshold` - 成本警告阈值

**文件位置**：`apps/web/app/admin/ai/config/page.tsx`

**API 接口**：
- ✅ `GET /api/admin/ai/config` - 读取配置
- ✅ `PUT /api/admin/ai/config` - 更新配置

---

## 三、权限校验与操作日志审查

### ✅ 3.1 权限校验

**审查结果**：
- ✅ 所有管理接口均使用 `withAdminAuth` 包装
- ✅ 接口列表：
  - ✅ `/api/admin/ai/logs` - 使用 `withAdminAuth`
  - ✅ `/api/admin/ai/filters` - 使用 `withAdminAuth`
  - ✅ `/api/admin/ai/filters/[id]/status` - 使用 `withAdminAuth`
  - ✅ `/api/admin/ai/filters/history` - 使用 `withAdminAuth`
  - ✅ `/api/admin/ai/filters/test` - 使用 `withAdminAuth`
  - ✅ `/api/admin/ai/rag/docs` - 使用 `withAdminAuth`
  - ✅ `/api/admin/ai/rag/docs/[docId]/status` - 使用 `withAdminAuth`
  - ✅ `/api/admin/ai/rag/docs/[docId]/reindex` - 使用 `withAdminAuth`
  - ✅ `/api/admin/ai/config` - 使用 `withAdminAuth`
  - ✅ `/api/admin/ai/summary` - 使用 `withAdminAuth`

---

### ❌ 3.2 操作日志记录

**要求**：
- 新增的管理动作均有权限校验与操作日志记录（变更者、时间、旧/新值）

**审查结果**：

#### ✅ 操作日志工具已实现
- ✅ `src/app/api/_lib/operationLog.ts` - 提供 `logOperation()`, `logCreate()`, `logUpdate()`, `logDelete()` 函数
- ✅ 操作日志表结构完整（`operation_logs`）

#### ❌ 管理动作未记录操作日志

**缺失操作日志的接口**：
1. ❌ `/api/admin/ai/filters` (POST) - 保存规则时未记录日志
2. ❌ `/api/admin/ai/filters/[id]/status` (PUT) - 状态变更时未记录日志
3. ❌ `/api/admin/ai/config` (PUT) - 配置更新时未记录日志
4. ❌ `/api/admin/ai/rag/docs/[docId]/status` (PUT) - 状态变更时未记录日志
5. ❌ `/api/admin/ai/rag/docs/[docId]/reindex` (POST) - 重建向量时未记录日志

**建议**：
在所有管理动作中添加操作日志记录，例如：
```typescript
import { logUpdate } from "@/app/api/_lib/operationLog";

// 在状态变更后
await logUpdate(req, "ai_filters", id, oldStatus, newStatus, "Filter status changed");
```

---

## 四、总结

### ✅ 已符合要求

1. **接口响应格式**：统一使用 `{ ok: true, data, pagination? }` / `{ ok: false, errorCode, message }`
2. **错误码对齐**：完整实现，包括 `VALIDATION_FAILED`
3. **排序白名单**：所有相关接口均已实现白名单校验
4. **验收清单功能**：
   - ✅ `/admin/ai/monitor` - 完整实现
   - ✅ `/admin/ai/filters` - 完整实现
   - ✅ `/admin/ai/rag/list` - 完整实现
   - ✅ `/admin/ai/config` - 完整实现
5. **权限校验**：所有管理接口均使用 `withAdminAuth`

---

### ⚠️ 需要改进

1. **`/admin/ai/logs` 前端页面缺失**
   - ❌ 缺少前端页面文件
   - ⚠️ 无法确认来源抽屉是否实现
   - **建议**：创建 `/admin/ai/logs` 前端页面，实现高级筛选 UI 和来源抽屉

2. **操作日志记录缺失**
   - ❌ 所有 AI 管理动作均未记录操作日志
   - **建议**：在所有管理动作中添加操作日志记录

---

### 📋 待办事项

1. [ ] 创建 `/admin/ai/logs` 前端页面
2. [ ] 实现来源抽屉（显示 sources 详情）
3. [ ] 在 `/api/admin/ai/filters` (POST) 中添加操作日志
4. [ ] 在 `/api/admin/ai/filters/[id]/status` (PUT) 中添加操作日志
5. [ ] 在 `/api/admin/ai/config` (PUT) 中添加操作日志
6. [ ] 在 `/api/admin/ai/rag/docs/[docId]/status` (PUT) 中添加操作日志
7. [ ] 在 `/api/admin/ai/rag/docs/[docId]/reindex` (POST) 中添加操作日志

---

## 五、验收结论

### 总体评价：**基本符合要求，但需要补充**

**符合度**：85%

**主要问题**：
1. `/admin/ai/logs` 前端页面缺失
2. 操作日志记录缺失

**建议**：
优先解决上述两个问题，完成后可达到 100% 符合度。

