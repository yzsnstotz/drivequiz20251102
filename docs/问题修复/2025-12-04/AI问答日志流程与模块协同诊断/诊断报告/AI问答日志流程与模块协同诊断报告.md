# AI问答日志流程与模块协同诊断报告

**报告编号**: CP-20251204-001  
**报告日期**: 2025-12-04  
**报告类型**: 流程逻辑与架构协同诊断  
**诊断范围**: AI问答日志流程逻辑、AI模块协同机制

---

## 📌 第一部分：问题概要（Summary）

| 字段 | 填写内容 |
|------|---------|
| **问题名称** | AI问答日志流程逻辑与模块协同机制诊断 |
| **问题等级** | Medium |
| **触发时间** | 2025-12-04（持续性问题，非单次触发） |
| **触发环境** | production / staging / local（全环境） |
| **相关模块** | ai-service / local-ai-service / drivequiz-api / web / question-processor |
| **当前状态** | 可复现（架构性问题，持续存在） |

---

## 📌 第二部分：问题整体叙述

### 2.1 问题背景

本次诊断针对当前AI问答系统的日志记录流程逻辑以及AI模块之间的协同机制进行全面分析。根据架构文档和代码审查，发现以下关键问题：

1. **日志记录分散且不一致**：多个服务（ai-service、local-ai-service、web）各自实现日志记录逻辑，存在代码重复和不一致风险
2. **模块协同边界不清晰**：主路由 `/api/ai/ask` 已废弃，但前端调用路径和后台调用路径存在差异
3. **日志记录时机不统一**：不同调用路径下日志记录的时机和内容存在差异
4. **模块职责划分模糊**：ai-service、local-ai-service、主站路由之间的职责边界需要进一步明确

### 2.2 问题范围

- **日志记录流程**：`ai_logs` 表的写入逻辑、时机、内容格式
- **模块协同机制**：ai-service、local-ai-service、主站路由之间的调用关系和职责划分
- **数据一致性**：不同调用路径下日志记录的完整性和一致性

---

## 📌 第三部分：日志信息

### 3.1 当前日志记录实现位置

#### 3.1.1 ai-service 日志记录
**文件位置**: `apps/ai-service/src/lib/dbLogger.ts`

**关键代码**:
```typescript
export async function logAiInteraction(log: AiLogRecord): Promise<void> {
  // 向 Supabase 的 ai_logs 表插入记录
  // Silent failure - 失败不阻断主流程
}
```

**记录字段**:
- `user_id`: 规范化后的用户ID（UUID或激活用户ID）
- `question`: 用户问题
- `answer`: AI回答
- `locale`: 语言代码（zh/ja/en）
- `model`: 使用的模型
- `rag_hits`: RAG检索命中数
- `safety_flag`: 安全标志（ok/needs_human/blocked）
- `cost_est`: 成本估算（USD）
- `created_at`: 创建时间

**调用位置**: 
- `apps/ai-service/src/routes/ask.ts` 第606行注释显示："不再在这里写入 ai_logs，由主路由统一写入"

#### 3.1.2 local-ai-service 日志记录
**文件位置**: `apps/local-ai-service/src/lib/dbLogger.ts`

**实现方式**: 与 ai-service 基本一致，但包含 `sources` 字段（JSONB）

**差异点**:
- local-ai-service 的 `dbLogger.ts` 支持 `sources` 字段
- ai-service 的 `dbLogger.ts` 不包含 `sources` 字段

#### 3.1.3 web 主站日志记录
**文件位置**: `apps/web/app/api/ai/chat/route.ts` 第73-125行

**实现方式**: 直接在路由中实现日志写入逻辑

**记录时机**: 在AI服务调用成功后写入

### 3.2 日志记录流程分析

#### 3.2.1 用户接口调用路径（已废弃）
**路由**: `/api/ai/ask` (已标记为 `@deprecated`)

**状态**: 返回410错误，提示前端应直接调用 ai-service

**代码位置**: `src/app/api/ai/ask/route.ts` 第51-63行

#### 3.2.2 前端直接调用路径
**调用方式**: 前端通过 `callAiDirect` 直接调用 ai-service

**日志记录**: 由 ai-service 内部处理（但代码注释显示不再记录）

#### 3.2.3 后台接口调用路径
**路由**: `/api/admin/ai/ask`

