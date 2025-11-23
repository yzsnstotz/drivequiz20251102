# DriveQuiz 数据库结构说明

**生成时间**: 2025-11-19T12:38:09.504Z
**数据库类型**: drivequiz
**表数量**: 31

---

## 激活码相关表

#### `activation_codes` - 激活码表

| 字段 | 类型 | 可空 | 默认值 | 说明 |
|------|------|------|---------|------|
| `id` | INTEGER | 否 | nextval('activation_codes_id_seq'::regclass) | 主键，自增ID |
| `code` | VARCHAR(20) | 否 | - | 激活码（唯一，20字符以内） |
| `is_used` | BOOLEAN | 是 | false | 是否已使用 |
| `usage_limit` | INTEGER | 是 | 1 | 使用次数限制（默认1次） |
| `used_count` | INTEGER | 是 | 0 | 已使用次数 |
| `created_at` | TIMESTAMP WITHOUT TIME ZONE | 是 | CURRENT_TIMESTAMP | 创建时间 |
| `updated_at` | TIMESTAMP WITHOUT TIME ZONE | 是 | CURRENT_TIMESTAMP | 更新时间 |
| `status` | VARCHAR(20) | 否 | 'disabled'::character varying | 激活码状态：disabled(禁用), enabled(启用), suspended(暂停), expired(过期) |
| `expires_at` | TIMESTAMP WITHOUT TIME ZONE | 是 | - | 过期时间 |
| `enabled_at` | TIMESTAMP WITHOUT TIME ZONE | 是 | - | 启用时间 |
| `notes` | TEXT | 是 | - | 备注信息 |
| `validity_period` | INTEGER | 是 | - | 有效期时长（数值） |
| `validity_unit` | VARCHAR(10) | 是 | - | 有效期单位：day(天), month(月), year(年) |
| `activation_started_at` | TIMESTAMP WITHOUT TIME ZONE | 是 | - | 激活开始时间（用户首次激活的时间） |

**索引**:
- `activation_codes_code_key`
- `activation_codes_pkey`
- `idx_activation_codes_activation_started_at`
- `idx_activation_codes_code`
- `idx_activation_codes_expires_at`
- `idx_activation_codes_status`

**约束**:
- 2200_17466_1_not_null (CHECK)
- 2200_17466_2_not_null (CHECK)
- 2200_17466_8_not_null (CHECK)
- activation_codes_code_key (UNIQUE)
- activation_codes_pkey (PRIMARY KEY)
- activation_codes_status_check (CHECK)
- activation_codes_validity_unit_check (CHECK)

---

#### `activations` - 激活记录表

| 字段 | 类型 | 可空 | 默认值 | 说明 |
|------|------|------|---------|------|
| `id` | INTEGER | 否 | nextval('activations_id_seq'::regclass) | 主键，自增ID |
| `email` | VARCHAR(255) | 否 | - | 用户邮箱（激活时使用的邮箱） |
| `activation_code` | VARCHAR(255) | 否 | - | 使用的激活码（关联 activation_codes.code） |
| `ip_address` | VARCHAR(45) | 是 | - | 激活时的 IP 地址 |
| `user_agent` | TEXT | 是 | - | 用户代理字符串（浏览器信息） |
| `activated_at` | TIMESTAMP WITHOUT TIME ZONE | 是 | CURRENT_TIMESTAMP | 激活时间 |

**索引**:
- `activations_pkey`
- `idx_activations_activation_code`
- `idx_activations_email`

**约束**:
- 2200_17452_1_not_null (CHECK)
- 2200_17452_2_not_null (CHECK)
- 2200_17452_3_not_null (CHECK)
- activations_pkey (PRIMARY KEY)

---

## 业务相关表

#### `ad_contents` - 广告内容表

| 字段 | 类型 | 可空 | 默认值 | 说明 |
|------|------|------|---------|------|
| `id` | INTEGER | 否 | nextval('ad_contents_id_seq'::regclass) |  |
| `slot_id` | INTEGER | 否 | - |  |
| `title` | VARCHAR(200) | 否 | - |  |
| `title_ja` | VARCHAR(200) | 是 | - |  |
| `title_zh` | VARCHAR(200) | 是 | - |  |
| `title_en` | VARCHAR(200) | 是 | - |  |
| `description` | TEXT | 是 | - |  |
| `description_ja` | TEXT | 是 | - |  |
| `description_zh` | TEXT | 是 | - |  |
| `description_en` | TEXT | 是 | - |  |
| `image_url` | TEXT | 是 | - |  |
| `video_url` | TEXT | 是 | - |  |
| `link_url` | TEXT | 是 | - |  |
| `start_date` | DATE | 是 | - |  |
| `end_date` | DATE | 是 | - |  |
| `priority` | INTEGER | 是 | 0 |  |
| `weight` | INTEGER | 是 | 1 |  |
| `impression_count` | BIGINT | 是 | 0 |  |
| `click_count` | BIGINT | 是 | 0 |  |
| `metadata` | JSONB | 是 | '{}'::jsonb |  |
| `status` | VARCHAR(20) | 是 | 'draft'::character varying | 广告内容状态：draft(草稿), active(启用), paused(暂停), archived(归档) |
| `created_at` | TIMESTAMPTZ | 是 | now() |  |
| `updated_at` | TIMESTAMPTZ | 是 | now() |  |

**索引**:
- `ad_contents_pkey`
- `idx_ad_contents_created_at`
- `idx_ad_contents_dates`
- `idx_ad_contents_priority`
- `idx_ad_contents_slot_id`
- `idx_ad_contents_status`

**约束**:
- 2200_21390_1_not_null (CHECK)
- 2200_21390_2_not_null (CHECK)
- 2200_21390_3_not_null (CHECK)
- ad_contents_pkey (PRIMARY KEY)
- ad_contents_slot_id_fkey (FOREIGN KEY)
- ad_contents_status_check (CHECK)

---

#### `ad_logs` - 广告日志表

| 字段 | 类型 | 可空 | 默认值 | 说明 |
|------|------|------|---------|------|
| `id` | BIGINT | 否 | nextval('ad_logs_id_seq'::regclass) |  |
| `ad_content_id` | INTEGER | 否 | - |  |
| `user_id` | INTEGER | 是 | - |  |
| `log_type` | VARCHAR(20) | 否 | - | 日志类型：impression(展示), click(点击), conversion(转化) |
| `ip_address` | VARCHAR(45) | 是 | - |  |
| `user_agent` | TEXT | 是 | - |  |
| `client_type` | VARCHAR(20) | 是 | - | 客户端类型：web(网页), mobile(移动端), api(API), desktop(桌面), other(其他) |
| `metadata` | JSONB | 是 | '{}'::jsonb |  |
| `created_at` | TIMESTAMPTZ | 是 | now() |  |

**索引**:
- `ad_logs_pkey`
- `idx_ad_logs_ad_content_id`
- `idx_ad_logs_content_type_time`
- `idx_ad_logs_created_at`
- `idx_ad_logs_ip_address`
- `idx_ad_logs_log_type`
- `idx_ad_logs_user_id`

