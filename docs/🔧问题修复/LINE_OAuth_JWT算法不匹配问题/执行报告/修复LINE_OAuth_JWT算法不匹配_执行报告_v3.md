# 修复 LINE OAuth JWT 算法不匹配问题 - 执行报告（v3）

**执行日期**: 2025-11-26  
**任务ID**: LINE-OAUTH-FIX-20251126-004  
**当前版本号**: 2025-11-26 18:35:28

---

## 📌 任务摘要

### 问题描述
LINE OAuth 登录回调报错：`OperationProcessingError: unexpected JWT "alg" header parameter`。错误详情：
- header.alg: `"HS256"`
- expected: `"RS256"`
- reason: `"default value"`
- provider: `"line"`

说明：
- LINE 返回的 `id_token` 用的是 HS256
- Auth.js / oauth4webapi 默认期望 RS256（reason: "default value"），仍然在尝试校验 `id_token`

### 修复方案
采用两层防护：
1. **尽量不请求/不依赖 id_token**：调整 scope 从 `"openid profile email"` 改为 `"profile"`，避免 LINE 返回 `id_token`
2. **兜底配置**：即使有 `id_token`，也把期望算法改成 HS256，避免 RS256 默认值报错

### 修复结果
✅ 已调整 scope 从 `"openid profile email"` 改为 `"profile"`  
✅ 已添加 `client.id_token_signed_response_alg: "HS256"` 配置  
✅ 已更新 `profile` 函数，email 设为 `null`  
✅ 已确认没有残留旧的 LineProvider 配置

---

## 📌 修改文件列表

### 1. `src/lib/auth.ts`

**修改内容**：
1. 调整 scope：从 `"openid profile email"` 改为 `"profile"`
2. 添加 `client` 配置，设置 `id_token_signed_response_alg: "HS256"`
3. 更新 `profile` 函数，email 设为 `null`

**关键修改**：

```typescript
// 修改前：
{
  id: "line",
  name: "LINE",
  type: "oauth",
  clientId: process.env.LINE_CLIENT_ID || "",
  clientSecret: process.env.LINE_CLIENT_SECRET || "",
  checks: ["pkce", "state"],
  authorization: {
    url: "https://access.line.me/oauth2/v2.1/authorize",
    params: {
      response_type: "code",
      scope: "openid profile email", // LINE 要求包含 openid scope
    },
  },
  token: "https://api.line.me/oauth2/v2.1/token",
  userinfo: "https://api.line.me/v2/profile",
  async profile(profile: any) {
    return {
      id: profile.userId,
      name: profile.displayName,
      image: profile.pictureUrl,
      email: profile.email || null,
    };
  },
}

// 修改后：
{
  id: "line",
  name: "LINE",
  type: "oauth",
  clientId: process.env.LINE_CLIENT_ID || "",
  clientSecret: process.env.LINE_CLIENT_SECRET || "",
  // ✅ 新增 client 配置，覆盖默认 RS256
  client: {
    // 主要是这一行：把 id_token 签名算法从默认 RS256 改为 HS256
    id_token_signed_response_alg: "HS256",
    // 可以顺便指定认证方式（非必须，按需）
    token_endpoint_auth_method: "client_secret_basic",
  },
  checks: ["pkce", "state"],
  authorization: {
    url: "https://access.line.me/oauth2/v2.1/authorize",
    params: {
      response_type: "code",
      scope: "profile", // 🔁 从 "openid profile email" 改成 "profile"，避免 LINE 返回 id_token
    },
  },
  token: "https://api.line.me/oauth2/v2.1/token",
  userinfo: "https://api.line.me/v2/profile",
  async profile(profile: any) {
    return {
      id: profile.userId,
      name: profile.displayName,
      image: profile.pictureUrl,
      email: null, // 现在我们不走 email 了，统一设为 null
    };
  },
}
```

### 2. `src/lib/version.ts`

**修改内容**：
- 更新版本号：`2025-11-26 18:35:28`
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
- ✅ 已调整 scope 从 `"openid profile email"` 改为 `"profile"`
- ✅ 已添加 `client.id_token_signed_response_alg: "HS256"` 配置
- ✅ 已更新 `profile` 函数，email 设为 `null`
- ✅ 已确认没有残留旧的 LineProvider 配置
- ✅ 无 TypeScript 编译错误
- ✅ 无 Linter 错误

#### 2. 清理检查
- ✅ 确认项目中不再引用 `next-auth/providers/line`
- ✅ 确认没有 `LineProvider` 包装代码
- ✅ 确认 `providers` 数组中只有一个 `id: "line"` 的对象

#### 3. 路由层规范检查（A1）
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
- ✅ Session 中能看到用户信息（如 `user.name`、`user.image` 等）

**验证日志**：
- 如果修复成功，应该看到：
  - `[auth][debug]` 日志显示正常的 OAuth 流程
  - 不再有 `[auth][error] CallbackRouteError` 相关日志
  - 不再有 `[auth][details]` 显示算法不匹配错误
  - LINE 不会返回 `id_token`（因为 scope 不包含 `openid`）

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
- LINE 返回的 `id_token` 使用 HS256 算法签名
- Auth.js / oauth4webapi 默认期望 RS256 算法（reason: "default value"）
- 当 scope 包含 `openid` 时，LINE 会返回 `id_token`，导致 NextAuth 尝试验证并报错

**修复方案（两层防护）**：