**核心模块**: `src/app/api/admin/ai/_lib/aiServiceCore.ts`

**调用方式**: 
- 通过 `callAiServer` 调用 ai-service 或 local-ai-service
- 跳过用户配额检查、JWT验证等用户相关逻辑

**日志记录**: 未明确记录（需要进一步确认）

### 3.3 日志记录时机问题

根据代码分析，发现以下问题：

1. **ai-service 路由层不再记录日志**（第606行注释）
2. **主路由已废弃**，无法统一记录日志
3. **前端直接调用**时，日志记录位置不明确
4. **后台批量处理**时，日志记录可能缺失

---

## 📌 第四部分：之前采取过的措施详情

### 4.1 架构重构措施

#### 4.1.1 AI服务统一架构规范（v1.0）
**文档**: `/Users/leo/Desktop/drivequiz研发规范/🧩 AI 服务研发规范（ai-service 统一架构规范 v1.0）.md`

**核心措施**:
- 统一场景执行管线（Scene Execution Pipeline）
- 所有AI逻辑集中在 `sceneRunner.ts`
- 路由层只负责HTTP请求解析和响应包装

**效果**: 统一了AI调用逻辑，但日志记录职责未明确

#### 4.1.2 AI核心服务规范（v2.0）
**文档**: `/Users/leo/Desktop/drivequiz研发规范/🧩 AI 核心服务规范（ai-core 统一架构规范 v2.0）.md`

**核心措施**:
- 引入 `@zalem/ai-core` 共享包
- 统一Provider封装（openaiClient.ts、ollamaClient.ts）
- 禁止路由层直接调用AI SDK

**效果**: 进一步统一了架构，但日志记录仍未统一

### 4.2 日志记录相关措施

#### 4.2.1 数据库表结构优化
**迁移文件**: `src/migrations/20250115_create_ai_tables.sql`

**措施**:
- 创建 `ai_logs` 表
- 创建 `question_ai_answers` 表
- 添加相关索引和RLS策略

#### 4.2.2 日志记录工具封装
**文件**: `apps/ai-service/src/lib/dbLogger.ts`、`apps/local-ai-service/src/lib/dbLogger.ts`

**措施**:
- 封装统一的日志记录函数 `logAiInteraction`
- 实现 Silent failure 机制（失败不阻断主流程）
- 规范化用户ID处理

**问题**: 
- 两个服务的实现存在差异（sources字段）
- 调用位置不统一

### 4.3 模块协同相关措施

#### 4.3.1 主路由废弃
**文件**: `src/app/api/ai/ask/route.ts`

**措施**: 标记路由为废弃，返回410错误

**影响**: 
- 前端需要改为直接调用 ai-service
- 日志记录路径需要重新设计

#### 4.3.2 后台接口分离
**文件**: `src/app/api/admin/ai/_lib/aiServiceCore.ts`

**措施**: 
- 创建共享核心模块 `aiServiceCore.ts`
- 后台接口直接调用AI服务，跳过用户逻辑

**效果**: 实现了真正的职责分离，但日志记录职责未明确

---

## 📌 第五部分：代码定位（Code Snapshot）

### 5.1 相关文件列表（绝对路径）

#### 日志记录相关文件
1. `apps/ai-service/src/lib/dbLogger.ts` - ai-service 日志记录工具
2. `apps/local-ai-service/src/lib/dbLogger.ts` - local-ai-service 日志记录工具
3. `apps/web/app/api/ai/chat/route.ts` - web 主站日志记录（第73-125行）
4. `src/lib/aiDb.ts` - 数据库表类型定义

#### 路由相关文件
1. `src/app/api/ai/ask/route.ts` - 主路由（已废弃）
2. `apps/ai-service/src/routes/ask.ts` - ai-service 主路由
3. `apps/local-ai-service/src/routes/ask.ts` - local-ai-service 主路由
4. `src/app/api/admin/ai/_lib/aiServiceCore.ts` - 后台AI服务核心模块

#### 客户端调用相关文件
1. `src/lib/aiClient.server.ts` - 服务端AI客户端
2. `src/lib/aiClient.front.ts` - 前端AI客户端

#### 数据库操作相关文件
1. `src/lib/questionDb.ts` - 题目数据库操作（包含 `saveAIAnswerToDb`、`getAIAnswerFromDb`）
2. `src/migrations/20250115_create_ai_tables.sql` - AI表结构迁移