**约束**:
- 2200_21418_1_not_null (CHECK)
- 2200_21418_2_not_null (CHECK)
- 2200_21418_4_not_null (CHECK)
- ad_logs_ad_content_id_fkey (FOREIGN KEY)
- ad_logs_client_type_check (CHECK)
- ad_logs_log_type_check (CHECK)
- ad_logs_pkey (PRIMARY KEY)
- ad_logs_user_id_fkey (FOREIGN KEY)

---

#### `ad_slots` - 广告位表

| 字段 | 类型 | 可空 | 默认值 | 说明 |
|------|------|------|---------|------|
| `id` | INTEGER | 否 | nextval('ad_slots_id_seq'::regclass) |  |
| `position` | VARCHAR(50) | 否 | - |  |
| `name` | VARCHAR(100) | 否 | - |  |
| `name_ja` | VARCHAR(100) | 是 | - |  |
| `name_zh` | VARCHAR(100) | 是 | - |  |
| `name_en` | VARCHAR(100) | 是 | - |  |
| `description` | TEXT | 是 | - |  |
| `width` | INTEGER | 是 | - |  |
| `height` | INTEGER | 是 | - |  |
| `format` | VARCHAR(20) | 是 | 'banner'::character varying | 广告格式：banner(横幅，默认), square(方形), rectangle(矩形) |
| `status` | VARCHAR(20) | 是 | 'active'::character varying | 广告位状态：active(启用), inactive(停用), archived(归档) |
| `created_at` | TIMESTAMPTZ | 是 | now() |  |
| `updated_at` | TIMESTAMPTZ | 是 | now() |  |

**索引**:
- `ad_slots_pkey`
- `ad_slots_position_key`
- `idx_ad_slots_created_at`
- `idx_ad_slots_position`
- `idx_ad_slots_status`

**约束**:
- 2200_21371_1_not_null (CHECK)
- 2200_21371_2_not_null (CHECK)
- 2200_21371_3_not_null (CHECK)
- ad_slots_pkey (PRIMARY KEY)
- ad_slots_position_key (UNIQUE)
- ad_slots_status_check (CHECK)

---

#### `ad_slots_config` - 广告位配置表

| 字段 | 类型 | 可空 | 默认值 | 说明 |
|------|------|------|---------|------|
| `id` | INTEGER | 否 | nextval('ad_slots_config_id_seq'::regclass) |  |
| `slot_key` | VARCHAR(50) | 否 | - |  |
| `title` | VARCHAR(100) | 否 | - |  |
| `description` | VARCHAR(255) | 是 | - |  |
| `is_enabled` | BOOLEAN | 是 | true |  |
| `created_at` | TIMESTAMPTZ | 是 | now() |  |
| `updated_at` | TIMESTAMPTZ | 是 | now() |  |
| `splash_duration` | INTEGER | 是 | 3 |  |

**索引**:
- `ad_slots_config_pkey`
- `ad_slots_config_slot_key_key`
- `idx_ad_slots_config_enabled`
- `idx_ad_slots_config_slot_key`

**约束**:
- 2200_21523_1_not_null (CHECK)
- 2200_21523_2_not_null (CHECK)
- 2200_21523_3_not_null (CHECK)
- ad_slots_config_pkey (PRIMARY KEY)
- ad_slots_config_slot_key_key (UNIQUE)

---

#### `contact_info` - 联系信息表

| 字段 | 类型 | 可空 | 默认值 | 说明 |
|------|------|------|---------|------|
| `id` | INTEGER | 否 | nextval('contact_info_id_seq'::regclass) |  |
| `type` | VARCHAR(50) | 否 | - | 联系信息类型：business(商务), purchase(采购) |
| `wechat` | VARCHAR(100) | 是 | - |  |
| `email` | VARCHAR(255) | 是 | - |  |
| `status` | VARCHAR(20) | 是 | 'active'::character varying | 联系信息状态：active(启用), inactive(停用) |
| `created_at` | TIMESTAMP WITHOUT TIME ZONE | 是 | CURRENT_TIMESTAMP |  |
| `updated_at` | TIMESTAMP WITHOUT TIME ZONE | 是 | CURRENT_TIMESTAMP |  |

**索引**:
- `contact_info_pkey`
- `idx_contact_info_status`
- `idx_contact_info_type`

**约束**:
- 2200_17669_1_not_null (CHECK)
- 2200_17669_2_not_null (CHECK)
- contact_info_pkey (PRIMARY KEY)
- contact_info_status_check (CHECK)
- contact_info_type_check (CHECK)

---

#### `merchant_categories` - 商户分类表

| 字段 | 类型 | 可空 | 默认值 | 说明 |
|------|------|------|---------|------|
| `id` | INTEGER | 否 | nextval('merchant_categories_id_seq'::regclass) |  |
| `name` | VARCHAR(100) | 否 | - |  |
| `display_order` | INTEGER | 是 | 0 |  |
| `status` | VARCHAR(20) | 是 | 'active'::character varying | 用户状态：active(活跃), inactive(非活跃), suspended(暂停), pending(待激活) |
| `created_at` | TIMESTAMP WITHOUT TIME ZONE | 是 | CURRENT_TIMESTAMP |  |
| `updated_at` | TIMESTAMP WITHOUT TIME ZONE | 是 | CURRENT_TIMESTAMP |  |

**索引**:
- `idx_merchant_categories_status`
- `merchant_categories_name_key`
- `merchant_categories_pkey`

**约束**:
- 2200_17640_1_not_null (CHECK)
- 2200_17640_2_not_null (CHECK)
- merchant_categories_name_key (UNIQUE)
- merchant_categories_pkey (PRIMARY KEY)
- merchant_categories_status_check (CHECK)

---

#### `merchants` - 商户表

| 字段 | 类型 | 可空 | 默认值 | 说明 |
|------|------|------|---------|------|
| `id` | INTEGER | 否 | nextval('merchants_id_seq'::regclass) |  |
| `name` | VARCHAR(255) | 否 | - |  |
| `description` | TEXT | 是 | - |  |
| `address` | TEXT | 是 | - |  |
| `phone` | VARCHAR(50) | 是 | - |  |
| `email` | VARCHAR(255) | 是 | - |  |
| `image_url` | VARCHAR(500) | 是 | - |  |
| `category` | VARCHAR(100) | 是 | - | 视频分类：basic(基础), advanced(高级) |
| `status` | VARCHAR(20) | 是 | 'active'::character varying | 商户状态：active(启用), inactive(停用) |
| `created_at` | TIMESTAMP WITHOUT TIME ZONE | 是 | CURRENT_TIMESTAMP |  |
| `updated_at` | TIMESTAMP WITHOUT TIME ZONE | 是 | CURRENT_TIMESTAMP |  |
| `ad_start_date` | TIMESTAMP WITHOUT TIME ZONE | 是 | - |  |
| `ad_end_date` | TIMESTAMP WITHOUT TIME ZONE | 是 | - |  |
| `ad_slot` | VARCHAR(50) | 是 | - | 广告位标识（字符串，如 'home_first_column', 'home_second_column', 'license_top', 'vehicle_list', 'service_detail' 等） |

