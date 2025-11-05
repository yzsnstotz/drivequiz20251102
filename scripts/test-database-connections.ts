#!/usr/bin/env tsx
/**
 * 数据库连接测试脚本
 * 
 * 功能：
 * 1. 测试 DriveQuiz 主应用数据库连接（DIRECT 方式）
 * 2. 测试 AI Service 数据库连接（DIRECT 方式）
 * 3. 验证所有表是否存在
 * 4. 生成测试报告
 */

import { Pool } from "pg";
import * as dotenv from "dotenv";

// 加载环境变量
dotenv.config();

// 数据库配置
const DRIVEQUIZ_DB_ID = "vdtnzjvmvrcdplawwiae";
const DRIVEQUIZ_DB_PASSWORD = "tcaZ6b577mojAkYw";
const AI_SERVICE_DB_ID = "cgpmpfnjzlzbquakmmrj";
const AI_SERVICE_DB_PASSWORD = "zKV0rtIV1QOByu89";

// DIRECT 连接字符串格式：postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres?sslmode=require
const DRIVEQUIZ_DB_URL = `postgresql://postgres:${DRIVEQUIZ_DB_PASSWORD}@db.${DRIVEQUIZ_DB_ID}.supabase.co:5432/postgres?sslmode=require`;
const AI_SERVICE_DB_URL = `postgresql://postgres:${AI_SERVICE_DB_PASSWORD}@db.${AI_SERVICE_DB_ID}.supabase.co:5432/postgres?sslmode=require`;

// DriveQuiz 主应用数据库表
const DRIVEQUIZ_TABLES = [
  "activations",
  "activation_codes",
  "admins",
  "operation_logs",
  "merchant_categories",
  "merchants",
  "videos",
  "contact_info",
  "terms_of_service",
];

// AI Service 数据库表
const AI_SERVICE_TABLES = [
  "ai_logs",
  "ai_filters",
  "ai_filters_history",
  "ai_rag_docs",
  "ai_daily_summary",
  "ai_vectors",
  "ai_config",
];

interface TestResult {
  success: boolean;
  message: string;
  details?: any;
}

async function testConnection(
  name: string,
  connectionString: string,
  tables: string[]
): Promise<TestResult> {
  const pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    // 设置环境变量以绕过 SSL 证书验证（Supabase 常见问题）
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    
    // 测试连接
    const client = await pool.connect();
    console.log(`✅ [${name}] 连接成功`);

    // 测试查询
    const result = await client.query("SELECT NOW() as current_time");
    console.log(`   - 当前时间: ${result.rows[0].current_time}`);

    // 检查表是否存在
    const tableCheckResults: Record<string, boolean> = {};
    for (const table of tables) {
      const tableResult = await client.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )`,
        [table]
      );
      const exists = tableResult.rows[0].exists;
      tableCheckResults[table] = exists;
      if (exists) {
        // 获取表行数
        const countResult = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`   ✅ 表 ${table} 存在 (${countResult.rows[0].count} 行)`);
      } else {
        console.log(`   ❌ 表 ${table} 不存在`);
      }
    }

    client.release();
    await pool.end();

    return {
      success: true,
      message: `连接成功，检查了 ${tables.length} 个表`,
      details: {
        tables: tableCheckResults,
      },
    };
  } catch (error) {
    await pool.end();
    return {
      success: false,
      message: `连接失败: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function main() {
  console.log("=".repeat(80));
  console.log("数据库连接测试");
  console.log("=".repeat(80));
  console.log();

  // 测试 DriveQuiz 主应用数据库
  console.log("📊 测试 DriveQuiz 主应用数据库");
  console.log(`连接字符串: ${DRIVEQUIZ_DB_URL.replace(/:[^:@]+@/, ":****@")}`);
  console.log();
  const drivequizResult = await testConnection(
    "DriveQuiz 主应用数据库",
    DRIVEQUIZ_DB_URL,
    DRIVEQUIZ_TABLES
  );
  console.log();

  // 测试 AI Service 数据库
  console.log("🤖 测试 AI Service 数据库");
  console.log(`连接字符串: ${AI_SERVICE_DB_URL.replace(/:[^:@]+@/, ":****@")}`);
  console.log();
  const aiServiceResult = await testConnection(
    "AI Service 数据库",
    AI_SERVICE_DB_URL,
    AI_SERVICE_TABLES
  );
  console.log();

  // 生成报告
  console.log("=".repeat(80));
  console.log("测试报告");
  console.log("=".repeat(80));
  console.log();

  console.log("DriveQuiz 主应用数据库:");
  console.log(`  ${drivequizResult.success ? "✅" : "❌"} ${drivequizResult.message}`);
  if (drivequizResult.details) {
    const missingTables = Object.entries(drivequizResult.details.tables)
      .filter(([_, exists]) => !exists)
      .map(([table]) => table);
    if (missingTables.length > 0) {
      console.log(`  ⚠️  缺失的表: ${missingTables.join(", ")}`);
    }
  }
  console.log();

  console.log("AI Service 数据库:");
  console.log(`  ${aiServiceResult.success ? "✅" : "❌"} ${aiServiceResult.message}`);
  if (aiServiceResult.details) {
    const missingTables = Object.entries(aiServiceResult.details.tables)
      .filter(([_, exists]) => !exists)
      .map(([table]) => table);
    if (missingTables.length > 0) {
      console.log(`  ⚠️  缺失的表: ${missingTables.join(", ")}`);
    }
  }
  console.log();

  // DIRECT 连接字符串
  console.log("=".repeat(80));
  console.log("DIRECT 连接字符串（用于环境变量）");
  console.log("=".repeat(80));
  console.log();
  console.log("DriveQuiz 主应用数据库 (DATABASE_URL):");
  console.log(DRIVEQUIZ_DB_URL);
  console.log();
  console.log("AI Service 数据库 (AI_DATABASE_URL):");
  console.log(AI_SERVICE_DB_URL);
  console.log();

  // 总结
  const allSuccess = drivequizResult.success && aiServiceResult.success;
  if (allSuccess) {
    console.log("✅ 所有数据库连接测试通过！");
    process.exit(0);
  } else {
    console.log("❌ 部分数据库连接测试失败，请检查上述错误信息。");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("❌ 测试过程中发生错误:", error);
  process.exit(1);
});