### 5.2 关键函数代码片段

#### 5.2.1 ai-service 日志记录函数
```typescript:apps/ai-service/src/lib/dbLogger.ts
export async function logAiInteraction(log: AiLogRecord): Promise<void> {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return;
  }

  const normalizedUserId = normalizeUserId(log.userId);
  
  const payload = [{
    user_id: normalizedUserId,
    question: log.question,
    answer: log.answer,
    locale: log.lang ?? null,
    model: log.model,
    rag_hits: log.ragHits,
    safety_flag: log.safetyFlag,
    cost_est: log.costEstUsd ?? null,
    created_at: log.createdAtIso ?? new Date().toISOString(),
  }];

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/ai_logs`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      // Silent failure
    }
  } catch (e) {
    // Silent failure
  }
}
```

#### 5.2.2 ai-service 路由层日志记录注释
```typescript:apps/ai-service/src/routes/ask.ts
// 8) 注意：不再在这里写入 ai_logs，由主路由统一写入（包含题目标识等完整信息）
// 主路由会在 STEP 7 中写入日志
```

**问题**: 主路由已废弃，无法统一写入日志

#### 5.2.3 主路由废弃标记
```typescript:src/app/api/ai/ask/route.ts
/**
 * @deprecated 此路由已废弃
 * AI 调用现在由前端直接调用 ai-service，不再经过 Next.js
 * 保留此路由仅为向后兼容，返回错误提示
 * 指令版本：0002
 */
export async function POST(req: NextRequest) {
  console.warn("[api/ai/ask] Deprecated route was called. It should no longer be used.");
  
  return NextResponse.json(
    {
      ok: false,
      errorCode: "DEPRECATED_ROUTE",
      message:
        "AI API 已升级，当前端应直接调用 ai-service（callAiDirect），/api/ai/ask 已废弃。",
    },
    { status: 410 } // 410 Gone
  );
}
```

#### 5.2.4 后台AI服务核心模块
```typescript:src/app/api/admin/ai/_lib/aiServiceCore.ts
export async function callAiServiceCore(params: {
  question: string;
  locale?: string;
  scene?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  requestId: string;
  timeout?: number;
}): Promise<AiServiceResponse> {
  // 直接调用 callAiServer，跳过用户接口
  const { callAiServer } = await import("@/lib/aiClient.server");
  
  const result = await callAiServer({
    provider,
    question,
    locale: locale || "zh-CN",
    scene: scene || undefined,
    sourceLanguage: sourceLanguage || undefined,
    targetLanguage: targetLanguage || undefined,
  });
  
  // 返回结果，但未记录日志
  return {
    ok: !!answer,
    data: { answer, aiProvider, model },
  };
}
```

### 5.3 数据库表结构

#### 5.3.1 ai_logs 表结构
```sql:src/migrations/20250115_create_ai_tables.sql
CREATE TABLE IF NOT EXISTS ai_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT,  -- 修改为TEXT类型，支持UUID和激活用户ID
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  locale TEXT,
  model TEXT,
  rag_hits INTEGER DEFAULT 0,
  safety_flag TEXT DEFAULT 'ok',
  cost_est NUMERIC(10,4),
  sources JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 📌 第六部分：配置与环境（Config & Env）

### 6.1 环境变量配置

#### ai-service 环境变量
- `SUPABASE_URL` - Supabase项目URL（日志记录必需）
- `SUPABASE_SERVICE_KEY` - Supabase服务密钥（日志记录必需）
- `AI_RENDER_SERVICE_URL` - Render AI服务URL
- `AI_RENDER_SERVICE_TOKEN` - Render AI服务令牌

#### local-ai-service 环境变量
- `SUPABASE_URL` - Supabase项目URL（日志记录必需）
- `SUPABASE_SERVICE_KEY` - Supabase服务密钥（日志记录必需）
- `AI_LOCAL_SERVICE_URL` - 本地AI服务URL
- `AI_LOCAL_SERVICE_TOKEN` - 本地AI服务令牌

#### 主站环境变量
- `AI_RENDER_SERVICE_URL` - Render AI服务URL
- `AI_RENDER_SERVICE_TOKEN` - Render AI服务令牌
- `AI_LOCAL_SERVICE_URL` - 本地AI服务URL
- `AI_LOCAL_SERVICE_TOKEN` - 本地AI服务令牌
- `SUPABASE_URL` - Supabase项目URL
- `SUPABASE_SERVICE_KEY` - Supabase服务密钥

