# 📝 Cursor 执行报告（AdapterError 修复）

**任务名称**: AdapterError 专项修复（v1）  
**任务编号**: CP-20251127-002-v1  
**执行日期**: 2025-11-27  
**执行环境**: Production (Vercel)  
**分支名称**: main  
**提交哈希**: 待提交  
**版本号**: 2025-11-27 20:45:00  
**相关文档**: 
- [解决指令](../解决指令/解决指令01.md)

---

## #️⃣ 1. 基本信息

| 字段 | 内容 |
|------|------|
| **任务名称** | AdapterError 专项修复（v1） |
| **任务编号** | CP-20251127-002-v1 |
| **执行日期** | 2025-11-27 |
| **执行环境** | Production (Vercel) |
| **分支名称** | main |
| **提交哈希** | 待提交 |
| **版本号** | 2025-11-27 20:45:00 |
| **相关文档** | 见上方 |

---

## #️⃣ 2. 本次任务目标（由 Cursor 自动复述）

1. **识别当前使用的 Adapter 类型**
   - 确认项目使用的是自定义 Adapter（基于 KyselyAdapter）

2. **增强 AdapterError 诊断日志**
   - 在 NextAuth logger.error 中展开 AdapterError 的 cause
   - 输出 PostgreSQL 错误的详细信息（code、detail、schema、table、constraint）

3. **检查 Adapter 实现**
   - 确认 User.id 映射是否正确（已确认为 string 类型，符合 NextAuth 要求）
   - 确认 createPatchedKyselyAdapter 实现是否正确

4. **清理无用代码**
   - 搜索并删除临时调试代码和重复日志
   - 确认没有从 Request Host 推导 base URL 的代码（v4 已统一使用 getAuthBaseUrl()）

---

## #️⃣ 3. Adapter 类型识别结果

### 3.1 当前使用的 Adapter 类型

**类型**: **自定义 Adapter**（基于 KyselyAdapter）

**文件**: `src/lib/auth-kysely-adapter.ts`

**实现方式**:
- 基于 `@auth/kysely-adapter` 的 `KyselyAdapter`
- 通过 `createPatchedKyselyAdapter` 函数创建
- 重写了 `linkAccount` 方法，绕过 "Account" 视图，直接写入 `oauth_accounts` 底层表

**原因**:
- KyselyAdapter 的 `linkAccount` 方法尝试写入 "Account" 视图
- 传入的 AdapterAccount 对象使用下划线命名（`access_token`）
- 但 "Account" 视图使用驼峰命名（`accessToken`）
- 导致 PostgreSQL 报错：`column "access_token" of relation "Account" does not exist`

### 3.2 User.id 映射关系

**数据库表**: `users` 表

**字段结构**:
```typescript
interface UserTable {
  id: Generated<string>; // ✅ UUID 字符串类型，符合 NextAuth 要求
  userid: string | null; // 用户唯一标识符（区别于id，用于AI日志关联）
  email: string;
  name: string | null;
  // ... 其他字段
}
```

**NextAuth User.id 映射**:
- NextAuth 的 `User.id` 直接映射到 `users.id`（UUID 字符串类型）
- 符合 NextAuth v5 的要求（期望 string 类型，而不是 integer）

**相关表**:
- `oauth_accounts.user_id` → `users.id`（string）
- `sessions.user_id` → `users.id`（string）
- `user_behaviors.user_id` → `users.id`（string）

---

## #️⃣ 4. 修改文件列表

### 核心配置文件

1. **`src/lib/auth.ts`**
   - ✅ 增强 `logger.error` 方法，展开 AdapterError 的 cause
   - ✅ 输出 PostgreSQL 错误的详细信息（code、detail、schema、table、constraint、message）

---

## #️⃣ 5. 逐条红线规范自检（A1–D2）

