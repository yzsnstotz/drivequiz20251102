# AI-Service 数据库结构说明

**生成时间**: 2025-11-19T12:38:11.372Z
**数据库类型**: ai-service
**表数量**: 14

---

## AI 相关表

#### `ai_config` - AI 配置表

| 字段 | 类型 | 可空 | 默认值 | 说明 |
|------|------|------|---------|------|
| `id` | INTEGER | 否 | nextval('ai_config_id_seq'::regclass) | 主键，自增ID |
| `key` | VARCHAR(64) | 否 | - | 配置键名（唯一），如 'dailyAskLimit', 'answerCharLimit', 'model', 'cacheTtl', 'costAlertUsdThreshold' |
| `value` | TEXT | 否 | - | 配置值（字符串格式） |
| `description` | TEXT | 是 | - | 配置项描述说明 |
| `updated_by` | INTEGER | 是 | - | 最后更新此配置的管理员ID（外键关联 admins.id，如果 admins 表存在） |
| `updated_at` | TIMESTAMPTZ | 是 | now() | 最后更新时间 |

**索引**:
- `ai_config_key_key`
- `ai_config_pkey`
- `idx_ai_config_key`
- `idx_ai_config_updated_at`

**约束**:
- 2200_18187_1_not_null (CHECK)
- 2200_18187_2_not_null (CHECK)
- 2200_18187_3_not_null (CHECK)
- ai_config_key_key (UNIQUE)
- ai_config_pkey (PRIMARY KEY)

---

#### `ai_daily_summary` - 每日汇总统计表

| 字段 | 类型 | 可空 | 默认值 | 说明 |
|------|------|------|---------|------|
| `date` | DATE | 否 | - | 统计日期（主键） |
| `total_calls` | INTEGER | 是 | - | 当日总调用次数 |
| `avg_cost` | NUMERIC(10, 4) | 是 | - | 平均每次调用成本（USD） |
| `cache_hit_rate` | NUMERIC(4, 2) | 是 | - | 缓存命中率（百分比，0-100） |
| `rag_hit_rate` | NUMERIC(4, 2) | 是 | - | RAG 命中率（百分比，0-100） |
| `top_questions` | JSONB | 是 | - | 热门问题列表（JSON 格式，包含问题文本和调用次数） |
| `new_topics` | JSONB | 是 | - | 新话题列表（JSON 格式，包含话题和相关信息） |
| `created_at` | TIMESTAMPTZ | 是 | now() | 记录创建时间 |
| `updated_at` | TIMESTAMPTZ | 是 | now() | 记录更新时间 |
| `context_distribution` | JSONB | 是 | '{}'::jsonb | 上下文标签分布统计（JSON 格式，记录各 context_tag 的调用次数） |

**索引**:
- `ai_daily_summary_pkey`
- `idx_ai_daily_summary_context_distribution`
- `idx_ai_daily_summary_date`

**约束**:
- 2200_17893_1_not_null (CHECK)
- ai_daily_summary_pkey (PRIMARY KEY)

---

#### `ai_filters` - AI 禁答关键词规则表

| 字段 | 类型 | 可空 | 默认值 | 说明 |
|------|------|------|---------|------|
| `id` | BIGINT | 否 | nextval('ai_filters_id_seq'::regclass) | 主键，自增ID |
| `type` | VARCHAR(32) | 否 | - | 过滤器类型：not-driving(非驾驶相关), sensitive(敏感内容) |
| `pattern` | TEXT | 否 | - | 匹配模式（关键词、正则表达式等） |
| `created_at` | TIMESTAMPTZ | 是 | now() | 创建时间 |
| `updated_at` | TIMESTAMPTZ | 是 | now() | 更新时间 |
| `status` | VARCHAR(16) | 是 | 'draft'::character varying | 过滤器状态：draft(草稿), active(启用), inactive(停用) |
| `changed_by` | INTEGER | 是 | - | 最后修改此规则的管理员ID |
| `changed_at` | TIMESTAMPTZ | 是 | now() | 最后修改时间 |

**索引**:
- `ai_filters_pkey`
- `idx_ai_filters_changed_at`
- `idx_ai_filters_changed_by`
- `idx_ai_filters_status`
- `idx_ai_filters_type`
- `idx_ai_filters_type_unique`

**约束**:
- 2200_17872_1_not_null (CHECK)
- 2200_17872_2_not_null (CHECK)
- 2200_17872_3_not_null (CHECK)
- ai_filters_pkey (PRIMARY KEY)
- ai_filters_status_check (CHECK)