**索引**:
- `idx_merchants_ad_dates`
- `idx_merchants_ad_slot`
- `idx_merchants_category`
- `idx_merchants_category_ad`
- `idx_merchants_status`
- `merchants_pkey`

**约束**:
- 2200_17627_1_not_null (CHECK)
- 2200_17627_2_not_null (CHECK)
- merchants_pkey (PRIMARY KEY)
- merchants_status_check (CHECK)

---

#### `service_categories` - 服务分类表

| 字段 | 类型 | 可空 | 默认值 | 说明 |
|------|------|------|---------|------|
| `id` | INTEGER | 否 | nextval('service_categories_id_seq'::regclass) |  |
| `name` | VARCHAR(100) | 否 | - |  |
| `name_ja` | VARCHAR(100) | 是 | - |  |
| `name_zh` | VARCHAR(100) | 是 | - |  |
| `name_en` | VARCHAR(100) | 是 | - |  |
| `description` | TEXT | 是 | - |  |
| `icon` | VARCHAR(50) | 是 | - |  |
| `parent_id` | INTEGER | 是 | - |  |
| `sort_order` | INTEGER | 是 | 0 |  |
| `created_at` | TIMESTAMPTZ | 是 | now() |  |
| `updated_at` | TIMESTAMPTZ | 是 | now() |  |

**索引**:
- `idx_service_categories_name`
- `idx_service_categories_parent_id`
- `idx_service_categories_sort_order`
- `service_categories_name_key`
- `service_categories_pkey`

**约束**:
- 2200_21259_1_not_null (CHECK)
- 2200_21259_2_not_null (CHECK)
- service_categories_name_key (UNIQUE)
- service_categories_parent_id_fkey (FOREIGN KEY)
- service_categories_pkey (PRIMARY KEY)

---

#### `service_reviews` - 服务评价表

| 字段 | 类型 | 可空 | 默认值 | 说明 |
|------|------|------|---------|------|
| `id` | BIGINT | 否 | nextval('service_reviews_id_seq'::regclass) |  |
| `service_id` | INTEGER | 否 | - |  |
| `user_id` | INTEGER | 是 | - |  |
| `rating` | INTEGER | 否 | - | 评分（1-5 的整数） |
| `comment` | TEXT | 是 | - |  |
| `metadata` | JSONB | 是 | '{}'::jsonb |  |
| `status` | VARCHAR(20) | 是 | 'active'::character varying | 评价状态：active(显示), hidden(隐藏), deleted(删除) |
| `created_at` | TIMESTAMPTZ | 是 | now() |  |
| `updated_at` | TIMESTAMPTZ | 是 | now() |  |

**索引**:
- `idx_service_reviews_created_at`
- `idx_service_reviews_rating`
- `idx_service_reviews_service_id`
- `idx_service_reviews_status`
- `idx_service_reviews_user_id`
- `service_reviews_pkey`

**约束**:
- 2200_21312_1_not_null (CHECK)
- 2200_21312_2_not_null (CHECK)
- 2200_21312_4_not_null (CHECK)
- service_reviews_pkey (PRIMARY KEY)
- service_reviews_rating_check (CHECK)
- service_reviews_service_id_fkey (FOREIGN KEY)
- service_reviews_status_check (CHECK)
- service_reviews_user_id_fkey (FOREIGN KEY)

---

#### `services` - 服务表

| 字段 | 类型 | 可空 | 默认值 | 说明 |
|------|------|------|---------|------|
| `id` | INTEGER | 否 | nextval('services_id_seq'::regclass) |  |
| `category_id` | INTEGER | 是 | - |  |
| `name` | VARCHAR(200) | 否 | - |  |
| `name_ja` | VARCHAR(200) | 是 | - |  |
| `name_zh` | VARCHAR(200) | 是 | - |  |
| `name_en` | VARCHAR(200) | 是 | - |  |
| `description` | TEXT | 是 | - |  |
| `description_ja` | TEXT | 是 | - |  |
| `description_zh` | TEXT | 是 | - |  |
| `description_en` | TEXT | 是 | - |  |
| `location` | VARCHAR(200) | 是 | - |  |
| `address` | TEXT | 是 | - |  |
| `latitude` | NUMERIC(10, 8) | 是 | - |  |
| `longitude` | NUMERIC(11, 8) | 是 | - |  |
| `prefecture` | VARCHAR(50) | 是 | - |  |
| `city` | VARCHAR(100) | 是 | - |  |
| `phone` | VARCHAR(20) | 是 | - |  |
| `email` | VARCHAR(255) | 是 | - |  |
| `website` | TEXT | 是 | - |  |
| `price_min` | NUMERIC(10, 2) | 是 | - |  |
| `price_max` | NUMERIC(10, 2) | 是 | - |  |
| `price_unit` | VARCHAR(20) | 是 | - | 价格单位：yen(日元), usd(美元) 等（可能有其他货币单位） |
| `rating_avg` | NUMERIC(3, 2) | 是 | 0 |  |
| `rating_count` | INTEGER | 是 | 0 |  |
| `image_url` | TEXT | 是 | - |  |
| `official_url` | TEXT | 是 | - |  |
| `business_hours` | JSONB | 是 | '{}'::jsonb | 营业时间（JSONB格式，如 {"monday": "09:00-18:00", "tuesday": "09:00-18:00"}） |
| `features` | JSONB | 是 | '{}'::jsonb | 服务特性（JSONB格式，如 {"wifi": true, "parking": true, "accessibility": false}） |
| `metadata` | JSONB | 是 | '{}'::jsonb |  |
| `status` | VARCHAR(20) | 是 | 'active'::character varying | 服务状态：active(启用), inactive(停用), archived(归档) |
| `created_at` | TIMESTAMPTZ | 是 | now() |  |
| `updated_at` | TIMESTAMPTZ | 是 | now() |  |

**索引**:
- `idx_services_category_id`
- `idx_services_city`
- `idx_services_created_at`
- `idx_services_location`
- `idx_services_name`
- `idx_services_prefecture`
- `idx_services_rating_avg`
- `idx_services_status`
- `services_pkey`

**约束**:
- 2200_21281_1_not_null (CHECK)
- 2200_21281_3_not_null (CHECK)
- services_category_id_fkey (FOREIGN KEY)
- services_pkey (PRIMARY KEY)
- services_status_check (CHECK)

---

#### `terms_of_service` - 服务条款表

| 字段 | 类型 | 可空 | 默认值 | 说明 |
|------|------|------|---------|------|
| `id` | INTEGER | 否 | nextval('terms_of_service_id_seq'::regclass) |  |
| `title` | VARCHAR(255) | 否 | - |  |
| `content` | TEXT | 否 | - |  |
| `version` | VARCHAR(50) | 是 | '1.0'::character varying |  |
| `status` | VARCHAR(20) | 是 | 'active'::character varying | 条款状态：active(启用), inactive(停用) |
| `created_at` | TIMESTAMP WITHOUT TIME ZONE | 是 | CURRENT_TIMESTAMP |  |
| `updated_at` | TIMESTAMP WITHOUT TIME ZONE | 是 | CURRENT_TIMESTAMP |  |

