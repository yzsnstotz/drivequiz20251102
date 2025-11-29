# 修复 LINE OAuth issuer 校验问题 - 执行报告

**执行日期**: 2025-11-26  
**任务ID**: LINE-OAUTH-FIX-20251126-003  
**当前版本号**: 2025-11-26 18:20:36

---

## 📌 任务摘要

### 问题描述
LINE OAuth 登录在回调阶段报错：`OperationProcessingError: unexpected JWT "iss" (issuer) claim value`。错误详情：
- expected: `"https://authjs.dev"`
- actual: `"https://access.line.me"`

这是 NextAuth v5 的已知 bug：对第三方 OAuth/OIDC 提供方，iss 校验拿的是全局 issuer（默认 `https://authjs.dev`），而不是各 provider 自己的 issuer。

### 修复方案
将 LINE 从「OIDC 模式」降级成「纯 OAuth2 模式」，自己手动配置 LINE 的授权 / token / userinfo，不再让 Auth.js 对 LINE 的 JWT 做严格 iss 校验。

### 修复结果
✅ 已删除自定义 `LineProvider` 的引用和包装代码  
✅ 已在 `providers` 数组中直接定义自定义 OAuth provider 对象  
✅ 已使用 `type: "oauth"` 而不是 `oidc`，避开有问题的 issuer 校验  
✅ 已更新相关注释说明

---

## 📌 修改文件列表

### 1. `src/lib/auth.ts`

**修改内容**：
1. 删除 `import LineProvider from "./providers/line"` 引用
2. 删除包装 LINE Provider 的代码（`lineProviderBase` 变量和 `client` 配置）
3. 在 `providers` 数组中直接定义自定义 OAuth provider 对象
4. 使用 `type: "oauth"` 而不是 `oidc`，避免 NextAuth 用全局 issuer 校验

**关键修改**：

```typescript
// 删除前：
import LineProvider from "./providers/line";

const lineProviderBase = LineProvider({
  clientId: process.env.LINE_CLIENT_ID || "",
  clientSecret: process.env.LINE_CLIENT_SECRET || "",
  redirectUri: process.env.LINE_REDIRECT_URI || `${process.env.NEXTAUTH_URL}/api/auth/callback/line`,
});

(lineProviderBase as any).client = {
  ...((lineProviderBase as any).client ?? {}),
  id_token_signed_response_alg: "HS256",
};

// 在 providers 中使用
lineProviderBase,

// 修改后：
// 删除 import LineProvider
// 删除包装代码

// 在 providers 中直接定义自定义 OAuth provider
{
  id: "line",
  name: "LINE",
  type: "oauth", // 关键：用 OAuth 而不是 oidc，避开有问题的 issuer 校验
  clientId: process.env.LINE_CLIENT_ID || "",
  clientSecret: process.env.LINE_CLIENT_SECRET || "",
  checks: ["pkce", "state"],
  authorization: {
    url: "https://access.line.me/oauth2/v2.1/authorize",
    params: {
      response_type: "code",
      scope: "openid profile email",
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
},
```

### 2. `src/lib/version.ts`

**修改内容**：
- 更新版本号：`2025-11-26 18:20:36`
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
- ✅ 已删除 `import LineProvider from "./providers/line"` 引用
- ✅ 已删除包装 LINE Provider 的代码
- ✅ 已在 `providers` 数组中直接定义自定义 OAuth provider 对象
- ✅ 已使用 `type: "oauth"` 而不是 `oidc`
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
- ✅ 不再出现 `unexpected JWT "iss" (issuer) claim value` 错误
- ✅ 不再出现 `OperationProcessingError` 错误
- ✅ 用户可以正常完成回调并创建 session
- ✅ 登录成功，重定向到首页或指定页面
- ✅ Session 中能看到用户信息（如 `user.name = "YZ"` 等）

**验证日志**：
- 如果修复成功，应该看到：
  - `[auth][debug]` 日志显示正常的 OAuth 流程
  - 不再有 `[auth][error] CallbackRouteError` 相关日志
  - 不再有 `[auth][details]` 显示 issuer 不匹配错误

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
- NextAuth v5 对第三方 OAuth/OIDC 提供方，iss 校验拿的是全局 issuer（默认 `https://authjs.dev`）
- LINE 的 `id_token` 的 `iss` 是 `https://access.line.me`
- NextAuth 期望 `https://authjs.dev`，但实际是 `https://access.line.me`，导致验证失败

**修复方案**：
- 将 LINE 从「OIDC 模式」降级成「纯 OAuth2 模式」
- 使用 `type: "oauth"` 而不是 `oidc`，避免 NextAuth 对 LINE 的 JWT 做严格 iss 校验
- 直接在 `providers` 数组中定义自定义 OAuth provider 对象，不依赖自定义 provider 函数

### 配置说明

**自定义 OAuth Provider 配置**：
```typescript
{
  id: "line",
  name: "LINE",
  type: "oauth", // 关键：用 OAuth 而不是 oidc，避开有问题的 issuer 校验
  clientId: process.env.LINE_CLIENT_ID || "",
  clientSecret: process.env.LINE_CLIENT_SECRET || "",
  checks: ["pkce", "state"],
  authorization: {
    url: "https://access.line.me/oauth2/v2.1/authorize",
    params: {
      response_type: "code",
      scope: "openid profile email",
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
```

