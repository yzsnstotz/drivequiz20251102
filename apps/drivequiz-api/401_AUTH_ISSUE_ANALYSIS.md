# DriveQuiz API 401 认证失败问题排查报告

## 问题总结

根据代码排查，发现了导致 401 认证失败的几个关键问题：

## 🔍 根本原因分析

### 1. **环境变量名称不匹配** ⚠️ **最可能的原因**

**问题**：
- **客户端（datapull）** 使用的环境变量名：`DRIVEQUIZ_API_TOKEN`
- **服务端（drivequiz-api）** 期望的环境变量名：`DRIVEQUIZ_API_TOKEN_SECRET`

**代码证据**：
```22:35:apps/drivequiz-api/src/utils/auth.ts
export function verifyToken(token: string | null): boolean {
  if (!token) {
    return false;
  }

  const secret = process.env.DRIVEQUIZ_API_TOKEN_SECRET;
  if (!secret) {
    // 如果未配置密钥，拒绝所有请求
    return false;
  }

  // 简单验证：直接比较 Token（生产环境应使用 JWT）
  // 这里可以根据需要实现 JWT 验证
  return token === secret;
}
```

**影响**：
- 如果服务端没有配置 `DRIVEQUIZ_API_TOKEN_SECRET`，`secret` 将为 `undefined`
- `verifyToken` 函数会直接返回 `false`，导致所有请求返回 401

### 2. **Token 值不匹配**

**问题**：
- 客户端发送的 Token：`datapull_drivequiz_api_token_2025_secure_key_v1`
- 服务端期望的 Token：从 `DRIVEQUIZ_API_TOKEN_SECRET` 环境变量读取的值

**验证逻辑**：
```35:35:apps/drivequiz-api/src/utils/auth.ts
  return token === secret;
```

**影响**：
- 如果服务端配置的 `DRIVEQUIZ_API_TOKEN_SECRET` 值与客户端发送的 token 不完全匹配（区分大小写），验证会失败
- 字符串比较是严格的，任何差异（包括前后空格）都会导致失败

### 3. **Token 解析逻辑**

**代码**：
```9:15:apps/drivequiz-api/src/utils/auth.ts
export function readBearerToken(req: FastifyRequest): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.substring(7);
}
```

**潜在问题**：
- 使用 `substring(7)` 提取 token，没有 `trim()`
- 如果 Authorization header 格式不正确（如 "Bearer " 后有多余空格），可能导致 token 包含前导空格

**建议**：
- 虽然客户端日志显示格式正确，但建议在服务端添加 `trim()` 以提高健壮性

## 📋 排查步骤

### 步骤 1：检查服务端环境变量配置

```bash
# 进入 drivequiz-api 目录
cd apps/drivequiz-api

# 检查环境变量是否配置
grep DRIVEQUIZ_API_TOKEN_SECRET .env

# 或者直接查看环境变量值
node -e "require('dotenv').config(); console.log('DRIVEQUIZ_API_TOKEN_SECRET:', process.env.DRIVEQUIZ_API_TOKEN_SECRET || '❌ 未配置');"
```

**预期结果**：
- 如果返回 `❌ 未配置`，说明环境变量未设置，这是导致 401 的直接原因
- 如果返回了值，需要检查该值是否与客户端发送的 token 完全匹配

### 步骤 2：验证 Token 值匹配

**客户端发送的 Token**：
```
datapull_drivequiz_api_token_2025_secure_key_v1
```

**服务端期望的 Token**：
- 应该是 `.env` 文件中 `DRIVEQUIZ_API_TOKEN_SECRET` 的值
- 必须与客户端发送的 token **完全匹配**（区分大小写）

**验证方法**：
```bash
# 在服务端运行
node -e "
require('dotenv').config();
const clientToken = 'datapull_drivequiz_api_token_2025_secure_key_v1';
const serverToken = process.env.DRIVEQUIZ_API_TOKEN_SECRET || '';
console.log('客户端 Token:', clientToken);
console.log('服务端 Token:', serverToken);
console.log('是否匹配:', clientToken === serverToken);
console.log('Token 长度:', '客户端=' + clientToken.length, '服务端=' + serverToken.length);
"
```

### 步骤 3：添加调试日志（临时）

在 `apps/drivequiz-api/src/utils/auth.ts` 的 `verifyToken` 函数中添加调试日志：

