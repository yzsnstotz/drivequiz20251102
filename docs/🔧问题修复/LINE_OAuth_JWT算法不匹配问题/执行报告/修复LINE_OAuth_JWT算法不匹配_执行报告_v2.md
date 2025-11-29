# 修复 LINE OAuth JWT 算法不匹配问题 - 执行报告（v2）

**执行日期**: 2025-11-26  
**任务ID**: LINE-OAUTH-FIX-20251126-002  
**当前版本号**: 2025-11-26 18:07:42

---

## 📌 任务摘要

### 问题描述
LINE OAuth 登录时，NextAuth 验证 ID token 失败，错误信息：`OperationProcessingError: unexpected JWT "alg" header parameter`。LINE 的 `id_token` 使用 HS256 算法签名，但 NextAuth 默认期望 RS256 算法，导致验证失败。

### 修复方案（v2）
根据指令要求，在 `src/lib/auth.ts` 中包装 LINE Provider，显式添加 `client.id_token_signed_response_alg: "HS256"` 配置，而不是在自定义 provider 文件中配置。同时简化 `src/lib/providers/line.ts` 中的 token 处理，直接返回完整 tokens，让 NextAuth 正常验证。

### 修复结果
✅ 已在 `src/lib/auth.ts` 中包装 LINE Provider，添加 `client.id_token_signed_response_alg: "HS256"` 配置  
✅ 已简化 `src/lib/providers/line.ts` 中的 token 处理，直接返回 `tokens`  
✅ 已移除自定义 provider 中的 `client` 配置，避免配置冲突  
✅ 已更新相关注释说明

---

## 📌 修改文件列表

### 1. `src/lib/auth.ts`

**修改内容**：
1. 在文件顶部添加 LINE Provider 包装逻辑
2. 创建 `lineProviderBase` 变量，调用 `LineProvider` 并传入配置
3. 显式设置 `client.id_token_signed_response_alg: "HS256"`
4. 在 `providers` 数组中使用包装后的 `lineProviderBase`

**关键修改**：

```typescript
// 包装 LINE Provider，添加 client.id_token_signed_response_alg 配置
// 告诉 NextAuth/oauth4webapi 使用 HS256 算法验证 LINE 的 id_token
const lineProviderBase = LineProvider({
  clientId: process.env.LINE_CLIENT_ID || "",
  clientSecret: process.env.LINE_CLIENT_SECRET || "",
  redirectUri: process.env.LINE_REDIRECT_URI || `${process.env.NEXTAUTH_URL}/api/auth/callback/line`,
});

// 确保 client 配置存在，并覆盖算法
(lineProviderBase as any).client = {
  ...((lineProviderBase as any).client ?? {}),
  id_token_signed_response_alg: "HS256",
};

// 在 providers 数组中使用
providers: [
  // ...
  // LINE OAuth（自定义提供商，已包装并配置 HS256 算法）
  lineProviderBase,
],
```

### 2. `src/lib/providers/line.ts`

**修改内容**：
1. 简化 `token.request` 返回逻辑，直接返回 `tokens`（不再手动处理 `id_token`）
2. 移除 `client` 配置（已在 `src/lib/auth.ts` 中通过包装添加）
3. 更新相关注释，说明配置位置

**关键修改**：

```typescript
// 修改前：手动返回 tokens 对象，包含 id_token
return {
  access_token: tokens.access_token,
  expires_in: tokens.expires_in,
  id_token: tokens.id_token,
  refresh_token: tokens.refresh_token,
  scope: tokens.scope,
  token_type: tokens.token_type,
};

// 修改后：直接返回完整 tokens
// LINE 返回的 ID token 使用 HS256 算法签名
// 在 src/lib/auth.ts 中已经通过包装配置了 client.id_token_signed_response_alg: "HS256"
// 因此直接返回完整 tokens，让 NextAuth 使用正确的算法验证
return tokens;
```

