# AI 数据库连接信息

## 📊 数据库连接对比

### 1. ai_config 表

**API 路由**: `src/app/api/admin/ai/config/route.ts`

**数据库连接方式**:
- ✅ **使用直接数据库连接** (Kysely)
- ✅ **连接来源**: `import { db } from "@/lib/db"`
- ✅ **环境变量**: `DATABASE_URL` 或 `POSTGRES_URL`
- ❌ **不使用** Supabase REST API

**连接配置**:
```typescript
// src/lib/db.ts
function getConnectionString(): string {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  // ...
}
```

**当前连接字符串格式**:
```
DATABASE_URL=postgres://postgres.vdtnzjvmvrcdplawwiae:tcaZ6b577mojAkYw@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require
```

**数据库实例**:
- 主机: `aws-1-ap-southeast-1.pooler.supabase.com`
- 端口: `6543` (连接池)
- 用户名: `postgres.vdtnzjvmvrcdplawwiae`
- 数据库: `postgres`
- 项目 ID: `vdtnzjvmvrcdplawwiae`

**问题**: 
- ⚠️ 指向主应用的数据库（driveapp），而不是 AI Service 的数据库
- ⚠️ 使用连接池连接，可能导致某些操作失败

---

### 2. ai_logs 表

**API 路由**: `src/app/api/admin/ai/logs/route.ts`

**数据库连接方式**:
- ✅ **使用直接数据库连接** (Kysely)
- ✅ **连接来源**: `import { db } from "@/lib/db"`
- ✅ **环境变量**: `DATABASE_URL` 或 `POSTGRES_URL`
- ❌ **不使用** Supabase REST API（读取时）

**连接配置**:
```typescript
// src/lib/db.ts
function getConnectionString(): string {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  // ...
}
```

**当前连接字符串格式**:
```
DATABASE_URL=postgres://postgres.vdtnzjvmvrcdplawwiae:tcaZ6b577mojAkYw@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require
```

**数据库实例**:
- 主机: `aws-1-ap-southeast-1.pooler.supabase.com`
- 端口: `6543` (连接池)
- 用户名: `postgres.vdtnzjvmvrcdplawwiae`
- 数据库: `postgres`
- 项目 ID: `vdtnzjvmvrcdplawwiae`

**写入方式** (AI Service):
- ✅ **使用 Supabase REST API** (AI Service 写入时)
- ✅ **环境变量**: `SUPABASE_URL` + `SUPABASE_SERVICE_KEY`
- ✅ **代码位置**: `apps/ai-service/src/lib/dbLogger.ts`

**写入示例**:
```typescript
// apps/ai-service/src/lib/dbLogger.ts
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

await fetch(`${SUPABASE_URL}/rest/v1/ai_logs`, {
  method: "POST",
  headers: {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(payload),
});
```

---

## 🔍 问题分析

### 当前情况

1. **ai_config** 和 **ai_logs** 都使用相同的数据库连接（`DATABASE_URL`）
2. **DATABASE_URL** 指向主应用的数据库（driveapp）
3. 但根据用户说明，**AI Service 的数据库**是另一个数据库实例

### 不一致之处

- **读取 ai_logs**: 使用 `DATABASE_URL` (主应用数据库)
- **写入 ai_logs** (AI Service): 使用 `SUPABASE_URL` (AI Service 数据库)
- **ai_config**: 使用 `DATABASE_URL` (主应用数据库)

如果 `SUPABASE_URL` 和 `DATABASE_URL` 指向不同的数据库实例，会导致：
- ❌ 写入和读取的数据不一致
- ❌ ai_config 表在错误的数据库中

---

## ✅ 解决方案

### 方案 1: 统一使用 Supabase REST API（推荐）

将 `ai_config` 改为使用 Supabase REST API，与 AI Service 一致：

```typescript
// 使用 SUPABASE_URL + SUPABASE_SERVICE_KEY
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";

// GET 请求
const res = await fetch(`${SUPABASE_URL}/rest/v1/ai_config?key=in.(dailyAskLimit,answerCharLimit,model,cacheTtl,costAlertUsdThreshold)`, {
  headers: {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  },
});

// PUT 请求（UPSERT）
const res = await fetch(`${SUPABASE_URL}/rest/v1/ai_config`, {
  method: "POST",
  headers: {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "resolution=merge-duplicates",
  },
  body: JSON.stringify({
    key: "dailyAskLimit",
    value: "10",
    updated_by: adminInfo.id,
    updated_at: new Date().toISOString(),
  }),
});
```

### 方案 2: 创建独立的数据库连接

如果必须使用直接数据库连接，创建独立的连接配置：

```typescript
// 使用 AI_DATABASE_URL 环境变量
const AI_DATABASE_URL = process.env.AI_DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
```

---

## 📝 环境变量清单

### 主应用数据库（当前）
- `DATABASE_URL` - 主应用数据库连接字符串

### AI Service 数据库（需要）
- `SUPABASE_URL` - Supabase 项目 URL
- `SUPABASE_SERVICE_KEY` - Supabase 服务密钥

### 验证
- 检查 `SUPABASE_URL` 和 `DATABASE_URL` 是否指向同一个数据库
- 如果不同，需要统一或明确区分

