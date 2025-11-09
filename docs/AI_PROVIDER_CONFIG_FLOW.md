# AI 配置流转说明（2025-11）

```
Admin Panel → ai_config 表 → 主站 API → Render AI-Service → 实际模型提供商
```

---

## 1. 管理端（Admin）
- 页面：`src/app/admin/ai/config/page.tsx`
- 可配置项：
  - `aiProvider`: `openai` / `openrouter` / `openrouter_direct` / `local`
  - `model`: 模型名称
  - `cacheTtl`: 缓存 TTL（秒）
  - 运营参数（提问上限、答案长度等）
- API：`src/app/api/admin/ai/config/route.ts`
  - 校验枚举并写入 `ai_config` 表

---

## 2. 数据库存储
- 表：`ai_config`
- 关键记录：
  - `{"key":"aiProvider","value":"openai"}` 等
  - `{"key":"model","value":"openai/gpt-4o-mini"}` 等
  - `{"key":"cacheTtl","value":"86400"}`（秒）
- 新增迁移：`src/migrations/20251109_update_ai_provider_values.sql` 用于规范旧值

---

## 3. 主站 API：`src/app/api/ai/ask/route.ts`

1. 读取 URL 参数 `ai`（`local` / `openai` / `openrouter`），用于调试覆盖。
2. 无 URL 覆盖时，从 `ai_config` 读取并规范化。
3. 根据 provider：
   - `local` → 访问本地 Ollama (`LOCAL_AI_SERVICE_URL`)
   - `openrouter_direct` → 直连 OpenRouter（需 `OPENROUTER_*` 环境变量）
   - `openai` / `openrouter` → 调用 Render AI-Service（携带 `X-AI-Provider` 请求头）
4. 统一记录日志与错误码，并将 `aiProvider` 写入响应 `metadata`。

---

## 4. Render AI-Service：`apps/ai-service/src/routes/ask.ts`

1. 优先从请求头读取 `X-AI-Provider`（值为 `openai` / `openrouter`）。
2. 如无请求头，调用 `getAiProviderFromConfig()`（读取数据库）。
3. 调用 `getOpenAIClient(config, aiProvider)`：
   - `openai` → 使用 `OPENAI_API_KEY` + `OPENAI_BASE_URL`
   - `openrouter` → 使用 `OPENROUTER_API_KEY` + `OPENROUTER_BASE_URL` + Referer + AppName
4. 执行对话完成请求，记录 tokens / cost / cache 等信息。

辅助函数：
- `apps/ai-service/src/lib/configLoader.ts`：负责读取并缓存 `model` / `cacheTtl` / `aiProvider`
  - 当数据库无值且未提供环境变量时抛出错误（所有配置需显式设置）
- `apps/ai-service/src/lib/openaiClient.ts`：强制校验所有必需环境变量

---

## 5. 本地 AI-Service（Ollama）
- 仅当 `aiProvider=local` 时被使用
- 环境变量：
  - `OLLAMA_BASE_URL`
  - `AI_MODEL`
  - `EMBEDDING_MODEL`
- 入口：`apps/local-ai-service/src/routes/ask.ts`

---

## 6. 关键约束
- 所有环境变量 **不得** 提供默认值。
- `X-AI-Provider` 请求头只能为 `openai` / `openrouter`（其余模式无须发送）。
- `ai_config` 表必须存在有效的 `model` 与 `aiProvider`。
- 直连 OpenRouter 仅在主站层处理，Render AI-Service 永远走代理模式。

---

## 7. 常见排查
1. **Missing environment variable**：启动即抛错，检查 Render/Vercel 配置。
2. **aiProvider 无效**：500 错误并提示 `AI provider is not configured`，检查数据库。
3. **模型缺失**：500 错误，提示 `AI model is not configured`，更新 `ai_config` 或环境变量。
4. **Render 请求失败**：查看请求头日志，确认 `X-AI-Provider` 是否正确。

---

> 统一遵循“数据库 + 显式环境变量 + 单一主站路由”，保证 AI 服务商选择流程清晰可控。*** End Patch


