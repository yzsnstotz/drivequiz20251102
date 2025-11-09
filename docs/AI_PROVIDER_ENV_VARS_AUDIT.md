# AI 服务商环境变量审核（2025-11 更新）

本文基于最新代码（2025-11）梳理 AI 服务相关的环境变量、数据库字段与代码调用位置，为后续统一整改提供依据。

---

## 1. 服务商与配置值

| 服务商 | 数据库 `aiProvider` 值 | 对应环境变量前缀 | 主要部署位置 | 关键代码 |
|--------|------------------------|------------------|--------------|----------|
| OpenAI（Render） | `openai` | `OPENAI_*` | `apps/ai-service` | `apps/ai-service/src/routes/ask.ts` |
| OpenRouter（Render 代理） | `openrouter` | `OPENROUTER_*` | `apps/ai-service` | `apps/ai-service/src/routes/ask.ts` |
| OpenRouter（直连） | `openrouter_direct` | `OPENROUTER_*` | `src/app/api/ai/ask/route.ts` | 同上 |
| 本地 Ollama | `local` | `OLLAMA_*` | `apps/local-ai-service` | `apps/local-ai-service/src/**` |

> ✅ `online` / `openrouter-direct` 等旧值已废弃，需统一迁移为上表命名。

---

## 2. 强制环境变量

### 2.1 OpenAI（Render）
| 变量 | 说明 | 是否必填 |
|------|------|----------|
| `OPENAI_API_KEY` | OpenAI API Key | ✅ |
| `OPENAI_BASE_URL` | OpenAI Base URL | ✅ |

### 2.2 OpenRouter（Render 代理）
| 变量 | 说明 | 是否必填 |
|------|------|----------|
| `OPENROUTER_API_KEY` | OpenRouter API Key | ✅ |
| `OPENROUTER_BASE_URL` | OpenRouter Base URL | ✅ |
| `OPENROUTER_REFERER_URL` | OpenRouter HTTP-Referer | ✅ |
| `OPENROUTER_APP_NAME` | OpenRouter X-Title | ✅ |

### 2.3 OpenRouter 直连（Next.js 主站）
需在 Vercel 中配置：
- `OPENROUTER_API_KEY`
- `OPENROUTER_BASE_URL`
- `OPENROUTER_REFERER_URL`
- `OPENROUTER_APP_NAME`

### 2.4 本地 Ollama
| 变量 | 说明 | 是否必填 |
|------|------|----------|
| `OLLAMA_BASE_URL` | Ollama Base URL | ✅ |
| `AI_MODEL` | 对话模型 | ✅ |
| `EMBEDDING_MODEL` | 向量模型 | ✅ |

🚫 所有默认值已移除。缺少任意必填变量会在启动阶段抛出异常。

---

## 3. 环境变量使用矩阵

### 3.1 主站代理 `src/app/api/ai/ask/route.ts`

| 变量 | 本地模式 | 直连 OpenRouter | Render（OpenAI/OpenRouter） |
|------|----------|-----------------|-----------------------------|
| `LOCAL_AI_SERVICE_URL` / `TOKEN` | ✅ | ❌ | ❌ |
| `AI_SERVICE_URL` / `TOKEN` | ❌ | ❌ | ✅ |
| `OPENROUTER_API_KEY` / `OPENROUTER_BASE_URL` / `OPENROUTER_REFERER_URL` / `OPENROUTER_APP_NAME` | ❌ | ✅ | ❌（由 Render 负责） |
| `USER_JWT_SECRET` | ✅ | ✅ | ✅ |

### 3.2 Render AI-Service `apps/ai-service/src/routes/ask.ts`

| 变量 | OpenAI | OpenRouter |
|------|--------|-----------|
| `OPENAI_API_KEY` | ✅ | ❌ |
| `OPENAI_BASE_URL` | ✅ | ❌ |
| `OPENROUTER_API_KEY` | ❌ | ✅ |
| `OPENROUTER_BASE_URL` | ❌ | ✅ |
| `OPENROUTER_REFERER_URL` | ❌ | ✅ |
| `OPENROUTER_APP_NAME` | ❌ | ✅ |
| `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` / `SERVICE_TOKENS` | ✅ | ✅ |

### 3.3 本地 AI Service `apps/local-ai-service`

| 变量 | 说明 |
|------|------|
| `OLLAMA_BASE_URL` | 必填，连接 Ollama |
| `AI_MODEL` | 必填，对话模型 |
| `EMBEDDING_MODEL` | 必填，向量模型 |
| `SERVICE_TOKENS` | 必填，鉴权 |

---

## 4. 数据库约束

`ai_config` 表要求：
- `aiProvider`：必须为 `openai` / `openrouter` / `openrouter_direct` / `local`
- `model`：必填，缺失时报错
- `cacheTtl`：必填，可在 `ai_config` 或环境变量 `AI_CACHE_TTL_MS` 指定

> 🔧 建议新增 SQL 迁移：将旧值 `online` → `openai`，`openrouter-direct` → `openrouter_direct`。

---

## 5. 路由与代码集中化

- `src/app/api/ai/ask/route.ts` 为唯一主站入口，已负责所有模式（本地 / 直连 / Render）。
- `apps/web/app/api/ai/ask/route.ts` 已改为 `export { runtime, dynamic, GET, POST } from "../../../../../../src/app/api/ai/ask/route";`
- Render 侧只处理 OpenAI / OpenRouter 代理逻辑。

---

## 6. TODO 清单

1. **数据库迁移**：将旧值批量更新为新枚举；更新 `ai_config` 描述文案。
2. **Admin 配置**：UI 与 API 均已迁移到新枚举，部署后需确认数据库数据。
3. **环境变量**：确保 Render 与 Vercel 环境均已补齐必填变量。
4. **文档同步**：更新以下文档与指南以符合最新命名：
   - `docs/AI_PROVIDER_CONFIG_FLOW.md`
   - `docs/AI_PROVIDER_ENV_VARS.md`
   - `docs/OPENROUTER_TROUBLESHOOTING.md`
   - `docs/FIX_OPENROUTER_URL_ERROR.md`

---

## 7. 参考代码路径

- 主站代理：`src/app/api/ai/ask/route.ts`
- Render AI 服务：`apps/ai-service/src/routes/ask.ts`
- 配置载入：`apps/ai-service/src/lib/configLoader.ts`
- OpenAI 客户端：`apps/ai-service/src/lib/openaiClient.ts`
- Admin 配置页面：`src/app/admin/ai/config/page.tsx`
- Admin API：`src/app/api/admin/ai/config/route.ts`

---

> **总结**：代码层面已全面改用“按服务商命名 + 无默认值 + 单一入口路由”的新规范。后续所有配置、文档及数据库操作请严格参照本文件执行。*** End Patch


