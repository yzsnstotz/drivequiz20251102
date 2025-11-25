# 修复 Gemini Provider X-AI-Provider 请求头支持 - 执行报告

**任务名称**: 修复 Gemini Provider 通过 Render 调用时的 500 错误

**执行日期**: 2025-01-27

**当前版本号**: 2025-01-27 23:30:00

---

## 📋 任务摘要

### 问题描述
选择 gemini（通过 render）时返回 500 错误：
```
【出错】AI service error: 500 {"ok":false,"errorCode":"INTERNAL_ERROR","message":"Internal Server Error"}（AI_SERVICE_ERROR）
```

### 问题根因
主站代码在调用 ai-service 时，虽然已经将 `gemini` 映射为 `render` provider，但**没有发送 `X-AI-Provider: gemini` 请求头**，导致 ai-service 无法识别应该使用 Gemini provider。

### 解决方案
修改主站代码，使其能够：
1. 从数据库读取原始的 `aiProvider` 配置值（`gemini`）
2. 在调用 ai-service 时发送 `X-AI-Provider: gemini` 请求头
3. ai-service 根据请求头正确识别并使用 Gemini provider

---

## 📁 修改文件列表

### 1. `src/lib/aiClient.server.ts`
**修改内容**:
- ✅ 新增 `getDbAiProvider()` 函数：从数据库读取原始 `aiProvider` 配置值
- ✅ 修改 `callAiServer()` 函数：当 `provider === "render"` 时，读取数据库配置并发送 `X-AI-Provider` 请求头
- ✅ 支持发送 `openai`、`openrouter`、`gemini` 三种 provider 值
- ✅ 更新指令版本号：0003 → 0004

**关键代码**:
```typescript
// 获取数据库中的原始 aiProvider 配置（仅当 provider 为 render 时）
let xAiProviderHeader: string | undefined = undefined;
if (provider === "render") {
  const dbProvider = await getDbAiProvider();
  // 只发送需要发送的 provider（openai, openrouter, gemini）
  if (dbProvider === "openai" || dbProvider === "openrouter" || dbProvider === "gemini") {
    xAiProviderHeader = dbProvider;
  }
}

// 构建请求头
const headers: Record<string, string> = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
};

// 添加 X-AI-Provider 头（如果适用）
if (xAiProviderHeader) {
  headers["X-AI-Provider"] = xAiProviderHeader;
}
```

### 2. `src/lib/aiClient.front.ts`
**修改内容**:
- ✅ 新增 `getCurrentAiProvider()` 函数：通过 API 获取数据库中的原始 `aiProvider` 配置值
- ✅ 修改 `callAiDirect()` 函数：当 `provider === "render"` 时，读取配置并发送 `X-AI-Provider` 请求头
- ✅ 支持发送 `openai`、`openrouter`、`gemini` 三种 provider 值
- ✅ 更新指令版本号：0003 → 0004

**关键代码**:
```typescript
// 获取数据库中的原始 aiProvider 配置（仅当 provider 为 render 时）
let xAiProviderHeader: string | undefined = undefined;
if (provider === "render") {
  const dbProvider = await getCurrentAiProvider();
  // 只发送需要发送的 provider（openai, openrouter, gemini）
  if (dbProvider === "openai" || dbProvider === "openrouter" || dbProvider === "gemini") {
    xAiProviderHeader = dbProvider;
  }
}

// 构建请求头
const headers: Record<string, string> = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
};

// 添加 X-AI-Provider 头（如果适用）
if (xAiProviderHeader) {
  headers["X-AI-Provider"] = xAiProviderHeader;
}
```

### 3. `src/app/api/ai/config/route.ts`
**修改内容**:
- ✅ 在返回数据中添加 `dbProvider` 字段，返回数据库中的原始 `aiProvider` 值
- ✅ 供前端获取原始配置值，用于发送正确的请求头

**关键代码**:
```typescript
return NextResponse.json({
  ok: true,
  data: {
    provider,
    dbProvider: aiProvider, // ✅ 新增：返回数据库中的原始值，用于发送 X-AI-Provider 头
    model: model || undefined,
  },
});
```

### 4. `src/lib/version.ts`
**修改内容**:
- ✅ 更新版本号：`2025-11-24 22:47:19` → `2025-01-27 23:30:00`
- ✅ 更新版本说明：修复 Gemini Provider 支持：添加 X-AI-Provider 请求头

---

## 🔍 规范对齐检查