---

#### `ai_filters_history` - AI 过滤器历史记录表

| 字段 | 类型 | 可空 | 默认值 | 说明 |
|------|------|------|---------|------|
| `id` | BIGINT | 否 | nextval('ai_filters_history_id_seq'::regclass) | 主键，自增ID |
| `filter_id` | BIGINT | 否 | - | 关联的过滤器ID（外键关联 ai_filters.id） |
| `type` | VARCHAR(32) | 否 | - | 过滤器类型：not-driving(非驾驶相关), sensitive(敏感内容) |
| `pattern` | TEXT | 否 | - | 匹配模式（历史值） |
| `status` | VARCHAR(16) | 否 | - | 上传状态（如 pending, processing, succeeded, failed） |
| `changed_by` | INTEGER | 是 | - | 执行此变更的管理员ID |
| `changed_at` | TIMESTAMPTZ | 是 | now() | 变更时间 |
| `action` | VARCHAR(32) | 是 | 'update'::character varying | 操作类型：create(创建), update(更新), status_change(状态变更) |

**索引**:
- `ai_filters_history_pkey`
- `idx_ai_filters_history_changed_at`
- `idx_ai_filters_history_changed_by`
- `idx_ai_filters_history_filter_id`

**约束**:
- 2200_18144_1_not_null (CHECK)
- 2200_18144_2_not_null (CHECK)
- 2200_18144_3_not_null (CHECK)
- 2200_18144_4_not_null (CHECK)
- 2200_18144_5_not_null (CHECK)
- ai_filters_history_filter_id_fkey (FOREIGN KEY)
- ai_filters_history_pkey (PRIMARY KEY)
- ai_filters_history_status_check (CHECK)

---

#### `ai_logs` - AI 问答日志表

| 字段 | 类型 | 可空 | 默认值 | 说明 |
|------|------|------|---------|------|
| `id` | BIGINT | 否 | nextval('ai_logs_id_seq'::regclass) | 主键，自增ID |
| `user_id` | TEXT | 是 | - | 用户ID（字符串格式，可能是 UUID 或其他格式） |
| `question` | TEXT | 否 | - | 用户提问内容 |
| `answer` | TEXT | 是 | - | AI 回答内容 |
| `locale` | VARCHAR(8) | 是 | 'ja'::character varying | 语言代码（如 'ja', 'zh', 'en'） |
| `model` | VARCHAR(32) | 是 | - | 使用的 AI 模型名称（如 'gpt-4o-mini', 'llama3.2:3b'） |
| `rag_hits` | INTEGER | 是 | 0 | RAG 检索命中的文档数量 |
| `cost_est` | NUMERIC(10, 4) | 是 | - | 预估成本（USD） |
| `safety_flag` | VARCHAR(16) | 是 | 'ok'::character varying | 安全标志：ok(安全), needs_human(需要人工审核), blocked(已阻止) |
| `created_at` | TIMESTAMPTZ | 是 | now() | 创建时间（调用时间） |
| `sources` | JSONB | 是 | '[]'::jsonb | RAG 检索到的来源文档列表（JSON 数组，包含 title, url, snippet 等） |
| `context_tag` | VARCHAR(20) | 是 | NULL::character varying | 上下文标签（如 'question', 'general', 'exam'，用于分类问题类型） |
| `from` | VARCHAR(20) | 是 | NULL::character varying | 请求来源：study(学习), question(问题), chat(聊天) 等 |
| `ai_provider` | VARCHAR(32) | 是 | NULL::character varying | AI 服务提供商（如 'openai', 'gemini', 'local', 'ollama'） |
| `cached` | BOOLEAN | 是 | false | 是否使用了缓存 |
| `cache_source` | VARCHAR(20) | 是 | NULL::character varying | 缓存来源：json(JSON缓存), database(数据库缓存) |

**索引**:
- `ai_logs_pkey`
- `idx_ai_logs_ai_provider`
- `idx_ai_logs_cache_source`
- `idx_ai_logs_cached`
- `idx_ai_logs_context_tag`
- `idx_ai_logs_context_tag_created_at`
- `idx_ai_logs_created_at`
- `idx_ai_logs_from`
- `idx_ai_logs_model`
- `idx_ai_logs_sources`
- `idx_ai_logs_user_id`

