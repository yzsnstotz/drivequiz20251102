# ZALEM 项目状态与数据库结构汇总报告

> **生成日期**: 2025-01-XX  
> **项目版本**: 1.0.8  
> **报告目的**: 为 ZALEM 前台架构优化与数据库扩展提供完整上下文基础

---

## 📋 目录

1. [项目结构总览](#1-项目结构总览)
2. [环境变量说明](#2-环境变量说明)
3. [数据库结构](#3-数据库结构)
4. [API 路由清单](#4-api-路由清单)
5. [部署与集成状态](#5-部署与集成状态)
6. [技术规范与依赖版本](#6-技术规范与依赖版本)
7. [待补充项](#7-待补充项)

---

## 1. 项目结构总览

### 1.1 Monorepo 架构

```
New Front End/
├── apps/
│   ├── web/              # Next.js Web 应用（前台）
│   │   ├── app/          # Next.js App Router
│   │   │   ├── admin/    # 后台管理页面
│   │   │   └── api/      # API 路由
│   │   └── vercel.json   # Vercel 部署配置
│   └── ai-service/       # Fastify AI 服务（独立服务）
│       ├── src/
│       │   ├── index.ts           # 服务入口
│       │   ├── routes/            # API 路由
│       │   ├── lib/               # 工具库
│       │   ├── middlewares/       # 中间件
│       │   ├── jobs/              # 定时任务
│       │   └── tasks/             # 后台任务
│       ├── Dockerfile
│       └── package.json
├── src/                   # 主应用源代码（Next.js）
│   ├── app/               # Next.js App Router
│   │   ├── api/           # API 路由（68+ 个路由文件）
│   │   └── admin/         # 后台管理页面
│   ├── components/        # React 组件
│   ├── lib/               # 工具库
│   ├── contexts/          # React Context
│   ├── data/              # 静态数据
│   └── migrations/        # 数据库迁移文件（29 个）
├── scripts/               # 脚本文件（35 个）
├── docs/                  # 文档目录
├── tests/                 # 测试文件
└── 配置文件
    ├── package.json
    ├── tsconfig.json
    ├── next.config.js
    ├── tailwind.config.js
    ├── eslint.config.js
    ├── docker-compose.yml
    ├── render.yaml
    └── vercel.json
```

### 1.2 应用模块说明

#### **apps/web** - Next.js Web 应用
- **框架**: Next.js 15.0.0 (App Router)
- **用途**: 前台用户界面 + 后台管理系统
- **部署**: Vercel
- **主要功能**:
  - 用户前台界面
  - 后台管理界面（Admin）
  - API 路由（Next.js API Routes）

#### **apps/ai-service** - Fastify AI 服务
- **框架**: Fastify 5.1.0
- **用途**: 独立的 AI 问答服务
- **部署**: Render.com
- **主要功能**:
  - AI 问答接口 (`/v1/ask`)
  - RAG 向量化 (`/v1/admin/rag/ingest`)
  - 每日摘要 (`/v1/admin/daily-summary`)
  - 缓存预热 (`/v1/admin/cache-prewarm`)

---

## 2. 环境变量说明

### 2.1 主应用（Next.js Web App）

#### 必需环境变量

| 变量名 | 用途 | 示例值 |
|--------|------|--------|
| `DATABASE_URL` | 主数据库连接字符串 | `postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres?sslmode=require` |
| `ADMIN_TOKEN` | 管理员 API 鉴权 Token | `your-secure-token-here` |
| `TZ` | 时区 | `UTC` |

#### AI 相关环境变量

| 变量名 | 用途 | 必需 | 示例值 |
|--------|------|------|--------|
| `OPENAI_API_KEY` | OpenAI API 密钥 | ✅ | `sk-xxx...` |
| `AI_MODEL` | 默认 AI 模型 | ❌ | `gpt-4o-mini` |
| `AI_SERVICE_URL` | AI 服务地址 | ✅ | `https://ai.zalem.app` |
| `AI_SERVICE_TOKEN` | AI 服务调用凭证 | ✅ | `svc_xxx...` |
| `SUPABASE_URL` | Supabase 项目 URL | ✅ | `https://xyz.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase 服务端密钥 | ✅ | `eyJxxx...` |
| `SUPABASE_ANON_KEY` | Supabase 前端匿名密钥 | ✅ | `eyJxxx...` |
| `AI_CACHE_REDIS_URL` | Redis 缓存连接（可选） | ❌ | `redis://...` |
| `AI_SERVICE_SUMMARY_URL` | AI 摘要接口地址 | ✅ | `https://ai.zalem.app/v1/admin/daily-summary` |

### 2.2 AI Service (Fastify App)

#### 必需环境变量

| 变量名 | 用途 | 必需 | 示例值 |
|--------|------|------|--------|
| `OPENAI_API_KEY` | OpenAI API 密钥 | ✅ | `sk-xxx...` |
| `AI_MODEL` | 默认 AI 模型 | ❌ | `gpt-4o-mini` |
| `PORT` | 服务端口 | ❌ | `8787` |
| `HOST` | 服务监听地址 | ❌ | `0.0.0.0` |
| `SERVICE_TOKENS` | 白名单 Token 列表（逗号分隔） | ✅ | `svc_token1,svc_token2` |
| `SUPABASE_URL` | Supabase 项目 URL | ✅ | `https://xyz.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase 服务端密钥 | ✅ | `eyJxxx...` |
| `AI_CACHE_REDIS_URL` | Redis 缓存连接（可选） | ❌ | `redis://...` |
| `NODE_ENV` | 运行环境 | ❌ | `production` / `development` |

### 2.3 环境变量配置方式

#### 本地开发
- **主应用**: 使用 `.env.local` 文件（Next.js 自动读取）
- **AI Service**: 使用 `apps/ai-service/.env` 文件（dotenv 加载）

#### 生产环境
- **主应用 (Vercel)**: 通过 Vercel Dashboard → Settings → Environment Variables 配置
- **AI Service (Render)**: 通过 Render Dashboard → Environment Variables 配置

> 📝 **详细说明**: 参考 `docs/ENV_SETUP.md` 和 `docs/AI_ENV_SETUP.md`

---

## 3. 数据库结构

### 3.1 数据库概览

项目使用 **PostgreSQL** 数据库，部署在 **Supabase** 平台。

#### 数据库连接方式
- **主应用**: 使用直接数据库连接（Kysely + pg）
- **AI Service**: 使用 Supabase REST API（PostgREST）

#### 数据库实例
- **主数据库**: `drivequiz` / `driveapp`（主应用数据）
- **AI 数据库**: 可能独立实例（AI Service 专用）

> ⚠️ **注意**: 当前 `DATABASE_URL` 和 `SUPABASE_URL` 可能指向不同数据库实例，需要确认统一。

### 3.2 数据库表结构

#### 3.2.1 AI 相关表

##### **ai_logs** - AI 问答日志表
```sql
CREATE TABLE ai_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,                    -- 用户 ID（关联 users.userid）
  question TEXT NOT NULL,          -- 用户问题
  answer TEXT,                     -- AI 回答
  locale VARCHAR(8) DEFAULT 'ja', -- 语言代码
  model VARCHAR(32),              -- AI 模型名称
  rag_hits INTEGER DEFAULT 0,     -- RAG 命中次数
  cost_est NUMERIC(10,4),         -- 成本估算（USD）
  safety_flag VARCHAR(16) DEFAULT 'ok', -- 安全标志
  sources JSONB DEFAULT '[]',      -- 来源文档（JSONB）
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**索引**:
- `idx_ai_logs_created_at` (created_at DESC)
- `idx_ai_logs_user_id` (user_id)
- `idx_ai_logs_model` (model)
- `idx_ai_logs_sources` (GIN index on sources)

**迁移文件**: `20250115_create_ai_tables.sql`, `20251103_ai_core.sql`, `20251105_add_sources_to_ai_logs.sql`

---

##### **ai_filters** - AI 禁答关键词规则表
```sql
CREATE TABLE ai_filters (
  id BIGSERIAL PRIMARY KEY,
  type VARCHAR(32) NOT NULL,       -- not-driving / sensitive
  pattern TEXT NOT NULL,           -- 正则表达式
  status VARCHAR(16) DEFAULT 'draft', -- draft / active / inactive
  changed_by INTEGER,              -- 修改人（关联 admins.id）
  changed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**索引**:
- `idx_ai_filters_type` (type)
- `idx_ai_filters_type_unique` (type UNIQUE)

**迁移文件**: `20250115_create_ai_tables.sql`, `20251107_add_filters_versioning_and_audit.sql`

---

##### **ai_filters_history** - AI 过滤器历史记录表
```sql
CREATE TABLE ai_filters_history (
  id BIGSERIAL PRIMARY KEY,
  filter_id BIGINT NOT NULL,       -- 关联 ai_filters.id
  type VARCHAR(32) NOT NULL,
  pattern TEXT NOT NULL,
  status VARCHAR(16),
  changed_by INTEGER,
  changed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**迁移文件**: `20251107_add_filters_versioning_and_audit.sql`

---

##### **ai_rag_docs** - RAG 文档元数据表
```sql
CREATE TABLE ai_rag_docs (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,             -- 文档标题
  url TEXT,                        -- 文档 URL
  version VARCHAR(32),             -- 版本号
  chunks INTEGER DEFAULT 0,        -- 分块数量
  uploaded_by UUID,                -- 上传人
  lang VARCHAR(8),                 -- 语言代码
  tags TEXT[],                     -- 标签数组
  status VARCHAR(32) DEFAULT 'ready', -- ready / processing / error
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**索引**:
- `idx_ai_rag_docs_created_at` (created_at DESC)
- `idx_ai_rag_docs_status` (status)
- `idx_ai_rag_docs_lang` (lang)

**迁移文件**: `20250115_create_ai_tables.sql`, `20251103_ai_core.sql`

---

##### **ai_vectors** - RAG 向量存储表
```sql
CREATE TABLE ai_vectors (
  id BIGSERIAL PRIMARY KEY,
  doc_id VARCHAR(64),              -- 文档 ID
  content TEXT,                     -- 文本内容
  embedding vector(1536),          -- 向量嵌入（pgvector）
  source_title TEXT,                -- 来源标题
  source_url TEXT,                  -- 来源 URL
  version VARCHAR(32),              -- 版本号
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**索引**:
- `idx_ai_vectors_doc_id` (doc_id)
- `idx_ai_vectors_version` (version)
- `idx_ai_vectors_embedding` (ivfflat index on embedding)

**扩展要求**: 需要 `pgvector` 扩展

**迁移文件**: `20250115_create_ai_tables.sql`, `20251103_ai_core.sql`, `20250115_migrate_to_ollama_768d.sql`

---

##### **ai_daily_summary** - AI 每日汇总统计表
```sql
CREATE TABLE ai_daily_summary (
  date DATE PRIMARY KEY,           -- 日期（主键）
  total_calls INTEGER,             -- 总调用次数
  avg_cost NUMERIC(10,4),          -- 平均成本
  cache_hit_rate NUMERIC(4,2),     -- 缓存命中率
  rag_hit_rate NUMERIC(4,2),       -- RAG 命中率
  top_questions JSONB,            -- 热门问题（JSONB）
  new_topics JSONB,                -- 新话题（JSONB）
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**索引**:
- `idx_ai_daily_summary_date` (date DESC)

**迁移文件**: `20250115_create_ai_tables.sql`, `20251103_ai_core.sql`

---

##### **ai_config** - AI 配置中心表
```sql
CREATE TABLE ai_config (
  id SERIAL PRIMARY KEY,
  key VARCHAR(64) NOT NULL UNIQUE, -- 配置键
  value TEXT NOT NULL,             -- 配置值
  description TEXT,                -- 描述
  updated_by INTEGER,              -- 更新人（关联 admins.id）
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**默认配置项**:
- `dailyAskLimit`: 每用户每日提问限制（默认: 10）
- `answerCharLimit`: 回答字符限制（默认: 300）
- `model`: AI 模型名称（默认: gpt-4o-mini）
- `cacheTtl`: 缓存 TTL（秒，默认: 86400）
- `costAlertUsdThreshold`: 成本警告阈值（USD，默认: 10.00）

**索引**:
- `idx_ai_config_key` (key)
- `idx_ai_config_updated_at` (updated_at DESC)

**迁移文件**: `20251108_create_ai_config.sql`

---

#### 3.2.2 用户相关表

##### **users** - 用户表
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  userid VARCHAR(255) UNIQUE,      -- 用户唯一标识符（用于 AI 日志关联）
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(100),
  phone VARCHAR(20),
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'suspended', 'pending')),
  activation_code_id INTEGER,      -- 关联激活码
  registration_info JSONB DEFAULT '{}', -- 注册信息（JSONB）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  notes TEXT
);
```

**索引**:
- `idx_users_userid` (userid)
- `idx_users_email` (email)
- `idx_users_status` (status)
- `idx_users_activation_code_id` (activation_code_id)
- `idx_users_created_at` (created_at DESC)
- `idx_users_last_login_at` (last_login_at DESC)

**迁移文件**: `20251110_create_users_and_user_behaviors.sql`

---

##### **user_behaviors** - 用户行为表
```sql
CREATE TABLE user_behaviors (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,        -- 关联 users.id
  behavior_type VARCHAR(50) NOT NULL
    CHECK (behavior_type IN ('login', 'logout', 'start_quiz', 'complete_quiz', 
          'pause_quiz', 'resume_quiz', 'view_page', 'ai_chat', 'other')),
  ip_address VARCHAR(45),
  user_agent TEXT,
  client_type VARCHAR(20)
    CHECK (client_type IS NULL OR client_type IN ('web', 'mobile', 'api', 'desktop', 'other')),
  client_version VARCHAR(50),
  device_info JSONB DEFAULT '{}',  -- 设备信息（JSONB）
  metadata JSONB DEFAULT '{}',     -- 行为元数据（JSONB）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);
```

**索引**:
- `idx_user_behaviors_user_id` (user_id)
- `idx_user_behaviors_behavior_type` (behavior_type)
- `idx_user_behaviors_created_at` (created_at DESC)
- `idx_user_behaviors_ip_address` (ip_address)
- `idx_user_behaviors_client_type` (client_type)
- `idx_user_behaviors_user_behavior_time` (user_id, behavior_type, created_at DESC)
- `idx_user_behaviors_user_time` (user_id, created_at DESC)

**触发器**:
- `trigger_update_user_last_login`: 自动更新 `users.last_login_at`

**迁移文件**: `20251110_create_users_and_user_behaviors.sql`

---

#### 3.2.3 管理相关表

##### **admins** - 管理员表
```sql
CREATE TABLE admins (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name VARCHAR(100),
  role VARCHAR(50) DEFAULT 'admin',
  permissions JSONB DEFAULT '{}',  -- 权限配置（JSONB）
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);
```

**迁移文件**: `20251103_add_admins_and_operation_logs.sql`

---

##### **operation_logs** - 操作日志表
```sql
CREATE TABLE operation_logs (
  id BIGSERIAL PRIMARY KEY,
  admin_id INTEGER NOT NULL,       -- 关联 admins.id
  action VARCHAR(100) NOT NULL,    -- 操作类型
  resource_type VARCHAR(50),       -- 资源类型
  resource_id INTEGER,            -- 资源 ID
  details JSONB DEFAULT '{}',     -- 详细信息（JSONB）
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**迁移文件**: `20251103_add_admins_and_operation_logs.sql`

---

#### 3.2.4 业务相关表

##### **merchants** - 商户表
```sql
CREATE TABLE merchants (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  image_url VARCHAR(500),
  category VARCHAR(100),          -- 关联 merchant_categories.name
  status VARCHAR(20) DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**索引**:
- `idx_merchants_status` (status)
- `idx_merchants_category` (category)

**迁移文件**: `20251104_create_merchants_and_videos.sql`

---

##### **merchant_categories** - 商户分类表
```sql
CREATE TABLE merchant_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  display_order INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**索引**:
- `idx_merchant_categories_status` (status)

**迁移文件**: `20251104_create_merchants_and_videos.sql`

---

##### **videos** - 视频表
```sql
CREATE TABLE videos (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  url VARCHAR(500) NOT NULL,
  thumbnail VARCHAR(500),
  category VARCHAR(50) NOT NULL
    CHECK (category IN ('basic', 'advanced')),
  display_order INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**索引**:
- `idx_videos_category` (category)
- `idx_videos_status` (status)
- `idx_videos_display_order` (display_order)

**迁移文件**: `20251104_create_merchants_and_videos.sql`

---

##### **contact_info** - 联系信息表
```sql
CREATE TABLE contact_info (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  message TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**迁移文件**: `20251104_create_contact_info.sql`

---

##### **terms_of_service** - 服务条款表
```sql
CREATE TABLE terms_of_service (
  id SERIAL PRIMARY KEY,
  version VARCHAR(50) NOT NULL UNIQUE,
  content TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**迁移文件**: `20251104_create_contact_info.sql`

---

##### **activation_codes** - 激活码表
```sql
-- 表结构（根据代码推断）
CREATE TABLE activation_codes (
  id SERIAL PRIMARY KEY,
  code VARCHAR(255) NOT NULL UNIQUE,
  -- 其他字段（需要查看实际迁移文件）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**迁移文件**: 需要查看实际迁移文件

---

### 3.3 数据库迁移文件清单

按时间顺序排列（从旧到新）：

1. `20250115_create_ai_tables.sql` - 创建 AI 核心表
2. `20250115_create_match_documents_rpc.sql` - 创建 RAG 匹配函数
3. `20250115_migrate_to_ollama_768d.sql` - 迁移到 Ollama 768d 向量
4. `20251101_add_activation_admin_fields.sql` - 添加激活码管理字段
5. `20251102_add_validity_period_fields.sql` - 添加有效期字段
6. `20251103_add_admins_and_operation_logs.sql` - 创建管理员和操作日志表
7. `20251103_ai_core.sql` - AI 核心表（重构）
8. `20251103_ai_rls.sql` - AI 表 RLS 策略
9. `20251103_ai_rpc.sql` - AI RPC 函数
10. `20251104_create_contact_info.sql` - 创建联系信息和服务条款表
11. `20251104_create_merchants_and_videos.sql` - 创建商户和视频表
12. `20251104_fix_ai_tables_schema.sql` - 修复 AI 表结构
13. `20251105_add_admin_permissions.sql` - 添加管理员权限
14. `20251105_add_sources_to_ai_logs.sql` - 添加 sources 字段到 ai_logs
15. `20251106_remove_activations_unique_constraint.sql` - 移除激活码唯一约束
16. `20251107_add_filters_versioning_and_audit.sql` - 添加过滤器版本化和审计
17. `20251108_create_ai_config.sql` - 创建 AI 配置中心表
18. `20251109_change_ai_logs_user_id_to_text.sql` - 修改 ai_logs.user_id 为文本
19. `20251110_add_ai_chat_behavior_type.sql` - 添加 AI 聊天行为类型
20. `20251110_add_userid_to_users.sql` - 添加 userid 字段到 users
21. `20251110_create_users_and_user_behaviors.sql` - 创建用户和用户行为表
22. `20251111_add_ai_config_rls.sql` - 添加 ai_config RLS 策略
23. `20251111_add_rls_to_all_tables.sql` - 为所有表添加 RLS
24. `20251111_fix_function_search_path.sql` - 修复函数搜索路径
25. `20251111_fix_multiple_permissive_policies.sql` - 修复多个宽松策略
26. `20251111_fix_multiple_permissive_policies_ai.sql` - 修复 AI 表多个宽松策略
27. `20251111_fix_remaining_function_search_path.sql` - 修复剩余函数搜索路径
28. `20251111_move_vector_extension.sql` - 移动向量扩展
29. `20251111_optimize_ai_config_rls_performance.sql` - 优化 ai_config RLS 性能

---

## 4. API 路由清单

### 4.1 Next.js API 路由（主应用）

#### 4.1.1 前台 API 路由

| 路由路径 | 方法 | 说明 |
|---------|------|------|
| `/api/activate` | POST | 激活码激活 |
| `/api/activation/check` | GET | 检查激活状态 |
| `/api/login` | POST | 用户登录 |
| `/api/ai/ask` | POST | AI 问答（前台） |
| `/api/ai/chat` | POST | AI 聊天（前台） |
| `/api/videos` | GET | 获取视频列表 |
| `/api/merchants` | GET | 获取商户列表 |
| `/api/merchant-categories` | GET | 获取商户分类 |
| `/api/contact-info` | POST | 提交联系信息 |
| `/api/terms-of-service` | GET | 获取服务条款 |
| `/api/user-behaviors` | POST | 记录用户行为 |

#### 4.1.2 后台管理 API 路由

##### **管理员相关**
| 路由路径 | 方法 | 说明 |
|---------|------|------|
| `/api/admin/admins` | GET, POST | 管理员列表/创建 |
| `/api/admin/admins/[id]` | GET, PUT, DELETE | 管理员详情/更新/删除 |
| `/api/admin/admins/me/change-password` | POST | 修改密码 |
| `/api/admin/me` | GET | 当前管理员信息 |
| `/api/admin/ping` | GET | 健康检查 |

##### **AI 相关**
| 路由路径 | 方法 | 说明 |
|---------|------|------|
| `/api/admin/ai/config` | GET, PUT | AI 配置管理 |
| `/api/admin/ai/filters` | GET, POST | AI 过滤器列表/创建 |
| `/api/admin/ai/filters/[id]/status` | PUT | 更新过滤器状态 |
| `/api/admin/ai/filters/history` | GET | 过滤器历史记录 |
| `/api/admin/ai/filters/test` | POST | 测试过滤器 |
| `/api/admin/ai/logs` | GET | AI 日志查询 |
| `/api/admin/ai/rag/docs` | GET, POST | RAG 文档列表/上传 |
| `/api/admin/ai/rag/docs/[docId]/status` | GET | 文档状态 |
| `/api/admin/ai/rag/docs/[docId]/reindex` | POST | 重新索引文档 |
| `/api/admin/ai/summary` | GET | AI 每日摘要 |
| `/api/admin/ai/summary/rebuild` | POST | 重建摘要 |
| `/api/admin/ai/cache/prewarm` | POST | 缓存预热 |

##### **用户相关**
| 路由路径 | 方法 | 说明 |
|---------|------|------|
| `/api/admin/users` | GET, POST | 用户列表/创建 |
| `/api/admin/users/[id]` | GET, PUT, DELETE | 用户详情/更新/删除 |
| `/api/admin/users/[id]/behaviors` | GET | 用户行为记录 |

##### **激活码相关**
| 路由路径 | 方法 | 说明 |
|---------|------|------|
| `/api/admin/activation-codes` | GET, POST | 激活码列表/创建 |
| `/api/admin/activation-codes/[id]` | GET, PUT, DELETE | 激活码详情/更新/删除 |
| `/api/admin/activation-codes/by-code/[code]` | GET | 根据代码查询激活码 |
| `/api/admin/activation-codes/stats` | GET | 激活码统计 |

##### **商户相关**
| 路由路径 | 方法 | 说明 |
|---------|------|------|
| `/api/admin/merchants` | GET, POST | 商户列表/创建 |
| `/api/admin/merchants/[id]` | GET, PUT, DELETE | 商户详情/更新/删除 |
| `/api/admin/merchant-categories` | GET, POST | 商户分类列表/创建 |
| `/api/admin/merchant-categories/[id]` | GET, PUT, DELETE | 商户分类详情/更新/删除 |

##### **视频相关**
| 路由路径 | 方法 | 说明 |
|---------|------|------|
| `/api/admin/videos` | GET, POST | 视频列表/创建 |
| `/api/admin/videos/[id]` | GET, PUT, DELETE | 视频详情/更新/删除 |

##### **题目相关**
| 路由路径 | 方法 | 说明 |
|---------|------|------|
| `/api/admin/questions` | GET, POST | 题目列表/创建 |
| `/api/admin/questions/[id]` | GET, PUT, DELETE | 题目详情/更新/删除 |
| `/api/admin/questions/categories` | GET | 题目分类 |
| `/api/admin/questions/import` | POST | 导入题目 |
| `/api/admin/questions/template` | GET | 题目导入模板 |

##### **其他管理功能**
| 路由路径 | 方法 | 说明 |
|---------|------|------|
| `/api/admin/contact-info` | GET, POST | 联系信息列表/创建 |
| `/api/admin/contact-info/[id]` | GET, PUT, DELETE | 联系信息详情/更新/删除 |
| `/api/admin/terms-of-service` | GET, PUT | 服务条款管理 |
| `/api/admin/operation-logs` | GET | 操作日志查询 |
| `/api/admin/tasks/sweep-expired` | POST | 清理过期数据 |
| `/api/admin/diagnose` | GET | 系统诊断 |
| `/api/admin/ip-geolocation` | GET | IP 地理位置查询 |
| `/api/_debug-alive` | GET | 调试存活检查 |

### 4.2 Fastify API 路由（AI Service）

| 路由路径 | 方法 | 说明 |
|---------|------|------|
| `/healthz` | GET | 健康检查（Render 用） |
| `/readyz` | GET | 就绪检查 |
| `/health` | GET | 健康检查（向后兼容） |
| `/v1/ask` | POST | AI 问答接口 |
| `/v1/admin/daily-summary` | GET | 每日摘要 |
| `/v1/admin/rag/ingest` | POST | RAG 向量化 |
| `/v1/admin/cache-prewarm` | POST | 缓存预热 |

---

## 5. 部署与集成状态

### 5.1 部署平台

#### **主应用 (Next.js Web App)**
- **平台**: Vercel
- **配置文件**: `vercel.json`
- **构建命令**: `npm run build`
- **输出目录**: `.next`
- **框架**: Next.js

**Vercel 配置**:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs"
}
```

#### **AI Service (Fastify App)**
- **平台**: Render.com
- **配置文件**: `render.yaml`
- **服务类型**: Web Service + Cron Job
- **端口**: 8787
- **健康检查**: `/healthz`

**Render 配置**:
```yaml
services:
  - type: web
    name: zalem-ai-service
    env: node
    rootDir: apps/ai-service
    buildCommand: npm install && npm run build
    startCommand: npm run start
    healthCheckPath: /healthz
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 8787

  - type: cron
    name: ai-daily-summarize
    rootDir: apps/ai-service
    schedule: "0 0 * * *"
    buildCommand: npm install && npm run build
    startCommand: node dist/tasks/dailySummarize.js
```

### 5.2 数据库部署

#### **主数据库**
- **平台**: Supabase
- **连接方式**: 直接连接（Kysely + pg）
- **环境变量**: `DATABASE_URL`

#### **AI 数据库**
- **平台**: Supabase（可能独立实例）
- **连接方式**: Supabase REST API（PostgREST）
- **环境变量**: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`

### 5.3 Docker 配置

**docker-compose.yml**:
```yaml
version: "3.8"
services:
  pg:
    image: postgres:16
    container_name: zalem-pg
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: drivequiz
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```

**用途**: 本地开发环境数据库

### 5.4 集成服务

#### **OpenAI**
- **用途**: AI 问答服务
- **模型**: gpt-4o-mini（默认）
- **环境变量**: `OPENAI_API_KEY`

#### **Supabase**
- **用途**: 数据库 + 认证 + 存储
- **环境变量**: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_ANON_KEY`

#### **Redis**（可选）
- **用途**: 缓存
- **环境变量**: `AI_CACHE_REDIS_URL`

---

## 6. 技术规范与依赖版本

### 6.1 主应用依赖

#### **核心依赖**
```json
{
  "next": "^15.0.0",
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "typescript": "^5.5.3"
}
```

#### **数据库相关**
```json
{
  "pg": "^8.11.0",
  "kysely": "^0.28.8"
}
```

#### **工具库**
```json
{
  "jose": "^6.1.0",        // JWT 处理
  "lucide-react": "^0.344.0", // 图标库
  "xlsx": "^0.18.5"        // Excel 处理
}
```

#### **开发依赖**
```json
{
  "@types/node": "^20.0.0",
  "@types/react": "^18.3.5",
  "@types/react-dom": "^18.3.0",
  "@types/pg": "^8.11.0",
  "eslint": "^9.0.0",
  "eslint-config-next": "^15.0.0",
  "tailwindcss": "^3.4.1",
  "autoprefixer": "^10.4.21",
  "postcss": "^8.4.35",
  "vitest": "^4.0.6",
  "@testing-library/react": "^16.3.0",
  "@testing-library/jest-dom": "^6.9.1"
}
```

### 6.2 AI Service 依赖

#### **核心依赖**
```json
{
  "fastify": "^5.1.0",
  "typescript": "^5.5.3"
}
```

#### **AI 相关**
```json
{
  "openai": "^4.28.0"
}
```

#### **工具库**
```json
{
  "@fastify/cors": "^10.0.1",
  "dotenv": "^17.2.3",
  "pino": "^9.6.0",
  "pino-pretty": "^13.0.0"
}
```

#### **开发依赖**
```json
{
  "@types/node": "^20.0.0",
  "tsx": "^4.7.0"
}
```

### 6.3 TypeScript 配置

#### **主应用 (tsconfig.json)**
```json
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts"
  ],
  "exclude": [
    "node_modules",
    "scripts",
    "apps/ai-service"
  ]
}
```

#### **AI Service (tsconfig.json)**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "moduleResolution": "node",
    "rootDir": "./src",
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 6.4 ESLint 配置

**eslint.config.js**:
```javascript
import { FlatCompat } from '@eslint/eslintrc';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends('next/core-web-vitals'),
  {
    rules: {
      'no-unused-vars': 'off',
    },
  },
];

export default eslintConfig;
```

### 6.5 Next.js 配置

**next.config.js**:
```javascript
const nextConfig = {
  reactStrictMode: true,
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'github.com',
      },
    ],
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};
```

### 6.6 Tailwind CSS 配置

**tailwind.config.js**:
```javascript
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

---

## 7. 待补充项

### 7.1 数据库设计待补充

#### **车辆模块数据库设计**
- 车辆信息表（vehicles）
- 车辆类型表（vehicle_types）
- 车辆服务记录表（vehicle_services）
- 车辆维护记录表（vehicle_maintenance）

#### **服务模块数据库设计**
- 服务项目表（services）
- 服务分类表（service_categories）
- 服务预约表（service_appointments）
- 服务评价表（service_reviews）

### 7.2 API 路由待补充

#### **车辆相关 API**
- `/api/vehicles` - 车辆列表/创建
- `/api/vehicles/[id]` - 车辆详情/更新/删除
- `/api/admin/vehicles` - 后台车辆管理

#### **服务相关 API**
- `/api/services` - 服务列表
- `/api/services/[id]` - 服务详情
- `/api/admin/services` - 后台服务管理

### 7.3 环境变量待确认

#### **数据库连接统一**
- ⚠️ 需要确认 `DATABASE_URL` 和 `SUPABASE_URL` 是否指向同一数据库实例
- 如果不同，需要明确区分主数据库和 AI 数据库的连接配置

#### **新增环境变量**
- `VEHICLE_SERVICE_API_URL` - 车辆服务 API 地址（如需要）
- `SERVICE_BOOKING_API_URL` - 服务预约 API 地址（如需要）

### 7.4 文档待补充

- [ ] 车辆模块 API 文档
- [ ] 服务模块 API 文档
- [ ] 数据库 ER 图
- [ ] 系统架构图
- [ ] 部署流程图

### 7.5 测试待补充

- [ ] 车辆模块单元测试
- [ ] 服务模块单元测试
- [ ] 集成测试
- [ ] E2E 测试

---

## 📝 附录

### A. 相关文档索引

- **环境变量配置**: `docs/ENV_SETUP.md`, `docs/AI_ENV_SETUP.md`
- **数据库迁移**: `DATABASE_MIGRATION_README.md`
- **AI 架构**: `docs/AI_ARCHITECTURE.md`
- **安全修复**: `docs/SECURITY_FIXES_COMPLETE.md`
- **故障排除**: `TROUBLESHOOTING.md`

### B. 项目脚本

- **数据库连接测试**: `test-connection.js`
- **环境修复脚本**: `fix-env.sh`
- **迁移脚本**: `scripts/` 目录（35 个文件）

### C. 数据库扩展要求

- **pgvector**: 用于 AI 向量搜索
- **PostgreSQL 16+**: 推荐版本

---

**报告生成完成** ✅

> 本报告基于项目当前状态生成，如有更新请及时同步文档。

