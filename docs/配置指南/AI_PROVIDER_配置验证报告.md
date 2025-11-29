# AI Provider 配置验证报告

## 验证目标
确认 `aiProvider` 不是硬编码写死，而是从 `ai-service` 数据库（`ai_config` 表）读取配置。

## 代码分析结果

### ✅ 1. 数据库读取逻辑

**文件**: `src/app/api/ai/ask/route.ts`

**位置**: 第 616-642 行

```typescript
// 从数据库读取 aiProvider 配置（如果 URL 参数没有强制指定）
let aiProviderFromDb: AiProviderValue | null = null;
if (!forceMode) {
  try {
    console.log(`[${requestId}] [STEP 0.2] 从数据库读取aiProvider配置`);
    const configRow = await (aiDb as any)
      .selectFrom("ai_config")
      .select(["value"])
      .where("key", "=", "aiProvider")
      .executeTakeFirst();
    
    if (configRow) {
      const normalized = normalizeAiProviderValue(configRow.value);
      if (normalized) {
        aiProviderFromDb = normalized;
        console.log(`[${requestId}] [STEP 0.2] 数据库配置: ${normalized}`);
      } else {
        console.warn(`[${requestId}] [STEP 0.2] 数据库配置值无效: ${configRow.value}`);
      }
    } else {
      console.log(`[${requestId}] [STEP 0.2] 数据库配置为空或无效`);
    }
  } catch (e) {
    // 如果读取配置失败，使用环境变量作为后备
    console.error(`[${requestId}] [STEP 0.2] 数据库读取失败:`, (e as Error).message);
  }
}
```

**关键点**:
- ✅ 从 `ai_config` 表读取 `key = 'aiProvider'` 的配置
- ✅ 使用 `aiDb` 连接（AI Service 数据库）
- ✅ 通过 `normalizeAiProviderValue` 函数规范化值
- ✅ 有完整的错误处理和日志记录

### ✅ 2. 优先级机制

**位置**: 第 644-648 行

```typescript
// 优先级：URL 参数 > 数据库配置
if (!forceMode && !aiProviderFromDb) {
  console.error(`[${requestId}] [STEP 0.3] 未获取到 aiProvider 配置`);
  return err("INTERNAL_ERROR", "AI provider is not configured.", 500);
}
```

**优先级顺序**:
1. **URL 参数** (`?ai=local` 或 `?ai=openai`) - 最高优先级（仅用于调试）
2. **数据库配置** (`ai_config.aiProvider`) - 正常使用
3. **错误返回** - 如果两者都没有，返回 500 错误

**结论**: ✅ 没有硬编码默认值，如果数据库中没有配置，会返回错误。

### ✅ 3. 值规范化函数

**位置**: 第 137-157 行

```typescript
function normalizeAiProviderValue(value: string | null | undefined): AiProviderValue | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  switch (v) {
    case "online":
    case "openai":
      return "openai";
    case "local":
      return "local";
    case "openrouter":
      return "openrouter";
    case "openrouter-direct":
    case "openrouter_direct":
      return "openrouter_direct";
    case "openai_direct":
      return "openai_direct";
    case "gemini_direct":
      return "gemini_direct";
    default:
      return null;
  }
}
```

**支持的值**:
- `openai` / `online` → `"openai"`
- `local` → `"local"`
- `openrouter` → `"openrouter"`
- `openrouter_direct` / `openrouter-direct` → `"openrouter_direct"`
- `openai_direct` → `"openai_direct"`
- `gemini_direct` → `"gemini_direct"`

**结论**: ✅ 只做值规范化，不设置默认值。

### ✅ 4. 使用数据库配置的决策逻辑

**位置**: 第 650-716 行