### 6.2 数据库配置

#### ai_config 表配置项
- `aiProvider` - AI提供商配置（openai/openrouter/openrouter_direct/local）
- `model` - 默认模型名称
- `cacheTtl` - 缓存TTL（毫秒）

### 6.3 调用路径配置

#### 前端调用路径
1. **直接调用**: 前端通过 `callAiDirect` 直接调用 ai-service
2. **Provider选择**: 根据URL参数或数据库配置选择Provider
3. **日志记录**: 由 ai-service 内部处理（但代码显示不再记录）

#### 后台调用路径
1. **核心模块**: 通过 `callAiServiceCore` 调用
2. **跳过用户逻辑**: 不经过用户接口，直接调用AI服务
3. **日志记录**: 未明确记录（需要确认）

---

## 📌 第七部分：问题影响范围（Impact Analysis）

### 7.1 影响模块

| 模块 | 影响程度 | 说明 |
|------|---------|------|
| **ai-service** | 高 | 日志记录职责不明确，代码注释显示不再记录日志 |
| **local-ai-service** | 高 | 日志记录实现与ai-service存在差异（sources字段） |
| **web主站** | 中 | 主路由已废弃，日志记录路径需要重新设计 |
| **后台接口** | 中 | 通过核心模块调用，日志记录可能缺失 |
| **question-processor** | 低 | 通过统一接口调用，日志记录依赖上游服务 |

### 7.2 用户影响

- **普通用户**: 无明显影响（日志记录失败不影响功能）
- **管理员**: 可能无法完整追踪AI调用记录
- **数据分析**: 日志数据可能不完整，影响统计分析

### 7.3 生产环境影响

- **日志完整性**: 不同调用路径下日志记录可能不一致
- **数据一致性**: 日志字段可能存在差异（如sources字段）
- **可追溯性**: 部分调用路径可能缺失日志记录

### 7.4 核心逻辑影响

- **AI调用逻辑**: 不受影响（日志记录是异步的，失败不阻断主流程）
- **缓存机制**: 不受影响
- **配额检查**: 不受影响
- **成本统计**: 可能受影响（日志记录不完整导致成本统计不准确）

### 7.5 紧急程度评估

- **功能影响**: 低（日志记录失败不影响核心功能）
- **数据完整性**: 中（日志数据可能不完整）
- **可维护性**: 高（代码分散，难以维护）
- **紧急修复**: 否（非阻塞性问题，但需要规划修复）

---

## 📌 第八部分：Cursor 自我分析（Root Cause Hypothesis）

### 8.1 根本原因分析

#### 8.1.1 架构演进导致的问题
**可能原因**:
1. **主路由废弃但日志记录职责未迁移**: 主路由废弃后，原本统一的日志记录职责未明确迁移到新的调用路径
2. **模块职责划分不清晰**: ai-service、local-ai-service、主站路由之间的日志记录职责边界不明确
3. **代码重构不彻底**: 架构重构时，日志记录逻辑未同步重构

#### 8.1.2 实现不一致导致的问题
**可能原因**:
1. **代码复制而非共享**: ai-service 和 local-ai-service 各自实现日志记录，存在差异
2. **字段定义不统一**: local-ai-service 支持 sources 字段，ai-service 不支持
3. **调用时机不统一**: 不同调用路径下日志记录的时机和内容存在差异

#### 8.1.3 文档与代码不一致
**可能原因**:
1. **代码注释误导**: ai-service 路由层注释显示"不再在这里写入 ai_logs，由主路由统一写入"，但主路由已废弃
2. **架构文档未更新**: 架构文档中关于日志记录的说明可能与实际代码不一致

### 8.2 具体问题点

#### 问题点1: 日志记录职责不明确
- **位置**: `apps/ai-service/src/routes/ask.ts` 第606行
- **问题**: 代码注释显示不再记录日志，但未明确由谁记录
- **影响**: 可能导致日志记录缺失

#### 问题点2: 实现差异
- **位置**: `apps/ai-service/src/lib/dbLogger.ts` vs `apps/local-ai-service/src/lib/dbLogger.ts`
- **问题**: local-ai-service 支持 sources 字段，ai-service 不支持
- **影响**: 日志数据格式不一致