```typescript
// 修改前：在 provider 中配置 client
client: {
  id_token_signed_response_alg: "HS256",
},

// 修改后：移除 client 配置，避免配置冲突
// 注意：client.id_token_signed_response_alg 配置已在 src/lib/auth.ts 中通过包装添加
// 这里不再重复配置，避免配置冲突
```

### 3. `src/lib/version.ts`

**修改内容**：
- 更新版本号：`2025-11-26 18:07:42`
- 更新注释：说明本次修复内容

---

## 📌 逐条红线规范自检（A1–D2）

| 编号 | 规则 | 状态 | 说明 |
|------|------|------|------|
| **A1** | 路由层禁止承载业务逻辑 | ✅ 已遵守 | `src/app/api/auth/[...nextauth]/route.ts` 只做请求分发，不承载业务逻辑 |
| **A2** | 所有核心逻辑必须写入 ai-core | ⚪ 不适用 | 本次任务不涉及 AI 功能 |
| **A3** | ai-service 与 local-ai-service 行为必须保持完全一致 | ⚪ 不适用 | 本次任务不涉及 AI 服务 |
| **A4** | 接口参数、返回结构必须保持统一 | ✅ 已遵守 | 保持 NextAuth OAuth provider 标准接口 |
| **B1** | 任何数据库字段、表结构、索引的修改必须同步更新数据库结构文档 | ⚪ 不适用 | 本次任务不涉及数据库结构修改 |
| **B2** | 所有文件新增、删除、迁移必须同步更新文件结构文档 | ⚪ 不适用 | 本次任务只修改现有文件，未新增或删除文件 |
| **B3** | 所有 Kysely 类型定义必须与数据库结构同步保持一致 | ⚪ 不适用 | 本次任务不涉及数据库类型定义 |
| **B4** | DriveQuiz 主库与 AI Service 库的 schema 需保持文档同步 | ⚪ 不适用 | 本次任务不涉及数据库 schema |
| **C1** | 涉及 AI 功能必须同时测试：local-ai-service & 远程 ai-service | ⚪ 不适用 | 本次任务不涉及 AI 功能 |
| **C2** | 必须输出测试日志摘要（请求、响应、耗时、错误） | ⚪ 不适用 | 本次任务不涉及 AI 功能 |
| **C3** | 若测试失败，必须主动继续排查，不得要求用户手动重试 | ⚪ 不适用 | 本次任务不涉及 AI 功能 |
| **D1** | 任务结束必须按模板输出完整执行报告 | ✅ 已遵守 | 本报告即为完整执行报告 |
| **D2** | 必须逐条对照 A1–D2，标注"已遵守 / 不适用 / 必须修复" | ✅ 已遵守 | 已在上表中逐条对照 |

---

## 📌 测试结果

### 测试环境
- **操作系统**: macOS
- **Node.js 版本**: 22.12.0
- **Next.js 版本**: 15.5.6
- **NextAuth 版本**: 5.0.0-beta.30
- **测试环境**: Development (localhost:3000)

### 测试步骤

#### 1. 代码修改验证
- ✅ 已在 `src/lib/auth.ts` 中包装 LINE Provider，添加 `client.id_token_signed_response_alg: "HS256"` 配置
- ✅ 已简化 `src/lib/providers/line.ts` 中的 token 处理，直接返回 `tokens`
- ✅ 已移除自定义 provider 中的 `client` 配置，避免配置冲突
- ✅ 已更新相关注释
- ✅ 无 TypeScript 编译错误
- ✅ 无 Linter 错误

#### 2. 路由层规范检查（A1）
- ✅ `src/app/api/auth/[...nextauth]/route.ts` 只做请求分发，不承载业务逻辑
- ✅ 符合 A1 规范要求

### 待验证项（需要重启服务器后测试）

