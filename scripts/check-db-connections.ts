#!/usr/bin/env tsx
/**
 * 数据库连接检查脚本
 * 检查主数据库和 AI 数据库的连接状态和配置
 */

import { Pool } from "pg";
import * as dotenv from "dotenv";

// 加载环境变量
dotenv.config();

// 颜色输出
const green = (text: string) => `\x1b[32m${text}\x1b[0m`;
const red = (text: string) => `\x1b[31m${text}\x1b[0m`;
const yellow = (text: string) => `\x1b[33m${text}\x1b[0m`;
const blue = (text: string) => `\x1b[34m${text}\x1b[0m`;
const cyan = (text: string) => `\x1b[36m${text}\x1b[0m`;

interface ConnectionTestResult {
  name: string;
  success: boolean;
  message: string;
  details?: {
    connectionString?: string;
    serverVersion?: string;
    currentTime?: string;
    tables?: string[];
    error?: string;
    connectionType?: "direct" | "pooler" | "unknown";
  };
}

function analyzeConnectionString(connectionString: string): {
  type: "direct" | "pooler" | "unknown";
  host: string;
  port: number;
  user: string;
  hasSSL: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  let type: "direct" | "pooler" | "unknown" = "unknown";
  let host = "";
  let port = 0;
  let user = "";
  let hasSSL = false;

  try {
    const url = new URL(connectionString);
    host = url.hostname;
    port = parseInt(url.port) || 5432;
    user = url.username;
    hasSSL = url.searchParams.get("sslmode") === "require" || url.searchParams.has("sslmode");

    // 判断连接类型
    if (host.includes("pooler") || port === 6543) {
      type = "pooler";
      if (!url.searchParams.has("pgbouncer")) {
        issues.push("Pooler 连接缺少 pgbouncer=true 参数");
      }
    } else if (host.includes("db.") && host.includes(".supabase.co") && port === 5432) {
      type = "direct";
    }

    // 检查协议
    if (url.protocol === "postgres:") {
      issues.push("建议使用 postgresql:// 而不是 postgres://");
    }

    // 检查 Pooler 用户名格式
    if (type === "pooler" && !user.includes(".")) {
      issues.push("Pooler 连接的用户名应该是 postgres.PROJECT_ID 格式");
    }
  } catch (error) {
    issues.push(`连接字符串解析失败: ${error instanceof Error ? error.message : String(error)}`);
  }

  return { type, host, port, user, hasSSL, issues };
}

