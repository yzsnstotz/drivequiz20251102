# 修复 ai_log 表 user_id 字段为空的问题

## 问题描述

在 `ai_logs` 数据库中看不到 `user_id` 字段的值，所有记录的 `user_id` 都是 `null`。

## 问题原因

在 `apps/local-ai-service/src/lib/dbLogger.ts` 中的 `normalizeUserId` 函数存在问题：

1. **对于 `act-` 格式的 userid**：直接返回 `null`（第 62-64 行）
2. **数据库已支持 TEXT 类型**：迁移文件 `20251109_change_ai_logs_user_id_to_text.sql` 已将 `user_id` 字段改为 TEXT 类型
3. **在线 AI 服务已支持**：`apps/ai-service/src/lib/dbLogger.ts` 已经支持 `act-` 格式
4. **本地 AI 服务未支持**：`apps/local-ai-service/src/lib/dbLogger.ts` 还没有支持 `act-` 格式

## 修复方案

修改 `apps/local-ai-service/src/lib/dbLogger.ts` 中的 `normalizeUserId` 函数，使其支持 `act-` 格式的 userid，与在线 AI 服务保持一致。

### 修复内容

1. **支持 `act-` 格式**：验证格式后直接返回，不再返回 `null`
2. **验证格式**：确保 `act-{数字}` 格式正确
3. **统一格式**：将 `act-{activationId}` 格式标准化

### 修复后的逻辑

```typescript
function normalizeUserId(userId: string | null | undefined): string | null {
  if (!userId || typeof userId !== "string") {
    return null;
  }

  // 如果是 "anonymous" 字符串，直接返回 null
  if (userId === "anonymous") {
    return null;
  }

  // 如果是匿名 ID 格式（以 "anon-" 开头），返回 null
  if (userId.startsWith("anon-")) {
    return null;
  }

  // 如果是有效的 UUID，直接返回
  if (isValidUuid(userId)) {
    return userId;
  }

  // 如果是 act- 格式，验证格式后直接返回（数据库已支持 TEXT 类型）
  if (userId.startsWith("act-")) {
    const parts = userId.split("-");
    if (parts.length >= 2 && parts[0] === "act") {
      const activationIdStr = parts[parts.length - 1];
      const activationId = parseInt(activationIdStr, 10);
      if (!isNaN(activationId) && activationId > 0) {
        // 有效的激活用户ID，统一格式为 act-{activationId}
        const normalizedActUserId = `act-${activationId}`;
        return normalizedActUserId;
      }
    }
    return null;
  }

  // 其他格式返回null（匿名用户）
  return null;
}
```

## 验证修复

### 1. 检查数据库表结构

确保 `ai_logs` 表的 `user_id` 字段是 TEXT 类型：

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'ai_logs' AND column_name = 'user_id';
```

**期望结果**：`data_type` 应该是 `text` 或 `character varying`

### 2. 测试写入

发送一个 AI 问答请求，然后查询数据库：

```sql
SELECT user_id, question, created_at 
FROM ai_logs 
ORDER BY created_at DESC 
LIMIT 1;
```

**期望结果**：`user_id` 应该有值（UUID 或 `act-{数字}` 格式）

### 3. 检查日志

查看本地 AI 服务的日志，确认 `user_id` 被正确传递：

```bash
# 查看本地 AI 服务日志
tail -f /tmp/local-ai.log | grep -i "userid\|user_id"
```

## 数据流说明

### 完整的 userid 传递流程

1. **前端请求** → 主服务 `/api/ai/ask`
2. **主服务解析 JWT** → 提取 `userId`（可能是 UUID 或 `act-{activationId}`）
3. **主服务转发请求** → 本地 AI 服务 `/v1/ask`（包含 `userId` 字段）
4. **本地 AI 服务处理** → 调用 `logAiInteraction({ userId: body.userId, ... })`
5. **dbLogger 规范化** → `normalizeUserId(userId)` 处理 userid
6. **写入数据库** → `ai_logs` 表的 `user_id` 字段

### 支持的 userid 格式

- ✅ **UUID 格式**：`550e8400-e29b-41d4-a716-446655440000`
- ✅ **激活用户ID**：`act-123`（激活系统使用）
- ❌ **匿名用户**：`anonymous` 或 `anon-*` → 返回 `null`
- ❌ **无效格式** → 返回 `null`

## 相关文件

- **修复文件**：`apps/local-ai-service/src/lib/dbLogger.ts`
- **参考实现**：`apps/ai-service/src/lib/dbLogger.ts`（在线 AI 服务）
- **数据库迁移**：`src/migrations/20251109_change_ai_logs_user_id_to_text.sql`
- **路由文件**：`apps/local-ai-service/src/routes/ask.ts`（调用日志记录）

## 注意事项

1. **数据库表类型**：确保 `ai_logs.user_id` 字段是 TEXT 类型（不是 UUID）
2. **向后兼容**：修复后，旧的 UUID 格式仍然支持
3. **匿名用户**：匿名用户的 `user_id` 仍然是 `null`（这是预期的行为）
4. **格式验证**：只保存有效的 UUID 或 `act-{数字}` 格式

## 总结

- ✅ **问题已修复**：`normalizeUserId` 函数现在支持 `act-` 格式
- ✅ **与在线服务一致**：本地 AI 服务现在与在线 AI 服务的行为一致
- ✅ **数据库已支持**：`user_id` 字段已改为 TEXT 类型，支持多种格式
- ⚠️ **需要重启服务**：修复后需要重启本地 AI 服务才能生效

