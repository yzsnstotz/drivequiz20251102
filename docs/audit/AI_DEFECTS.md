# ZALEM · AI问答模块 缺陷报告

**审计日期**: 2025-11-04  
**审计范围**: 主站 Next.js API、AI-Service、管理后台、前端组件  
**缺陷总数**: 3（1 个高优先级，1 个中优先级，1 个低优先级）

---

## 🔴 高优先级缺陷

### D1. 前端历史缓存缺失

**模块**: 前端组件  
**文件路径**: `src/components/AIPage.tsx`  
**状态**: ❌ 未修复  
**优先级**: 🔴 高

#### 问题描述

前端 AI 问答页面未实现本地缓存持久化，消息历史仅存储在 React `useState` 中，刷新页面后历史记录丢失，不符合"前端历史显示（本地缓存）"的产品要求。

#### 复现步骤

1. 打开 AI 问答页面（`/src/components/AIPage.tsx`）
2. 发送 2-3 条消息
3. 刷新页面（F5 或 `window.location.reload()`）
4. **实际行为**: 历史记录丢失，仅显示初始欢迎消息
5. **期望行为**: 历史记录保留，显示之前发送的消息

#### 代码位置

```typescript
// src/components/AIPage.tsx
const [messages, setMessages] = useState<ChatMessage[]>(() => [
  {
    id: uid(),
    role: "ai",
    content: "你好！我是你的 AI 助手，有什么我可以帮你的吗？",
    createdAt: Date.now(),
  },
]);
```

**位置**: 86-93 行

#### 影响面

- **用户体验**: 刷新页面后历史记录丢失，需要重新输入问题
- **产品功能**: 不符合产品文档要求的"前端历史显示（本地缓存）"
- **后端影响**: 无（后端无多轮上下文，符合要求）

#### 修复建议

1. **添加 localStorage 持久化**:
   ```typescript
   // 初始化时从 localStorage 读取
   const [messages, setMessages] = useState<ChatMessage[]>(() => {
     if (typeof window !== "undefined") {
       const saved = localStorage.getItem("AI_CHAT_HISTORY");
       if (saved) {
         try {
           return JSON.parse(saved);
         } catch {
           // 忽略解析错误，使用默认值
         }
       }
     }
     return [
       {
         id: uid(),
         role: "ai",
         content: "你好！我是你的 AI 助手，有什么我可以帮你的吗？",
         createdAt: Date.now(),
       },
     ];
   });

   // 每次更新消息时保存到 localStorage
   useEffect(() => {
     if (typeof window !== "undefined") {
       localStorage.setItem("AI_CHAT_HISTORY", JSON.stringify(messages));
     }
   }, [messages]);
   ```

2. **添加历史记录清理功能**（可选）:
   - 提供"清空历史"按钮
   - 限制历史记录数量（如最多 100 条）

3. **数据迁移**（如需要）:
   - 如果之前有其他存储方式，需要迁移逻辑

#### 回归测试用例

1. ✅ 发送多条消息后刷新页面，历史记录保留
2. ✅ 切换浏览器标签页后返回，历史记录保留
3. ✅ 清空浏览器缓存后，历史记录丢失（符合预期）
4. ✅ 不同浏览器/设备之间，历史记录不共享（符合预期）

#### 负责人/优先级/DDL

- **负责人**: 前端开发
- **优先级**: 🔴 高
- **DDL**: 建议 1 周内修复

---

## 🟡 中优先级缺陷

### D2. 缓存 Key 格式不一致

**模块**: AI-Service  
**文件路径**: `apps/ai-service/src/routes/ask.ts`  
**状态**: ⚠️ 功能正常，但格式不一致  
**优先级**: 🟡 中

#### 问题描述

代码中缓存 Key 生成格式与文档要求不一致：
- **代码实现**: `sha256(normalize(question) + ":" + lang + ":" + model + ":" + version)`
- **文档要求**: `sha256(normalize(question) + "|" + locale + "|" + version)`

**差异点**:
1. 分隔符：代码使用 `:`，文档要求 `|`
2. 语言字段：代码使用 `lang`（zh/ja/en），文档要求 `locale`（BCP-47）
3. 模型字段：代码包含 `model`，文档不包含

#### 复现步骤

1. 查看 `apps/ai-service/src/routes/ask.ts` 的 `buildCacheKey()` 函数
2. 对比文档 `📘 ZALEM · AI问答模块 产品文档 v1.0（草案）.md`
3. **实际行为**: 使用 `:` 分隔符，包含 `model` 字段
4. **期望行为**: 使用 `|` 分隔符，不包含 `model` 字段

#### 代码位置

```typescript
// apps/ai-service/src/routes/ask.ts
function buildCacheKey(question: string, lang: string, model: string): string {
  const normalized = normalizeQuestion(question);
  const keyStr = `${normalized}:${lang}:${model}:${AI_MODEL_VERSION}`;
  const hash = createHash("sha256").update(keyStr).digest("hex");
  return `ask:${hash}`;
}
```

**位置**: 116-121 行

#### 影响面

- **功能影响**: 无（功能正常，缓存命中正常）
- **文档一致性**: 与文档不一致，可能造成理解偏差
- **向后兼容**: 如果修改，会导致现有缓存失效（需要清空缓存）

#### 修复建议

1. **方案 A（推荐）**: 更新文档，使其与代码实现一致
   - 优点：无需修改代码，不影响现有缓存
   - 缺点：文档与实现不一致

