# USER_JWT_SECRET 用户身份验证说明

## ✅ 答案：是的，设置后可以读取用户身份

如果设置了 `USER_JWT_SECRET`，并且请求中包含了有效的 JWT token，系统就可以正确验证并读取用户身份。

---

## 🔍 工作流程

### 1. 未设置 USER_JWT_SECRET（当前状态）

**流程**:
```
请求 → 检查 JWT → 未设置密钥 → 跳过验证 → 使用匿名用户 (anonymous)
```

**结果**:
- ❌ 无法验证 JWT 签名
- ❌ 无法确认用户身份
- ✅ 使用匿名用户 ID (`anonymous`)
- ✅ API 可以正常工作

### 2. 设置了 USER_JWT_SECRET（推荐）

**流程**:
```
请求 → 检查 JWT → 使用密钥验证签名 → 提取用户 ID → 使用真实用户身份
```

**结果**:
- ✅ 验证 JWT 签名（确保 token 未被篡改）
- ✅ 确认用户身份
- ✅ 使用真实的用户 ID（从 JWT payload 中提取）
- ✅ 可以基于用户身份进行个性化处理

---

## 📋 详细验证流程

### 步骤 1: 获取 JWT Token

系统支持多种方式获取 JWT token：

1. **Authorization Header**（推荐）
   ```
   Authorization: Bearer <jwt-token>
   ```

2. **Cookie**
   - `USER_TOKEN` cookie
   - `sb-access-token` cookie（Supabase 兼容）

3. **Query 参数**（测试用）
   ```
   ?token=<jwt-token>
   ```

### 步骤 2: 验证 JWT（如果设置了 USER_JWT_SECRET）

**代码逻辑** (`src/app/api/ai/ask/route.ts` 第 304 行):

```typescript
// 使用 USER_JWT_SECRET 验证 JWT 签名
const { payload } = await jwtVerify(token, secret);

// 从 payload 中提取用户 ID（支持多种字段名）
const userId = payload.sub || payload.user_id || payload.userId || payload.id || null;
```

**支持的字段名**:
- `sub`（标准 JWT 字段，Supabase 使用）
- `user_id`
- `userId`
- `id`

### 步骤 3: 验证用户 ID 格式

**代码逻辑** (第 319-325 行):

```typescript
// 验证是否为有效的 UUID 格式
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (uuidRegex.test(userId)) {
  return { userId }; // ✅ 返回真实用户 ID
}
// 如果不是 UUID 格式，返回 null（将被视为匿名用户）
return null;
```

### 步骤 4: 使用用户身份

**代码逻辑** (第 801-821 行):

```typescript
// 验证 JWT
session = await verifyJwt(`Bearer ${jwt}`);

if (session) {
  console.log(`[STEP 1.6] JWT验证成功: ${session.userId}`);
  // ✅ 使用真实用户 ID
} else {
  console.warn(`[STEP 1.6] JWT验证失败`);
}

// 如果没有 session，使用匿名 ID
if (!session) {
  session = { userId: "anonymous" };
  console.log(`[STEP 1.7] 使用匿名ID`);
}
```

---

## 🎯 对比：设置 vs 不设置

| 场景 | 未设置 USER_JWT_SECRET | 设置 USER_JWT_SECRET |
|------|----------------------|-------------------|
| **JWT 验证** | ❌ 跳过验证（仅解析 payload） | ✅ 完整验证签名 |
| **安全性** | ⚠️ 低（无法确认 token 真实性） | ✅ 高（验证签名） |
| **用户身份** | ❌ 匿名用户 (`anonymous`) | ✅ 真实用户 ID |
| **个性化** | ❌ 无法基于用户身份处理 | ✅ 可以基于用户身份处理 |
| **配额管理** | ⚠️ 所有用户共享配额 | ✅ 每个用户独立配额 |
| **日志记录** | ⚠️ 无法追踪真实用户 | ✅ 可以追踪真实用户 |

---

## 📊 实际使用示例

### 示例 1: 未设置 USER_JWT_SECRET

**请求**:
```bash
curl -X POST http://localhost:3000/api/ai/ask \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{"question": "测试问题"}'
```