async function testConnection(
  name: string,
  connectionString: string | undefined,
  expectedTables?: string[]
): Promise<ConnectionTestResult> {
  if (!connectionString) {
    return {
      name,
      success: false,
      message: "环境变量未配置",
      details: {
        error: "连接字符串为空",
      },
    };
  }

  // 分析连接字符串
  const analysis = analyzeConnectionString(connectionString);

  // 检测是否需要 SSL
  const isSupabase =
    connectionString.includes("supabase.com") ||
    connectionString.includes("supabase.co") ||
    connectionString.includes("sslmode=require");

  const poolConfig: any = {
    connectionString,
    connectionTimeoutMillis: 10000, // 10秒超时
    max: 5,
    min: 1,
    idleTimeoutMillis: 30000,
  };

  if (isSupabase) {
    poolConfig.ssl = {
      rejectUnauthorized: false,
    };
  }

  const pool = new Pool(poolConfig);

  try {
    console.log(`\n${blue(`[${name}]`)} 正在测试连接...`);
    console.log(`   连接类型: ${cyan(analysis.type)}`);
    console.log(`   主机: ${analysis.host}:${analysis.port}`);
    console.log(`   用户: ${analysis.user}`);
    if (analysis.issues.length > 0) {
      analysis.issues.forEach((issue) => {
        console.log(`   ${yellow("⚠️")} ${issue}`);
      });
    }

    const client = await pool.connect();
    console.log(`   ${green("✅ 连接成功")}`);

    // 测试基本查询
    const timeResult = await client.query("SELECT NOW() as current_time, version() as pg_version");
    const currentTime = timeResult.rows[0].current_time;
    const serverVersion = timeResult.rows[0].pg_version.split(" ")[0] + " " + timeResult.rows[0].pg_version.split(" ")[1];

    console.log(`   ${green("✅ 查询成功")}`);
    console.log(`   - 服务器时间: ${currentTime}`);
    console.log(`   - PostgreSQL 版本: ${serverVersion}`);

    // 检查表
    const tables: string[] = [];
    if (expectedTables && expectedTables.length > 0) {
      console.log(`   ${blue("检查表...")}`);
      for (const table of expectedTables) {
        const tableResult = await client.query(
          `SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          )`,
          [table]
        );
        const exists = tableResult.rows[0].exists;
        if (exists) {
          const countResult = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
          const count = countResult.rows[0].count;
          console.log(`   ${green("✅")} 表 ${table} 存在 (${count} 行)`);
          tables.push(table);
        } else {
          console.log(`   ${yellow("⚠️")} 表 ${table} 不存在`);
        }
      }
    } else {
      // 列出所有表
      const allTablesResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
        LIMIT 20
      `);
      allTablesResult.rows.forEach((row) => {
        tables.push(row.table_name);
      });
      console.log(`   ${blue(`找到 ${tables.length} 个表`)}`);
    }

    client.release();
    await pool.end();

    return {
      name,
      success: true,
      message: "连接成功",
      details: {
        connectionString: connectionString.substring(0, 50) + "...",
        serverVersion,
        currentTime: String(currentTime),
        tables,
        connectionType: analysis.type,
      },
    };
  } catch (error) {
    await pool.end();
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`   ${red("❌ 连接失败")}: ${errorMessage}`);
    
    // 提供修复建议
    if (errorMessage.includes("timeout") || errorMessage.includes("ETIMEDOUT")) {
      console.log(`   ${yellow("💡 建议:")}`);
      if (analysis.type === "pooler") {
        console.log(`      - 尝试使用直接连接 (端口 5432)`);
        console.log(`      - 检查数据库是否已暂停（Supabase 免费版可能暂停）`);
      } else {
        console.log(`      - 检查网络连接`);
        console.log(`      - 检查数据库是否已暂停（Supabase 免费版可能暂停）`);
        console.log(`      - 尝试使用连接池 (端口 6543)`);
      }
    }
    
    return {
      name,
      success: false,
      message: `连接失败: ${errorMessage}`,
      details: {
        connectionString: connectionString.substring(0, 50) + "...",
        error: errorMessage,
        connectionType: analysis.type,
      },
    };
  }
}

async function main() {
  console.log("=".repeat(80));
  console.log(blue("数据库连接检查"));
  console.log("=".repeat(80));

  // 检查环境变量
  const mainDbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  const aiDbUrl = process.env.AI_DATABASE_URL;

  console.log(`\n${cyan("环境变量检查:")}`);
  console.log(`  DATABASE_URL: ${mainDbUrl ? green("✅ 已配置") : red("❌ 未配置")}`);
  console.log(`  AI_DATABASE_URL: ${aiDbUrl ? green("✅ 已配置") : red("❌ 未配置")}`);

  if (!mainDbUrl && !aiDbUrl) {
    console.log(`\n${red("❌ 没有配置任何数据库连接字符串")}`);
    console.log(`\n${yellow("请配置环境变量:")}`);
    console.log(`  1. 创建或编辑 .env 文件`);
    console.log(`  2. 添加以下环境变量:`);
    console.log(`     DATABASE_URL=postgresql://postgres:PASSWORD@db.PROJECT_ID.supabase.co:5432/postgres?sslmode=require`);
    console.log(`     AI_DATABASE_URL=postgresql://postgres:PASSWORD@db.PROJECT_ID.supabase.co:5432/postgres?sslmode=require`);
    process.exit(1);
  }

  // 测试主数据库
  const mainDbResult = await testConnection(
    "主数据库 (DriveQuiz)",
    mainDbUrl,
    ["questions", "admins", "users"] // 主数据库的预期表
  );

  // 测试 AI 数据库
  const aiDbResult = await testConnection(
    "AI 数据库 (AI Service)",
    aiDbUrl,
    ["ai_logs", "ai_config", "ai_scene_config", "ai_provider_daily_stats"] // AI 数据库的预期表
  );

  // 生成报告
  console.log("\n" + "=".repeat(80));
  console.log(blue("检查报告"));
  console.log("=".repeat(80));

  console.log(`\n${mainDbResult.name}:`);
  if (mainDbResult.success) {
    console.log(`  ${green("✅")} ${mainDbResult.message}`);
    if (mainDbResult.details?.serverVersion) {
      console.log(`  - PostgreSQL 版本: ${mainDbResult.details.serverVersion}`);
    }
    if (mainDbResult.details?.connectionType) {
      console.log(`  - 连接类型: ${mainDbResult.details.connectionType}`);
    }
    if (mainDbResult.details?.tables && mainDbResult.details.tables.length > 0) {
      console.log(`  - 找到 ${mainDbResult.details.tables.length} 个表`);
    }
  } else {
    console.log(`  ${red("❌")} ${mainDbResult.message}`);
    if (mainDbResult.details?.error) {
      console.log(`  - 错误: ${mainDbResult.details.error}`);
    }
  }

  console.log(`\n${aiDbResult.name}:`);
  if (aiDbResult.success) {
    console.log(`  ${green("✅")} ${aiDbResult.message}`);
    if (aiDbResult.details?.serverVersion) {
      console.log(`  - PostgreSQL 版本: ${aiDbResult.details.serverVersion}`);
    }
    if (aiDbResult.details?.connectionType) {
      console.log(`  - 连接类型: ${aiDbResult.details.connectionType}`);
    }
    if (aiDbResult.details?.tables && aiDbResult.details.tables.length > 0) {
      console.log(`  - 找到 ${aiDbResult.details.tables.length} 个表`);
    }
  } else {
    console.log(`  ${red("❌")} ${aiDbResult.message}`);
    if (aiDbResult.details?.error) {
      console.log(`  - 错误: ${aiDbResult.details.error}`);
    }
  }

  // 总结
  console.log("\n" + "=".repeat(80));
  const allSuccess = mainDbResult.success && aiDbResult.success;
  if (allSuccess) {
    console.log(green("✅ 所有数据库连接正常"));
  } else {
    console.log(red("❌ 部分数据库连接失败"));
    console.log(`\n${yellow("修复建议:")}`);
    if (!mainDbUrl) {
      console.log(`  1. 配置 DATABASE_URL 环境变量`);
    }
    if (!aiDbUrl) {
      console.log(`  2. 配置 AI_DATABASE_URL 环境变量`);
    }
    if (mainDbUrl && !mainDbResult.success) {
      console.log(`  3. 检查主数据库连接字符串是否正确`);
      console.log(`  4. 检查数据库是否已暂停（Supabase 免费版可能暂停）`);
    }
    if (aiDbUrl && !aiDbResult.success) {
      console.log(`  5. 检查 AI 数据库连接字符串是否正确`);
      console.log(`  6. 检查数据库是否已暂停（Supabase 免费版可能暂停）`);
    }
    process.exit(1);
  }
  console.log("=".repeat(80));
}

main().catch((error) => {
  console.error(red("脚本执行失败:"), error);
  process.exit(1);
});