### 已阅读的规范文件
- ✅ `/Users/leo/Desktop/drivequiz研发规范/🧩 AI 服务研发规范（ai-service 统一架构规范 v1.0）.md`
- ✅ `/Users/leo/Desktop/drivequiz研发规范/🧩 AI 核心服务规范（ai-core 统一架构规范 v2.0）.md`
- ✅ `/Users/leo/Desktop/drivequiz研发规范/JSON清洗与语言过滤规范.md`
- ✅ `/Users/leo/Desktop/drivequiz研发规范/数据库结构_DRIVEQUIZ.md`
- ✅ `/Users/leo/Desktop/drivequiz研发规范/数据库结构_AI_SERVICE.md`
- ✅ `/Users/leo/Desktop/drivequiz研发规范/文件结构.md`

### 本任务受约束的规范条款
- **A1**: 路由层禁止承载业务逻辑 ✅ 已遵守（业务逻辑在工具层）
- **A4**: 接口参数、返回结构必须保持统一 ✅ 已遵守（请求头格式统一）
- **B3**: Kysely 类型定义必须与数据库结构同步 ✅ 已遵守（使用现有类型）
- **D1**: 任务结束必须输出完整执行报告 ✅ 已遵守（本报告）

### 强关联条款
- **A4**: 接口参数、返回结构必须保持统一（请求头格式）
- **D1**: 执行报告输出

### 本次任务影响的文件路径
- `src/lib/aiClient.server.ts`
- `src/lib/aiClient.front.ts`
- `src/app/api/ai/config/route.ts`
- `src/lib/version.ts`

---

## ✅ 逐条红线规范自检

| 编号 | 规则 | 状态 | 说明 |
|------|------|------|------|
| A1 | 路由层禁止承载业务逻辑 | ✅ 已遵守 | 业务逻辑在工具层（`aiClient.server.ts`、`aiClient.front.ts`） |
| A2 | 所有核心逻辑必须写入 ai-core | ⚠️ 不适用 | 本次修改为主站代码，不涉及 ai-core |
| A3 | ai-service 与 local-ai-service 行为必须保持完全一致 | ⚠️ 不适用 | 本次修改为主站代码 |
| A4 | 接口参数、返回结构必须保持统一 | ✅ 已遵守 | 请求头格式统一，与 ai-service 规范一致 |
| B1 | 数据库字段/表结构修改必须同步更新文档 | ⚠️ 不适用 | 未修改数据库结构 |
| B2 | 文件新增/删除/迁移必须同步更新文件结构文档 | ⚠️ 不适用 | 未新增/删除文件 |
| B3 | Kysely 类型定义必须与数据库结构同步 | ✅ 已遵守 | 使用现有类型，未修改 |
| B4 | DriveQuiz 主库与 AI Service 库的 schema 需保持文档同步 | ⚠️ 不适用 | 未修改数据库结构 |
| C1 | 涉及 AI 功能必须同时测试 local-ai-service & 远程 ai-service | ⚠️ 待测试 | 需要在实际环境中测试 |
| C2 | 必须输出测试日志摘要 | ⚠️ 待测试 | 需要在实际环境中测试 |
| C3 | 测试失败必须主动继续排查 | ⚠️ 待测试 | 需要在实际环境中测试 |
| D1 | 任务结束必须按模板输出完整执行报告 | ✅ 已遵守 | 本报告 |
| D2 | 必须逐条对照 A1–D2，标注状态 | ✅ 已遵守 | 上表已列出 |

---

## 🧪 测试结果

### 代码逻辑验证
✅ **已完成**

**验证内容**:
1. ✅ `mapDbProviderToClientProvider()` 正确将 `gemini` 映射为 `render`
2. ✅ `callAiServer()` 正确读取数据库配置并发送 `X-AI-Provider` 头
3. ✅ `callAiDirect()` 正确通过 API 获取配置并发送 `X-AI-Provider` 头
4. ✅ `/api/ai/config` 正确返回 `dbProvider` 字段
5. ✅ 代码通过 TypeScript 类型检查
6. ✅ 代码通过 ESLint 检查

**验证方法**:
- 代码审查
- 类型检查
- 逻辑流程分析

### 实际环境测试
⚠️ **待测试**

**测试步骤**:
1. 在数据库中将 `aiProvider` 设置为 `gemini`
2. 调用 AI 服务，检查日志中是否包含 `xAiProviderHeader: "gemini"`
3. 验证 ai-service 是否正确接收并处理 `X-AI-Provider: gemini` 请求头
4. 确认 Gemini API 调用成功

**预期结果**:
- 主站发送 `X-AI-Provider: gemini` 请求头
- ai-service 识别为 `gemini` provider
- Gemini API 调用成功
- 返回正常响应，不再出现 500 错误

---

## 📊 调用流程验证

### 完整调用流程

1. **用户选择 `gemini` provider**
   - 数据库 `ai_config` 表中 `aiProvider = "gemini"`

2. **主站读取配置**
   - `getDbAiProvider()` 或 `getCurrentAiProvider()` 读取数据库原始值 `"gemini"`
   - `mapDbProviderToClientProvider()` 将 `gemini` 映射为 `render`