**约束**:
- 2200_17857_1_not_null (CHECK)
- 2200_17857_3_not_null (CHECK)
- ai_logs_cache_source_check (CHECK)
- ai_logs_context_tag_check (CHECK)
- ai_logs_pkey (PRIMARY KEY)

---

#### `ai_provider_config` - AI Provider 配置表

| 字段 | 类型 | 可空 | 默认值 | 说明 |
|------|------|------|---------|------|
| `id` | INTEGER | 否 | nextval('ai_provider_config_id_seq'::regclass) | 主键，自增ID |
| `provider` | TEXT | 否 | - | AI 服务提供商名称（如 'openai', 'gemini', 'ollama', 'openrouter', 'openrouter_direct', 'openai_direct', 'gemini_direct', 'local'） |
| `model` | TEXT | 是 | - | 模型名称（可选，为空表示该 provider 的默认配置；与 provider 组成唯一约束） |
| `is_enabled` | BOOLEAN | 否 | true | 是否启用此配置 |
| `daily_limit` | INTEGER | 是 | - | 每日调用上限（硬限制）；为 NULL 或 0 表示不限制 |
| `priority` | INTEGER | 否 | 100 | 优先级（数值越小优先级越高，用于选择 provider 时的排序） |
| `is_local_fallback` | BOOLEAN | 否 | false | 是否为"本地兜底"Provider（如 ollama 本地服务，当其他 provider 失败时使用） |
| `created_at` | TIMESTAMPTZ | 否 | now() | 创建时间 |
| `updated_at` | TIMESTAMPTZ | 否 | now() | 更新时间 |

**索引**:
- `ai_provider_config_pkey`
- `ai_provider_config_provider_model_key`
- `idx_ai_provider_config_is_enabled`
- `idx_ai_provider_config_is_local_fallback`
- `idx_ai_provider_config_priority`
- `idx_ai_provider_config_provider`
- `idx_ai_provider_config_single_local_fallback`

**约束**:
- 2200_37749_1_not_null (CHECK)
- 2200_37749_2_not_null (CHECK)
- 2200_37749_4_not_null (CHECK)
- 2200_37749_6_not_null (CHECK)
- 2200_37749_7_not_null (CHECK)
- 2200_37749_8_not_null (CHECK)
- 2200_37749_9_not_null (CHECK)
- ai_provider_config_pkey (PRIMARY KEY)
- ai_provider_config_provider_model_key (UNIQUE)

---

#### `ai_provider_daily_stats` - AI Provider 每日统计表

| 字段 | 类型 | 可空 | 默认值 | 说明 |
|------|------|------|---------|------|
| `stat_date` | DATE | 否 | - | 统计日期 |
| `provider` | TEXT | 否 | - | AI 服务提供商名称 |
| `model` | TEXT | 否 | - | 模型名称 |
| `scene` | TEXT | 否 | - | 场景名称（如 'question_translation', 'question_polish', 'question_full_pipeline'） |
| `total_calls` | INTEGER | 否 | 0 | 总调用次数 |
| `total_success` | INTEGER | 否 | 0 | 成功调用次数 |
| `total_error` | INTEGER | 否 | 0 | 失败调用次数 |
| `created_at` | TIMESTAMPTZ | 否 | now() | 记录创建时间 |
| `updated_at` | TIMESTAMPTZ | 否 | now() | 记录更新时间 |

**索引**:
- `ai_provider_daily_stats_pkey`
- `idx_ai_provider_daily_stats_provider`
- `idx_ai_provider_daily_stats_stat_date`
- `idx_ai_provider_daily_stats_stat_date_provider`

**约束**:
- 2200_37712_1_not_null (CHECK)
- 2200_37712_2_not_null (CHECK)
- 2200_37712_3_not_null (CHECK)
- 2200_37712_4_not_null (CHECK)
- 2200_37712_5_not_null (CHECK)
- 2200_37712_6_not_null (CHECK)
- 2200_37712_7_not_null (CHECK)
- 2200_37712_8_not_null (CHECK)
- 2200_37712_9_not_null (CHECK)
- ai_provider_daily_stats_pkey (PRIMARY KEY)

---

#### `ai_rag_docs` - RAG 文档元数据表

