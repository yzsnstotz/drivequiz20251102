# 生产环境问题报告

**报告日期**: 2025-01-XX  
**报告人**: 研发团队  
**环境**: Vercel 生产环境

---

## 📋 问题概述

本报告汇总了两个在生产环境（Vercel）中发现的关键问题：

1. **后台问答日志无法访问数据库** - 生产环境无法查询 `ai_logs` 表，但本地服务可以正常访问
2. **JWT 实现问题** - 无法获取用户 `userId` 来区分用户

---

## 🔴 问题 1: Vercel 生产环境后台问答日志无法访问数据库

### 问题描述

- **现象**: 在 Vercel 生产环境中，后台问答日志（`/api/admin/ai/logs`）无法访问到数据库
- **本地环境**: 本地服务可以正常访问数据库
- **影响**: 管理员无法在生产环境查看问答日志，严重影响运维和数据分析

### 相关文件

#### 1. 后台日志 API 路由

**文件路径**: `apps/web/app/api/admin/ai/logs/route.ts`

**关键代码**:
```typescript
// 第 4 行：导入 AI 数据库连接
import { aiDb } from "@/lib/aiDb";

// 第 130-138 行：环境变量检查
export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    // 检查 AI_DATABASE_URL 环境变量是否配置
    if (!process.env.AI_DATABASE_URL) {
      console.error("[GET /api/admin/ai/logs] AI_DATABASE_URL environment variable is not configured");
      return internalError(
        "AI_DATABASE_URL environment variable is not configured. Please configure it in Vercel Dashboard for Preview/Production environments."
      );
    }

    // 第 192-202 行：数据库查询
    let base = aiDb
      .selectFrom("ai_logs")
      .select(fieldsWithSources);
    
    // ... 应用筛选条件
    
    // 第 316 行：执行查询
    const rows = await base.orderBy(sortColumn, sortOrder).limit(limit).offset(offset).execute();
```

**错误处理** (第 324-378 行):
- DNS 解析错误处理
- "Tenant or user not found" 错误处理
- 连接字符串验证

#### 2. AI 数据库连接配置

**文件路径**: `src/lib/aiDb.ts`

**关键代码**:
```typescript
// 第 130-138 行：获取连接字符串
function getAiConnectionString(): string {
  const connectionString = process.env.AI_DATABASE_URL;
  
  if (!connectionString) {
    return 'postgresql://placeholder:placeholder@placeholder:5432/placeholder';
  }
  
  return connectionString;
}

// 第 140-204 行：创建数据库实例
function createAiDbInstance(): Kysely<AiDatabase> {
  const connectionString = getAiConnectionString();

  const isPlaceholder = connectionString === 'postgresql://placeholder:placeholder@placeholder:5432/placeholder';
  
  if (isPlaceholder) {
    return createPlaceholderAiDb();
  }

  // 检测是否需要SSL连接（Supabase必须使用SSL）
  const isSupabase = connectionString && (
    connectionString.includes('supabase.com') || 
    connectionString.includes('supabase.co') ||
    connectionString.includes('sslmode=require')
  );

  // 创建 Pool 配置对象
  const poolConfig: {
    connectionString: string;
    ssl?: { rejectUnauthorized: boolean };
  } = {
    connectionString,
  };

  // Supabase 必须使用 SSL，但证书链可能有自签名证书
  if (isSupabase) {
    poolConfig.ssl = {
      rejectUnauthorized: false,
    };
  }

  // 创建 Pool 实例并传递给 PostgresDialect
  const pool = new Pool(poolConfig);
  const dialect = new PostgresDialect({
    pool,
  });

  return new Kysely<AiDatabase>({
    dialect,
  });
}
```

### 环境变量配置

**必需的环境变量**: `AI_DATABASE_URL`

**预期的连接字符串格式**:
```
postgresql://postgres:zKV0rtIV1QOByu89@db.cgpmpfnjzlzbquakmmrj.supabase.co:5432/postgres?sslmode=require
```

**数据库信息**:
- 数据库 ID: `cgpmpfnjzlzbquakmmrj`
- 密码: `zKV0rtIV1QOByu89`
- 连接方式: DIRECT（端口 5432）
- 主机: `db.cgpmpfnjzlzbquakmmrj.supabase.co`

### 可能的原因

1. **环境变量未配置**
   - Vercel Dashboard 中未配置 `AI_DATABASE_URL` 环境变量
   - 环境变量配置在错误的部署环境（例如只配置了 Preview，未配置 Production）