**索引**:
- `idx_terms_of_service_status`
- `terms_of_service_pkey`

**约束**:
- 2200_17681_1_not_null (CHECK)
- 2200_17681_2_not_null (CHECK)
- 2200_17681_3_not_null (CHECK)
- terms_of_service_pkey (PRIMARY KEY)
- terms_of_service_status_check (CHECK)

---

#### `vehicle_types` - 车辆类型表

| 字段 | 类型 | 可空 | 默认值 | 说明 |
|------|------|------|---------|------|
| `id` | INTEGER | 否 | nextval('vehicle_types_id_seq'::regclass) |  |
| `name` | VARCHAR(100) | 否 | - |  |
| `name_ja` | VARCHAR(100) | 是 | - |  |
| `name_zh` | VARCHAR(100) | 是 | - |  |
| `name_en` | VARCHAR(100) | 是 | - |  |
| `description` | TEXT | 是 | - |  |
| `icon` | VARCHAR(50) | 是 | - |  |
| `created_at` | TIMESTAMPTZ | 是 | now() |  |
| `updated_at` | TIMESTAMPTZ | 是 | now() |  |

**索引**:
- `idx_vehicle_types_created_at`
- `idx_vehicle_types_name`
- `vehicle_types_name_key`
- `vehicle_types_pkey`

**约束**:
- 2200_21217_1_not_null (CHECK)
- 2200_21217_2_not_null (CHECK)
- vehicle_types_name_key (UNIQUE)
- vehicle_types_pkey (PRIMARY KEY)

---

#### `vehicles` - 车辆表

| 字段 | 类型 | 可空 | 默认值 | 说明 |
|------|------|------|---------|------|
| `id` | INTEGER | 否 | nextval('vehicles_id_seq'::regclass) |  |
| `vehicle_type_id` | INTEGER | 是 | - |  |
| `brand` | VARCHAR(100) | 否 | - |  |
| `model` | VARCHAR(100) | 否 | - |  |
| `year` | INTEGER | 是 | - |  |
| `name_ja` | VARCHAR(200) | 是 | - |  |
| `name_zh` | VARCHAR(200) | 是 | - |  |
| `name_en` | VARCHAR(200) | 是 | - |  |
| `description_ja` | TEXT | 是 | - |  |
| `description_zh` | TEXT | 是 | - |  |
| `description_en` | TEXT | 是 | - |  |
| `price_min` | NUMERIC(10, 2) | 是 | - |  |
| `price_max` | NUMERIC(10, 2) | 是 | - |  |
| `fuel_type` | VARCHAR(20) | 是 | - | 燃料类型：gasoline(汽油), diesel(柴油), hybrid(混合动力), electric(电动) |
| `transmission` | VARCHAR(20) | 是 | - | 变速箱类型：manual(手动), automatic(自动), cvt(无级变速) |
| `seats` | INTEGER | 是 | - |  |
| `image_url` | TEXT | 是 | - |  |
| `official_url` | TEXT | 是 | - |  |
| `dealer_url` | TEXT | 是 | - |  |
| `specifications` | JSONB | 是 | '{}'::jsonb |  |
| `metadata` | JSONB | 是 | '{}'::jsonb |  |
| `status` | VARCHAR(20) | 是 | 'active'::character varying | 车辆状态：active(启用), inactive(停用), archived(归档) |
| `created_at` | TIMESTAMPTZ | 是 | now() |  |
| `updated_at` | TIMESTAMPTZ | 是 | now() |  |

**索引**:
- `idx_vehicles_brand`
- `idx_vehicles_created_at`
- `idx_vehicles_model`
- `idx_vehicles_price_range`
- `idx_vehicles_status`
- `idx_vehicles_vehicle_type_id`
- `idx_vehicles_year`
- `vehicles_pkey`

**约束**:
- 2200_21232_1_not_null (CHECK)
- 2200_21232_3_not_null (CHECK)
- 2200_21232_4_not_null (CHECK)
- vehicles_pkey (PRIMARY KEY)
- vehicles_status_check (CHECK)
- vehicles_vehicle_type_id_fkey (FOREIGN KEY)

---

#### `videos` - 视频表

| 字段 | 类型 | 可空 | 默认值 | 说明 |
|------|------|------|---------|------|
| `id` | INTEGER | 否 | nextval('videos_id_seq'::regclass) |  |
| `title` | VARCHAR(255) | 否 | - |  |
| `description` | TEXT | 是 | - |  |
| `url` | VARCHAR(500) | 否 | - |  |
| `thumbnail` | VARCHAR(500) | 是 | - |  |
| `category` | VARCHAR(50) | 否 | - | 视频分类：basic(基础), advanced(高级) |
| `display_order` | INTEGER | 是 | 0 |  |
| `status` | VARCHAR(20) | 是 | 'active'::character varying | 用户状态：active(活跃), inactive(非活跃), suspended(暂停), pending(待激活) |
| `created_at` | TIMESTAMP WITHOUT TIME ZONE | 是 | CURRENT_TIMESTAMP |  |
| `updated_at` | TIMESTAMP WITHOUT TIME ZONE | 是 | CURRENT_TIMESTAMP |  |

**索引**:
- `idx_videos_category`
- `idx_videos_display_order`
- `idx_videos_status`
- `videos_pkey`

**约束**:
- 2200_17654_1_not_null (CHECK)
- 2200_17654_2_not_null (CHECK)
- 2200_17654_4_not_null (CHECK)
- 2200_17654_6_not_null (CHECK)
- videos_category_check (CHECK)
- videos_pkey (PRIMARY KEY)
- videos_status_check (CHECK)

---

## 管理员相关表

#### `admins` - 管理员表

| 字段 | 类型 | 可空 | 默认值 | 说明 |
|------|------|------|---------|------|
| `id` | INTEGER | 否 | nextval('admins_id_seq'::regclass) |  |
| `username` | VARCHAR(50) | 否 | - |  |
| `token` | VARCHAR(255) | 否 | - |  |
| `is_active` | BOOLEAN | 否 | true |  |
| `created_at` | TIMESTAMP WITHOUT TIME ZONE | 否 | now() |  |
| `updated_at` | TIMESTAMP WITHOUT TIME ZONE | 否 | now() |  |
| `permissions` | JSONB | 是 | '[]'::jsonb | 权限JSONB数组，存储权限类别（如 ['users', 'questions', 'ai']） |

**索引**:
- `admins_pkey`
- `admins_token_key`
- `admins_username_key`
- `idx_admins_is_active`
- `idx_admins_permissions`
- `idx_admins_token`
- `idx_admins_username`