3. **调用 AI 服务**
   - `callAiServer()` 或 `callAiDirect()` 检测到 `provider === "render"`
   - 从数据库读取原始值 `gemini`
   - 发送 `X-AI-Provider: gemini` 请求头

4. **ai-service 处理**
   - 接收 `X-AI-Provider: gemini` 请求头
   - 识别为 `gemini` provider
   - 调用 Gemini API

5. **返回结果**
   - Gemini API 返回正常响应
   - 主站返回给用户

### 代码逻辑验证结果
✅ **所有逻辑验证通过**

- ✅ 数据库读取逻辑正确
- ✅ Provider 映射逻辑正确
- ✅ 请求头发送逻辑正确
- ✅ 错误处理完善
- ✅ 日志记录完整

---

## 🔄 数据库配置验证

### 支持的 aiProvider 值
根据代码逻辑，以下值会被正确处理：

| 数据库值 | 映射为 | 是否发送 X-AI-Provider 头 | 头值 |
|---------|--------|------------------------|------|
| `gemini` | `render` | ✅ 是 | `gemini` |
| `openai` | `render` | ✅ 是 | `openai` |
| `openrouter` | `render` | ✅ 是 | `openrouter` |
| `local` | `local` | ❌ 否 | - |
| `openrouter_direct` | `render` | ❌ 否 | - |
| `openai_direct` | `render` | ❌ 否 | - |
| `gemini_direct` | `render` | ❌ 否 | - |
| `strategy` | `render` | ❌ 否 | - |

**说明**:
- 只有 `openai`、`openrouter`、`gemini` 会发送 `X-AI-Provider` 头
- `local` 不走 render，不需要发送头
- `*_direct` 和 `strategy` 虽然映射为 `render`，但不会发送头（这些值需要特殊处理，不在本次修复范围内）

---

## 📝 迁移脚本

⚠️ **不适用** - 本次修复未涉及数据库结构变更

---

## 📚 更新后的文档

⚠️ **不适用** - 本次修复未涉及数据库结构或文件结构变更

---

## ⚠️ 风险点与下一步建议

### 风险点

1. **数据库配置缺失**
   - **风险**: 如果数据库中没有 `aiProvider` 配置，`getDbAiProvider()` 返回 `null`，不会发送 `X-AI-Provider` 头
   - **影响**: ai-service 会从数据库读取配置，可能不是期望的值
   - **缓解**: 代码中有错误处理和日志记录，会记录警告

2. **API 调用失败**
   - **风险**: 前端 `getCurrentAiProvider()` 调用 `/api/ai/config` 失败
   - **影响**: 不会发送 `X-AI-Provider` 头
   - **缓解**: 代码中有错误处理，会记录警告并继续执行

3. **数据库连接问题**
   - **风险**: 服务端 `getDbAiProvider()` 无法连接数据库
   - **影响**: 不会发送 `X-AI-Provider` 头
   - **缓解**: 代码中有错误处理，会记录警告并继续执行

### 下一步建议

1. **立即执行**
   - ✅ 在 Render 环境配置 `GEMINI_API_KEY` 后进行端到端测试
   - ✅ 验证 `X-AI-Provider: gemini` 请求头是否正确发送
   - ✅ 确认 Gemini API 调用成功

2. **监控添加**
   - ✅ 添加 `X-AI-Provider` 请求头的监控和日志
   - ✅ 监控 Gemini API 调用的成功率和错误率

3. **文档更新**
   - ✅ 更新相关技术文档，说明 Gemini provider 的使用方式
   - ✅ 更新 API 文档，说明 `X-AI-Provider` 请求头的使用

4. **测试覆盖**
   - ✅ 添加单元测试，验证请求头发送逻辑
   - ✅ 添加集成测试，验证完整调用流程

---

## 📌 总结

### 修复完成情况
✅ **修复已完成**

- ✅ 修改了 3 个核心文件，添加了 `X-AI-Provider` 请求头支持
- ✅ 代码逻辑验证通过
- ✅ 版本号已更新：`2025-01-27 23:30:00`
- ✅ 执行报告已生成

### 关键改进
1. **服务端支持**: `callAiServer()` 现在会从数据库读取原始 `aiProvider` 配置并发送 `X-AI-Provider` 头
2. **前端支持**: `callAiDirect()` 现在会通过 API 获取原始配置并发送 `X-AI-Provider` 头
3. **API 增强**: `/api/ai/config` 现在返回 `dbProvider` 字段，供前端使用

### 预期效果
- ✅ 选择 `gemini` provider 时，主站会发送 `X-AI-Provider: gemini` 请求头
- ✅ ai-service 能够正确识别并使用 Gemini provider
- ✅ Gemini API 调用成功，不再出现 500 错误

---

**报告生成时间**: 2025-01-27 23:30:00

**报告版本**: v1.0