| 字段 | 类型 | 可空 | 默认值 | 说明 |
|------|------|------|---------|------|
| `id` | BIGINT | 否 | nextval('ai_rag_docs_id_seq'::regclass) | 主键，自增ID |
| `title` | TEXT | 否 | - | 文档标题 |
| `url` | TEXT | 是 | - | 文档源 URL |
| `version` | VARCHAR(32) | 是 | - | 文档版本号 |
| `chunks` | INTEGER | 是 | 0 | 文档分块数量（向量化后的块数） |
| `uploaded_by` | UUID | 是 | - | 上传者ID（UUID 格式） |
| `created_at` | TIMESTAMPTZ | 是 | now() | 创建时间 |
| `lang` | VARCHAR(8) | 是 | - | 文档语言代码（如 'ja', 'zh', 'en'） |
| `tags` | _TEXT | 是 | - | 文档标签数组（PostgreSQL 数组类型） |
| `status` | VARCHAR(32) | 是 | 'ready'::character varying | 文档状态：active(启用), disabled(禁用) |
| `updated_at` | TIMESTAMPTZ | 是 | now() | 更新时间 |

**索引**:
- `ai_rag_docs_pkey`
- `idx_ai_rag_docs_created_at`
- `idx_ai_rag_docs_lang`
- `idx_ai_rag_docs_status`

**约束**:
- 2200_17882_1_not_null (CHECK)
- 2200_17882_2_not_null (CHECK)
- ai_rag_docs_pkey (PRIMARY KEY)

---

#### `ai_scene_config` - AI 场景配置表

| 字段 | 类型 | 可空 | 默认值 | 说明 |
|------|------|------|---------|------|
| `id` | INTEGER | 否 | nextval('ai_scene_config_id_seq'::regclass) | 主键，自增ID |
| `scene_key` | VARCHAR(64) | 否 | - | 场景键名（唯一，如 'question_translation', 'question_polish', 'question_full_pipeline'）。`question_full_pipeline` 用于题目一体化处理（润色+补漏+打 tag+多语翻译），`max_length = 3000` |
| `scene_name` | VARCHAR(128) | 否 | - | 场景显示名称（多语言支持） |
| `system_prompt_zh` | TEXT | 否 | - | 中文系统提示词 |
| `system_prompt_ja` | TEXT | 是 | - | 日文系统提示词 |
| `system_prompt_en` | TEXT | 是 | - | 英文系统提示词 |
| `output_format` | TEXT | 是 | - | 输出格式说明（JSON Schema 或格式描述） |
| `max_length` | INTEGER | 是 | 1000 | 最大输出长度（字符数）。注意：`question_full_pipeline` 场景的 `max_length` 已提升到 3000，以适应多语言 + 解析的文本长度 |
| `temperature` | NUMERIC(3, 2) | 是 | 0.4 | AI 模型温度参数（0-1，控制随机性） |
| `enabled` | BOOLEAN | 是 | true | 是否启用此场景 |
| `description` | TEXT | 是 | - | 场景描述说明 |
| `updated_by` | INTEGER | 是 | - | 最后更新的管理员ID |
| `created_at` | TIMESTAMPTZ | 是 | now() | 创建时间 |
| `updated_at` | TIMESTAMPTZ | 是 | now() | 更新时间 |

**索引**:
- `ai_scene_config_pkey`
- `ai_scene_config_scene_key_key`
- `idx_ai_scene_config_enabled`
- `idx_ai_scene_config_key`

**约束**:
- 2200_34108_1_not_null (CHECK)
- 2200_34108_2_not_null (CHECK)
- 2200_34108_3_not_null (CHECK)
- 2200_34108_4_not_null (CHECK)
- ai_scene_config_pkey (PRIMARY KEY)
- ai_scene_config_scene_key_key (UNIQUE)

---

#### `ai_vectors` - 向量存储表

| 字段 | 类型 | 可空 | 默认值 | 说明 |
|------|------|------|---------|------|
| `id` | BIGINT | 否 | nextval('ai_vectors_id_seq'::regclass) | 主键，自增ID |
| `doc_id` | VARCHAR(64) | 是 | - | 关联的文档ID（关联 ai_rag_docs.id 或 rag_documents.doc_id） |
| `content` | TEXT | 是 | - | 文档块内容（文本片段） |
| `source_title` | TEXT | 是 | - | 来源文档标题 |
| `source_url` | TEXT | 是 | - | 来源文档 URL |
| `version` | VARCHAR(32) | 是 | - | 文档版本号 |
| `updated_at` | TIMESTAMPTZ | 是 | now() | 更新时间 |
| `embedding` | vector(1536) | 是 | - | 向量嵌入（1536 维，用于相似度搜索） |