#### 问题点3: 调用路径差异
- **位置**: 前端直接调用 vs 后台核心模块调用
- **问题**: 不同调用路径下日志记录可能不一致
- **影响**: 日志数据完整性无法保证

#### 问题点4: 主路由废弃影响
- **位置**: `src/app/api/ai/ask/route.ts`
- **问题**: 主路由废弃后，统一的日志记录入口消失
- **影响**: 需要重新设计日志记录机制

---

## 📌 第九部分：建议修复方向（Suggested Fixes）

### 9.1 方案A：统一日志记录模块（推荐）

**核心思路**: 创建统一的日志记录模块，所有服务共享使用

**实施步骤**:
1. 创建共享日志记录模块 `packages/ai-core/src/logger.ts` 或 `src/lib/aiLogger.ts`
2. 统一日志记录接口和字段定义（包含sources字段）
3. 所有服务（ai-service、local-ai-service、主站）统一使用该模块
4. 明确日志记录时机：在AI服务返回结果后统一记录

**优势**:
- ✅ 代码统一，易于维护
- ✅ 字段定义一致，数据格式统一
- ✅ 符合DRY原则

**劣势**:
- ⚠️ 需要创建新的共享模块
- ⚠️ 需要修改多个服务的调用代码

### 9.2 方案B：在ai-core中统一记录（快速）

**核心思路**: 在 `@zalem/ai-core` 的 `sceneRunner.ts` 中统一记录日志

**实施步骤**:
1. 在 `runScene()` 函数返回结果后记录日志
2. 所有通过 `runScene()` 的调用都会自动记录日志
3. 移除各服务中的独立日志记录代码

**优势**:
- ✅ 实施快速，修改范围小
- ✅ 日志记录时机统一
- ✅ 符合单一职责原则

**劣势**:
- ⚠️ ai-core 需要依赖 Supabase 配置
- ⚠️ 可能增加 ai-core 的复杂度

### 9.3 方案C：在调用层统一记录（结构性改进）

**核心思路**: 在 `callAiServer` 和 `callAiDirect` 等客户端层统一记录日志

**实施步骤**:
1. 在 `src/lib/aiClient.server.ts` 和 `src/lib/aiClient.front.ts` 中统一记录日志
2. 所有AI服务调用都会经过客户端层，统一记录
3. 各服务内部不再记录日志

**优势**:
- ✅ 调用层统一，覆盖所有调用路径
- ✅ 日志记录逻辑集中，易于维护
- ✅ 符合关注点分离原则

**劣势**:
- ⚠️ 客户端层需要访问用户信息（userId等）
- ⚠️ 需要处理不同调用场景下的用户信息获取

---

## 📌 第十部分：需要你（ChatGPT）决策的点（Decision Needed）

### 10.1 架构决策

1. **日志记录位置选择**
   - 选项A: 在 ai-core 的 `runScene()` 中记录（方案B）
   - 选项B: 在客户端层（`callAiServer`、`callAiDirect`）记录（方案C）
   - 选项C: 创建独立的日志记录模块（方案A）
   - **需要确认**: 哪种方案更符合当前架构设计原则？

2. **日志记录时机**
   - 选项A: 在AI服务返回结果后立即记录（同步）
   - 选项B: 异步记录，不阻塞主流程（当前实现）
   - **需要确认**: 是否需要改变当前的异步记录机制？

3. **字段统一性**
   - 选项A: 统一所有服务的日志字段定义（包含sources）
   - 选项B: 保持各服务的字段差异（向后兼容）
   - **需要确认**: 是否需要统一字段定义？

### 10.2 实现细节决策

1. **用户信息获取**
   - **问题**: 在客户端层记录日志时，如何获取userId等信息？
   - **选项A**: 通过参数传递
   - **选项B**: 从请求上下文中获取
   - **需要确认**: 哪种方式更合适？

2. **错误处理策略**
   - **问题**: 日志记录失败时的处理策略？
   - **选项A**: Silent failure（当前实现）
   - **选项B**: 记录到错误日志
   - **选项C: 重试机制**
   - **需要确认**: 是否需要改进错误处理？

3. **性能考虑**
   - **问题**: 日志记录是否会影响性能？
   - **选项A**: 保持异步记录（当前实现）
   - **选项B**: 批量记录
   - **需要确认**: 是否需要优化性能？

### 10.3 向后兼容性