2. **连接字符串格式错误**
   - 使用了 Pooler 连接字符串（端口 6543）而不是 DIRECT 连接（端口 5432）
   - 用户名格式错误（Pooler 需要 `postgres.PROJECT_ID` 格式）

3. **SSL 证书问题**
   - Supabase 必须使用 SSL，但证书链可能有自签名证书
   - 代码中已设置 `rejectUnauthorized: false`，但可能还有其他 SSL 配置问题

4. **数据库暂停**
   - Supabase 免费版项目在非活动状态会自动暂停
   - 需要检查 Supabase Dashboard 确认数据库状态

5. **网络连接问题**
   - Vercel 服务器到 Supabase 数据库的网络连接问题
   - 防火墙或安全组规则阻止连接

### 诊断步骤

1. **检查 Vercel 环境变量**
   ```bash
   # 在 Vercel Dashboard 中检查：
   # Settings → Environment Variables → Production
   # 确认 AI_DATABASE_URL 已配置
   ```

2. **检查数据库连接**
   ```bash
   # 运行测试脚本
   NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/test-ai-database-connection.ts
   ```

3. **检查 Supabase 数据库状态**
   - 登录 Supabase Dashboard
   - 检查项目是否处于暂停状态
   - 如果暂停，需要恢复项目

4. **检查错误日志**
   - 查看 Vercel 部署日志
   - 查看 API 路由的错误响应
   - 检查是否有 DNS 解析错误或连接超时错误

### 相关文档

- `docs/VERCEL_DB_CONNECTION_CHECK.md` - Vercel 数据库连接配置文档
- `DATABASE_SEPARATION_REPORT.md` - 数据库分离报告
- `docs/AI_DATABASE_CONNECTION_INFO.md` - AI 数据库连接信息

---

## 🔴 问题 2: JWT 实现问题导致无法获取用户 UserId

### 问题描述

- **现象**: JWT 实现发生问题，导致无法从 JWT Token 中获取用户 `userId` 来区分用户
- **影响**: 
  - 无法正确识别用户身份
  - 无法按用户维度进行配额限制
  - 无法按用户维度进行日志记录和数据分析
  - 所有用户可能被识别为匿名用户

### 相关文件

#### 1. 主站 API - `/api/ai/ask`

**文件路径**: `src/app/api/ai/ask/route.ts`

**关键代码**:

**JWT 验证函数** (第 87-165 行):
```typescript
// ==== JWT 解析（RS256 公钥验证，缺省时退化为仅检测存在性）====
async function verifyJwt(authorization?: string): Promise<{ userId: string } | null> {
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  if (!token) return null;

  // 若未配置公钥，则尝试从 token 中解析 userId（仅用于开发/预览环境）
  if (!USER_JWT_PUBLIC_KEY) {
    try {
      const [header, payload, signature] = token.split(".");
      if (!header || !payload) return null;
      // 尝试解析 payload（不验证签名）
      const json = JSON.parse(atobUrlSafe(payload)) as { 
        sub?: string; 
        user_id?: string; 
        userId?: string;
        id?: string;
      };
      // 尝试多种可能的字段名
      const userId = json.sub || json.user_id || json.userId || json.id || null;
      if (!userId || typeof userId !== "string") return null;
      // 验证是否为有效的 UUID 格式
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(userId)) {
        return { userId };
      }
      // 如果不是 UUID 格式，返回 null（将被视为匿名用户）
      return null;
    } catch {
      // 如果解析失败，返回 null
      return null;
    }
  }

  // 配置了公钥：严格验证签名
  try {
    const [header, payload, signature] = token.split(".");
    if (!header || !payload || !signature) return null;

    const enc = new TextEncoder();
    const data = `${header}.${payload}`;
    const sig = base64UrlToUint8Array(signature);

    const pubKey = await crypto.subtle.importKey(
      "spki",
      pemToArrayBuffer(USER_JWT_PUBLIC_KEY),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );

    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      pubKey,
      sig,
      enc.encode(data),
    );
    if (!valid) return null;

    const json = JSON.parse(atobUrlSafe(payload)) as { 
      sub?: string; 
      user_id?: string; 
      userId?: string;
      id?: string;
    };
    // 尝试多种可能的字段名
    const userId = json.sub || json.user_id || json.userId || json.id || null;
    if (!userId || typeof userId !== "string") return null;
    // 验证是否为有效的 UUID 格式
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(userId)) {
      return { userId };
    }
    // 如果不是 UUID 格式，返回 null（将被视为匿名用户）
    return null;
  } catch {
    return null;
  }
}
```