1. **第一层：避免请求 id_token**
   - 调整 scope 从 `"openid profile email"` 改为 `"profile"`
   - scope 不含 `openid` 时，LINE 就不会返回 `id_token`
   - Auth.js 也就不会尝试对 `id_token` 做 JWT 校验，自然不会触发 alg 错误

2. **第二层：兜底配置**
   - 添加 `client.id_token_signed_response_alg: "HS256"` 配置
   - 即使有些情况下 LINE 还是带了 `id_token`，也把期望算法从默认 RS256 改成 HS256
   - 避免再报同样的错

### 配置说明

**Scope 调整**：
```typescript
scope: "profile", // 从 "openid profile email" 改成 "profile"
```

**作用**：
- 不包含 `openid` scope，LINE 不会返回 `id_token`
- 只使用 `profile` scope，获取用户基本信息（userId、displayName、pictureUrl）
- 不依赖 email 和 OIDC claims，这样是足够的

**Client 配置**：
```typescript
client: {
  id_token_signed_response_alg: "HS256",
  token_endpoint_auth_method: "client_secret_basic",
}
```

**作用**：
- `id_token_signed_response_alg: "HS256"` 是给 oauth4webapi 用的，防止它再用默认 RS256 去检查 HS256 的 token
- 即使 scope 已经去掉 `openid`，这一步也作为"兜底"
- `token_endpoint_auth_method: "client_secret_basic"` 指定认证方式（非必须，按需）

### 代码变更对比

**修改前**：
- scope: `"openid profile email"` → LINE 返回 `id_token`（HS256）
- 没有 `client` 配置 → NextAuth 默认期望 RS256
- 算法不匹配 → 验证失败 → 登录失败

**修改后**：
- scope: `"profile"` → LINE 不返回 `id_token`
- 添加 `client.id_token_signed_response_alg: "HS256"` → 即使有 `id_token`，也使用 HS256 验证
- 两层防护 → 避免算法不匹配错误

**优势**：
- 主要防护：不请求 `id_token`，避免验证问题
- 兜底防护：即使有 `id_token`，也使用正确的算法验证
- 配置简单，直接在 `auth.ts` 中管理

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

1. **Email 信息缺失**
   - ⚠️ 由于 scope 不包含 `email`，LINE 不会返回 email 信息
   - 当前配置中 `email: null`，如果后续需要 email，可能需要：
     - 从 `id_token` 中解析（如果 LINE 返回了 `id_token`）
     - 或者使用其他方式获取 email

2. **LINE API 变更**
   - ⚠️ 如果 LINE API 变更，可能需要更新配置
   - 需要关注 LINE Developers 文档的更新

3. **NextAuth v5 版本兼容性**
   - ⚠️ 如果 NextAuth 升级到新版本，可能会改变默认行为
   - 需要关注 NextAuth 的更新日志

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
   - 检查 LINE API 文档，确认 scope 配置是否正确
   - 检查 NextAuth v5 文档，确认 `client.id_token_signed_response_alg` 是否支持
   - 考虑其他解决方案：
     - 方案 2：联系 NextAuth 社区或提交 Issue
     - 方案 3：等待 NextAuth v5 修复默认算法问题

4. **长期优化**
   - 如果配置有效，可以考虑：
     - 在文档中记录此配置的重要性
     - 为其他使用类似问题的 OAuth 提供商也添加类似配置
     - 如果后续需要 email，考虑从 `id_token` 中解析（如果 LINE 返回了 `id_token`）

---

## 📌 执行日志

### 执行命令

```bash
# 1. 修改文件
- src/lib/auth.ts（调整 scope，添加 client 配置，更新 profile 函数）
- src/lib/version.ts（更新版本号）

# 2. 检查 Linter
- 无错误

# 3. 清理检查
- 确认没有残留旧的 LineProvider 配置
- 确认项目中不再引用 next-auth/providers/line

# 4. 更新版本号
- 2025-11-26 18:35:28
```

### 执行结果

- ✅ 已调整 scope 从 `"openid profile email"` 改为 `"profile"`
- ✅ 已添加 `client.id_token_signed_response_alg: "HS256"` 配置
- ✅ 已更新 `profile` 函数，email 设为 `null`
- ✅ 已确认没有残留旧的 LineProvider 配置
- ✅ 已更新相关注释
- ✅ 无编译错误
- ✅ 无 Linter 错误
- ⏳ 待测试：需要重启服务器后测试 LINE OAuth 登录功能

---

## 📌 成果摘要

### 已完成的工作

1. ✅ **调整 scope**
   - 从 `"openid profile email"` 改为 `"profile"`
   - 避免 LINE 返回 `id_token`，从而避免 NextAuth 尝试验证

2. ✅ **添加 client 配置**
   - 设置 `id_token_signed_response_alg: "HS256"`
   - 作为兜底配置，即使有 `id_token`，也使用正确的算法验证

3. ✅ **更新 profile 函数**
   - email 设为 `null`，因为不再使用 email scope

4. ✅ **清理检查**
   - 确认没有残留旧的 LineProvider 配置
   - 确认项目中不再引用 `next-auth/providers/line`

5. ✅ **更新版本号**
   - 版本号：`2025-11-26 18:35:28`

### 待验证的工作

1. ⏳ **LINE OAuth 登录功能测试**
   - 需要重启服务器后测试
   - 验证是否解决了 JWT 算法不匹配问题

2. ⏳ **回归测试**
   - Google OAuth 登录功能
   - 其他 OAuth 提供商功能

---

**报告生成时间**: 2025-11-26 18:35:28  
**报告生成工具**: Cursor AI Assistant  
**任务状态**: 代码修改完成，待测试验证