1. **现有日志数据**
   - **问题**: 修复后是否会影响现有日志数据的查询？
   - **需要确认**: 是否需要数据迁移？

2. **API兼容性**
   - **问题**: 修复后是否会影响现有API调用？
   - **需要确认**: 是否需要保持API兼容性？

---

## 📌 第十一部分：附录（Attachments）

### 11.1 相关文档链接

1. **架构文档**:
   - `/Users/leo/Desktop/drivequiz研发规范/AI板块整体架构说明.md`
   - `/Users/leo/Desktop/drivequiz研发规范/🧩 AI 服务研发规范（ai-service 统一架构规范 v1.0）.md`
   - `/Users/leo/Desktop/drivequiz研发规范/🧩 AI 核心服务规范（ai-core 统一架构规范 v2.0）.md`

2. **流程文档**:
   - `docs/架构文档/AI_ANSWER_REQUEST_FLOW.md`
   - `docs/架构文档/AIASK_STEPS_FLOW.md`
   - `docs/架构文档/AIASK_FLOW_OPTIMIZATION.md`

3. **问题诊断文档**:
   - `docs/问题诊断/本地AI服务调用问题分析报告.md`
   - `docs/问题诊断/AIASK_接口分离分析报告.md`

### 11.2 数据库表结构快照

#### ai_logs 表结构
```sql
CREATE TABLE IF NOT EXISTS ai_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  locale TEXT,
  model TEXT,
  rag_hits INTEGER DEFAULT 0,
  safety_flag TEXT DEFAULT 'ok',
  cost_est NUMERIC(10,4),
  sources JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### question_ai_answers 表结构
```sql
CREATE TABLE IF NOT EXISTS question_ai_answers (
  id BIGSERIAL PRIMARY KEY,
  question_hash TEXT NOT NULL,
  answer TEXT NOT NULL,
  locale TEXT NOT NULL,
  model TEXT,
  sources JSONB,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(question_hash, locale)
);
```

### 11.3 关键代码文件清单

#### 日志记录相关
- `apps/ai-service/src/lib/dbLogger.ts` (139行)
- `apps/local-ai-service/src/lib/dbLogger.ts` (141行)
- `apps/web/app/api/ai/chat/route.ts` (第73-125行)

#### 路由相关
- `src/app/api/ai/ask/route.ts` (64行，已废弃)
- `apps/ai-service/src/routes/ask.ts` (686行)
- `apps/local-ai-service/src/routes/ask.ts` (712行)

#### 客户端相关
- `src/lib/aiClient.server.ts` (315行)
- `src/lib/aiClient.front.ts` (404行)
- `src/app/api/admin/ai/_lib/aiServiceCore.ts` (93行)

#### 数据库操作相关
- `src/lib/questionDb.ts` (包含 `saveAIAnswerToDb`、`getAIAnswerFromDb`)
- `src/lib/aiDb.ts` (数据库表类型定义)

### 11.4 调用流程图

```
前端请求
  ↓
[路径1] callAiDirect (前端直接调用)
  ↓
ai-service /v1/ask
  ↓
runScene() (ai-core)
  ↓
[日志记录?] ← 问题点：代码注释显示不再记录

[路径2] callAiServer (服务端调用)
  ↓
ai-service /v1/ask 或 local-ai-service /v1/ask
  ↓
runScene() (ai-core)
  ↓
[日志记录?] ← 问题点：代码注释显示不再记录

[路径3] callAiServiceCore (后台调用)
  ↓
callAiServer
  ↓
ai-service /v1/ask
  ↓
runScene() (ai-core)
  ↓
[日志记录?] ← 问题点：未明确记录
```

---

## 📌 总结

本次诊断发现AI问答日志流程和模块协同存在以下核心问题：

1. **日志记录职责不明确**: ai-service 路由层注释显示不再记录日志，但主路由已废弃，导致日志记录职责缺失
2. **实现不一致**: ai-service 和 local-ai-service 的日志记录实现存在差异（sources字段）
3. **调用路径差异**: 不同调用路径下日志记录可能不一致，影响数据完整性
4. **架构演进遗留问题**: 主路由废弃后，统一的日志记录入口消失，需要重新设计

**建议**: 采用方案A（统一日志记录模块）或方案C（在调用层统一记录），明确日志记录职责，统一实现和字段定义，确保所有调用路径下都能正确记录日志。

---

**报告结束**

