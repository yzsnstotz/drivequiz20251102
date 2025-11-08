# 数据库环境变量统一性检查报告

**检查时间**：2025-11-07  
**检查范围**：`apps/drivequiz-api` 项目

---

## 📋 检查结果

### ✅ 环境变量名称使用情况

**当前 `.env` 文件中的变量名**：
```bash
DRIVEQUIZ_DB_URL=postgresql://postgres:zKV0rtIV1QOByu89@db.cgpmpfnjzlzbquakmmrj.supabase.co:5432/postgres?sslmode=require
```

**代码中使用的变量名优先级**：

1. **`DRIVEQUIZ_DB_URL`** ✅ **首选**（当前使用）
2. **`DATABASE_URL`** ⚠️ 兼容（后备选项）
3. **`POSTGRES_URL`** ⚠️ 兼容（后备选项）

---

## 🔍 代码实现分析

### 1. 配置加载 (`src/index.ts`)

```45:58:apps/drivequiz-api/src/index.ts
  if (!DRIVEQUIZ_DB_URL && !process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    errors.push("DRIVEQUIZ_DB_URL, DATABASE_URL, or POSTGRES_URL");
  }
  if (!AI_VECTORIZE_URL) errors.push("AI_VECTORIZE_URL");

  if (errors.length) {
    throw new Error(`Missing required environment variables: ${errors.join(", ")}`);
  }

  return {
    port: Number(PORT || 8788),
    host: HOST || "0.0.0.0",
    apiTokenSecret: DRIVEQUIZ_API_TOKEN_SECRET as string,
    dbUrl: DRIVEQUIZ_DB_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || "",
```

**优先级顺序**：
1. `DRIVEQUIZ_DB_URL`（首选）
2. `DATABASE_URL`（后备）
3. `POSTGRES_URL`（后备）

---

### 2. 数据库连接 (`src/lib/db.ts`)

```64:77:apps/drivequiz-api/src/lib/db.ts
function getConnectionString(): string {
  const connectionString =
    process.env.DRIVEQUIZ_DB_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL;

  if (!connectionString) {
    throw new Error(
      "Missing database connection string. Please set DRIVEQUIZ_DB_URL, DATABASE_URL, or POSTGRES_URL"
    );
  }

  return connectionString;
}
```

**优先级顺序**：
1. `DRIVEQUIZ_DB_URL`（首选）
2. `DATABASE_URL`（后备）
3. `POSTGRES_URL`（后备）

---

### 3. 迁移脚本 (`scripts/migrate.ts`)

```15:28:apps/drivequiz-api/scripts/migrate.ts
function getConnectionString(): string {
  const connectionString =
    process.env.DRIVEQUIZ_DB_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL;

  if (!connectionString) {
    throw new Error(
      "Missing database connection string. Please set DRIVEQUIZ_DB_URL, DATABASE_URL, or POSTGRES_URL"
    );
  }

  return connectionString;
}
```

**优先级顺序**：
1. `DRIVEQUIZ_DB_URL`（首选）
2. `DATABASE_URL`（后备）
3. `POSTGRES_URL`（后备）

---

## ✅ 统一性结论

### 当前状态

✅ **已统一使用 `DRIVEQUIZ_DB_URL`**

- `.env` 文件中使用：`DRIVEQUIZ_DB_URL`
- 代码中首选：`DRIVEQUIZ_DB_URL`
- 所有相关文件都遵循相同的优先级顺序

### 兼容性说明

⚠️ **代码支持多个变量名，但建议统一使用 `DRIVEQUIZ_DB_URL`**

**支持的变量名**（按优先级）：
1. `DRIVEQUIZ_DB_URL` ✅ **推荐使用**
2. `DATABASE_URL` ⚠️ 兼容（常见于 Vercel、Heroku 等平台）
3. `POSTGRES_URL` ⚠️ 兼容（常见于某些部署平台）

**为什么支持多个变量名？**
- 兼容不同的部署平台（Vercel 使用 `DATABASE_URL`，Heroku 也使用 `DATABASE_URL`）
- 提供灵活性，便于在不同环境中使用不同的变量名
- 但为了统一性和可维护性，建议统一使用 `DRIVEQUIZ_DB_URL`

---

## 📝 建议

### 1. 保持当前配置 ✅

**当前配置是正确的**：
- `.env` 文件中使用 `DRIVEQUIZ_DB_URL`
- 代码中优先使用 `DRIVEQUIZ_DB_URL`
- 所有相关文件都遵循相同的优先级顺序

**无需修改** ✅

---

### 2. 文档说明

建议在文档中明确说明：

1. **推荐使用**：`DRIVEQUIZ_DB_URL`
2. **兼容支持**：`DATABASE_URL` 和 `POSTGRES_URL`（用于特定部署平台）
3. **优先级顺序**：`DRIVEQUIZ_DB_URL` > `DATABASE_URL` > `POSTGRES_URL`

---

### 3. 环境变量命名规范

**当前项目的环境变量命名规范**：

| 用途 | 变量名 | 说明 |
|------|--------|------|
| API 认证密钥 | `DRIVEQUIZ_API_TOKEN_SECRET` | ✅ 统一使用 |
| 数据库连接 | `DRIVEQUIZ_DB_URL` | ✅ 统一使用（兼容 `DATABASE_URL`、`POSTGRES_URL`） |
| 向量化服务 | `AI_VECTORIZE_URL` | ✅ 统一使用 |

**命名模式**：
- 项目特定变量：`DRIVEQUIZ_*`
- 通用变量：`PORT`、`HOST`、`NODE_ENV`、`LOG_LEVEL`

---

## 🔗 相关文件

- `apps/drivequiz-api/.env` - 环境变量配置文件
- `apps/drivequiz-api/src/index.ts` - 配置加载
- `apps/drivequiz-api/src/lib/db.ts` - 数据库连接
- `apps/drivequiz-api/scripts/migrate.ts` - 迁移脚本
- `apps/drivequiz-api/ENV_SETUP.md` - 环境变量配置文档

---

## ✅ 总结

**结论**：✅ **数据库环境变量名称已统一**

- **当前使用**：`DRIVEQUIZ_DB_URL` ✅
- **代码支持**：`DRIVEQUIZ_DB_URL`（首选）、`DATABASE_URL`（兼容）、`POSTGRES_URL`（兼容）
- **建议**：保持当前配置，统一使用 `DRIVEQUIZ_DB_URL`

**无需修改** ✅

---

**报告生成时间**：2025-11-07  
**检查状态**：✅ 已确认统一