```typescript
export function verifyToken(token: string | null): boolean {
  if (!token) {
    console.log('[Auth] Token is null or empty');
    return false;
  }

  const secret = process.env.DRIVEQUIZ_API_TOKEN_SECRET;
  if (!secret) {
    console.log('[Auth] DRIVEQUIZ_API_TOKEN_SECRET is not configured');
    return false;
  }

  console.log('[Auth] Token comparison:', {
    clientToken: token,
    clientTokenLength: token.length,
    serverToken: secret,
    serverTokenLength: secret.length,
    match: token === secret,
  });

  return token === secret;
}
```

## ✅ 解决方案

### 方案 1：统一环境变量名称（推荐）

**选项 A：修改服务端支持 `DRIVEQUIZ_API_TOKEN`**

修改 `apps/drivequiz-api/src/utils/auth.ts`：

```typescript
export function verifyToken(token: string | null): boolean {
  if (!token) {
    return false;
  }

  // 优先使用 DRIVEQUIZ_API_TOKEN_SECRET，兼容 DRIVEQUIZ_API_TOKEN
  const secret = process.env.DRIVEQUIZ_API_TOKEN_SECRET || process.env.DRIVEQUIZ_API_TOKEN;
  if (!secret) {
    return false;
  }

  return token.trim() === secret.trim();
}
```

**选项 B：修改客户端使用 `DRIVEQUIZ_API_TOKEN_SECRET`**

修改 datapull 客户端配置，将环境变量名从 `DRIVEQUIZ_API_TOKEN` 改为 `DRIVEQUIZ_API_TOKEN_SECRET`。

### 方案 2：确保服务端配置正确的 Token 值

在服务端的 `.env` 文件中设置：

```bash
DRIVEQUIZ_API_TOKEN_SECRET=datapull_drivequiz_api_token_2025_secure_key_v1
```

**注意**：确保值完全匹配，包括大小写。

### 方案 3：改进 Token 验证逻辑（增强健壮性）

修改 `apps/drivequiz-api/src/utils/auth.ts`：

```typescript
export function readBearerToken(req: FastifyRequest): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  // 添加 trim() 去除前后空格
  return authHeader.substring(7).trim();
}

export function verifyToken(token: string | null): boolean {
  if (!token) {
    return false;
  }

  const secret = process.env.DRIVEQUIZ_API_TOKEN_SECRET;
  if (!secret) {
    return false;
  }

  // 使用 trim() 比较，避免空格问题
  return token.trim() === secret.trim();
}
```

## 🎯 立即行动项

1. **检查服务端环境变量**：
   ```bash
   cd apps/drivequiz-api
   cat .env | grep DRIVEQUIZ_API_TOKEN_SECRET
   ```

2. **如果未配置，添加环境变量**：
   ```bash
   echo "DRIVEQUIZ_API_TOKEN_SECRET=datapull_drivequiz_api_token_2025_secure_key_v1" >> .env
   ```

3. **重启服务**：
   ```bash
   # 停止当前服务，然后重新启动
   npm run dev
   ```

4. **验证修复**：
   ```bash
   curl -X POST http://localhost:8789/api/v1/rag/docs/batch \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer datapull_drivequiz_api_token_2025_secure_key_v1" \
     -d '{"docs":[],"sourceId":"test"}'
   ```

## 📝 代码改进建议

1. **添加更详细的认证日志**：
   - 记录接收到的 token（脱敏处理）
   - 记录 token 比较结果
   - 记录验证失败的具体原因

2. **改进错误信息**：
   - 区分"未配置密钥"和"token 不匹配"两种情况
   - 提供更明确的错误提示

3. **增强健壮性**：
   - 添加 `trim()` 处理
   - 支持大小写不敏感比较（可选）
   - 支持多个 token（白名单机制）

## 🔗 相关文件

- `apps/drivequiz-api/src/utils/auth.ts` - 认证逻辑
- `apps/drivequiz-api/src/routes/docs-batch.ts` - 批量上传路由
- `apps/drivequiz-api/src/index.ts` - 服务启动和配置加载
- `apps/drivequiz-api/ENV_SETUP.md` - 环境变量配置文档

---

**报告生成时间**：2025-11-07  
**问题状态**：已定位根本原因，待修复

