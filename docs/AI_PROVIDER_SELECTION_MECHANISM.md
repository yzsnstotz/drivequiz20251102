# AI 服务商选择机制（2025-11）

目标：确保 Render AI-Service 明确使用 OpenAI 还是 OpenRouter，并移除重复读取配置的逻辑。

---

## 1. 数据来源
- **数据库表 `ai_config`**：字段 `key="aiProvider"`，值为 `openai` / `openrouter` / `openrouter_direct` / `local`
- **URL 参数**：`?ai=openai` / `?ai=openrouter` / `?ai=local`（仅用于调试）
- **请求头**：`X-AI-Provider`（主站在调用 Render 时写入）

优先级：URL 参数 > 数据库 > 报错。

---

## 2. 主站路由 `src/app/api/ai/ask/route.ts`

处理流程：
1. 读取 URL 参数 `ai`，支持 `local` / `openai` / `openrouter`（兼容 legacy `online`）。
2. 若无 URL 参数，查询 `ai_config.aiProvider` 并映射到规范枚举。
3. 根据结果：
   - `local`：调用本地 Ollama 服务。
   - `openrouter_direct`：直连 OpenRouter。
   - `openai` / `openrouter`：调用 Render AI-Service，并在请求头附带 `X-AI-Provider`。

关键代码片段：
```ts
const headers: Record<string, string> = {
  "content-type": "application/json; charset=utf-8",
  authorization: `Bearer ${selectedAiServiceToken}`,
  "x-zalem-client": "web",
};

if (aiServiceMode === "openai" || aiServiceMode === "openrouter") {
  headers["X-AI-Provider"] = aiServiceMode;
}
```

---

## 3. Render AI-Service `apps/ai-service/src/routes/ask.ts`

步骤：
1. 从请求头读取 `X-AI-Provider`（若存在）。
2. 若请求头缺失，调用 `getAiProviderFromConfig()`（读取数据库，返回 `openai` / `openrouter`）。
3. 调用 `getOpenAIClient(config, aiProvider)`，内部会根据提供商选择不同的 Base URL、API Key 与 headers。

错误处理：
- 如果 `aiProvider` 配置为 `local`，直接报错（Render 不处理本地模式）。
- 如果环境变量缺失，如 `OPENROUTER_BASE_URL`，初始化客户端时抛出异常。

---

## 4. `getAiProviderFromConfig` 规范

位置：`apps/ai-service/src/lib/configLoader.ts`

- 缓存有效期 5 分钟。
- 仅接受 `openai` / `openrouter` / `openrouter_direct` / `local`（不再返回 `online` 或 `openrouter-direct`）。
- 当值为 `openrouter_direct` 时回退为 `openrouter`（Render 始终走代理模式）。
- 若数据库和环境变量都无法提供 provider，抛出错误。

---

## 5. 请求头规范

| 场景 | 请求方 | 目标服务 | 是否需要 `X-AI-Provider` |
|------|--------|----------|-------------------------|
| 主站 → Render（OpenAI） | Next.js | Render | ✅ 值为 `openai` |
| 主站 → Render（OpenRouter） | Next.js | Render | ✅ 值为 `openrouter` |
| 主站 → 本地 Ollama | Next.js | 本地服务 | ❌ |
| 主站 → OpenRouter 直连 | Next.js | OpenRouter | ❌ |

---

## 6. TODO / 注意事项
- [ ] 数据库迁移：更新旧值 `online` → `openai`，`openrouter-direct` → `openrouter_direct`
- [ ] 确认所有调用 Render 的代码均带上 `X-AI-Provider`
- [ ] 检查日志：Render 端打印应显示 `aiProvider: "openai" | "openrouter"`
- [ ] 文档同步（本文件、配置说明、运维文档）

---

> 结论：主站统一负责“该用哪个服务商”的决策，并通过请求头明确告知 Render；Render 仅充当实际的 OpenAI/OpenRouter 代理，不再重复读取数据库。*** End Patch


