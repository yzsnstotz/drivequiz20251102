// ============================================================
// 文件路径: src/lib/db.ts
// 功能: 数据库连接配置 (PostgreSQL + Kysely)
// 更新日期: 2025-11-01
// 更新内容: 为 activation_codes 表增加后台管理字段
// ============================================================

import { Kysely, PostgresDialect, Generated } from "kysely";
import { Pool } from "pg";

// ------------------------------------------------------------
// 1️⃣ activation_codes 表结构定义
// ------------------------------------------------------------
interface ActivationCodeTable {
  id: Generated<number>;
  code: string;
  usage_limit: number;
  used_count: number;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;

  // ✅ 新增字段（后台管理所需）
  status: "disabled" | "enabled" | "suspended" | "expired";
  expires_at: Date | null; // 计算后的到期时间（用户激活后开始计算）
  enabled_at: Date | null;
  notes: string | null;

  // ✅ 有效期字段（用户激活后开始倒计时）
  validity_period: number | null; // 有效期周期（数字）
  validity_unit: "day" | "month" | "year" | null; // 有效期单位
  activation_started_at: Date | null; // 用户激活账户的时间（倒计时开始时间）
}

// ------------------------------------------------------------
// 2️⃣ activations 表结构定义
// ------------------------------------------------------------
interface ActivationTable {
  id: Generated<number>;
  email: string;
  activation_code: string;
  ip_address: string | null;
  user_agent: string | null;
  activated_at: Generated<Date>;
}