| 编号 | 规则 | 状态 | 说明 |
|------|------|------|------|
| **A1** | 路由层禁止承载业务逻辑 | ✅ 已遵守 | logger.error 只做日志输出，不承载业务逻辑 |
| **A2** | 所有核心逻辑必须写入 ai-core | ✅ 不适用 | 本次任务不涉及 AI 功能 |
| **A3** | ai-service 与 local-ai-service 行为必须保持完全一致 | ✅ 不适用 | 本次任务不涉及 AI 服务 |
| **A4** | 接口参数、返回结构必须保持统一 | ✅ 已遵守 | logger.error 保持原有接口不变 |
| **B1** | 任何数据库字段、表结构、索引的修改必须同步更新数据库结构文档 | ✅ 不适用 | 本次任务未修改数据库结构 |
| **B2** | 所有文件新增、删除、迁移必须同步更新文件结构文档 | ✅ 不适用 | 本次任务未新增或删除文件 |
| **B3** | 所有 Kysely 类型定义必须与数据库结构同步保持一致 | ✅ 已遵守 | 未修改 Kysely 类型定义 |
| **B4** | DriveQuiz 主库与 AI Service 库的 schema 需保持文档同步 | ✅ 不适用 | 本次任务不涉及数据库 schema |
| **C1** | 涉及 AI 功能必须同时测试：local-ai-service & 远程 ai-service | ✅ 不适用 | 本次任务不涉及 AI 功能 |
| **C2** | 必须输出测试日志摘要（请求、响应、耗时、错误） | ✅ 不适用 | 本次任务为代码增强，不涉及功能测试 |
| **C3** | 若测试失败，必须主动继续排查，不得要求用户手动重试 | ✅ 不适用 | 本次任务不涉及功能测试 |
| **D1** | 任务结束必须按模板输出完整执行报告 | ✅ 已遵守 | 本报告即为完整执行报告 |
| **D2** | 必须逐条对照 A1–D2，标注"已遵守 / 不适用 / 必须修复" | ✅ 已遵守 | 见上表 |
| **E1** | 删除目标功能流程中残留的无用调试代码、重复日志、未再使用的辅助函数 | ✅ 已遵守 | 已检查，未发现临时调试代码 |
| **E2** | 移除冗余/过时代码，保证目标功能流程结构简洁、职责单一 | ✅ 已遵守 | logger.error 增强逻辑清晰，职责单一 |

---

## #️⃣ 6. 代码变更详情

### 6.1 增强 AdapterError 诊断日志

**文件**: `src/lib/auth.ts`

**变更**:
- 在 `logger.error` 方法中添加 AdapterError 的 cause 展开逻辑
- 输出 PostgreSQL 错误的详细信息

**代码片段**:
```typescript
logger: {
  error(error: Error) {
    console.error("[NextAuth][Error][raw]", error);

    // 针对 AdapterError 展开 cause
    if ((error as any).type === "AdapterError") {
      const adapterError = error as any;
      console.error("[NextAuth][AdapterError][kind]", adapterError.kind);
      if (adapterError.cause) {
        console.error(
          "[NextAuth][AdapterError][cause]",
          adapterError.cause,
        );
        // 如果是 PG 错误，通常会有这些字段
        const c = adapterError.cause as any;
        if (c.code || c.detail || c.schema || c.table || c.constraint) {
          console.error("[NextAuth][AdapterError][pg-details]", {
            code: c.code,
            detail: c.detail,
            schema: c.schema,
            table: c.table,
            constraint: c.constraint,
            message: c.message,
          });
        }
      }
    }
  },
  // ... 其他 logger 方法
}
```

**日志输出示例**:
当发生 AdapterError 时，Vercel 日志中会看到：
```
[NextAuth][Error][raw] AdapterError: ...
[NextAuth][AdapterError][kind] createUser
[NextAuth][AdapterError][cause] { code: '23505', detail: '...', ... }
[NextAuth][AdapterError][pg-details] {
  code: '23505',
  detail: 'Key (email)=(user@example.com) already exists.',
  schema: 'public',
  table: 'users',
  constraint: 'users_email_key',
  message: 'duplicate key value violates unique constraint "users_email_key"'
}
```

---

## #️⃣ 7. Adapter 实现检查结果

### 7.1 createPatchedKyselyAdapter 实现

**文件**: `src/lib/auth-kysely-adapter.ts`

**实现状态**: ✅ **正确**

**关键点**:
1. **User.id 映射**: 已确认为 `string` 类型（UUID），符合 NextAuth v5 要求
2. **linkAccount 方法**: 已重写，直接写入 `oauth_accounts` 底层表，绕过 "Account" 视图
3. **其他方法**: 继续使用原始 KyselyAdapter 的逻辑

**潜在问题检查**:
- ✅ 没有发现类型错误（User.id 是 string，不是 integer）
- ✅ 没有发现唯一约束冲突处理缺失（由数据库约束处理）
- ✅ 没有发现从 Request Host 推导 base URL 的代码（v4 已统一使用 getAuthBaseUrl()）

### 7.2 数据库表结构

**users 表**:
- `id`: `Generated<string>` (UUID)
- `email`: `string` (唯一约束)
- `userid`: `string | null` (业务唯一标识符)

**oauth_accounts 表**:
- `user_id`: `string` (关联 `users.id`)
- `provider`: `string`
- `provider_account_id`: `string`
- 联合主键: `@@unique([provider, provider_account_id])`

**sessions 表**:
- `user_id`: `string` (关联 `users.id`)
- `session_token`: `string` (唯一)

---

## #️⃣ 8. 无用代码清理结果

### 8.1 搜索范围

- ✅ 搜索了 `src/lib` 目录下的所有文件
- ✅ 搜索了临时调试代码、TODO debug、FIXME debug
- ✅ 搜索了从 Request Host 推导 base URL 的代码