**JWT 读取和验证** (第 202-246 行):
```typescript
// 1) 用户鉴权（JWT）- 支持多种方式：Bearer header、Cookie、query 参数
// 允许未登录用户匿名访问（使用匿名 ID）
let jwt: string | null = null;

// 1) Authorization: Bearer <jwt>
const authHeader = req.headers.get("authorization");
if (authHeader?.startsWith("Bearer ")) {
  jwt = authHeader.slice("Bearer ".length).trim();
}

// 2) Cookie（Supabase 前端可能使用）
if (!jwt) {
  try {
    const cookieJwt = req.cookies.get("sb-access-token")?.value;
    if (cookieJwt && cookieJwt.trim()) jwt = cookieJwt.trim();
  } catch {
    // Ignore cookie read errors
  }
}

// 3) Query 参数（?token=<jwt>，便于测试/脚本）
if (!jwt) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (token && token.trim()) jwt = token.trim();
  } catch {
    // Ignore URL parsing errors
  }
}

// 验证 JWT（如果提供了 token，否则使用匿名 ID）
let session: { userId: string } | null = null;
if (jwt) {
  session = await verifyJwt(`Bearer ${jwt}`);
  // 如果配置了公钥但验证失败，拒绝请求
  if (!session && USER_JWT_PUBLIC_KEY) {
    return err("AUTH_REQUIRED", "Invalid or expired authentication token.", 401);
  }
}

// 如果没有 token 或验证失败但未配置公钥，使用匿名 ID（允许未登录用户访问）
if (!session) {
  session = { userId: "anonymous" };
}
```

**环境变量** (第 48 行):
```typescript
const USER_JWT_PUBLIC_KEY = process.env.USER_JWT_PUBLIC_KEY; // PEM (RS256)；如使用别的方案，可替换 verifyJwt()
```

#### 2. 主站 API - `/api/ai/ask` (另一个版本)

**文件路径**: `apps/web/app/api/ai/ask/route.ts`

**关键代码**:

**JWT 读取函数** (第 85-111 行):
```typescript
/** 统一读取用户JWT：优先 Bearer，其次 Cookie，最后 query=token（便于 smoke 测试） */
function readUserJwt(req: NextRequest): string | null {
  // 1) Authorization: Bearer <jwt>
  const authHeader = req.headers.get("authorization");
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (token) return token;
  }

  // 2) Supabase Cookie（如果是前端页面请求）
  try {
    const cookieJwt = req.cookies.get("sb-access-token")?.value;
    if (cookieJwt && cookieJwt.trim()) return cookieJwt.trim();
  } catch {
    // Ignore cookie read errors
  }

  // 3) 兜底：?token=<jwt>（仅联调/脚本测试使用）
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (token && token.trim()) return token.trim();
  } catch {
    // Ignore URL parsing errors
  }

  return null;
}
```

**JWT 解析函数** (第 113-154 行):
```typescript
// 尝试从JWT解析 userId（不验证签名，仅为配额统计与透传；生产环境应使用服务端验证）
function unsafeDecodeJwtSub(jwt: string): string | null {
  try {
    const parts = jwt.split(".");
    if (parts.length < 2) return null;
    
    // 处理 base64url 解码（添加 padding 如果需要）
    let payloadBase64 = parts[1];
    const padding = (4 - (payloadBase64.length % 4)) % 4;
    if (padding > 0) {
      payloadBase64 += "=".repeat(padding);
    }
    
    // 替换 base64url 字符为 base64 字符
    payloadBase64 = payloadBase64.replace(/-/g, "+").replace(/_/g, "/");
    
    // 解码并解析 JSON
    const payloadStr = Buffer.from(payloadBase64, "base64").toString("utf8");
    const payload = JSON.parse(payloadStr) as { 
      sub?: string; 
      user_id?: string; 
      userId?: string;
      id?: string;
    };
    
    // 尝试多种可能的字段名
    const userId = payload.sub || payload.user_id || payload.userId || payload.id || null;
    if (!userId || typeof userId !== "string") return null;
    
    // 验证是否为有效的 UUID 格式（可选，但建议）
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(userId)) {
      return userId;
    }
    
    // 如果不是 UUID 格式，但仍然返回（可能是其他格式的 ID）
    return userId;
  } catch (e) {
    // 解析失败，返回 null
    return null;
  }
}
```

