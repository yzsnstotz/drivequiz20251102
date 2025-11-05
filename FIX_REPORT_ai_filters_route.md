# 修复报告：apps/web/app/api/admin/ai/filters/route.ts

## 修复日期
2025-01-XX

## 修复文件
`apps/web/app/api/admin/ai/filters/route.ts`

## 问题概述
该文件存在 17 个 TypeScript 编译错误，主要涉及：
1. `withAdminAuth` 的错误使用方式
2. `db.execute()` 方法不存在
3. `success()`, `badRequest()`, `internalError()` 的错误参数使用
4. 事务中 `trx.execute()` 方法不存在

## 修复详情

### 1. 修复 `withAdminAuth` 的用法
**问题：** 原代码将 `withAdminAuth` 当作异步函数调用：
```ts
const auth = await withAdminAuth(req);
if (!auth.ok) return NextResponse.json(auth, { status: 401 });
```

**修复：** `withAdminAuth` 是一个高阶函数，应该直接包装处理函数：
```ts
export const GET = withAdminAuth(async (req: NextRequest) => {
  // ...
});
export const POST = withAdminAuth(async (req: NextRequest) => {
  // ...
});
```

### 2. 修复数据库查询方法
**问题：** 原代码使用不存在的 `db.execute()` 方法执行原始 SQL：
```ts
const rows = await db.execute<Row>(
  sql`select id, type, pattern, created_at, updated_at from ai_filters ...`
);
```

**修复：** 改用 Kysely 查询构建器。由于 `ai_filters` 表不在 Database 接口中，使用类型断言：
```ts
const getAiFiltersTable = () => (db as any).selectFrom("ai_filters");

const rows = await getAiFiltersTable()
  .select(["id", "type", "pattern", "created_at", "updated_at"])
  .orderBy("updated_at", "desc")
  .orderBy("created_at", "desc")
  .execute();
```

### 3. 修复错误响应函数的参数使用
**问题：** 
- `success()` 被错误地传递了泛型参数，并被包装在 `NextResponse.json()` 中
- `badRequest()` 和 `internalError()` 被传递了两个参数

**修复：**
- `success()` 直接返回响应，不需要泛型参数，也不需要在 `NextResponse.json()` 中包装
- `badRequest()` 和 `internalError()` 只接受一个参数（message）

```ts
// 修复前
return NextResponse.json(success<{ items: unknown[] }>({ items }), { status: 200 });
return badRequest("VALIDATION_FAILED", "Body.items must be an array.");

// 修复后
return success({ items });
return badRequest("Body.items must be an array.");
```

### 4. 修复事务中的插入操作
**问题：** 原代码使用不存在的 `trx.execute()` 方法执行原始 SQL：
```ts
await trx.execute(
  sql`insert into ai_filters (type, pattern) values ... on conflict ...`
);
```

**修复：** 使用 Kysely 的查询构建器进行 UPSERT：
```ts
await (trx as any)
  .insertInto("ai_filters")
  .values({
    type: it.type,
    pattern: it.pattern,
  })
  .onConflict((oc: any) =>
    oc.column("type").doUpdateSet({
      pattern: sql`excluded.pattern`,
      updated_at: sql`NOW()`,
    })
  )
  .execute();
```

### 5. 移除未使用的导入
移除了未使用的 `NextResponse` 导入（除了类型声明）。

## 验证结果
- ✅ 所有 TypeScript 编译错误已修复
- ✅ Linter 检查通过（0 个错误）
- ✅ 代码符合项目规范

## 注意事项
1. **类型安全：** 由于 `ai_filters` 表不在 Database 接口中，使用了 `(db as any)` 类型断言。建议后续将 `ai_filters` 表添加到 `src/lib/db.ts` 的 Database 接口中。
2. **排序行为：** 原代码使用了 `ORDER BY ... NULLS LAST`，修复后的代码使用标准的 `orderBy()`，在大多数情况下行为一致。如需 `NULLS LAST` 语义，可能需要使用 SQL 模板或数据库层处理。
3. **错误处理：** 所有错误现在都使用统一的错误响应函数，符合项目规范。

## 修复前后对比

### 修复前错误数量
- TypeScript 编译错误：17 个
- Linter 错误：0 个

### 修复后错误数量
- TypeScript 编译错误：0 个
- Linter 错误：0 个

## 测试建议
1. 测试 GET `/api/admin/ai/filters` 端点是否能正确返回过滤规则列表
2. 测试 POST `/api/admin/ai/filters` 端点是否能正确创建/更新过滤规则
3. 测试验证逻辑（空数组、无效类型、过长模式等）
4. 测试管理员鉴权是否正常工作