**日志输出**:
```
[STEP 1.6] 开始验证标准JWT
[STEP 1.6] JWT验证失败
[STEP 1.7] 使用匿名ID
[STEP 1.8] 会话信息 { userId: 'anonymous', isAnonymous: true }
```

**结果**: 使用匿名用户

---

### 示例 2: 设置了 USER_JWT_SECRET

**请求**:
```bash
curl -X POST http://localhost:3000/api/ai/ask \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{"question": "测试问题"}'
```

**日志输出**:
```
[STEP 1.6] 开始验证标准JWT
[STEP 1.6] JWT验证成功: 123e4567-e89b-12d3-a456-426614174000
[STEP 1.8] 会话信息 { userId: '123e4567-e89b-12d3-a456-426614174000', isAnonymous: false }
```

**结果**: 使用真实用户 ID

---

## 🔧 如何设置 USER_JWT_SECRET

### 1. 获取 JWT Secret

**如果使用 Supabase**:
```bash
# Supabase JWT Secret 通常是 Base64 编码的
# 可以在 Supabase Dashboard > Settings > API 中找到
# 格式：your-supabase-jwt-secret (Base64 编码)
```

**如果使用自定义 JWT**:
```bash
# 生成一个安全的随机字符串（至少 32 字符）
openssl rand -base64 32
```

### 2. 添加到 `.env.local`

```bash
# 用户 JWT 密钥（用于用户认证）
USER_JWT_SECRET=your-jwt-secret-here
```

### 3. 重启开发服务器

```bash
# 停止当前服务器（Ctrl+C）
npm run dev
```

---

## ✅ 验证设置是否生效

### 测试 1: 检查环境变量

```bash
node -e "require('dotenv').config({ path: '.env.local' }); console.log('USER_JWT_SECRET:', process.env.USER_JWT_SECRET ? '已设置 ✅' : '未设置 ❌');"
```

### 测试 2: 使用有效 JWT Token 测试

```bash
# 使用真实的 JWT token（从 Supabase 或其他认证服务获取）
curl -X POST http://localhost:3000/api/ai/ask \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-valid-jwt-token>" \
  -d '{"question": "测试问题"}'
```

**预期日志**:
```
[STEP 1.6] JWT验证成功: <user-id>
[STEP 1.8] 会话信息 { userId: '<user-id>', isAnonymous: false }
```

### 测试 3: 使用无效 JWT Token 测试

```bash
# 使用无效的 JWT token
curl -X POST http://localhost:3000/api/ai/ask \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid-token" \
  -d '{"question": "测试问题"}'
```

**预期日志**（开发环境）:
```
[STEP 1.6] JWT验证失败
[STEP 1.7] 使用匿名ID
```

**预期日志**（生产环境）:
```
[STEP 1.6] JWT验证失败
[STEP 1.6] 生产环境JWT验证失败，返回401
```

---

## 📌 总结

### ✅ 设置 USER_JWT_SECRET 的好处

1. **安全性提升**: 验证 JWT 签名，确保 token 未被篡改
2. **用户身份识别**: 可以读取真实的用户 ID
3. **个性化处理**: 可以基于用户身份进行个性化处理
4. **配额管理**: 每个用户独立配额管理
5. **日志追踪**: 可以追踪真实用户的操作

### ⚠️ 注意事项

1. **JWT Token 格式**: 必须是有效的 JWT 格式（`header.payload.signature`）
2. **用户 ID 格式**: 必须是有效的 UUID 格式
3. **Secret 匹配**: `USER_JWT_SECRET` 必须与生成 JWT 时使用的 secret 匹配
4. **生产环境**: 生产环境必须设置 `USER_JWT_SECRET`

### 🎯 推荐做法

**本地开发**:
- ✅ 可以设置 `USER_JWT_SECRET` 来测试用户认证流程
- ✅ 也可以不设置，使用匿名用户进行快速测试

**生产环境**:
- ⚠️ **必须设置** `USER_JWT_SECRET`
- ⚠️ 确保使用安全的随机字符串
- ⚠️ 不要将 secret 提交到 Git 仓库

---

## 🔍 相关代码位置

- **JWT 验证函数**: `src/app/api/ai/ask/route.ts` 第 232-337 行
- **用户身份提取**: `src/app/api/ai/ask/route.ts` 第 775-821 行
- **环境变量定义**: `src/app/api/ai/ask/route.ts` 第 98 行