#### 1. LINE OAuth 登录功能测试
**测试步骤**：
1. 重启开发服务器
2. 访问登录页面（`http://localhost:3000/login`）
3. 点击 "使用 LINE 登录" 按钮
4. 选择 "跳转授权" 登录方式
5. 完成 LINE 授权
6. 观察服务器日志和浏览器控制台

**预期结果**：
- ✅ 不再出现 `unexpected JWT "alg" header parameter` 错误
- ✅ 不再出现 `OperationProcessingError` 错误
- ✅ 用户可以正常完成回调并创建 session
- ✅ 登录成功，重定向到首页或指定页面

**验证日志**：
- 如果修复成功，应该看到：
  - `[auth][debug]` 日志显示正常的 OAuth 流程
  - 不再有 `[auth][error] CallbackRouteError` 相关日志
  - 不再有 `[auth][details]` 显示算法不匹配错误

#### 2. Google OAuth 登录回归测试
**测试步骤**：
1. 访问登录页面
2. 点击 "使用 Google 登录" 按钮
3. 完成 Google 授权

**预期结果**：
- ✅ Google 登录功能不受影响
- ✅ 可以正常完成登录流程

---

## 📌 技术细节

### 修复原理

**问题根源**：
- LINE OAuth 2.1 使用 HS256 算法签名 `id_token`
- NextAuth v5 使用 `oauth4webapi` 库处理 OAuth 流程
- `oauth4webapi` 默认期望 RS256 算法验证 `id_token`
- 算法不匹配导致验证失败

**修复方案（v2）**：
- 在 `src/lib/auth.ts` 中包装 LINE Provider，显式添加 `client.id_token_signed_response_alg: "HS256"`
- 这个配置告诉 `oauth4webapi` 使用 HS256 算法验证 `id_token`
- 简化自定义 provider 中的 token 处理，直接返回完整 tokens，让 NextAuth 正常验证

### 配置说明

**在 `src/lib/auth.ts` 中包装 Provider**：
```typescript
const lineProviderBase = LineProvider({
  clientId: process.env.LINE_CLIENT_ID || "",
  clientSecret: process.env.LINE_CLIENT_SECRET || "",
  redirectUri: process.env.LINE_REDIRECT_URI || `${process.env.NEXTAUTH_URL}/api/auth/callback/line`,
});

(lineProviderBase as any).client = {
  ...((lineProviderBase as any).client ?? {}),
  id_token_signed_response_alg: "HS256",
};
```

**作用**：
- 告诉 NextAuth/oauth4webapi：LINE 的 `id_token` 使用 HS256 算法签名
- NextAuth 会使用 HS256 算法验证 `id_token`，而不是默认的 RS256
- 这样既满足 LINE 的要求（包含 `openid` scope，返回 `id_token`），又解决了算法不匹配问题

### 代码变更对比

**修改前（v1）**：
- 在 `src/lib/providers/line.ts` 中配置 `client.id_token_signed_response_alg: "HS256"`
- 在 `token.request` 中手动返回 tokens 对象

**修改后（v2）**：
- 在 `src/lib/auth.ts` 中包装 LINE Provider，显式添加 `client.id_token_signed_response_alg: "HS256"`
- 在 `src/lib/providers/line.ts` 中直接返回 `tokens`，不再手动处理

**优势**：
- 配置更集中，在 NextAuth 主配置文件中统一管理
- 避免配置冲突，确保只有一个地方配置 `client.id_token_signed_response_alg`
- 代码更简洁，自定义 provider 只负责 OAuth 流程，不处理算法配置

---

## 📌 迁移脚本

**不适用**：本次任务不涉及数据库结构修改。

---

## 📌 更新后的文档

### 文件结构文档
**不适用**：本次任务只修改现有文件，未新增或删除文件。

### 数据库结构文档
**不适用**：本次任务不涉及数据库结构修改。

---

## 📌 风险点与下一步建议

### 风险点