**约束**:
- 2200_17489_1_not_null (CHECK)
- 2200_17489_2_not_null (CHECK)
- 2200_17489_3_not_null (CHECK)
- 2200_17489_4_not_null (CHECK)
- 2200_17489_5_not_null (CHECK)
- 2200_17489_6_not_null (CHECK)
- admins_pkey (PRIMARY KEY)
- admins_token_key (UNIQUE)
- admins_username_key (UNIQUE)

---

#### `operation_logs` - 操作日志表

| 字段 | 类型 | 可空 | 默认值 | 说明 |
|------|------|------|---------|------|
| `id` | INTEGER | 否 | nextval('operation_logs_id_seq'::regclass) |  |
| `admin_id` | INTEGER | 否 | - |  |
| `admin_username` | VARCHAR(50) | 否 | - |  |
| `action` | VARCHAR(20) | 否 | - | 操作类型：create(创建), update(更新), delete(删除) |
| `table_name` | VARCHAR(50) | 否 | - |  |
| `record_id` | INTEGER | 是 | - |  |
| `old_value` | JSONB | 是 | - |  |
| `new_value` | JSONB | 是 | - |  |
| `description` | TEXT | 是 | - |  |
| `created_at` | TIMESTAMP WITHOUT TIME ZONE | 否 | now() |  |

**索引**:
- `idx_operation_logs_action`
- `idx_operation_logs_admin_id`
- `idx_operation_logs_admin_username`
- `idx_operation_logs_created_at`
- `idx_operation_logs_table_name`
- `operation_logs_pkey`

**约束**:
- 2200_17506_10_not_null (CHECK)
- 2200_17506_1_not_null (CHECK)
- 2200_17506_2_not_null (CHECK)
- 2200_17506_3_not_null (CHECK)
- 2200_17506_4_not_null (CHECK)
- 2200_17506_5_not_null (CHECK)
- operation_logs_action_check (CHECK)
- operation_logs_pkey (PRIMARY KEY)

---

## 其他表

#### `batch_process_tasks` - 批量处理任务表

| 字段 | 类型 | 可空 | 默认值 | 说明 |
|------|------|------|---------|------|
| `id` | BIGINT | 否 | nextval('batch_process_tasks_id_seq'::regclass) | 主键，自增ID |
| `task_id` | VARCHAR(64) | 否 | - | 任务唯一标识符（唯一，格式如 "task-1763559104260-pvst8c"） |
| `status` | VARCHAR(20) | 否 | 'pending'::character varying | 任务状态：pending(待处理), processing(处理中), completed(已完成-完全成功), partial_success(部分成功-数据不完整), failed(失败), cancelled(已取消) |
| `operations` | _TEXT | 否 | - | 操作类型数组（PostgreSQL 数组，如 ['translate', 'polish', 'fill_missing', 'category_tags', 'full_pipeline']） |
| `question_ids` | _INT4 | 是 | - | 题目ID数组（PostgreSQL 整数数组，要处理的题目ID列表） |
| `translate_options` | JSONB | 是 | - | 翻译选项（JSON 格式，如 {"from": "zh", "to": "ja"}） |
| `polish_options` | JSONB | 是 | - | 润色选项（JSON 格式，如 {"locale": "zh"}） |
| `batch_size` | INTEGER | 是 | 10 | 批处理大小（每批处理的题目数量） |
| `continue_on_error` | BOOLEAN | 是 | true | 遇到错误是否继续处理 |
| `total_questions` | INTEGER | 是 | 0 | 题目总数 |
| `processed_count` | INTEGER | 是 | 0 | 已处理题目数 |
| `succeeded_count` | INTEGER | 是 | 0 | 成功处理题目数 |
| `failed_count` | INTEGER | 是 | 0 | 失败题目数 |
| `current_batch` | INTEGER | 是 | 0 | 当前处理的批次号 |
| `errors` | JSONB | 是 | - | 错误列表（JSON 数组，包含 {questionId, error} 对象） |
| `details` | JSONB | 是 | - | 详细信息（JSON 数组，包含每个题目的处理详情） |
| `created_by` | VARCHAR(64) | 是 | - | 创建者标识（管理员用户名或ID） |
| `started_at` | TIMESTAMPTZ | 是 | - | 开始处理时间 |
| `completed_at` | TIMESTAMPTZ | 是 | - | 完成时间 |
| `created_at` | TIMESTAMPTZ | 是 | now() | 创建时间 |
| `updated_at` | TIMESTAMPTZ | 是 | now() | 更新时间 |

**索引**:
- `batch_process_tasks_pkey`
- `batch_process_tasks_task_id_key`
- `idx_batch_process_tasks_created_at`
- `idx_batch_process_tasks_created_by`
- `idx_batch_process_tasks_status`
- `idx_batch_process_tasks_task_id`

**约束**:
- 2200_24286_1_not_null (CHECK)
- 2200_24286_2_not_null (CHECK)
- 2200_24286_3_not_null (CHECK)
- 2200_24286_4_not_null (CHECK)
- batch_process_tasks_pkey (PRIMARY KEY)
- batch_process_tasks_task_id_key (UNIQUE)

---

## 语言相关表

#### `languages` - 语言表

| 字段 | 类型 | 可空 | 默认值 | 说明 |
|------|------|------|---------|------|
| `id` | BIGINT | 否 | nextval('languages_id_seq'::regclass) |  |
| `locale` | VARCHAR(16) | 否 | - |  |
| `name` | VARCHAR(64) | 否 | - |  |
| `enabled` | BOOLEAN | 否 | true |  |
| `created_at` | TIMESTAMPTZ | 是 | now() |  |
| `updated_at` | TIMESTAMPTZ | 是 | now() |  |

**索引**:
- `languages_locale_key`
- `languages_pkey`

**约束**:
- 2200_22942_1_not_null (CHECK)
- 2200_22942_2_not_null (CHECK)
- 2200_22942_3_not_null (CHECK)
- 2200_22942_4_not_null (CHECK)
- languages_locale_key (UNIQUE)
- languages_pkey (PRIMARY KEY)

---

## 题目相关表

#### `question_ai_answer_pending_updates` - 待更新题目AI回答表

| 字段 | 类型 | 可空 | 默认值 | 说明 |
|------|------|------|---------|------|
| `id` | BIGINT | 否 | nextval('question_ai_answer_pending_updates_id_seq'::regclass) |  |
| `question_hash` | VARCHAR(64) | 否 | - |  |
| `locale` | VARCHAR(8) | 否 | - |  |
| `package_name` | VARCHAR(100) | 否 | - |  |
| `created_at` | TIMESTAMPTZ | 是 | now() |  |

**索引**:
- `idx_pending_updates_created_at`
- `idx_pending_updates_hash_locale_unique`
- `idx_pending_updates_package_name`
- `idx_pending_updates_question_hash`
- `question_ai_answer_pending_up_question_hash_locale_package__key`
- `question_ai_answer_pending_updates_pkey`

**约束**:
- 2200_21655_1_not_null (CHECK)
- 2200_21655_2_not_null (CHECK)
- 2200_21655_3_not_null (CHECK)
- 2200_21655_4_not_null (CHECK)
- question_ai_answer_pending_up_question_hash_locale_package__key (UNIQUE)
- question_ai_answer_pending_updates_pkey (PRIMARY KEY)