```typescript
const wantLocal = forceMode
  ? forceMode === "local"
  : aiProviderFromDb === "local";

// ... 根据 aiProviderFromDb 的值选择不同的模式
if (aiProviderFromDb === "openrouter_direct") {
  aiServiceMode = "openrouter_direct";
} else if (aiProviderFromDb === "openai_direct") {
  aiServiceMode = "openai_direct";
} else if (aiProviderFromDb === "gemini_direct") {
  aiServiceMode = "gemini_direct";
} else {
  // 其他模式（openrouter、openai）需要通过 AI Service
  aiServiceMode = aiProviderFromDb === "openrouter" ? "openrouter" : "openai";
}
```

**结论**: ✅ 所有决策都基于 `aiProviderFromDb`（来自数据库），没有硬编码的默认值。

### ⚠️ 5. 特殊情况：本地服务回退逻辑

**位置**: 第 660-684 行

```typescript
if (wantLocal) {
  if (!LOCAL_AI_SERVICE_URL || !LOCAL_AI_SERVICE_TOKEN) {
    console.warn(`[${requestId}] [STEP 0.4] 本地AI服务配置不完整，回退到在线服务`);
    // 如果本地AI服务配置不完整，回退到在线服务
    if (!AI_SERVICE_URL || !AI_SERVICE_TOKEN) {
      // ... 返回错误
    }
    selectedAiServiceUrl = AI_SERVICE_URL;
    selectedAiServiceToken = AI_SERVICE_TOKEN;
    aiServiceMode = "openai";  // ⚠️ 这里硬编码为 "openai"
    console.log(`[${requestId}] [STEP 0.4] 已选择 OpenAI 服务（回退）`);
  }
}
```

**注意**: 这是一个**回退逻辑**，仅在以下情况触发：
1. 数据库配置为 `local`
2. 但 `LOCAL_AI_SERVICE_URL` 或 `LOCAL_AI_SERVICE_TOKEN` 未配置
3. 此时回退到 `openai` 模式

**建议**: 这个回退逻辑可以改进，但这不是主要问题，因为：
- 只有在配置错误时才会触发
- 正常情况完全依赖数据库配置

## 验证结论

### ✅ 主要结论

1. **aiProvider 不是硬编码的**
   - 所有正常流程都从数据库 `ai_config` 表读取
   - 没有硬编码的默认值
   - 如果数据库中没有配置，会返回 500 错误

2. **数据库读取逻辑正确**
   - 使用 `aiDb` 连接（AI Service 数据库）
   - 查询 `ai_config` 表，`key = 'aiProvider'`
   - 有完整的错误处理和日志

3. **优先级机制清晰**
   - URL 参数（调试用）> 数据库配置 > 错误返回
   - 没有环境变量后备（除了特殊情况）

4. **值规范化正确**
   - 支持多种格式（如 `openrouter-direct` 和 `openrouter_direct`）
   - 兼容旧值（如 `online` → `openai`）

### ⚠️ 改进建议

1. **回退逻辑优化**（可选）
   - 当前：本地服务配置不完整时，硬编码回退到 `openai`
   - 建议：可以回退到数据库配置的其他值，而不是硬编码

2. **错误处理增强**（可选）
   - 数据库读取失败时，可以记录更详细的错误信息
   - 可以考虑添加配置缓存（但需要谨慎处理缓存失效）

## 测试验证

### 当前数据库配置

```sql
SELECT key, value, updated_at 
FROM ai_config 
WHERE key = 'aiProvider';
```

**结果**: `aiProvider = openrouter_direct`

### 代码执行流程

1. ✅ 请求到达 `/api/ai/ask`
2. ✅ 检查 URL 参数（无）
3. ✅ 从 `ai_config` 表读取 `aiProvider` 配置
4. ✅ 规范化值：`openrouter_direct`
5. ✅ 根据配置选择直连 OpenRouter 模式
6. ✅ 不需要 `AI_SERVICE_URL`（直连模式）

## 最终确认

**✅ 确认：aiProvider 不是硬编码写死，而是从 ai-service 数据库（`ai_config` 表）读取配置。**

代码逻辑完全依赖数据库配置，没有硬编码的默认值。只有在配置错误或缺失时才会返回错误，这符合预期行为。