2. **方案 B**: 修改代码，使其与文档一致
   - 优点：文档与实现一致
   - 缺点：需要清空现有缓存，可能影响性能

3. **方案 C（折中）**: 保持当前实现，但添加注释说明
   - 优点：代码可读性提升
   - 缺点：文档与实现仍不一致

#### 建议

优先采用**方案 A**（更新文档），因为：
- 当前实现功能正常，缓存命中正常
- 包含 `model` 字段更合理（不同模型可能产生不同答案）
- 修改代码会导致现有缓存失效

如需修改代码，建议：
1. 先发布版本，通知用户
2. 在部署时清空缓存（或使用新的缓存键前缀）
3. 更新文档，使其与代码一致

#### 回归测试用例

1. ✅ 相同问题、相同语言、相同模型的请求，缓存命中
2. ✅ 相同问题、相同语言、不同模型的请求，缓存不命中（符合预期）
3. ✅ 相同问题、不同语言的请求，缓存不命中（符合预期）

#### 负责人/优先级/DDL

- **负责人**: AI-Service 开发
- **优先级**: 🟡 中
- **DDL**: 建议 2 周内修复或文档更新

---

## 🟢 低优先级缺陷

### D3. 日志写入失败的告警机制缺失

**模块**: AI-Service  
**文件路径**: `apps/ai-service/src/lib/dbLogger.ts`  
**状态**: ⚠️ 功能正常，但告警缺失  
**优先级**: 🟢 低

#### 问题描述

`dbLogger.ts` 在日志写入失败时仅打印警告日志，未实现告警通知机制（如邮件、Slack、钉钉等），生产环境可能无法及时发现日志写入异常。

#### 复现步骤

1. 模拟 Supabase 服务不可用（或网络异常）
2. 发送 AI 问答请求
3. 查看日志输出
4. **实际行为**: 仅打印警告日志，无告警通知
5. **期望行为**: 打印警告日志 + 发送告警通知（如邮件、Slack）

#### 代码位置

```typescript
// apps/ai-service/src/lib/dbLogger.ts
if (!res.ok) {
  const text = await res.text().catch(() => "");
  defaultLogger.warn("ai_logs insert non-2xx", { status: res.status, text });
}
// ...
catch (e) {
  defaultLogger.warn("ai_logs insert failed", { error: (e as Error).message });
}
```

**位置**: 77-83 行

#### 影响面

- **功能影响**: 无（日志写入失败不阻断主流程，符合设计要求）
- **运维影响**: 无法及时发现日志写入异常，可能影响数据分析
- **用户体验**: 无（用户无感知）

#### 修复建议

1. **添加告警通知**（可选）:
   ```typescript
   // 添加告警配置
   const ALERT_WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL;
   const ALERT_EMAIL = process.env.ALERT_EMAIL;

   // 失败时发送告警
   if (!res.ok) {
     const text = await res.text().catch(() => "");
     defaultLogger.warn("ai_logs insert non-2xx", { status: res.status, text });
     
     // 发送告警（可选）
     if (ALERT_WEBHOOK_URL) {
       await fetch(ALERT_WEBHOOK_URL, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
           title: "AI Logs 写入失败",
           message: `Status: ${res.status}, Text: ${text}`,
           level: "warning",
         }),
       }).catch(() => {}); // 告警失败不阻断主流程
     }
   }
   ```

2. **添加失败率监控**（可选）:
   - 统计连续失败次数
   - 超过阈值时发送告警

3. **添加重试机制**（可选）:
   - 失败时自动重试（如 3 次）
   - 重试失败后再发送告警

#### 建议

- **低优先级**: 当前实现已满足基本需求（降级处理，不阻断主流程）
- **可选优化**: 如需完善监控，可添加告警机制
- **建议**: 先观察生产环境日志写入情况，再决定是否需要告警

#### 回归测试用例

1. ✅ 日志写入成功时，无告警（符合预期）
2. ✅ 日志写入失败时，打印警告日志（符合预期）
3. ✅ 日志写入失败时，不阻断主流程（符合预期）
4. ✅ 日志写入失败时，发送告警通知（如实现）

#### 负责人/优先级/DDL

- **负责人**: AI-Service 开发 / 运维
- **优先级**: 🟢 低
- **DDL**: 建议 1 个月内修复或评估

---

## 📊 缺陷统计

| 优先级 | 数量 | 状态 |
|--------|------|------|
| 🔴 高 | 1 | ❌ 未修复 |
| 🟡 中 | 1 | ⚠️ 功能正常 |
| 🟢 低 | 1 | ⚠️ 功能正常 |
| **总计** | **3** | **1 个需修复** |

---

## 🔧 修复建议总结

### 立即修复（高优先级）

1. **D1. 前端历史缓存缺失**
   - 添加 localStorage 持久化
   - 预计工作量：0.5 天
   - 影响：用户体验提升

### 可选修复（中/低优先级）

2. **D2. 缓存 Key 格式不一致**
   - 更新文档或修改代码（推荐更新文档）
   - 预计工作量：0.5 天（文档）或 1 天（代码 + 清空缓存）
   - 影响：文档一致性

3. **D3. 日志写入失败的告警机制缺失**
   - 添加告警通知（可选）
   - 预计工作量：1 天
   - 影响：运维监控完善

---

**审计结论**: ✅ **核心功能完整，代码质量良好。需修复 1 个高优先级缺陷（前端历史缓存），其他缺陷为可选优化项。**

