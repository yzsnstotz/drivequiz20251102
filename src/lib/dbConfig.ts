/**
 * 统一 DB 配置模块
 * 功能：解析 DATABASE_URL、打印配置日志、构造 Pool 配置
 * 目标：确保 [DB][Config] 日志只打印一次，避免多 bundle 重复打印
 */

import { PoolConfig } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __DRIVEQUIZ_DB_LOGGED__: boolean | undefined;
}

const globalForDb = globalThis as typeof globalThis & {
  __DRIVEQUIZ_DB_LOGGED__?: boolean;
};

/**
 * 获取连接字符串
 */
function getConnectionString(): string {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  
  // 如果没有连接字符串，返回占位符而不是抛出错误
  // 这样可以避免构建时失败，运行时会在 Proxy 中检测到并返回占位符
  if (!connectionString) {
    return 'postgresql://placeholder:placeholder@placeholder:5432/placeholder';
  }
  
  return connectionString;
}

/**
 * 解析连接字符串，提取配置信息
 */
function parseConnectionString(connectionString: string): {
  host: string;
  port: number;
  database: string | undefined;
  user: string | undefined;
  password: string | undefined;
  sslMode: string | null;
  sslEnabled: boolean;
} {
  // 清理可能的前缀（如 "DATABASE_URL=" 或 "POSTGRES_URL="）
  let cleanedConnectionString = connectionString.trim();
  if (cleanedConnectionString.startsWith('DATABASE_URL=')) {
    cleanedConnectionString = cleanedConnectionString.substring('DATABASE_URL='.length);
  } else if (cleanedConnectionString.startsWith('POSTGRES_URL=')) {
    cleanedConnectionString = cleanedConnectionString.substring('POSTGRES_URL='.length);
  }
  
  const url = new URL(cleanedConnectionString);

  const host = url.hostname;
  const port = url.port ? Number(url.port) : 5432;
  const database = url.pathname ? url.pathname.slice(1) : undefined;
  const user = url.username ? decodeURIComponent(url.username) : undefined;
  const password = url.password ? decodeURIComponent(url.password) : undefined;

  const sslMode = url.searchParams.get("sslmode");

  // 对于 Supabase 的托管 Postgres，官方建议是关闭证书严格校验
  // 这里不再玩复杂逻辑，统一用 rejectUnauthorized: false
  const sslEnabled = !!(sslMode && sslMode !== "disable");

  return {
    host,
    port,
    database,
    user,
    password,
    sslMode,
    sslEnabled,
  };
}

/**
 * 从连接字符串构建 Pool 配置
 * ✅ 修复：统一收口 DB 配置逻辑，确保 [DB][Config] 日志只打印一次
 */
export function buildPoolConfigFromConnectionString(): PoolConfig {
  const connectionString = getConnectionString();

  // 验证连接字符串存在
  if (!connectionString || connectionString === 'postgresql://placeholder:placeholder@placeholder:5432/placeholder') {
    throw new Error("[DB][Config] DATABASE_URL is not set or is placeholder");
  }

  // 解析连接字符串
  const parsed = parseConnectionString(connectionString);

  // ✅ 修复：一次性记录所有配置日志（使用 globalThis 标记，确保只打印一次）
  // ✅ 可选增强：默认 dev 环境不打印，只有手动开启 DB_CONFIG_DEBUG=true 时才打印
  const shouldLogDbConfig =
    process.env.NODE_ENV === "development" &&
    process.env.DB_CONFIG_DEBUG === "true";

  if (!globalForDb.__DRIVEQUIZ_DB_LOGGED__ && shouldLogDbConfig) {
    globalForDb.__DRIVEQUIZ_DB_LOGGED__ = true;
    console.log(
      "[DB][Config] Using raw DATABASE_URL (first 80 chars):",
      connectionString.substring(0, 80) + "...",
    );
    console.log("[DB][Config] Parsed DATABASE_URL:", {
      host: parsed.host,
      port: parsed.port,
      database: parsed.database,
      sslMode: parsed.sslMode,
      sslEnabled: parsed.sslEnabled,
    });
  }

  // 构建 Pool 配置
  const ssl =
    parsed.sslMode && parsed.sslMode !== "disable"
      ? { rejectUnauthorized: false }
      : undefined;

  const config: PoolConfig = {
    host: parsed.host,
    port: parsed.port,
    database: parsed.database,
    user: parsed.user,
    password: parsed.password,
    ssl,
    max: 20,
    min: 2, // 保持最小连接数，减少连接创建开销
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 20_000, // 减少连接超时时间，更快失败重试
    statement_timeout: 60_000,
    query_timeout: 60_000,
    // 添加连接重试配置
    allowExitOnIdle: true,
  };

  return config;
}

