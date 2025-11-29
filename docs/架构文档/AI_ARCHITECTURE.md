# 🏗️ AI 架构说明

## 📋 系统架构

### 架构概览

```
用户浏览器
    ↓
Vercel (Next.js 主站)
    ↓ /api/ai/ask
Render (AI-Service)
    ↓
OpenAI API
```

### 组件说明

1. **Vercel (Next.js 主站)**
   - 部署在 Vercel
   - 处理用户认证、配额管理
   - 转发请求到 AI-Service
   - **不需要配置 OPENAI_API_KEY**

2. **Render (AI-Service)**
   - 部署在 Render
   - 处理 RAG 检索、向量搜索
   - 调用 OpenAI API
   - **需要配置 OPENAI_API_KEY**

3. **OpenAI API**
   - 由 AI-Service (Render) 调用
   - 生成 AI 回答

---

## 🔄 请求流程

### 用户请求 AI 回答

1. **前端** (`AIPage.tsx`)
   - 用户输入问题
   - 调用 `/api/ai/ask` 路由

2. **主站 API** (`/api/ai/ask`)
   - 验证用户 JWT
   - 检查每日配额（10次/日）
   - 转发请求到 AI-Service (Render)
   - 携带 `AI_SERVICE_TOKEN` 认证

3. **AI-Service** (`/v1/ask`)
   - 验证 Service Token
   - 执行 RAG 检索（向量搜索）
   - 调用 OpenAI API
   - 返回回答和来源

4. **主站 API**
   - 接收 AI-Service 响应
   - 返回给前端

5. **前端**
   - 显示回答和来源

---

## 🔑 环境变量配置

### Vercel (主站)

**必需的环境变量：**

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `AI_SERVICE_URL` | AI-Service 的 URL | `https://ai-service.onrender.com` |
| `AI_SERVICE_TOKEN` | Service Token（用于认证） | `svc_token_xxx` |
| `USER_JWT_SECRET` | JWT 密钥（用于用户认证） | `your-secret-key` |
| `DATABASE_URL` | 数据库连接字符串 | `postgresql://...` |

**不需要配置：**
- ❌ `OPENAI_API_KEY` - 不需要，由 AI-Service (Render) 处理

### Render (AI-Service)

**必需的环境变量：**

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `OPENAI_API_KEY` | OpenAI API 密钥 | `sk-xxx...` |
| `AI_MODEL` | AI 模型（可选） | `gpt-4o-mini` |
| `SUPABASE_URL` | Supabase 项目 URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase Service Key | `eyJxxx...` |
| `SERVICE_TOKENS` | Service Token 列表 | `svc_token_xxx` |
| `PORT` | 服务端口 | `8787` |

---

## 📝 路由说明

### 主站路由

| 路由 | 方法 | 功能 | 转发到 |
|------|------|------|--------|
| `/api/ai/ask` | POST | 用户问答（转发到 AI-Service） | Render `/v1/ask` |
| `/api/ai/chat` | POST | 直接调用 OpenAI（备用，不推荐） | OpenAI API |

### AI-Service 路由

| 路由 | 方法 | 功能 |
|------|------|------|
| `/v1/ask` | POST | 处理问答请求（RAG + OpenAI） |
| `/healthz` | GET | 健康检查 |
| `/v1/admin/daily-summary` | GET | 每日摘要 |

---

## ✅ 为什么 Vercel 不需要 OPENAI_API_KEY？

1. **架构设计**：Vercel 主站只负责转发请求，不直接调用 OpenAI
2. **安全隔离**：API Key 只在 AI-Service (Render) 中配置，减少泄露风险
3. **独立部署**：AI-Service 可以独立扩展，不影响主站
4. **统一管理**：所有 OpenAI 调用集中在 AI-Service，便于监控和日志

---

## 🔧 如何切换路由？

### 当前使用（推荐）

```typescript
// AIPage.tsx
const CHAT_PATH = "/api/ai/ask"; // 转发到 AI-Service (Render)
```

### 备用方案（不推荐）

如果需要直接调用 OpenAI（不经过 AI-Service），可以：

```typescript
// AIPage.tsx
const CHAT_PATH = "/api/ai/chat"; // 直接调用 OpenAI
```

**注意**：使用 `/api/ai/chat` 需要在 Vercel 配置 `OPENAI_API_KEY`，且无法使用 RAG 功能。

---

## 📚 相关文档

- [AI 环境变量配置](./AI_ENV_SETUP.md)
- [Vercel Preview 修复指南](./VERCEL_PREVIEW_FIX.md)
- [AI 测试指南](./AI_TESTING_GUIDE.md)