**使用 JWT** (第 210-228 行):
```typescript
// 1) 鉴权：用户 JWT（前端 -> 主站）
// 允许未登录用户匿名访问（使用匿名 ID）
const jwt = readUserJwt(req);
let userId: string | null = null;
let isAnonymous = false;

if (jwt) {
  userId = unsafeDecodeJwtSub(jwt);
  // 如果解析失败，但有 token，使用基于 token 的匿名ID
  if (!userId) {
    userId = generateAnonymousId(jwt);
    isAnonymous = true;
  }
} else {
  // 没有 token，使用默认匿名ID
  userId = "anonymous";
  isAnonymous = true;
}
```

#### 3. 聊天 API - `/api/ai/chat`

**文件路径**: `src/app/api/ai/chat/route.ts`

**关键代码**:

**JWT 验证函数** (第 112-157 行):
```typescript
async function verifyUserJwt(authorization?: string) {
  // 生产环境安全检查：必须配置 USER_JWT_SECRET
  if (isProduction()) {
    if (!USER_JWT_SECRET) {
      console.error("[Security] Production environment requires USER_JWT_SECRET");
      return { 
        valid: false, 
        reason: "SERVER_MISCONFIG" as const, 
        detail: "USER_JWT_SECRET is required in production environment" 
      };
    }
    // 生产环境必须提供有效的 Authorization header
    if (!authorization?.startsWith("Bearer ")) {
      return { valid: false, reason: "MISSING_BEARER" as const };
    }
  }
  
  // 开发或预览环境：如果未配置 USER_JWT_SECRET，允许跳过认证（仅用于本地测试和预览）
  if (!USER_JWT_SECRET) {
    if (isDevelopmentOrPreview()) {
      // 开发模式兜底：如果有 Bearer token，即使不验证也允许通过
      if (authorization?.startsWith("Bearer ")) {
        const token = authorization.slice("Bearer ".length).trim();
        if (token) {
          // 简单检查 token 是否存在，不验证签名（仅开发/预览模式）
          return { valid: true as const, payload: { sub: "dev-user" } };
        }
      }
      // 开发或预览环境允许跳过认证
      return { valid: true as const, payload: { sub: "anonymous-dev" } };
    }
    // 非开发/预览环境但未配置密钥，返回错误
    return { valid: false, reason: "SERVER_MISCONFIG" as const, detail: "USER_JWT_SECRET not set" };
  }

  if (!authorization?.startsWith("Bearer ")) return { valid: false, reason: "MISSING_BEARER" as const };

  const token = authorization.slice("Bearer ".length).trim();
  try {
    const secret = new TextEncoder().encode(USER_JWT_SECRET);
    const { payload } = await jwtVerify(token, secret); // 默认允许 HS256
    return { valid: true as const, payload };
  } catch (e) {
    return { valid: false as const, reason: "INVALID_TOKEN" as const };
  }
}
```

**环境变量** (第 8 行):
```typescript
const USER_JWT_SECRET = process.env.USER_JWT_SECRET; // HMAC 密钥（用户端 JWT 校验）
```

### 环境变量配置

#### 方案 1: RS256 公钥验证（用于 `/api/ai/ask`）

**环境变量**: `USER_JWT_PUBLIC_KEY`

**格式**: PEM 格式的公钥
```
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
-----END PUBLIC KEY-----
```

**重要说明**: 
- ✅ **这是 DriveQuiz 主应用的 JWT 公钥**，用于验证前端用户发送的 JWT Token
- ✅ 不是 AI Service 数据库的 JWT
- ✅ 用于验证用户身份（从 JWT Token 中提取 userId）
- ✅ **如果使用 Supabase Auth，应该使用 Supabase 的 JWT Public Key**（使用 RS256 算法）
- ✅ 代码中使用 RS256 算法验证：`RSASSA-PKCS1-v1_5` with `SHA-256`
- ✅ 如果使用 DriveQuiz 自己的用户系统，需要使用 DriveQuiz 用户系统的 JWT 公钥

**如何获取 Supabase JWT Public Key**:
1. 登录 Supabase Dashboard
2. 进入项目 → Settings → API
3. 在 "JWT Settings" 部分找到 "JWT Public Key"（PEM 格式）
4. 或者访问 JWKS 端点：`https://<project-id>.supabase.co/auth/v1/.well-known/jwks.json`
5. 复制公钥并配置到 Vercel Dashboard 的 `USER_JWT_PUBLIC_KEY` 环境变量

