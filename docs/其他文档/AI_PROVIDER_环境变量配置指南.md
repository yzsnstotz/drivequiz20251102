# AI Provider 环境变量配置指南

## 📊 当前数据库配置

根据数据库查询结果：
- **aiProvider**: `openrouter_direct`
- **model**: `openai/gpt-4o-mini`
- **更新时间**: `2025-11-16T07:04:47.583Z`

---

## 🔍 所有支持的 aiProvider 选项

根据代码分析，系统支持以下 6 种 aiProvider 选项：

### 1. `openrouter_direct` - 直连 OpenRouter
- **描述**: 直接调用 OpenRouter API，不通过 AI Service
- **当前配置**: ✅ 已启用

### 2. `openai_direct` - 直连 OpenAI
- **描述**: 直接调用 OpenAI API，不通过 AI Service

### 3. `gemini_direct` - 直连 Google Gemini
- **描述**: 直接调用 Google Gemini API，不通过 AI Service

### 4. `openrouter` - OpenRouter（通过 AI Service）
- **描述**: 通过 AI Service 调用 OpenRouter

### 5. `openai` - OpenAI（通过 AI Service）
- **描述**: 通过 AI Service 调用 OpenAI

### 6. `local` - 本地 AI（Ollama）
- **描述**: 使用本地 Ollama 服务

---

## 🔧 各选项所需的环境变量

### 1️⃣ `openrouter_direct`（当前配置）✅

**必需的环境变量**:
```bash
# OpenRouter API Key（必需）
OPENROUTER_API_KEY=sk-or-v1-xxx...

# OpenRouter 配置（必需，代码中有 requireEnvVar 检查）
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_REFERER_URL=https://zalem.app
OPENROUTER_APP_NAME=Zalem AI
```

**当前状态**:
- ❌ `OPENROUTER_API_KEY` - 未设置
- ❌ `OPENROUTER_BASE_URL` - 未设置
- ❌ `OPENROUTER_REFERER_URL` - 未设置
- ❌ `OPENROUTER_APP_NAME` - 未设置

**⚠️ 需要立即添加**: 所有 4 个环境变量都是必需的

---

### 2️⃣ `openai_direct`

**必需的环境变量**:
```bash
# OpenAI API Key（必需）
OPENAI_API_KEY=sk-xxx...

# OpenAI Base URL（必需，代码中有 requireEnvVar 检查）
OPENAI_BASE_URL=https://api.openai.com/v1
```

**当前状态**:
- ❌ `OPENAI_API_KEY` - 未设置
- ❌ `OPENAI_BASE_URL` - 未设置

---

### 3️⃣ `gemini_direct`

**必需的环境变量**:
```bash
# Google Gemini API Key（必需）
GEMINI_API_KEY=your-gemini-api-key

# Google Gemini Base URL（可选，有默认值）
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1
```

**当前状态**:
- ❌ `GEMINI_API_KEY` - 未设置
- ⚠️ `GEMINI_BASE_URL` - 未设置（有默认值，但建议显式设置）

---

### 4️⃣ `openrouter`（通过 AI Service）

**必需的环境变量**:
```bash
# AI Service 配置（必需）
AI_SERVICE_URL=https://your-ai-service-url.com
AI_SERVICE_TOKEN=your-service-token
```

**当前状态**:
- ❌ `AI_SERVICE_URL` - 未设置
- ❌ `AI_SERVICE_TOKEN` - 未设置

---

### 5️⃣ `openai`（通过 AI Service）

**必需的环境变量**:
```bash
# AI Service 配置（必需）
AI_SERVICE_URL=https://your-ai-service-url.com
AI_SERVICE_TOKEN=your-service-token
```

**当前状态**:
- ❌ `AI_SERVICE_URL` - 未设置
- ❌ `AI_SERVICE_TOKEN` - 未设置

---

### 6️⃣ `local`（本地 Ollama）

**必需的环境变量**:
```bash
# 本地 AI 服务配置（必需）
LOCAL_AI_SERVICE_URL=http://localhost:11434
LOCAL_AI_SERVICE_TOKEN=your-local-token
```

**回退机制**: 如果 `LOCAL_AI_SERVICE_URL` 或 `LOCAL_AI_SERVICE_TOKEN` 未配置，系统会回退到 `openai` 模式（需要 `AI_SERVICE_URL` 和 `AI_SERVICE_TOKEN`）

**当前状态**:
- ❌ `LOCAL_AI_SERVICE_URL` - 未设置
- ❌ `LOCAL_AI_SERVICE_TOKEN` - 未设置

---

## 🎯 当前配置所需的环境变量（立即需要）

由于当前数据库配置为 `openrouter_direct`，您需要添加以下环境变量到 `.env.local`:

```bash
# ============================================
# OpenRouter 直连配置（当前配置：openrouter_direct）
# ============================================

# OpenRouter API Key（必需）
# 获取方式：https://openrouter.ai/keys
OPENROUTER_API_KEY=sk-or-v1-xxx...

# OpenRouter Base URL（必需）
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# OpenRouter Referer URL（必需）
# 用于标识请求来源
OPENROUTER_REFERER_URL=https://zalem.app

# OpenRouter App Name（必需）
# 用于标识应用名称
OPENROUTER_APP_NAME=Zalem AI
```

