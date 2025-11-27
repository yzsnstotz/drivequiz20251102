// ============================================================
// 文件路径: src/lib/pgSslDefaults.ts
// 功能: 统一的 pg SSL 默认配置模块
// 更新日期: 2025-11-27
// 更新内容: 初始化 pg.defaults.ssl，统一为所有使用 pg 的客户端设置 SSL 策略
// ============================================================

import type { PoolConfig } from "pg";
import pg from "pg";

/**
 * 只初始化一次的标记，避免重复日志和重复配置
 */
let sslPatched = false;

/**
 * 根据 connectionString 判断是否为需要 SSL 的托管库（如 Supabase）
 */
function shouldUseSsl(connectionString: string): boolean {
  if (!connectionString) return false;
  const lower = connectionString.toLowerCase();
  return (
    lower.includes("supabase.co") ||
    lower.includes("supabase.com") ||
    lower.includes("sslmode=require") ||
    lower.includes("aws-1-ap-southeast-1.pooler.supabase.com")
  );
}

/**
 * 初始化 pg.defaults.ssl，统一为所有使用 pg 的客户端设置 SSL 策略。
 *
 * 安全级别：
 * 1. 如有 DB_CA_CERT -> 使用 CA 证书，严格验证
 * 2. 否则，在需要 SSL 的场景下使用 { rejectUnauthorized: false }
 *    仅影响 DB 连接，不修改 NODE_TLS_REJECT_UNAUTHORIZED
 */
export function initPgSslDefaults(connectionString: string): void {
  if (sslPatched) {
    return;
  }

  const isProd = process.env.NODE_ENV === "production";
  const needSsl = isProd || shouldUseSsl(connectionString);

  if (!needSsl) {
    // 本地非 Supabase 直连场景，不强制 SSL
    console.log("[DB][SSL] Using plain connection (no SSL defaults).");
    sslPatched = true;
    return;
  }

  let sslConfig: PoolConfig["ssl"] = undefined;
  const ca = process.env.DB_CA_CERT;

  if (ca && ca.trim().length > 0) {
    sslConfig = { ca } as any;
  } else {
    sslConfig = { rejectUnauthorized: false } as any;
  }

  // 统一设置 pg 默认 SSL
  pg.defaults.ssl = sslConfig;

  console.log("[DB][SSL] pg.defaults.ssl initialized:", {
    enabled: !!sslConfig,
    mode: ca ? "ca-cert" : "rejectUnauthorized-false",
  });

  sslPatched = true;
}