---

#### `question_ai_answers` - 题目AI回答表

| 字段 | 类型 | 可空 | 默认值 | 说明 |
|------|------|------|---------|------|
| `id` | BIGINT | 否 | nextval('question_ai_answers_id_seq'::regclass) | 主键，自增ID |
| `question_hash` | VARCHAR(64) | 否 | - | 题目内容哈希值（关联 questions.content_hash，与 locale 组成唯一约束） |
| `locale` | VARCHAR(8) | 否 | - | 语言代码（如 'ja', 'zh', 'en'，与 question_hash 组成唯一约束） |
| `answer` | TEXT | 否 | - | AI 生成的回答内容 |
| `sources` | JSONB | 是 | - | RAG 检索到的来源文档列表（JSON 数组，包含 {title, url, snippet, score, version} 对象） |
| `model` | VARCHAR(32) | 是 | - | 使用的 AI 模型名称（如 'gpt-4o-mini', 'llama3.2:3b'） |
| `created_by` | UUID | 是 | - | 创建者ID（UUID 格式，如果是从用户请求创建的） |
| `view_count` | INTEGER | 是 | 0 | 查看次数（用户查看此回答的次数） |
| `created_at` | TIMESTAMPTZ | 是 | now() | 创建时间 |
| `updated_at` | TIMESTAMPTZ | 是 | now() | 更新时间 |
| `category` | VARCHAR(50) | 是 | - | 视频分类：basic(基础), advanced(高级) |
| `stage_tag` | VARCHAR(20) | 是 | - | 阶段标签（从 questions 表同步，用于快速查询） |
| `topic_tags` | _TEXT | 是 | - | 主题标签数组（从 questions 表同步，用于快速查询） |

**索引**:
- `idx_question_ai_answers_category`
- `idx_question_ai_answers_created_at`
- `idx_question_ai_answers_locale`
- `idx_question_ai_answers_question_hash`
- `idx_question_ai_answers_stage_tag`
- `idx_question_ai_answers_topic_tags`
- `idx_question_ai_answers_view_count`
- `question_ai_answers_pkey`
- `question_ai_answers_question_hash_locale_key`

**约束**:
- 2200_21621_1_not_null (CHECK)
- 2200_21621_2_not_null (CHECK)
- 2200_21621_3_not_null (CHECK)
- 2200_21621_4_not_null (CHECK)
- question_ai_answers_pkey (PRIMARY KEY)
- question_ai_answers_question_hash_locale_key (UNIQUE)

---

#### `question_package_versions` - 题目包版本表

| 字段 | 类型 | 可空 | 默认值 | 说明 |
|------|------|------|---------|------|
| `id` | BIGINT | 否 | nextval('question_package_versions_id_seq'::regclass) |  |
| `package_name` | VARCHAR(100) | 否 | - |  |
| `version` | VARCHAR(50) | 否 | - |  |
| `total_questions` | INTEGER | 是 | 0 |  |
| `ai_answers_count` | INTEGER | 是 | 0 |  |
| `created_at` | TIMESTAMPTZ | 是 | now() |  |
| `updated_at` | TIMESTAMPTZ | 是 | now() |  |
| `package_content` | JSONB | 是 | - |  |

**索引**:
- `idx_package_versions_content_gin`
- `idx_package_versions_version`
- `idx_question_package_versions_created_at`
- `idx_question_package_versions_name`
- `idx_question_package_versions_version`
- `question_package_versions_pkey`

**约束**:
- 2200_21639_1_not_null (CHECK)
- 2200_21639_2_not_null (CHECK)
- 2200_21639_3_not_null (CHECK)
- question_package_versions_pkey (PRIMARY KEY)

---

#### `question_polish_history` - 题目润色历史表

| 字段 | 类型 | 可空 | 默认值 | 说明 |
|------|------|------|---------|------|
| `id` | BIGINT | 否 | nextval('question_polish_history_id_seq'::regclass) |  |
| `content_hash` | VARCHAR(64) | 否 | - |  |
| `locale` | VARCHAR(16) | 否 | - |  |
| `old_content` | TEXT | 是 | - |  |
| `old_options` | JSONB | 是 | - | 旧选项列表（JSONB 格式）。单选题/多选题：字符串数组（如 `["选项A", "选项B"]`）。是非题：`null` |
| `old_explanation` | TEXT | 是 | - | 旧解析说明 |
| `new_content` | TEXT | 否 | - | 新题干内容 |
| `new_options` | JSONB | 是 | - | 新选项列表（JSONB 格式）。单选题/多选题：字符串数组（如 `["选项A", "选项B"]`）。是非题：`null` |
| `new_explanation` | TEXT | 是 | - |  |
| `approved_by` | UUID | 是 | - |  |
| `approved_at` | TIMESTAMPTZ | 是 | now() |  |
| `created_at` | TIMESTAMPTZ | 是 | now() |  |
| `category` | VARCHAR(50) | 是 | - | 视频分类：basic(基础), advanced(高级) |
| `stage_tag` | VARCHAR(20) | 是 | - |  |
| `topic_tags` | _TEXT | 是 | - |  |

**索引**:
- `idx_qph_content_hash`
- `idx_qph_content_hash_locale`
- `idx_qph_locale`
- `idx_question_polish_history_category`
- `idx_question_polish_history_stage_tag`
- `idx_question_polish_history_topic_tags`
- `question_polish_history_pkey`

**约束**:
- 2200_22985_1_not_null (CHECK)
- 2200_22985_2_not_null (CHECK)
- 2200_22985_3_not_null (CHECK)
- 2200_22985_7_not_null (CHECK)
- question_polish_history_pkey (PRIMARY KEY)

---

#### `question_polish_reviews` - 题目润色审核表

| 字段 | 类型 | 可空 | 默认值 | 说明 |
|------|------|------|---------|------|
| `id` | BIGINT | 否 | nextval('question_polish_reviews_id_seq'::regclass) |  |
| `content_hash` | VARCHAR(64) | 否 | - |  |
| `locale` | VARCHAR(16) | 否 | - |  |
| `proposed_content` | TEXT | 否 | - |  |
| `proposed_options` | JSONB | 是 | - | 建议选项列表（JSONB 格式）。单选题/多选题：字符串数组（如 `["选项A", "选项B"]`）。是非题：`null` |
| `proposed_explanation` | TEXT | 是 | - |  |
| `status` | VARCHAR(16) | 否 | 'pending'::character varying | 审核状态：pending(待审核), approved(通过), rejected(驳回) |
| `notes` | TEXT | 是 | - |  |
| `created_by` | UUID | 是 | - |  |
| `reviewed_by` | UUID | 是 | - |  |
| `created_at` | TIMESTAMPTZ | 是 | now() |  |
| `reviewed_at` | TIMESTAMPTZ | 是 | - |  |
| `updated_at` | TIMESTAMPTZ | 是 | now() |  |
| `category` | VARCHAR(50) | 是 | - | 视频分类：basic(基础), advanced(高级) |
| `stage_tag` | VARCHAR(20) | 是 | - |  |
| `topic_tags` | _TEXT | 是 | - |  |