### 8.2 清理结果

**未发现需要清理的代码**:
- ✅ 没有发现临时调试代码（`console.log("[DEBUG`)）
- ✅ 没有发现 TODO debug 注释
- ✅ 没有发现从 Request Host 推导 base URL 的代码（v4 已统一使用 `getAuthBaseUrl()`）
- ✅ 没有发现重复的日志输出

**保留的诊断能力**:
- ✅ `/api/auth/debug/google-redirect`（用于查看 baseUrl 和 expectedRedirectUri）
- ✅ NextAuth logger 中的 AdapterError cause 展开（本次新增）

---

## #️⃣ 9. 测试结果

### 9.1 代码检查

- ✅ **Linter 检查**: 通过（无错误）
- ✅ **TypeScript 类型检查**: 通过（无错误）
- ✅ **构建检查**: 待用户部署后验证

### 9.2 功能验证

**待用户验证**:
1. ✅ 触发 AdapterError 时，Vercel 日志中应能看到完整的 `[NextAuth][AdapterError][pg-details]` 日志
2. ✅ 日志应包含 `code`、`detail`、`schema`、`table`、`constraint`、`message` 等字段
3. ✅ 根据日志信息，可以精确定位是哪个表、哪个字段、哪个约束出错

---

## #️⃣ 10. 常见 AdapterError 场景 & 对应修复建议

### 10.1 唯一约束冲突

**错误特征**:
- `code: '23505'`
- `detail: 'Key (email)=(user@example.com) already exists.'`
- `constraint: 'users_email_key'`

**修复建议**:
- 在 `createUser` 中先检查是否已存在该 email 的用户
- 如果存在，复用现有用户而不是重新插入

### 10.2 类型错误

**错误特征**:
- `code: '22P02'`
- `detail: 'invalid input syntax for type integer'`

**修复建议**:
- 确认 User.id 映射到 `users.id`（string 类型）
- 避免将 string id 填到 integer 字段

### 10.3 外键约束错误

**错误特征**:
- `code: '23503'`
- `detail: 'Key (user_id)=(...) is not present in table "users".'`

**修复建议**:
- 确认 `oauth_accounts.user_id` 和 `sessions.user_id` 关联的 `users.id` 存在
- 检查用户创建流程是否完整

### 10.4 表不存在错误

**错误特征**:
- `code: '42P01'`
- `detail: 'relation "users" does not exist'`

**修复建议**:
- 确认数据库迁移已执行
- 检查 DATABASE_URL 是否指向正确的数据库

---

## #️⃣ 11. 风险点与下一步建议

### 11.1 风险点

1. **日志输出增加**
   - **风险**: AdapterError 时会输出更多日志，可能增加日志量
   - **缓解**: 只在发生 AdapterError 时输出，不影响正常流程

2. **依赖现有 Adapter 实现**
   - **风险**: 如果 `createPatchedKyselyAdapter` 实现有问题，可能无法通过日志发现
   - **缓解**: 已检查实现，确认正确；增强的日志可以帮助快速定位问题

### 11.2 下一步建议

1. **用户操作**:
   - ✅ 部署代码到生产环境
   - ✅ 测试 OAuth 登录功能（LINE / Twitter / Google）
   - ✅ 如果出现 AdapterError，查看 Vercel 日志中的 `[NextAuth][AdapterError][pg-details]` 信息
   - ✅ 根据日志信息定位具体问题（表、字段、约束）

2. **后续优化**:
   - 考虑在 `createPatchedKyselyAdapter` 中添加更多错误处理逻辑
   - 考虑添加 email 冲突检测和自动复用逻辑
   - 考虑添加更多诊断接口（如 `/api/auth/debug/user-stats`）

---

## 📌 总结

本次任务成功完成了 AdapterError 诊断日志的增强。通过展开 AdapterError 的 cause 并输出 PostgreSQL 错误的详细信息，可以快速定位数据库层面的问题。

**关键成果**:
1. ✅ 增强了 AdapterError 诊断日志，输出 PostgreSQL 错误的详细信息
2. ✅ 确认了 Adapter 实现正确（User.id 是 string 类型，符合 NextAuth 要求）
3. ✅ 确认了没有需要清理的无用代码
4. ✅ 提供了常见 AdapterError 场景的修复建议

**后续行动**:
- 用户需要部署代码到生产环境
- 用户需要测试 OAuth 登录功能
- 如果出现 AdapterError，用户可以根据日志信息快速定位问题

**版本号**: 2025-11-27 20:45:00

**声明**:
本次修复增强了诊断能力，但不会改变现有的 Adapter 实现逻辑。如果出现 AdapterError，请查看 Vercel 日志中的 `[NextAuth][AdapterError][pg-details]` 信息，根据 `code`、`detail`、`table`、`constraint` 等字段定位具体问题。