#### 方案 2: HMAC 密钥验证（用于 `/api/ai/chat`）

**环境变量**: `USER_JWT_SECRET`

**格式**: 字符串密钥（至少 32 个字符）

**重要说明**: 
- ✅ **这是 DriveQuiz 主应用的 JWT 密钥**，用于验证前端用户发送的 JWT Token
- ✅ 不是 AI Service 数据库的 JWT
- ✅ 用于验证用户身份（从 JWT Token 中提取 userId）
- ✅ **如果使用 Supabase Auth，应该使用 Supabase 的 Legacy JWT Secret**（使用 HS256 HMAC 算法）
- ✅ 代码中明确使用 HS256 算法验证：`jwtVerify(token, secret)`（默认允许 HS256）
- ✅ 如果使用 DriveQuiz 自己的用户系统，需要使用 DriveQuiz 用户系统的 JWT Secret

**如何获取 Supabase Legacy JWT Secret**:
1. 登录 Supabase Dashboard
2. 进入项目 → Settings → API
3. 在 "JWT Settings" 部分找到 "JWT Secret"（这是 Legacy JWT Secret）
4. 复制该值并配置到 Vercel Dashboard 的 `USER_JWT_SECRET` 环境变量

### 可能的原因

1. **环境变量未配置**
   - Vercel Dashboard 中未配置 `USER_JWT_PUBLIC_KEY` 或 `USER_JWT_SECRET`
   - 环境变量配置在错误的部署环境

2. **JWT Token 格式问题**
   - JWT Token 的 payload 中不包含 `sub`、`user_id`、`userId` 或 `id` 字段
   - JWT Token 的 payload 中的 `userId` 不是有效的 UUID 格式
   - JWT Token 的签名验证失败（如果配置了公钥或密钥）

3. **JWT Token 读取问题**
   - 前端未正确发送 Authorization header
   - Cookie 名称不匹配（代码中查找 `sb-access-token`）
   - JWT Token 在传输过程中被截断或损坏

4. **公钥/密钥不匹配**
   - `USER_JWT_PUBLIC_KEY` 与 JWT 签名使用的私钥不匹配
   - `USER_JWT_SECRET` 与 JWT 签名使用的密钥不匹配

5. **JWT Token 已过期**
   - JWT Token 的 `exp` 字段已过期
   - 验证函数可能没有正确处理过期情况

6. **Base64 解码问题**
   - JWT payload 的 base64url 解码失败
   - Padding 处理不正确

### 诊断步骤

1. **检查 Vercel 环境变量**
   ```bash
   # 在 Vercel Dashboard 中检查：
   # Settings → Environment Variables → Production
   # 确认 USER_JWT_PUBLIC_KEY 或 USER_JWT_SECRET 已配置
   ```

2. **检查 JWT Token 格式**
   ```javascript
   // 在浏览器控制台中解码 JWT Token
   const token = "your-jwt-token";
   const payload = JSON.parse(atob(token.split('.')[1]));
   console.log("JWT Payload:", payload);
   // 检查是否包含 sub, user_id, userId 或 id 字段
   ```

3. **检查 JWT Token 读取**
   - 检查前端是否正确发送 Authorization header
   - 检查 Cookie 是否正确设置
   - 检查网络请求中是否包含 JWT Token

4. **检查 JWT 验证逻辑**
   - 查看服务器日志中的 JWT 验证错误
   - 检查是否有 "Invalid token" 或 "Missing bearer" 错误

5. **测试 JWT 验证**
   ```bash
   # 使用 curl 测试 JWT 验证
   curl -X POST https://your-domain.vercel.app/api/ai/ask \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"question": "test"}'
   ```

### 相关文档

- `docs/VERCEL_PREVIEW_FIX.md` - Vercel Preview 环境 JWT 配置
- `docs/AI_TESTING_GUIDE.md` - AI 测试指南（包含 JWT 配置）
- `docs/AI_ARCHITECTURE.md` - AI 架构文档（包含 JWT 验证说明）

---

## 📊 问题对比

| 问题 | 环境变量 | 本地环境 | 生产环境 | 影响范围 |
|------|---------|---------|---------|---------|
| 数据库连接 | `AI_DATABASE_URL` | ✅ 正常 | ❌ 失败 | 后台日志查询 |
| JWT 验证 | `USER_JWT_PUBLIC_KEY`<br>`USER_JWT_SECRET` | ✅ 正常 | ❌ 失败 | 用户身份识别 |

