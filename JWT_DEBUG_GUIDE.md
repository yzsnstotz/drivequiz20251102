# JWT UserID 调试指南

## 📋 概述

已添加详细的调试日志到 `/api/ai/ask` 路由，用于排查 userid 为 null 的问题。

## 🔍 如何查看调试日志

### 1. 在 Vercel Dashboard 中查看日志

1. 登录 Vercel Dashboard
2. 进入项目页面
3. 点击 **Functions** 标签
4. 找到 `/api/ai/ask` 路由
5. 点击查看日志
6. 搜索 `[JWT Debug]` 标签

### 2. 使用 Vercel CLI 查看日志

```bash
# 安装 Vercel CLI（如果还没有）
npm i -g vercel

# 登录
vercel login

# 查看实时日志
vercel logs --follow
```

## 📊 调试日志说明

### 日志标签：`[JWT Debug]`

所有 JWT 相关的调试日志都带有 `[JWT Debug]` 标签，便于搜索和过滤。

### 关键日志点

#### 1. JWT 提取阶段

```
[JWT Debug] JWT extraction result
```
- `hasJwt`: 是否找到 JWT token
- `jwtLength`: JWT token 长度
- `jwtPrefix`: JWT token 前20个字符（用于识别）
- `hasSecret`: 是否配置了 USER_JWT_SECRET

**可能的问题：**
- 如果 `hasJwt: false`，说明前端没有发送 JWT token
- 如果 `hasSecret: false`，说明环境变量未配置

#### 2. verifyJwt 函数调用

```
[JWT Debug] verifyJwt called
```
- `hasAuth`: 是否有 authorization header
- `authPrefix`: authorization header 前20个字符
- `hasSecret`: 是否配置了 USER_JWT_SECRET
- `isProduction`: 是否为生产环境
- `isDevOrPreview`: 是否为开发/预览环境

#### 3. JWT 验证过程

##### 如果未配置 USER_JWT_SECRET

```
[JWT Debug] USER_JWT_SECRET not configured
[JWT Debug] Dev mode: parsed payload
```
- `hasSub`, `hasUser_id`, `hasUserId`, `hasId`: 检查 payload 中是否有这些字段
- `payloadKeys`: payload 中的所有字段名

##### 如果配置了 USER_JWT_SECRET

```
[JWT Debug] Secret decoded as Base64 / Secret used as raw string
[JWT Debug] JWT verification successful
[JWT Debug] Extracted userId
[JWT Debug] Valid UUID userId found / userId is not UUID format
```

**关键信息：**
- `secretType`: 密钥类型（base64 或 raw）
- `payloadKeys`: payload 中的所有字段名
- `hasSub`, `hasUser_id`, `hasUserId`, `hasId`: 检查是否有这些字段
- `userId`: 提取的 userId 值
- `type`: userId 的类型

#### 4. 验证结果

```
[JWT Debug] verifyJwt result
```
- `hasSession`: 是否成功验证
- `userId`: 提取的 userId（如果成功）

#### 5. 最终会话

```
[JWT Debug] Final session
```
- `userId`: 最终使用的 userId（可能是 "anonymous"）

#### 6. 转发到 AI-Service

```
[JWT Debug] Forwarding to AI-Service
```
- `originalUserId`: 原始 userId（可能是 "anonymous"）
- `forwardedUserId`: 转发给 AI-Service 的 userId（null 如果 anonymous）
- `isAnonymous`: 是否为匿名用户

## 🔧 常见问题排查

### 问题 1: JWT token 未发送

**日志显示：**
```
[JWT Debug] JWT extraction result { hasJwt: false, ... }
[JWT Debug] No JWT token provided
```

**解决方案：**
1. 检查前端是否正确发送 JWT token
2. 检查 localStorage 中是否有 `USER_TOKEN`
3. 检查前端代码是否正确设置 `Authorization` header

### 问题 2: USER_JWT_SECRET 未配置

**日志显示：**
```
[JWT Debug] JWT extraction result { hasSecret: false, ... }
[JWT Debug] USER_JWT_SECRET not configured
```

**解决方案：**
1. 在 Vercel Dashboard 中配置 `USER_JWT_SECRET` 环境变量
2. 确保环境变量已应用到正确的环境（Production/Preview/Development）
3. 触发重新部署以读取新环境变量

### 问题 3: JWT 验证失败

**日志显示：**
```
[JWT Debug] JWT verification failed
```

**详细信息会显示：**
- `error`: 错误消息
- `errorName`: 错误类型
- `stack`: 错误堆栈（前200字符）

**可能的原因：**
1. JWT token 签名不匹配（密钥不正确）
2. JWT token 已过期
3. JWT token 格式错误

**解决方案：**
1. 检查 `USER_JWT_SECRET` 是否正确
2. 检查 JWT token 是否过期
3. 检查 JWT token 格式是否正确

### 问题 4: userId 字段不存在

**日志显示：**
```
[JWT Debug] Dev mode: parsed payload { hasSub: false, hasUser_id: false, ... }
[JWT Debug] Dev mode: no userId found in payload
```

**解决方案：**
1. 检查 JWT payload 中是否有 `sub`、`user_id`、`userId` 或 `id` 字段
2. 如果字段名不同，需要修改代码以支持该字段名

### 问题 5: userId 不是 UUID 格式

**日志显示：**
```
[JWT Debug] Extracted userId { userId: "some-id", ... }
[JWT Debug] userId is not UUID format
```

**解决方案：**
1. 检查 JWT payload 中的 userId 字段值
2. 如果 userId 不是 UUID 格式，可能需要修改代码以支持其他格式
3. 或者确保 Supabase 生成的 JWT token 包含有效的 UUID

### 问题 6: 验证成功但 userId 仍为 null

**日志显示：**
```
[JWT Debug] verifyJwt result { hasSession: true, userId: "xxx-xxx-xxx" }
[JWT Debug] Final session { userId: "xxx-xxx-xxx" }
[JWT Debug] Forwarding to AI-Service { forwardedUserId: null, ... }
```

**可能的原因：**
- 代码逻辑问题：userId 被错误地设置为 null

**解决方案：**
- 检查代码中是否有逻辑错误

## 📝 完整排查流程

1. **查看第一条日志**：`[JWT Debug] JWT extraction result`
   - 确认 JWT token 是否被提取
   - 确认 USER_JWT_SECRET 是否配置

2. **查看验证日志**：`[JWT Debug] verifyJwt called`
   - 确认环境类型（生产/开发/预览）
   - 确认是否有 authorization header

3. **查看验证结果**：`[JWT Debug] verifyJwt result`
   - 确认验证是否成功
   - 确认是否提取到 userId

4. **查看最终会话**：`[JWT Debug] Final session`
   - 确认最终使用的 userId

5. **查看转发日志**：`[JWT Debug] Forwarding to AI-Service`
   - 确认转发给 AI-Service 的 userId

## 🎯 下一步

根据日志信息，确定问题所在：

1. **如果 JWT token 未发送**：检查前端代码
2. **如果 USER_JWT_SECRET 未配置**：在 Vercel Dashboard 中配置
3. **如果 JWT 验证失败**：检查密钥和 token 是否匹配
4. **如果 userId 字段不存在**：检查 JWT payload 结构
5. **如果 userId 不是 UUID 格式**：检查 Supabase 配置或修改代码

## 📞 需要帮助？

如果问题仍未解决，请提供以下信息：

1. 完整的调试日志（从 `[JWT Debug]` 开始的所有日志）
2. JWT token 的前20个字符（用于识别，不要提供完整 token）
3. 环境信息（生产/预览/开发）
4. USER_JWT_SECRET 是否已配置

