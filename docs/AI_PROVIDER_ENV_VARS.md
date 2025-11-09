# AI 服务商环境变量速查（2025-11）

## 1. OpenAI（Render）
| 变量 | 说明 |
|------|------|
| `OPENAI_API_KEY` | OpenAI API Key |
| `OPENAI_BASE_URL` | OpenAI Base URL（如 `https://api.openai.com/v1`） |

> `OPENAI_BASE_URL` 为必填，未设置会在服务启动时报错。

---

## 2. OpenRouter（Render 代理）
| 变量 | 说明 |
|------|------|
| `OPENROUTER_API_KEY` | OpenRouter API Key |
| `OPENROUTER_BASE_URL` | OpenRouter Base URL（例如 `https://openrouter.ai/api/v1`） |
| `OPENROUTER_REFERER_URL` | OpenRouter 要求的 HTTP-Referer |
| `OPENROUTER_APP_NAME` | OpenRouter 要求的 X-Title |

> Render 环境通过 `apps/ai-service` 使用，必须全部配置。

---

## 3. OpenRouter 直连（Vercel 主站）

除上述 `OPENROUTER_*` 变量外，需要额外保证：
- Vercel 项目启用了 `openrouter_direct` 模式（数据库 `aiProvider` 值）
- 主站路由 `src/app/api/ai/ask/route.ts` 会直接请求 `OPENROUTER_BASE_URL`

---

## 4. 本地 Ollama
| 变量 | 说明 |
|------|------|
| `OLLAMA_BASE_URL` | Ollama API Base URL |
| `AI_MODEL` | 对话模型（如 `llama3.2:3b`） |
| `EMBEDDING_MODEL` | 向量模型（如 `nomic-embed-text`） |

> 所有变量必须显式配置，无默认值。

---

## 5. 主站代理（通用）
| 变量 | 说明 |
|------|------|
| `AI_SERVICE_URL` / `AI_SERVICE_TOKEN` | Render AI-Service 地址与凭证 |
| `LOCAL_AI_SERVICE_URL` / `LOCAL_AI_SERVICE_TOKEN` | 本地 Ollama 服务地址与凭证 |
| `USER_JWT_SECRET` | 用户 JWT 校验密钥 |

主站会根据 `ai_config.aiProvider` 自动选择本地 / Render / 直连模式，并在转发 Render 请求时附带 `X-AI-Provider: openai | openrouter`。

---

## 6. 推荐配置总览

| 场景 | 必填变量 |
|------|----------|
| **Render + OpenAI** | `OPENAI_API_KEY`, `OPENAI_BASE_URL` |
| **Render + OpenRouter** | `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`, `OPENROUTER_REFERER_URL`, `OPENROUTER_APP_NAME` |
| **直连 OpenRouter** | 同上，在 Vercel 主站配置 |
| **本地 Ollama** | `OLLAMA_BASE_URL`, `AI_MODEL`, `EMBEDDING_MODEL`, `SERVICE_TOKENS` |

---

> 所有环境变量均无默认值；缺少配置将导致应用在启动或运行时立即报错。*** End Patch