**索引**:
- `idx_qpr_content_hash`
- `idx_qpr_content_hash_locale`
- `idx_qpr_locale`
- `idx_qpr_status`
- `idx_question_polish_reviews_category`
- `idx_question_polish_reviews_stage_tag`
- `idx_question_polish_reviews_topic_tags`
- `question_polish_reviews_pkey`

**约束**:
- 2200_22970_1_not_null (CHECK)
- 2200_22970_2_not_null (CHECK)
- 2200_22970_3_not_null (CHECK)
- 2200_22970_4_not_null (CHECK)
- 2200_22970_7_not_null (CHECK)
- question_polish_reviews_pkey (PRIMARY KEY)

---

#### `question_processing_task_items` - 题目处理任务项表

| 字段 | 类型 | 可空 | 默认值 | 说明 |
|------|------|------|---------|------|
| `id` | BIGINT | 否 | nextval('question_processing_task_items_id_seq'::regclass) | 主键，自增ID |
| `task_id` | VARCHAR(64) | 否 | - | 任务ID（关联 batch_process_tasks.task_id） |
| `question_id` | BIGINT | 否 | - | 题目ID（关联 questions.id） |
| `operation` | TEXT | 否 | - | 操作类型：translate(翻译), polish(润色), fill_missing(填漏), category_tags(分类标签) |
| `target_lang` | TEXT | 是 | - | 目标语言代码（如 'ja', 'zh', 'en'） |
| `status` | TEXT | 否 | 'pending'::text | 子任务状态：pending(待处理), processing(处理中), succeeded(成功), failed(失败), skipped(跳过) |
| `error_message` | TEXT | 是 | - | 错误消息（简要错误描述） |
| `started_at` | TIMESTAMPTZ | 是 | - | 开始处理时间 |
| `finished_at` | TIMESTAMPTZ | 是 | - | 完成处理时间 |
| `ai_request` | JSONB | 是 | - | AI 请求体（完整内容），用于调试 |
| `ai_response` | JSONB | 是 | - | AI 响应（完整内容），用于调试 |
| `processed_data` | JSONB | 是 | - | 处理后要入库的数据（content, explanation等），用于调试 |
| `error_detail` | JSONB | 是 | - | 错误详情（JSONB），包含结构化的诊断信息：questionId, sourceLanguage, targetLanguage, parsedSourceLanguage, translationsKeys, errorStage, errorCode, errorMessage, sampleText, parsed, sanitized, rawAiResponse 等 |
| `created_at` | TIMESTAMPTZ | 是 | now() | 创建时间 |
| `updated_at` | TIMESTAMPTZ | 是 | now() | 更新时间 |

**索引**:
- `idx_qpt_items_operation`
- `idx_qpt_items_question_id`
- `idx_qpt_items_status`
- `idx_qpt_items_task_id`
- `idx_qpt_items_task_id_question`
- `question_processing_task_items_pkey`

**约束**:
- 2200_30755_1_not_null (CHECK)
- 2200_30755_2_not_null (CHECK)
- 2200_30755_3_not_null (CHECK)
- 2200_30755_4_not_null (CHECK)
- 2200_30755_6_not_null (CHECK)
- question_processing_task_items_pkey (PRIMARY KEY)

---

#### `questions` - 题目表（核心表）

| 字段 | 类型 | 可空 | 默认值 | 说明 |
|------|------|------|---------|------|
| `id` | BIGINT | 否 | nextval('questions_id_seq'::regclass) | 主键，自增ID |
| `content_hash` | VARCHAR(64) | 否 | - | 题目内容哈希值（SHA-256，用于去重，唯一） |
| `type` | VARCHAR(20) | 否 | - | 题目类型：single(单选题), multiple(多选题), truefalse(是非题/判断题) |
| `options` | JSONB | 是 | - | 选项列表（JSONB 格式）。单选题/多选题：存储为字符串数组，例如 `["选项A", "选项B", "选项C", "选项D"]`。是非题：存储为 `null`（不存储选项）。在 AI 翻译/润色场景中，是非题不输出 Options 部分 |
| `correct_answer` | JSONB | 否 | - | 正确答案（JSONB 格式）。单选题：字符串（如 `"A"` 或 `"选项A"`）。多选题：字符串数组（如 `["A", "B"]` 或 `["选项A", "选项B"]`）。是非题：字符串 `"true"` 或 `"false"`（系统会自动将布尔值转换为字符串格式） |
| `image` | TEXT | 是 | - | 题目图片 URL |
| `version` | VARCHAR(50) | 是 | - | 题目版本号（用于版本管理） |
| `created_at` | TIMESTAMPTZ | 是 | now() | 创建时间 |
| `updated_at` | TIMESTAMPTZ | 是 | now() | 更新时间 |
| `content` | JSONB | 否 | - | 题目内容（多语言对象，格式：{"zh": "中文题干", "ja": "日文题干", "en": "英文题干"}） |
| `category` | VARCHAR(50) | 是 | - | 视频分类：basic(基础), advanced(高级) |
| `stage_tag` | VARCHAR(20) | 是 | - | 阶段标签（'provisional' 仮免, 'regular' 本免, 'both' 两者，或 null） |
| `topic_tags` | _TEXT | 是 | - | 主题标签数组（PostgreSQL 数组类型，1-2个标签，如 ['traffic_sign', 'safety']） |
| `explanation` | JSONB | 是 | - | 解析说明（多语言对象，格式：{"zh": "中文解析", "ja": "日文解析", "en": "英文解析"}） |
| `license_type_tag` | JSONB | 是 | - | 驾照类型标签（JSONB 数组，统一大写格式，存储通用 + 专属驾照类型标签。例如：["GENERAL", "ORDINARY"]。通用题目包含 "GENERAL" 标签，专属题目仅包含对应专属标签。查询策略：通用 + 专属 OR 关系） |

**索引**:
- `idx_questions_category`
- `idx_questions_content_en`
- `idx_questions_content_hash`
- `idx_questions_content_ja`
- `idx_questions_content_zh`
- `idx_questions_created_at`
- `idx_questions_explanation_en`
- `idx_questions_explanation_ja`
- `idx_questions_explanation_zh`
- `idx_questions_license_type_tag`
- `idx_questions_stage_tag`
- `idx_questions_topic_tags`
- `idx_questions_type`
- `idx_questions_version`
- `questions_content_hash_key`
- `questions_pkey`

**约束**:
- 2200_21604_13_not_null (CHECK)
- 2200_21604_1_not_null (CHECK)
- 2200_21604_2_not_null (CHECK)
- 2200_21604_3_not_null (CHECK)
- 2200_21604_6_not_null (CHECK)
- questions_content_hash_key (UNIQUE)
- questions_pkey (PRIMARY KEY)

---

## 用户相关表