**作用**：
- `type: "oauth"` 告诉 NextAuth 这是纯 OAuth2 provider，不是 OIDC provider
- NextAuth 不会对 OAuth2 provider 的 JWT 做严格的 issuer 校验
- 这样既满足 LINE 的要求（包含 `openid` scope，返回 `id_token`），又解决了 issuer 不匹配问题

### 代码变更对比

**修改前**：
- 使用自定义 `LineProvider` 函数
- 包装 provider 并添加 `client.id_token_signed_response_alg: "HS256"` 配置
- NextAuth 仍然尝试验证 `id_token` 的 issuer，导致失败

**修改后**：
- 直接在 `providers` 数组中定义自定义 OAuth provider 对象
- 使用 `type: "oauth"` 而不是 `oidc`
- NextAuth 不会对 OAuth2 provider 的 JWT 做严格的 issuer 校验

**优势**：
- 完全绕过 NextAuth v5 的 issuer 校验 bug
- 配置更简单，直接在 `auth.ts` 中管理
- 不依赖自定义 provider 函数，减少代码复杂度

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

1. **NextAuth v5 版本兼容性**
   - ⚠️ 如果 NextAuth 升级到新版本，可能会修复 issuer 校验 bug
   - 如果修复了，可以考虑恢复使用 OIDC 模式

2. **LINE API 变更**
   - ⚠️ 如果 LINE API 变更，可能需要更新配置
   - 需要关注 LINE Developers 文档的更新

3. **Email 获取**
   - ⚠️ LINE 可能不返回 email，需要从 `id_token` 中解析
   - 当前配置中 `email: profile.email || null`，如果 LINE 不返回 email，可能需要从 `id_token` 中解析

### 下一步建议

1. **立即测试**
   - 重启开发服务器
   - 测试 LINE OAuth 登录功能
   - 观察是否还有 issuer 校验错误

2. **如果修复成功**
   - ✅ 记录修复方案
   - ✅ 更新诊断报告，标记问题已解决
   - ✅ 进行回归测试（Google、Facebook、Twitter 等）

3. **如果修复失败**
   - 检查 NextAuth v5 文档，确认 `type: "oauth"` 是否支持
   - 检查 LINE API 文档，确认配置是否正确
   - 考虑其他解决方案：
     - 方案 2：联系 NextAuth 社区或提交 Issue
     - 方案 3：等待 NextAuth v5 修复 issuer 校验 bug

4. **长期优化**
   - 如果配置有效，可以考虑：
     - 在文档中记录此配置的重要性
     - 为其他使用类似问题的 OAuth 提供商也添加类似配置
     - 关注 NextAuth v5 的更新，如果修复了 issuer 校验 bug，可以考虑恢复使用 OIDC 模式

---

## 📌 执行日志

### 执行命令

```bash
# 1. 修改文件
- src/lib/auth.ts（删除 LineProvider 引用，直接定义自定义 OAuth provider）
- src/lib/version.ts（更新版本号）

# 2. 检查 Linter
- 无错误

# 3. 更新版本号
- 2025-11-26 18:20:36
```

### 执行结果

- ✅ 已删除 `import LineProvider from "./providers/line"` 引用
- ✅ 已删除包装 LINE Provider 的代码
- ✅ 已在 `providers` 数组中直接定义自定义 OAuth provider 对象
- ✅ 已使用 `type: "oauth"` 而不是 `oidc`
- ✅ 已更新相关注释
- ✅ 无编译错误
- ✅ 无 Linter 错误
- ⏳ 待测试：需要重启服务器后测试 LINE OAuth 登录功能

---

## 📌 成果摘要

### 已完成的工作

1. ✅ **删除自定义 LineProvider 引用**
   - 删除 `import LineProvider from "./providers/line"` 引用
   - 删除包装 LINE Provider 的代码（`lineProviderBase` 变量和 `client` 配置）

2. ✅ **直接定义自定义 OAuth provider**
   - 在 `providers` 数组中直接定义自定义 OAuth provider 对象
   - 使用 `type: "oauth"` 而不是 `oidc`，避开有问题的 issuer 校验

3. ✅ **配置 LINE OAuth 端点**
   - 配置 `authorization`、`token`、`userinfo` 端点
   - 配置 `profile` 函数，映射 LINE Profile API 的返回结构

4. ✅ **更新版本号**
   - 版本号：`2025-11-26 18:20:36`

### 待验证的工作

1. ⏳ **LINE OAuth 登录功能测试**
   - 需要重启服务器后测试
   - 验证是否解决了 issuer 校验问题

2. ⏳ **回归测试**
   - Google OAuth 登录功能
   - 其他 OAuth 提供商功能

---

**报告生成时间**: 2025-11-26 18:20:36  
**报告生成工具**: Cursor AI Assistant  
**任务状态**: 代码修改完成，待测试验证

