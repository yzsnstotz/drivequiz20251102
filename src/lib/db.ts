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
// 5️⃣ 数据库总接口定义
// ------------------------------------------------------------
interface Database {
  activations: ActivationTable;
  activation_codes: ActivationCodeTable;
  admins: AdminTable;
  operation_logs: OperationLogTable;
}

// ------------------------------------------------------------
// 4️⃣ 数据库连接配置
// 优先使用 DATABASE_URL (本地开发)，回退到 POSTGRES_URL (生产环境)
// 延迟初始化以避免构建时检查
// ------------------------------------------------------------

let dbInstance: Kysely<Database> | null = null;

// 检查是否在构建阶段（Next.js 在构建时会设置特定的环境变量）
function isBuildTime(): boolean {
  // Next.js 在构建时可能会设置这些环境变量
  // 或者在构建时不会设置数据库连接字符串
  return (
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.NEXT_PHASE === 'phase-development-build' ||
    // 如果没有任何环境变量，可能是构建时的静态分析
    (!process.env.DATABASE_URL && !process.env.POSTGRES_URL && !process.env.VERCEL)
  );
}

function getConnectionString(): string {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  
  if (!connectionString) {
    // 在构建时返回一个虚拟连接字符串，避免抛出错误
    if (isBuildTime()) {
      return 'postgresql://placeholder:placeholder@placeholder:5432/placeholder';
    }
    throw new Error(
      "❌ 数据库连接字符串未配置！请在 .env.local 中设置 DATABASE_URL 或 POSTGRES_URL"
    );
  }
  
  return connectionString;
}

function createDbInstance(): Kysely<Database> {
  // 只在运行时检查连接字符串
  const connectionString = getConnectionString();

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
  } = {
    connectionString,
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
    try {
      // 在开发环境中，我们可以设置 NODE_TLS_REJECT_UNAUTHORIZED 作为后备
      if (!process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
        console.log('[DB Config] ⚠️  Set NODE_TLS_REJECT_UNAUTHORIZED=0 for Supabase SSL');
      }
    } catch (e) {
      // 忽略错误
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
    // 在构建时返回占位符对象，不检查环境变量
    if (isBuildTime()) {
      const placeholder = createPlaceholderDb();
      const value = placeholder[prop as keyof Kysely<Database>];
      if (typeof value === 'function') {
        return value.bind(placeholder);
      }
      return value;
    }
    
    // 运行时才真正创建数据库连接
    if (!dbInstance) {
      dbInstance = createDbInstance();
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