---

## 🔧 建议的解决方案

### 问题 1: 数据库连接

1. **检查 Vercel 环境变量配置**
   - 登录 Vercel Dashboard
   - 进入项目 → Settings → Environment Variables
   - 确认 `AI_DATABASE_URL` 已配置在 Production 环境
   - 确认连接字符串格式正确

2. **验证数据库连接字符串**
   ```bash
   # 正确的 DIRECT 连接字符串格式
   postgresql://postgres:zKV0rtIV1QOByu89@db.cgpmpfnjzlzbquakmmrj.supabase.co:5432/postgres?sslmode=require
   ```

3. **检查 Supabase 数据库状态**
   - 登录 Supabase Dashboard
   - 检查项目是否处于暂停状态
   - 如果暂停，需要恢复项目

4. **重新部署**
   - 在 Vercel Dashboard 中重新部署项目
   - 确保环境变量已正确注入

### 问题 2: JWT 验证

1. **检查 Vercel 环境变量配置**
   - 登录 Vercel Dashboard
   - 进入项目 → Settings → Environment Variables
   - 确认 `USER_JWT_PUBLIC_KEY` 或 `USER_JWT_SECRET` 已配置在 Production 环境

2. **验证 JWT Token 格式**
   - 检查前端生成的 JWT Token 是否包含正确的 payload
   - 确认 payload 中包含 `sub` 字段（用户 ID）

3. **统一 JWT 验证方案**
   - 确认使用哪种 JWT 验证方案（RS256 或 HMAC）
   - 确保前端和后端使用相同的验证方案

4. **添加调试日志**
   - 在 JWT 验证函数中添加详细的日志
   - 记录 JWT Token 的解析过程和验证结果

---

## 📝 需要研发工程师确认的事项

1. **数据库连接问题**
   - [ ] 确认 Vercel Dashboard 中 `AI_DATABASE_URL` 环境变量的值
   - [ ] 确认连接字符串格式是否正确（DIRECT vs Pooler）
   - [ ] 确认 Supabase 数据库是否处于活动状态
   - [ ] 确认网络连接是否正常

2. **JWT 验证问题**
   - [ ] 确认前端使用的 JWT 签名算法（RS256 还是 HMAC）
   - [ ] 确认 JWT Token 的 payload 结构
   - [ ] 确认 Vercel Dashboard 中 `USER_JWT_PUBLIC_KEY` 或 `USER_JWT_SECRET` 的值
   - [ ] 确认前端是否正确发送 JWT Token

3. **环境差异**
   - [ ] 确认本地环境和生产环境的配置差异
   - [ ] 确认是否有其他环境变量影响这两个功能

---

## 📚 相关文件清单

### 数据库连接相关
- `src/lib/aiDb.ts` - AI 数据库连接配置
- `apps/web/app/api/admin/ai/logs/route.ts` - 后台日志 API 路由
- `docs/VERCEL_DB_CONNECTION_CHECK.md` - Vercel 数据库连接配置文档
- `DATABASE_SEPARATION_REPORT.md` - 数据库分离报告

### JWT 验证相关
- `src/app/api/ai/ask/route.ts` - 主站 AI 问答 API（使用 RS256 公钥验证）
- `apps/web/app/api/ai/ask/route.ts` - 主站 AI 问答 API（使用不验证签名方式）
- `src/app/api/ai/chat/route.ts` - 聊天 API（使用 HMAC 密钥验证）
- `docs/VERCEL_PREVIEW_FIX.md` - Vercel Preview 环境 JWT 配置
- `docs/AI_TESTING_GUIDE.md` - AI 测试指南

---

## 🔍 调试建议

1. **启用详细日志**
   - 在关键位置添加 `console.log` 或使用日志库
   - 记录环境变量值（隐藏敏感信息）
   - 记录 JWT Token 的解析过程
   - 记录数据库连接过程

2. **使用测试脚本**
   - 运行 `scripts/test-ai-database-connection.ts` 测试数据库连接
   - 运行 `scripts/test-ai-ask.sh` 测试 JWT 验证

3. **检查 Vercel 日志**
   - 查看 Vercel Dashboard 中的函数日志
   - 查看 API 路由的错误响应
   - 检查是否有网络错误或超时错误

---

**报告结束**