---

## 📝 完整的 .env.local 配置示例

```bash
# ============================================
# 数据库配置
# ============================================

# DriveQuiz 主应用数据库（使用连接池，端口 6543）
DATABASE_URL=postgresql://postgres.vdtnzjvmvrcdplawwiae:tcaZ6b577mojAkYw@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require

# AI Service 数据库（直接连接，端口 5432）
AI_DATABASE_URL=postgresql://postgres:zKV0rtIV1QOByu89@db.cgpmpfnjzlzbquakmmrj.supabase.co:5432/postgres?sslmode=require

# ============================================
# 管理员配置
# ============================================

# 管理员 Token
ADMIN_TOKEN=Aa123456

# ============================================
# 时区配置
# ============================================

TZ=UTC

# ============================================
# OpenRouter 直连配置（当前配置：openrouter_direct）
# ============================================

# OpenRouter API Key（必需）
# 获取方式：https://openrouter.ai/keys
OPENROUTER_API_KEY=sk-or-v1-xxx...

# OpenRouter Base URL（必需）
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# OpenRouter Referer URL（必需）
OPENROUTER_REFERER_URL=https://zalem.app

# OpenRouter App Name（必需）
OPENROUTER_APP_NAME=Zalem AI

# ============================================
# OpenAI 直连配置（如果切换到 openai_direct）
# ============================================

# OpenAI API Key（可选，如果使用 openai_direct）
# OPENAI_API_KEY=sk-xxx...

# OpenAI Base URL（可选，如果使用 openai_direct）
# OPENAI_BASE_URL=https://api.openai.com/v1

# ============================================
# Google Gemini 直连配置（如果切换到 gemini_direct）
# ============================================

# Google Gemini API Key（可选，如果使用 gemini_direct）
# GEMINI_API_KEY=your-gemini-api-key

# Google Gemini Base URL（可选，有默认值）
# GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1

# ============================================
# AI Service 配置（如果使用 openrouter 或 openai 模式）
# ============================================

# AI Service URL（可选，如果使用 openrouter 或 openai 模式）
# AI_SERVICE_URL=https://your-ai-service-url.com

# AI Service Token（可选，如果使用 openrouter 或 openai 模式）
# AI_SERVICE_TOKEN=your-service-token

# ============================================
# 本地 AI 服务配置（如果使用 local 模式）
# ============================================

# 本地 AI 服务 URL（可选，如果使用 local 模式）
# LOCAL_AI_SERVICE_URL=http://localhost:11434

# 本地 AI 服务 Token（可选，如果使用 local 模式）
# LOCAL_AI_SERVICE_TOKEN=your-local-token

# ============================================
# 用户 JWT 密钥（用于用户认证）
# ============================================

# USER_JWT_SECRET=your-jwt-secret-key
```

---

## ✅ 验证步骤

### 1. 添加环境变量后，重启开发服务器

```bash
# 停止当前服务器（Ctrl+C）
# 然后重新启动
npm run dev
```

### 2. 测试 API 调用

```bash
curl -X POST http://localhost:3000/api/ai/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "测试问题", "locale": "zh"}'
```

### 3. 检查日志

查看控制台输出，确认：
- ✅ `[STEP 0.2] 数据库配置: openrouter_direct`
- ✅ `[STEP 5.1.1] API Key 检查` - 显示 API Key 已设置
- ✅ `[STEP 5] 开始直连OpenRouter处理`

---

## 🔄 切换 aiProvider 配置

如果需要切换到其他 aiProvider，需要：

1. **更新数据库配置**:
   ```sql
   UPDATE ai_config 
   SET value = 'openai_direct', updated_at = NOW() 
   WHERE key = 'aiProvider';
   ```

2. **添加对应的环境变量**（参考上面的配置指南）

3. **重启开发服务器**

---

## 📌 总结

### 当前状态
- **数据库配置**: `openrouter_direct` ✅
- **环境变量**: 全部未设置 ❌

### 需要立即添加
由于当前配置为 `openrouter_direct`，需要添加以下 4 个环境变量：
1. `OPENROUTER_API_KEY` - 必需
2. `OPENROUTER_BASE_URL` - 必需
3. `OPENROUTER_REFERER_URL` - 必需
4. `OPENROUTER_APP_NAME` - 必需

### 获取 OpenRouter API Key
1. 访问 https://openrouter.ai/keys
2. 登录或注册账号
3. 创建新的 API Key
4. 复制 API Key（格式：`sk-or-v1-xxx...`）
5. 添加到 `.env.local` 文件

---

## ⚠️ 注意事项

1. **API Key 安全**: 不要将 API Key 提交到 Git 仓库
2. **环境变量格式**: 确保没有多余的空格或换行符
3. **重启服务器**: 修改 `.env.local` 后必须重启开发服务器
4. **数据库配置优先**: 系统优先从数据库读取 `aiProvider` 配置，而不是环境变量