// ------------------------------------------------------------
// 3️⃣ admins 表结构定义
// ------------------------------------------------------------
interface AdminTable {
  id: Generated<number>;
  username: string;
  token: string;
  is_active: boolean;
  permissions: string[]; // JSONB数组，存储权限类别
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

// ------------------------------------------------------------
// 4️⃣ operation_logs 表结构定义
// ------------------------------------------------------------
interface OperationLogTable {
  id: Generated<number>;
  admin_id: number;
  admin_username: string;
  action: "create" | "update" | "delete";
  table_name: string;
  record_id: number | null;
  old_value: any | null; // JSONB
  new_value: any | null; // JSONB
  description: string | null;
  created_at: Generated<Date>;
}

// ------------------------------------------------------------
// 5️⃣ merchant_categories 表结构定义
// ------------------------------------------------------------
interface MerchantCategoryTable {
  id: Generated<number>;
  name: string;
  display_order: number;
  status: "active" | "inactive";
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

// ------------------------------------------------------------
// 6️⃣ merchants 表结构定义
// ------------------------------------------------------------
interface MerchantTable {
  id: Generated<number>;
  name: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  image_url: string | null;
  category: string | null;
  status: "active" | "inactive";
  ad_start_date: Date | null;
  ad_end_date: Date | null;
  ad_slot: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

// ------------------------------------------------------------
// 7️⃣ vehicle_types 表结构定义
// ------------------------------------------------------------
interface VehicleTypeTable {
  id: Generated<number>;
  name: string;
  name_ja: string | null;
  name_zh: string | null;
  name_en: string | null;
  description: string | null;
  icon: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

// ------------------------------------------------------------
// 8️⃣ vehicles 表结构定义
// ------------------------------------------------------------
interface VehicleTable {
  id: Generated<number>;
  vehicle_type_id: number | null;
  brand: string;
  model: string;
  year: number | null;
  name_ja: string | null;
  name_zh: string | null;
  name_en: string | null;
  description_ja: string | null;
  description_zh: string | null;
  description_en: string | null;
  price_min: number | null;
  price_max: number | null;
  fuel_type: string | null;
  transmission: string | null;
  seats: number | null;
  image_url: string | null;
  official_url: string | null;
  dealer_url: string | null;
  specifications: Record<string, any> | null;
  metadata: Record<string, any> | null;
  status: "active" | "inactive" | "archived";
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

// ------------------------------------------------------------
// 9️⃣ services 表结构定义
// ------------------------------------------------------------
interface ServiceTable {
  id: Generated<number>;
  name: string;
  name_ja: string | null;
  name_zh: string | null;
  name_en: string | null;
  description: string | null;
  description_ja: string | null;
  description_zh: string | null;
  description_en: string | null;
  location: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  prefecture: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  price_min: number | null;
  price_max: number | null;
  price_unit: string | null;
  rating_avg: number | null;
  rating_count: number | null;
  image_url: string | null;
  official_url: string | null;
  business_hours: Record<string, any> | null;
  features: Record<string, any> | null;
  metadata: Record<string, any> | null;
  status: "active" | "inactive" | "archived";
  category_id: number | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

// ------------------------------------------------------------
// 8️⃣ service_categories 表结构定义
// ------------------------------------------------------------
interface ServiceCategoryTable {
  id: Generated<number>;
  name: string;
  name_ja: string | null;
  name_zh: string | null;
  name_en: string | null;
  description: string | null;
  icon: string | null;
  parent_id: number | null;
  sort_order: number | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

// ------------------------------------------------------------
// 9️⃣ service_reviews 表结构定义
// ------------------------------------------------------------
interface ServiceReviewTable {
  id: Generated<number>;
  service_id: number;
  user_id: string | null; // ✅ 改为字符串类型（UUID），NextAuth v5 使用字符串 ID
  rating: number;
  comment: string | null;
  metadata: Record<string, any> | null;
  status: "active" | "hidden" | "deleted";
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

// ------------------------------------------------------------
// 🔟 videos 表结构定义
// ------------------------------------------------------------
interface VideoTable {
  id: Generated<number>;
  title: string;
  description: string | null;
  url: string;
  thumbnail: string | null;
  category: "basic" | "advanced";
  display_order: number;
  status: "active" | "inactive";
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

// ------------------------------------------------------------
// 8️⃣ ad_slots_config 表结构定义
// ------------------------------------------------------------
interface AdSlotsConfigTable {
  id: Generated<number>;
  slot_key: string;
  title: string;
  description: string | null;
  splash_duration: number;
  is_enabled: boolean;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

// ------------------------------------------------------------
// 8️⃣1️⃣ ad_slots 表结构定义
// ------------------------------------------------------------
interface AdSlotsTable {
  id: Generated<number>;
  position: string;
  name: string;
  name_ja: string | null;
  name_zh: string | null;
  name_en: string | null;
  description: string | null;
  width: number | null;
  height: number | null;
  format: string | null;
  status: "active" | "inactive" | "archived";
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

// ------------------------------------------------------------
// 8️⃣2️⃣ ad_contents 表结构定义
// ------------------------------------------------------------
interface AdContentsTable {
  id: Generated<number>;
  slot_id: number;
  title: string;
  title_ja: string | null;
  title_zh: string | null;
  title_en: string | null;
  description: string | null;
  description_ja: string | null;
  description_zh: string | null;
  description_en: string | null;
  image_url: string | null;
  video_url: string | null;
  link_url: string | null;
  start_date: Date | null;
  end_date: Date | null;
  priority: number | null;
  weight: number | null;
  impression_count: number | null;
  click_count: number | null;
  metadata: any | null; // JSONB
  status: "draft" | "active" | "paused" | "archived";
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

// ------------------------------------------------------------
// 8️⃣3️⃣ ad_logs 表结构定义
// ------------------------------------------------------------
interface AdLogsTable {
  id: Generated<number>;
  ad_content_id: number;
  user_id: string | null; // ✅ 改为字符串类型，关联 users.id（UUID）
  log_type: "impression" | "click" | "conversion";
  ip_address: string | null;
  user_agent: string | null;
  client_type: "web" | "mobile" | "api" | "desktop" | "other" | null;
  metadata: any | null; // JSONB
  created_at: Generated<Date>;
}

// ------------------------------------------------------------
// 9️⃣ contact_info 表结构定义
// ------------------------------------------------------------
interface ContactInfoTable {
  id: Generated<number>;
  type: "business" | "purchase";
  wechat: string | null;
  email: string | null;
  status: "active" | "inactive";
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

// ------------------------------------------------------------
// 9️⃣ terms_of_service 表结构定义
// ------------------------------------------------------------
interface TermsOfServiceTable {
  id: Generated<number>;
  title: string;
  content: string;
  version: string;
  status: "active" | "inactive";
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

// ------------------------------------------------------------
// 🔟 user_profiles 表结构定义
// ------------------------------------------------------------
interface UserProfileTable {
  id: Generated<number>;
  user_id: string; // ✅ 改为字符串类型，关联 users.id（UUID）
  language: string | null;
  goals: string[] | null;
  level: "beginner" | "intermediate" | "advanced" | "expert";
  metadata: Record<string, any> | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

// ------------------------------------------------------------
// 1️⃣1️⃣ user_interests 表结构定义
// ------------------------------------------------------------
interface UserInterestsTable {
  id: Generated<number>;
  user_id: string; // ✅ 改为字符串类型，关联 users.id（UUID）
  vehicle_brands: string[] | null;
  service_types: string[] | null;
  other_interests: Record<string, any> | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

// ------------------------------------------------------------
// 1️⃣2️⃣ ai_logs 表结构定义
// ------------------------------------------------------------
interface AiLogsTable {
  id: Generated<number>;
  user_id: string | null;
  question: string;
  answer: string | null;
  language: string | null; // 注意：迁移脚本中为 locale，但代码中使用 language
  model: string | null;
  rag_hits: number | null;
  cost_est: number | null; // NUMERIC(10,4)
  safety_flag: string; // "ok" | "needs_human" | "blocked"
  created_at: Generated<Date>;
}

// ------------------------------------------------------------
// 1️⃣2️⃣ users 表结构定义
// ------------------------------------------------------------
interface UserTable {
  id: Generated<string>; // ✅ 改为字符串类型（UUID），NextAuth v5 使用字符串 ID
  userid: string | null; // 用户唯一标识符（区别于id，用于AI日志关联）
  email: string;
  name: string | null;
  phone: string | null;
  status: "active" | "inactive" | "suspended" | "pending";
  activation_code_id: number | null;
  registration_info: any | null; // JSONB
  phone_verified_at: Date | null; // 电话号码验证时间（暂时不使用）
  oauth_provider: string | null; // 首次登录使用的OAuth提供商
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  last_login_at: Date | null;
  notes: string | null;
}

// ------------------------------------------------------------
// 1️⃣3️⃣ user_behaviors 表结构定义
// ------------------------------------------------------------
interface UserBehaviorTable {
  id: Generated<number>;
  user_id: string; // ✅ 改为字符串类型，关联 users.id（UUID）
  behavior_type: "login" | "logout" | "start_quiz" | "complete_quiz" | "pause_quiz" | "resume_quiz" | "view_page" | "ai_chat" | "other";
  ip_address: string | null;
  user_agent: string | null;
  client_type: "web" | "mobile" | "api" | "desktop" | "other" | null;
  client_version: string | null;
  device_info: any | null; // JSONB
  metadata: any | null; // JSONB
  created_at: Generated<Date>;
  notes: string | null;
}

// ------------------------------------------------------------
// 1️⃣4️⃣ oauth_accounts 表结构定义
// ------------------------------------------------------------
interface OAuthAccountTable {
  id: Generated<number>;
  user_id: string; // ✅ 改为字符串类型，关联 users.id（UUID）
  provider: string; // 'wechat', 'line', 'google', 'facebook', 'twitter'
  provider_account_id: string; // 第三方平台的用户ID
  access_token: string | null;
  refresh_token: string | null;
  expires_at: Date | null;
  token_type: string | null;
  scope: string | null;
  id_token: string | null;
  session_state: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

// ------------------------------------------------------------
// 1️⃣4️⃣-1️⃣ Account 视图结构定义（用于 NextAuth KyselyAdapter）
// 注意：使用驼峰命名，与 KyselyAdapter 查询一致
// 写入时，KyselyAdapter 传入的对象可能使用下划线命名（来自 TokenEndpointResponse），
// 但触发器会处理这种映射
// ------------------------------------------------------------
interface AccountTable {
  id: string; // 视图返回字符串类型
  userId: string; // 驼峰命名，映射自 oauth_accounts.user_id
  provider: string;
  providerAccountId: string; // 驼峰命名，映射自 oauth_accounts.provider_account_id
  type: "oauth" | "oidc" | "email" | "webauthn"; // NextAuth adapter 期望的字段（AdapterAccountType）
  accessToken: string | undefined; // 驼峰命名，映射自 oauth_accounts.access_token（@auth/kysely-adapter 期望 undefined 而不是 null）
  refreshToken: string | undefined; // 驼峰命名，映射自 oauth_accounts.refresh_token
  expiresAt: Date | null; // 驼峰命名，映射自 oauth_accounts.expires_at（@auth/kysely-adapter 期望 Date 字段使用 null）
  tokenType: string | undefined; // 驼峰命名，映射自 oauth_accounts.token_type
  scope: string | undefined;
  idToken: string | undefined; // 驼峰命名，映射自 oauth_accounts.id_token
  sessionState: string | undefined; // 驼峰命名，映射自 oauth_accounts.session_state
  createdAt: Date; // 驼峰命名，映射自 oauth_accounts.created_at
  updatedAt: Date; // 驼峰命名，映射自 oauth_accounts.updated_at
  // 索引签名：满足 AdapterAccount 的类型要求（继承自 Account，而 Account 继承自 Partial<TokenEndpointResponse>）
  [key: string]: any;
}

// ------------------------------------------------------------
// 1️⃣5️⃣ sessions 表结构定义 (NextAuth)
// ------------------------------------------------------------
interface SessionTable {
  id: string;
  session_token: string;
  user_id: string; // ✅ 改为字符串类型，关联 users.id（UUID）
  expires: Date;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

// ------------------------------------------------------------
// 1️⃣6️⃣ verification_tokens 表结构定义 (NextAuth)
// ------------------------------------------------------------
interface VerificationTokenTable {
  identifier: string;
  token: string;
  expires: Date;
}

// ------------------------------------------------------------
// 1️⃣4️⃣ questions 表结构定义
// ------------------------------------------------------------
interface QuestionTable {
  id: Generated<number>;
  content_hash: string;
  type: "single" | "multiple" | "truefalse";
  content: any; // ✅ JSONB - 多语言内容对象
  options: any | null; // ✅ JSONB
  correct_answer: any | null; // ✅ JSONB
  image: string | null;
  explanation: any | null; // ✅ JSONB - 多语言解析对象
  license_types: string[] | null; // 兼容旧字段（数组）
  license_type_tag: any | null; // ✅ JSONB - 驾照类型标签（JSONB 数组，内部约定为 string[]，例如 ["ALL","ORDINARY"]）
  category: string | null; // 题目分类（如 "12"）
  stage_tag: "both" | "provisional" | "regular" | null; // 阶段标签（兼容旧值，新值应为 "provisional" | "full" | "both"）
  topic_tags: string[] | null; // 主题标签数组（如 ['traffic_sign']）
  version: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

// ------------------------------------------------------------
// 1️⃣5️⃣ question_ai_answers 表结构定义
// ------------------------------------------------------------
interface QuestionAiAnswerTable {
  id: Generated<number>;
  question_hash: string;
  locale: string;
  answer: string;
  sources: any | null; // JSONB
  model: string | null;
  created_by: string | null; // UUID
  view_count: number;
  category: string | null; // 题目分类（冗余字段，从questions表同步）
  stage_tag: "both" | "provisional" | "regular" | null; // 阶段标签（冗余字段）
  topic_tags: string[] | null; // 主题标签数组（冗余字段）
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

// ------------------------------------------------------------
// 1️⃣6️⃣ question_ai_answer_pending_updates 表结构定义
// ------------------------------------------------------------
interface QuestionAiAnswerPendingUpdateTable {
  id: Generated<number>;
  question_hash: string;
  locale: string;
  package_name: string | null;
  created_at: Generated<Date>;
}

// ------------------------------------------------------------
// 1️⃣7️⃣ question_package_versions 表结构定义
// ------------------------------------------------------------
interface QuestionPackageVersionTable {
  id: Generated<number>;
  package_name: string;
  version: string;
  total_questions: number;
  ai_answers_count: number;
  package_content: any | null; // JSONB字段，存储完整的JSON包内容
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

// ------------------------------------------------------------
// 1️⃣8️⃣ languages 表结构定义
// ------------------------------------------------------------
interface LanguageTable {
  id: Generated<number>;
  locale: string;
  name: string;
  enabled: boolean;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

// ------------------------------------------------------------
// 1️⃣9️⃣ question_translations 表结构定义
// ------------------------------------------------------------
interface QuestionTranslationsTable {
  id: Generated<number>;
  content_hash: string;
  locale: string;
  content: string;
  options: any | null; // JSONB
  explanation: string | null;
  image: string | null;
  source: string | null; // ai / human / import
  created_by: string | null; // UUID
  category: string | null; // 题目分类（冗余字段，从questions表同步）
  stage_tag: "both" | "provisional" | "regular" | null; // 阶段标签（冗余字段）
  topic_tags: string[] | null; // 主题标签数组（冗余字段）
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

// ------------------------------------------------------------
// 2️⃣0️⃣ question_polish_reviews 表结构定义
// ------------------------------------------------------------
interface QuestionPolishReviewsTable {
  id: Generated<number>;
  content_hash: string;
  locale: string;
  proposed_content: string;
  proposed_options: any | null; // JSONB
  proposed_explanation: string | null;
  status: "pending" | "approved" | "rejected";
  notes: string | null;
  created_by: string | null; // UUID
  reviewed_by: string | null; // UUID
  category: string | null; // 题目分类（冗余字段，从questions表同步）
  stage_tag: "both" | "provisional" | "regular" | null; // 阶段标签（冗余字段）
  topic_tags: string[] | null; // 主题标签数组（冗余字段）
  created_at: Generated<Date>;
  reviewed_at: Date | null;
  updated_at: Generated<Date>;
}

// ------------------------------------------------------------
// 2️⃣1️⃣ question_polish_history 表结构定义
// ------------------------------------------------------------
interface QuestionPolishHistoryTable {
  id: Generated<number>;
  content_hash: string;
  locale: string;
  old_content: string | null;
  old_options: any | null; // JSONB
  old_explanation: string | null;
  new_content: string;
  new_options: any | null; // JSONB
  new_explanation: string | null;
  approved_by: string | null; // UUID
  category: string | null; // 题目分类（冗余字段，从questions表同步）
  stage_tag: "both" | "provisional" | "regular" | null; // 阶段标签（冗余字段）
  topic_tags: string[] | null; // 主题标签数组（冗余字段）
  approved_at: Generated<Date>;
  created_at: Generated<Date>;
}

// ------------------------------------------------------------
// 2️⃣0️⃣ batch_process_tasks 表结构定义
// ------------------------------------------------------------
interface BatchProcessTaskTable {
  id: Generated<number>;
  task_id: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  operations: string[];
  question_ids: number[] | null;
  translate_options: any | null; // JSONB
  polish_options: any | null; // JSONB
  batch_size: number;
  continue_on_error: boolean;
  total_questions: number;
  processed_count: number;
  succeeded_count: number;
  failed_count: number;
  current_batch: number;
  errors: any | null; // JSONB
  details: any | null; // JSONB
  created_by: string | null;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

// ------------------------------------------------------------
// 2️⃣1️⃣ question_processing_task_items 表结构定义
// ------------------------------------------------------------
interface QuestionProcessingTaskItemsTable {
  id: Generated<number>;
  task_id: string;
  question_id: number;
  operation: string;
  target_lang: string | null;
  status: "pending" | "processing" | "succeeded" | "partially_succeeded" | "failed" | "skipped";
  error_message: string | null;
  started_at: Date | null;
  finished_at: Date | null;
  content_hash: string | null;      // 题目的 content_hash
  ai_provider: string | null;        // AI 服务提供商
  ai_request: any | null;          // AI 请求体（JSONB）
  ai_response: any | null;          // AI 响应（JSONB）
  processed_data: any | null;       // 处理后要入库的数据（JSONB）
  error_detail: any | null;         // 错误详情（JSONB），包含结构化的诊断信息
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

// ------------------------------------------------------------
// 1️⃣1️⃣ 数据库总接口定义
// ------------------------------------------------------------
export interface Database {
  activations: ActivationTable;
  activation_codes: ActivationCodeTable;
  admins: AdminTable;
  operation_logs: OperationLogTable;
  merchant_categories: MerchantCategoryTable;
  merchants: MerchantTable;
  vehicle_types: VehicleTypeTable;
  vehicles: VehicleTable;
  services: ServiceTable;
  service_categories: ServiceCategoryTable;
  service_reviews: ServiceReviewTable;
  videos: VideoTable;
  ad_slots_config: AdSlotsConfigTable;
  ad_slots: AdSlotsTable;
  ad_contents: AdContentsTable;
  ad_logs: AdLogsTable;
  contact_info: ContactInfoTable;
  terms_of_service: TermsOfServiceTable;
  user_profiles: UserProfileTable;
  user_interests: UserInterestsTable;
  ai_logs: AiLogsTable;
  users: UserTable;
  user_behaviors: UserBehaviorTable;
  oauth_accounts: OAuthAccountTable;
  sessions: SessionTable;
  verification_tokens: VerificationTokenTable;
  // NextAuth adapter 期望的表名映射（指向实际表或视图）
  // ⚠️ 注意：User 视图包含 emailVerified 字段（映射自 phone_verified_at），但 UserTable 没有
  // 为了满足 @auth/kysely-adapter 的类型要求，创建一个适配器类型
  // ⚠️ 关键：覆盖 id 字段，从 Generated<string> 改为 string，满足 @auth/kysely-adapter 的类型要求
  User: Omit<UserTable, 'id'> & {
    id: string; // @auth/kysely-adapter 期望 string，而不是 Generated<string>
    emailVerified: Date | null; // NextAuth adapter 期望的字段（@auth/kysely-adapter 期望 Date 字段使用 null）
    image: string | undefined; // NextAuth adapter 期望的字段（@auth/kysely-adapter 期望 undefined 而不是 null）
    createdAt: Date; // NextAuth adapter 期望的字段（映射自 created_at）
    updatedAt: Date; // NextAuth adapter 期望的字段（映射自 updated_at）
  };
  Account: AccountTable; // 映射到 Account 视图（使用驼峰命名，与 NextAuth AdapterAccount 一致）
  Session: SessionTable; // 映射到 sessions 表
  VerificationToken: VerificationTokenTable; // 映射到 verification_tokens 表
  questions: QuestionTable;
  question_ai_answers: QuestionAiAnswerTable;
  question_ai_answer_pending_updates: QuestionAiAnswerPendingUpdateTable;
  question_package_versions: QuestionPackageVersionTable;
  languages: LanguageTable;
  // question_translations: QuestionTranslationsTable; // 已废弃：翻译现在存储在 questions.content JSONB 中
  question_polish_reviews: QuestionPolishReviewsTable;
  question_polish_history: QuestionPolishHistoryTable;
  batch_process_tasks: BatchProcessTaskTable;
  question_processing_task_items: QuestionProcessingTaskItemsTable;
}

// ------------------------------------------------------------
// 4️⃣ 数据库连接配置
// 优先使用 DATABASE_URL (本地开发)，回退到 POSTGRES_URL (生产环境)
// 延迟初始化以避免构建时检查
// ------------------------------------------------------------

let dbInstance: Kysely<Database> | null = null;
let dbPool: Pool | null = null;

// 检查是否在构建阶段（Next.js 在构建时会设置特定的环境变量）
function isBuildTime(): boolean {
  // Next.js 在构建时可能会设置这些环境变量
  // 或者在构建时不会设置数据库连接字符串
  // 在 Vercel 构建时，如果没有 DATABASE_URL/POSTGRES_URL，很可能是构建阶段
  const hasDbUrl = !!(process.env.DATABASE_URL || process.env.POSTGRES_URL);
  const isNextBuild = process.env.NEXT_PHASE === 'phase-production-build' || 
                      process.env.NEXT_PHASE === 'phase-development-build';
  
  // 如果没有数据库连接字符串，很可能是在构建阶段（静态分析）
  // 或者在 Vercel 构建时还没有设置环境变量
  return isNextBuild || !hasDbUrl;
}

function getConnectionString(): string {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  
  // 如果没有连接字符串，返回占位符而不是抛出错误
  // 这样可以避免构建时失败，运行时会在 Proxy 中检测到并返回占位符
  if (!connectionString) {
    return 'postgresql://placeholder:placeholder@placeholder:5432/placeholder';
  }
  
  return connectionString;
}

function createDbInstance(): Kysely<Database> {
  // 获取连接字符串（如果不存在会返回占位符）
  const connectionString = getConnectionString();

  // 检查是否是占位符连接字符串
  const isPlaceholder = connectionString === 'postgresql://placeholder:placeholder@placeholder:5432/placeholder';
  
  // 如果是占位符，返回占位符数据库对象
  if (isPlaceholder) {
    return createPlaceholderDb();
  }

  // 检测是否需要SSL连接（Supabase必须使用SSL）
  // 强制检测：如果包含 supabase.com，必须使用 SSL
  const isSupabase = connectionString && (
    connectionString.includes('supabase.com') || 
    connectionString.includes('sslmode=require')
  );

  // 创建 Pool 配置对象
  const poolConfig: {
    connectionString: string;
    ssl?: { rejectUnauthorized: boolean };
    max?: number; // 最大连接数
    min?: number; // 最小连接数
    idleTimeoutMillis?: number; // 空闲连接超时时间（毫秒）
    connectionTimeoutMillis?: number; // 连接超时时间（毫秒）
    statement_timeout?: number; // 语句超时时间（毫秒）
    query_timeout?: number; // 查询超时时间（毫秒）
  } = {
    connectionString,
    // 连接池配置（针对批量处理场景优化）
    max: 20, // 最大连接数（适合大多数应用）
    min: 2, // 最小连接数（保持一些连接活跃）
    idleTimeoutMillis: 30000, // 空闲连接30秒后关闭
    connectionTimeoutMillis: 30000, // ✅ 修复：连接超时30秒（批量处理需要更长时间，从10秒增加到30秒）
    statement_timeout: 60000, // ✅ 修复：语句超时60秒（批量处理可能需要更长时间，从30秒增加到60秒）
    query_timeout: 60000, // ✅ 修复：查询超时60秒（批量处理可能需要更长时间，从30秒增加到60秒）
  };

  // Supabase 必须使用 SSL，但证书链可能有自签名证书
  if (isSupabase) {
    poolConfig.ssl = {
      rejectUnauthorized: false,
    };
    // 调试：在开发环境打印配置信息
    if (process.env.NODE_ENV === 'development') {
      console.log('[DB Config] ✅ SSL enabled for Supabase connection');
      console.log('[DB Config] Connection string (first 50 chars):', connectionString.substring(0, 50) + '...');
    }
  } else if (process.env.NODE_ENV === 'development') {
    console.log('[DB Config] ℹ️  SSL not enabled (not Supabase connection)');
  }

  // 创建 Pool 实例并传递给 PostgresDialect
  // 注意：必须在传递给 PostgresDialect 之前创建 Pool 实例，以确保 SSL 配置正确应用
  const pool = new Pool(poolConfig);
  dbPool = pool; // 保存 Pool 实例以便后续获取统计信息

  // 添加连接池错误处理
  pool.on('error', (err) => {
    console.error('[DB Pool] Unexpected error on idle client:', err);
  });

  // 添加连接池连接事件监听（开发环境）
  if (process.env.NODE_ENV === 'development') {
    pool.on('connect', () => {
      console.log('[DB Pool] New client connected');
    });
    pool.on('remove', () => {
      console.log('[DB Pool] Client removed from pool');
    });
  }

  // 添加连接池错误处理
  pool.on('error', (err) => {
    console.error('[DB Pool] Unexpected error on idle client:', err);
  });

  // 添加连接池连接事件监听（开发环境）
  if (process.env.NODE_ENV === 'development') {
    pool.on('connect', () => {
      console.log('[DB Pool] New client connected');
    });
    pool.on('remove', () => {
      console.log('[DB Pool] Client removed from pool');
    });
  }

  // 验证 Pool 配置（开发环境）
  if (process.env.NODE_ENV === 'development' && isSupabase) {
    // 检查 Pool 的配置是否正确
    // pg Pool 的配置存储在内部，需要检查是否正确应用
    console.log('[DB Config] Pool config applied:', {
      hasSSL: !!poolConfig.ssl,
      sslConfig: poolConfig.ssl,
    });
    
    // 尝试通过测试连接验证 SSL 配置
    // 注意：这只是用于调试，不会实际建立连接
    // 注意：我们只在数据库连接配置中使用 rejectUnauthorized: false
    // 不设置全局 NODE_TLS_REJECT_UNAUTHORIZED 环境变量，以避免影响其他 HTTPS 请求
    // 如果环境变量已经设置（例如在 package.json 的 dev 脚本中），这是可以接受的
    // 但在生产环境中，应该依赖连接配置而不是全局环境变量
    if (process.env.NODE_ENV !== 'development' || !!process.env.VERCEL) {
      console.log('[DB Config] ℹ️  Using SSL with rejectUnauthorized: false (production mode, relying on connection config only)');
    }
  }

  const dialect = new PostgresDialect({
    pool,
  });

  return new Kysely<Database>({
    dialect,
  });
}

// 创建一个占位符对象，用于构建时
function createPlaceholderDb(): Kysely<Database> {
  // 在构建时，返回一个不会实际工作的对象
  // 这只是一个占位符，不会被实际调用
  const placeholder = {
    selectFrom: () => ({
      select: () => ({ execute: async () => [] }),
      selectAll: () => ({ execute: async () => [] }),
      where: () => ({ execute: async () => [] }),
    }),
    insertInto: () => ({
      values: () => ({ returning: () => ({ execute: async () => [] }) }),
    }),
    updateTable: () => ({
      set: () => ({ where: () => ({ execute: async () => [] }) }),
    }),
    deleteFrom: () => ({
      where: () => ({ execute: async () => [] }),
    }),
    transaction: () => ({
      execute: async (callback: any) => callback(placeholder),
    }),
  } as any;
  
  return placeholder;
}

// 延迟初始化：只在运行时访问时创建实例
export const db = new Proxy({} as Kysely<Database>, {
  get(_target, prop) {
    // 检查是否在构建阶段或没有数据库连接字符串
    // 如果是，返回占位符对象，避免抛出错误
    const hasDbUrl = !!(process.env.DATABASE_URL || process.env.POSTGRES_URL);
    const shouldUsePlaceholder = isBuildTime() || !hasDbUrl;
    
    if (shouldUsePlaceholder) {
      const placeholder = createPlaceholderDb();
      const value = placeholder[prop as keyof Kysely<Database>];
      if (typeof value === 'function') {
        return value.bind(placeholder);
      }
      return value;
    }
    
    // 运行时且环境变量存在时，才真正创建数据库连接
    if (!dbInstance) {
      try {
        dbInstance = createDbInstance();
      } catch (error) {
        // 如果创建连接失败（例如环境变量格式错误），返回占位符
        // 这样构建不会失败，但运行时会有错误日志
        console.error('[DB] Failed to create database instance, using placeholder:', error);
        return createPlaceholderDb()[prop as keyof Kysely<Database>];
      }
    }
    const value = dbInstance[prop as keyof Kysely<Database>];
    if (typeof value === 'function') {
      return value.bind(dbInstance);
    }
    return value;
  }
});

// ------------------------------------------------------------
// 💡 说明
// - 所有时间字段均为 UTC 时间。
// - 字段命名遵循 snake_case。
// - API 输出时统一转换为 camelCase。
// ------------------------------------------------------------

// ============================================================
// 数据库连接池统计函数
// ============================================================

export type PoolStats = {
  total: number;
  idle: number;
  active: number;
  waiting: number;
  usageRate: number;
  status: "healthy" | "warning" | "critical";
};

export function getDbPoolStats(): PoolStats | null {
  if (!dbPool) {
    // 如果 Pool 还没有创建，尝试初始化数据库实例
    try {
      // 触发数据库实例创建（这会创建 Pool）
      const _ = db;
      // 如果还是 null，说明可能是占位符或构建时
      if (!dbPool) {
        return null;
      }
    } catch (err) {
      console.error("[getDbPoolStats] Failed to initialize database:", err);
      return null;
    }
  }

  try {
    // pg Pool 对象的属性（使用私有属性或公共属性）
    // 注意：pg Pool 可能使用不同的属性名，这里尝试多种方式
    const poolAny = dbPool as any;
    
    // 尝试获取连接池统计信息
    // pg Pool 可能使用以下属性：
    // - totalCount: 总连接数
    // - idleCount: 空闲连接数  
    // - waitingCount: 等待连接的请求数
    // 或者使用私有属性：
    // - _clients: 客户端数组
    // - _idle: 空闲客户端数组
    // - _waiting: 等待队列
    
    let total = 0;
    let idle = 0;
    let waiting = 0;
    
    // 方法1: 尝试使用公共属性
    if (typeof poolAny.totalCount === 'number') {
      total = poolAny.totalCount;
      idle = poolAny.idleCount ?? 0;
      waiting = poolAny.waitingCount ?? 0;
    } 
    // 方法2: 尝试使用私有属性
    else if (Array.isArray(poolAny._clients)) {
      total = poolAny._clients.length;
      idle = Array.isArray(poolAny._idle) ? poolAny._idle.length : 0;
      waiting = Array.isArray(poolAny._waiting) ? poolAny._waiting.length : 0;
    }
    // 方法3: 如果都不可用，返回默认值
    else {
      // 无法获取实际统计，返回默认值
      console.warn("[getDbPoolStats] Unable to get pool statistics, using defaults");
      total = 0;
      idle = 0;
      waiting = 0;
    }
    
    const active = Math.max(0, total - idle);
    const maxConnections = poolAny.options?.max ?? 20;
    const usageRate = maxConnections > 0 ? Math.min(1, active / maxConnections) : 0;

    // 判断状态
    let status: "healthy" | "warning" | "critical" = "healthy";
    if (usageRate >= 0.9 || waiting > 10) {
      status = "critical";
    } else if (usageRate >= 0.7 || waiting > 0) {
      status = "warning";
    }

    return {
      total,
      idle,
      active,
      waiting,
      usageRate,
      status,
    };
  } catch (err) {
    console.error("[getDbPoolStats] Error getting pool stats:", err);
    return null;
  }
}