**索引**:
- `ai_vectors_pkey`
- `idx_ai_vectors_doc_id`
- `idx_ai_vectors_embedding`
- `idx_ai_vectors_version`

**约束**:
- 2200_17902_1_not_null (CHECK)
- ai_vectors_pkey (PRIMARY KEY)

---

#### `rag_documents` - RAG 文档表

| 字段 | 类型 | 可空 | 默认值 | 说明 |
|------|------|------|---------|------|
| `id` | INTEGER | 否 | nextval('rag_documents_id_seq'::regclass) | 主键，自增ID |
| `doc_id` | VARCHAR(255) | 否 | - | 文档唯一标识符（唯一） |
| `title` | VARCHAR(500) | 否 | - | 文档标题 |
| `url` | VARCHAR(1000) | 否 | - | 文档源 URL |
| `content` | TEXT | 否 | - | 文档完整内容 |
| `content_hash` | VARCHAR(64) | 否 | - | 内容哈希值（用于去重，SHA-256） |
| `version` | VARCHAR(50) | 否 | - | 文档版本号 |
| `lang` | VARCHAR(10) | 否 | - | 文档语言代码 |
| `source_id` | VARCHAR(100) | 否 | - | 来源标识（如 'manual', 'auto', 'import'） |
| `doc_type` | VARCHAR(50) | 是 | - | 文档类型：pdf, txt, markdown 等（文件扩展名或类型标识） |
| `vectorization_status` | VARCHAR(50) | 否 | 'pending'::character varying | 向量化状态：pending(待处理), processing(处理中), completed(已完成), failed(失败) |
| `created_at` | TIMESTAMPTZ | 是 | CURRENT_TIMESTAMP | 创建时间 |
| `updated_at` | TIMESTAMPTZ | 是 | CURRENT_TIMESTAMP | 更新时间 |

**索引**:
- `idx_rag_documents_content_hash`
- `idx_rag_documents_created_at`
- `idx_rag_documents_doc_id`
- `idx_rag_documents_source_id`
- `idx_rag_documents_vectorization_status`
- `rag_documents_doc_id_key`
- `rag_documents_pkey`
- `unique_document`

**约束**:
- 2200_18833_11_not_null (CHECK)
- 2200_18833_1_not_null (CHECK)
- 2200_18833_2_not_null (CHECK)
- 2200_18833_3_not_null (CHECK)
- 2200_18833_4_not_null (CHECK)
- 2200_18833_5_not_null (CHECK)
- 2200_18833_6_not_null (CHECK)
- 2200_18833_7_not_null (CHECK)
- 2200_18833_8_not_null (CHECK)
- 2200_18833_9_not_null (CHECK)
- rag_documents_doc_id_key (UNIQUE)
- rag_documents_pkey (PRIMARY KEY)
- unique_document (UNIQUE)

---

#### `rag_operation_documents` - RAG 操作文档关联表

| 字段 | 类型 | 可空 | 默认值 | 说明 |
|------|------|------|---------|------|
| `id` | INTEGER | 否 | nextval('rag_operation_documents_id_seq'::regclass) | 主键，自增ID |
| `operation_id` | VARCHAR(255) | 否 | - | 操作ID（外键关联 rag_operations.operation_id） |
| `doc_id` | VARCHAR(255) | 是 | - | 文档ID（关联 rag_documents.doc_id） |
| `status` | VARCHAR(50) | 否 | - | 文档处理状态：pending(待处理), processing(处理中), succeeded(成功), failed(失败) |
| `error_code` | VARCHAR(100) | 是 | - | 错误代码（如果处理失败） |
| `error_message` | TEXT | 是 | - | 错误消息（如果处理失败） |
| `created_at` | TIMESTAMPTZ | 是 | CURRENT_TIMESTAMP | 创建时间 |

**索引**:
- `idx_rag_operation_documents_doc_id`
- `idx_rag_operation_documents_operation_id`
- `idx_rag_operation_documents_status`
- `rag_operation_documents_pkey`

**约束**:
- 2200_18925_1_not_null (CHECK)
- 2200_18925_2_not_null (CHECK)
- 2200_18925_4_not_null (CHECK)
- fk_rag_operation_documents_operation (FOREIGN KEY)
- rag_operation_documents_pkey (PRIMARY KEY)

---

#### `rag_operations` - RAG 操作记录表