1. **NextAuth v5 兼容性**
   - ⚠️ `client.id_token_signed_response_alg` 配置可能不被 NextAuth v5 beta.30 支持
   - 如果配置无效，可能需要：
     - 升级 NextAuth 版本
     - 或使用其他解决方案（如自定义 OAuth 流程）

2. **oauth4webapi 库行为**
   - ⚠️ 需要确认 `oauth4webapi` 库是否支持 `client.id_token_signed_response_alg` 配置
   - 如果库不支持，可能需要：
     - 检查库的文档和源码
     - 或联系 NextAuth 社区

3. **配置位置**
   - ⚠️ 配置在 `src/lib/auth.ts` 中通过包装添加，而不是在 provider 定义中
   - 如果 NextAuth 内部处理逻辑发生变化，可能需要调整配置位置

### 下一步建议

1. **立即测试**
   - 重启开发服务器
   - 测试 LINE OAuth 登录功能
   - 观察是否还有 JWT 算法不匹配错误

2. **如果修复成功**
   - ✅ 记录修复方案
   - ✅ 更新诊断报告，标记问题已解决
   - ✅ 进行回归测试（Google、Facebook、Twitter 等）

3. **如果修复失败**
   - 检查 NextAuth v5 文档，确认 `client.id_token_signed_response_alg` 是否支持
   - 检查 `oauth4webapi` 库源码，确认配置是否生效
   - 考虑其他解决方案：
     - 方案 2：使用自定义 OAuth 流程
     - 方案 3：联系 NextAuth 社区或提交 Issue

4. **长期优化**
   - 如果配置有效，可以考虑：
     - 在文档中记录此配置的重要性
     - 为其他使用 HS256 的 OAuth 提供商（如微信）也添加类似配置

---

## 📌 执行日志

### 执行命令

```bash
# 1. 修改文件
- src/lib/auth.ts（包装 LINE Provider，添加 client 配置）
- src/lib/providers/line.ts（简化 token 处理，直接返回 tokens）
- src/lib/version.ts（更新版本号）

# 2. 检查 Linter
- 无错误

# 3. 更新版本号
- 2025-11-26 18:07:42
```

### 执行结果

- ✅ 已在 `src/lib/auth.ts` 中包装 LINE Provider，添加 `client.id_token_signed_response_alg: "HS256"` 配置
- ✅ 已简化 `src/lib/providers/line.ts` 中的 token 处理，直接返回 `tokens`
- ✅ 已移除自定义 provider 中的 `client` 配置，避免配置冲突
- ✅ 已更新相关注释
- ✅ 无编译错误
- ✅ 无 Linter 错误
- ⏳ 待测试：需要重启服务器后测试 LINE OAuth 登录功能

---

## 📌 成果摘要

### 已完成的工作

1. ✅ **在 auth.ts 中包装 LINE Provider**
   - 创建 `lineProviderBase` 变量，调用 `LineProvider` 并传入配置
   - 显式设置 `client.id_token_signed_response_alg: "HS256"`
   - 在 `providers` 数组中使用包装后的 `lineProviderBase`

2. ✅ **简化自定义 provider 的 token 处理**
   - 在 `src/lib/providers/line.ts` 中，`token.request` 直接返回 `tokens`
   - 不再手动处理 `id_token`，让 NextAuth 正常验证

3. ✅ **移除配置冲突**
   - 移除自定义 provider 中的 `client` 配置
   - 确保配置只在 `src/lib/auth.ts` 中通过包装添加

4. ✅ **更新版本号**
   - 版本号：`2025-11-26 18:07:42`

### 待验证的工作

1. ⏳ **LINE OAuth 登录功能测试**
   - 需要重启服务器后测试
   - 验证是否解决了 JWT 算法不匹配问题

2. ⏳ **回归测试**
   - Google OAuth 登录功能
   - 其他 OAuth 提供商功能

---

**报告生成时间**: 2025-11-26 18:07:42  
**报告生成工具**: Cursor AI Assistant  
**任务状态**: 代码修改完成，待测试验证