#### `user_behaviors` - 用户行为表

| 字段 | 类型 | 可空 | 默认值 | 说明 |
|------|------|------|---------|------|
| `id` | BIGINT | 否 | nextval('user_behaviors_id_seq'::regclass) |  |
| `user_id` | INTEGER | 否 | - |  |
| `behavior_type` | VARCHAR(50) | 否 | - | 行为类型：login(登录), logout(登出), start_quiz(开始答题), complete_quiz(完成答题), pause_quiz(暂停答题), resume_quiz(恢复答题), view_page(浏览页面), ai_chat(AI聊天), other(其他) |
| `ip_address` | VARCHAR(45) | 是 | - |  |
| `user_agent` | TEXT | 是 | - |  |
| `client_type` | VARCHAR(20) | 是 | - | 客户端类型：web(网页), mobile(移动端), api(API), desktop(桌面), other(其他) |
| `client_version` | VARCHAR(50) | 是 | - |  |
| `device_info` | JSONB | 是 | '{}'::jsonb |  |
| `metadata` | JSONB | 是 | '{}'::jsonb |  |
| `created_at` | TIMESTAMPTZ | 是 | now() |  |
| `notes` | TEXT | 是 | - |  |

**索引**:
- `idx_user_behaviors_behavior_type`
- `idx_user_behaviors_client_type`
- `idx_user_behaviors_created_at`
- `idx_user_behaviors_ip_address`
- `idx_user_behaviors_user_behavior_time`
- `idx_user_behaviors_user_id`
- `idx_user_behaviors_user_time`
- `user_behaviors_pkey`

**约束**:
- 2200_20673_1_not_null (CHECK)
- 2200_20673_2_not_null (CHECK)
- 2200_20673_3_not_null (CHECK)
- user_behaviors_behavior_type_check (CHECK)
- user_behaviors_client_type_check (CHECK)
- user_behaviors_pkey (PRIMARY KEY)
- user_behaviors_user_id_fkey (FOREIGN KEY)

---

#### `user_interests` - 用户兴趣表

| 字段 | 类型 | 可空 | 默认值 | 说明 |
|------|------|------|---------|------|
| `id` | BIGINT | 否 | nextval('user_interests_id_seq'::regclass) |  |
| `user_id` | INTEGER | 否 | - |  |
| `vehicle_brands` | _TEXT | 是 | - |  |
| `service_types` | _TEXT | 是 | - |  |
| `other_interests` | JSONB | 是 | '{}'::jsonb |  |
| `created_at` | TIMESTAMPTZ | 是 | now() |  |
| `updated_at` | TIMESTAMPTZ | 是 | now() |  |

**索引**:
- `idx_user_interests_created_at`
- `idx_user_interests_user_id`
- `user_interests_pkey`
- `user_interests_user_id_unique`

**约束**:
- 2200_21172_1_not_null (CHECK)
- 2200_21172_2_not_null (CHECK)
- user_interests_pkey (PRIMARY KEY)
- user_interests_user_id_fkey (FOREIGN KEY)
- user_interests_user_id_unique (UNIQUE)

---

#### `user_profiles` - 用户资料表

| 字段 | 类型 | 可空 | 默认值 | 说明 |
|------|------|------|---------|------|
| `id` | BIGINT | 否 | nextval('user_profiles_id_seq'::regclass) |  |
| `user_id` | INTEGER | 否 | - |  |
| `language` | VARCHAR(8) | 是 | 'ja'::character varying |  |
| `goals` | _TEXT | 是 | - | 用户目标数组（PostgreSQL 数组类型，如 ['pass_exam', 'improve_skills', 'get_license']） |
| `level` | VARCHAR(20) | 是 | 'beginner'::character varying | 用户等级：beginner(初级), intermediate(中级), advanced(高级), expert(专家) |
| `metadata` | JSONB | 是 | '{}'::jsonb |  |
| `created_at` | TIMESTAMPTZ | 是 | now() |  |
| `updated_at` | TIMESTAMPTZ | 是 | now() |  |

**索引**:
- `idx_user_profiles_created_at`
- `idx_user_profiles_language`
- `idx_user_profiles_level`
- `idx_user_profiles_user_id`
- `user_profiles_pkey`
- `user_profiles_user_id_unique`

**约束**:
- 2200_21146_1_not_null (CHECK)
- 2200_21146_2_not_null (CHECK)
- user_profiles_level_check (CHECK)
- user_profiles_pkey (PRIMARY KEY)
- user_profiles_user_id_fkey (FOREIGN KEY)
- user_profiles_user_id_unique (UNIQUE)

---

#### `users` - 用户表

| 字段 | 类型 | 可空 | 默认值 | 说明 |
|------|------|------|---------|------|
| `id` | INTEGER | 否 | nextval('users_id_seq'::regclass) | 主键，自增ID |
| `email` | VARCHAR(255) | 否 | - | 用户邮箱（唯一） |
| `name` | VARCHAR(100) | 是 | - | 用户姓名 |
| `phone` | VARCHAR(20) | 是 | - | 用户电话 |
| `status` | VARCHAR(20) | 否 | 'active'::character varying | 用户状态：active(活跃), inactive(非活跃), suspended(暂停), pending(待激活) |
| `activation_code_id` | INTEGER | 是 | - | 使用的激活码ID（外键关联 activation_codes.id） |
| `registration_info` | JSONB | 是 | '{}'::jsonb | 注册信息（JSON 格式，包含注册时的额外信息，如 IP、来源等） |
| `created_at` | TIMESTAMPTZ | 是 | now() | 创建时间（注册时间） |
| `updated_at` | TIMESTAMPTZ | 是 | now() | 更新时间 |
| `last_login_at` | TIMESTAMPTZ | 是 | - | 最后登录时间 |
| `notes` | TEXT | 是 | - | 备注信息 |
| `userid` | VARCHAR(255) | 是 | - | 用户唯一标识符（唯一，可能是 UUID 或其他格式） |

**索引**:
- `idx_users_activation_code_id`
- `idx_users_created_at`
- `idx_users_email`
- `idx_users_last_login_at`
- `idx_users_status`
- `idx_users_userid`
- `users_email_key`
- `users_pkey`
- `users_userid_key`

**约束**:
- 2200_20647_1_not_null (CHECK)
- 2200_20647_2_not_null (CHECK)
- 2200_20647_5_not_null (CHECK)
- users_activation_code_id_fkey (FOREIGN KEY)
- users_email_key (UNIQUE)
- users_pkey (PRIMARY KEY)
- users_status_check (CHECK)
- users_userid_key (UNIQUE)

---

## ⚠️ 不明确字段列表

以下字段的具体值或用途需要进一步确认（已从代码中提取大部分信息，剩余字段需要查看实际数据）：

### services 表
1. **price_unit** - 价格单位的具体值（代码中确认有 'yen', 'usd'，可能有其他货币单位，需确认实际使用的值）

**注意**：大部分字段的含义已从代码中提取并更新到文档中。上述字段需要查看实际数据库数据来确认具体值。
---