| 字段 | 类型 | 可空 | 默认值 | 说明 |
|------|------|------|---------|------|
| `id` | INTEGER | 否 | nextval('rag_operations_id_seq'::regclass) | 主键，自增ID |
| `operation_id` | VARCHAR(255) | 否 | - | 操作唯一标识符（唯一，用于跟踪批量操作） |
| `source_id` | VARCHAR(100) | 否 | - | 来源标识（如 'manual', 'auto', 'import'） |
| `status` | VARCHAR(50) | 否 | 'pending'::character varying | 操作状态：pending(待处理), processing(处理中), completed(已完成), failed(失败) |
| `docs_count` | INTEGER | 否 | 0 | 文档总数 |
| `failed_count` | INTEGER | 否 | 0 | 失败文档数 |
| `metadata` | JSONB | 否 | '{}'::jsonb | 操作元数据（JSON 格式，包含额外信息） |
| `created_at` | TIMESTAMPTZ | 是 | CURRENT_TIMESTAMP | 创建时间 |
| `completed_at` | TIMESTAMPTZ | 是 | - | 完成时间（如果操作已完成） |
| `updated_at` | TIMESTAMPTZ | 是 | CURRENT_TIMESTAMP | 更新时间 |

**索引**:
- `idx_rag_operations_created_at`
- `idx_rag_operations_operation_id`
- `idx_rag_operations_source_id`
- `idx_rag_operations_status`
- `rag_operations_operation_id_key`
- `rag_operations_pkey`

**约束**:
- 2200_18879_1_not_null (CHECK)
- 2200_18879_2_not_null (CHECK)
- 2200_18879_3_not_null (CHECK)
- 2200_18879_4_not_null (CHECK)
- 2200_18879_5_not_null (CHECK)
- 2200_18879_6_not_null (CHECK)
- 2200_18879_7_not_null (CHECK)
- rag_operations_operation_id_key (UNIQUE)
- rag_operations_pkey (PRIMARY KEY)

---

#### `rag_upload_history` - RAG 上传历史表

| 字段 | 类型 | 可空 | 默认值 | 说明 |
|------|------|------|---------|------|
| `id` | INTEGER | 否 | nextval('rag_upload_history_id_seq'::regclass) | 主键，自增ID |
| `url` | VARCHAR(1000) | 否 | - | 上传的文档 URL |
| `content_hash` | VARCHAR(64) | 否 | - | 内容哈希值（用于去重） |
| `version` | VARCHAR(50) | 否 | - | 文档版本号 |
| `title` | VARCHAR(500) | 否 | - | 文档标题 |
| `source_id` | VARCHAR(100) | 否 | - | 来源标识 |
| `lang` | VARCHAR(10) | 否 | - | 文档语言代码 |
| `status` | VARCHAR(50) | 否 | 'pending'::character varying | 上传状态：pending(待处理), processing(处理中), succeeded(成功), failed(失败) |
| `rejection_reason` | VARCHAR(255) | 是 | - | 拒绝原因（如果状态为 'rejected'） |
| `operation_id` | VARCHAR(255) | 是 | - | 关联的操作ID（关联 rag_operations.operation_id） |
| `doc_id` | VARCHAR(255) | 是 | - | 生成的文档ID（关联 rag_documents.doc_id，如果上传成功） |
| `uploaded_at` | TIMESTAMPTZ | 是 | CURRENT_TIMESTAMP | 上传时间 |

**索引**:
- `idx_rag_upload_history_content_hash`
- `idx_rag_upload_history_operation_id`
- `idx_rag_upload_history_source_id`
- `idx_rag_upload_history_status`
- `idx_rag_upload_history_unique_check`
- `idx_rag_upload_history_uploaded_at`
- `idx_rag_upload_history_url`
- `idx_rag_upload_history_version`
- `rag_upload_history_pkey`
- `unique_upload_history`

**约束**:
- 2200_19064_1_not_null (CHECK)
- 2200_19064_2_not_null (CHECK)
- 2200_19064_3_not_null (CHECK)
- 2200_19064_4_not_null (CHECK)
- 2200_19064_5_not_null (CHECK)
- 2200_19064_6_not_null (CHECK)
- 2200_19064_7_not_null (CHECK)
- 2200_19064_8_not_null (CHECK)
- rag_upload_history_pkey (PRIMARY KEY)
- unique_upload_history (UNIQUE)

---

## ⚠️ 不明确字段列表

以下字段的具体值或用途需要进一步确认（已从代码中提取大部分信息）：

**注意**：所有字段的含义已从代码中提取并更新到文档中。如需确认实际使用的值，请查看数据库数据。
