#!/usr/bin/env tsx
/**
 * 测试 AI 数据库连接脚本
 * 
 * 用途：验证 AI_DATABASE_URL 是否正确配置并连接到 AI Service 数据库
 * 
 * 使用方法：
 * NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/test-ai-database-connection.ts
 */

import { Pool } from "pg";
import * as dotenv from "dotenv";

// 加载环境变量
dotenv.config({ path: ".env.local" });
dotenv.config();

const AI_DATABASE_URL = process.env.AI_DATABASE_URL;

async function testAiDatabaseConnection(): Promise<void> {
  console.log("=".repeat(60));
  console.log("🔍 测试 AI Service 数据库连接");
  console.log("=".repeat(60));
  console.log();

  if (!AI_DATABASE_URL) {
    console.error("❌ 错误: AI_DATABASE_URL 环境变量未设置");
    console.error();
    console.error("请确保在 .env.local 或环境变量中设置:");
    console.error("AI_DATABASE_URL=postgresql://postgres:zKV0rtIV1QOByu89@db.cgpmpfnjzlzbquakmmrj.supabase.co:5432/postgres?sslmode=require");
    process.exit(1);
  }

  // 检查连接字符串格式
  const expectedDbId = "cgpmpfnjzlzbquakmmrj";
  const expectedPassword = "zKV0rtIV1QOByu89";
  const hasCorrectDbId = AI_DATABASE_URL.includes(expectedDbId);
  const hasCorrectPassword = AI_DATABASE_URL.includes(expectedPassword);

  console.log("📋 连接信息:");
  console.log(`   数据库 ID: ${hasCorrectDbId ? "✅" : "❌"} ${expectedDbId}`);
  console.log(`   密码: ${hasCorrectPassword ? "✅" : "❌"} (已隐藏)`);
  console.log(`   连接字符串: ${AI_DATABASE_URL.substring(0, 50)}...`);
  console.log();

  if (!hasCorrectDbId) {
    console.error("⚠️  警告: 连接字符串中的数据库 ID 不匹配预期的 AI Service 数据库");
    console.error(`   预期: ${expectedDbId}`);
    console.error();
  }

  // 创建连接池
  const pool = new Pool({
    connectionString: AI_DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    console.log("🔌 正在连接数据库...");
    const client = await pool.connect();
    console.log("✅ 数据库连接成功!");
    console.log();

    // 测试查询
    console.log("📊 检查数据库表...");
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'ai_%'
      ORDER BY table_name;
    `);
    
    const tables = tablesResult.rows.map((row) => row.table_name);
    console.log(`   ✅ 找到 ${tables.length} 个 AI 相关表:`);
    tables.forEach((table) => {
      console.log(`      - ${table}`);
    });
    console.log();

    // 检查 ai_config 表是否存在
    const hasAiConfig = tables.includes("ai_config");
    if (hasAiConfig) {
      console.log("✅ ai_config 表存在");
      
      // 检查表结构
      const columnsResult = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'ai_config'
        ORDER BY ordinal_position;
      `);
      
      console.log(`   📋 表结构 (${columnsResult.rows.length} 列):`);
      columnsResult.rows.forEach((col) => {
        console.log(`      - ${col.column_name} (${col.data_type})`);
      });
      
      // 检查配置数据
      const configResult = await client.query(`
        SELECT key, value, description 
        FROM ai_config 
        ORDER BY key;
      `);
      
      console.log(`   📊 配置数据 (${configResult.rows.length} 条):`);
      configResult.rows.forEach((row) => {
        console.log(`      - ${row.key}: ${row.value}${row.description ? ` (${row.description})` : ""}`);
      });
      console.log();
    } else {
      console.error("❌ ai_config 表不存在!");
      console.error();
      console.error("请执行迁移脚本创建表:");
      console.error("   src/migrations/20251108_create_ai_config.sql");
      console.error();
      console.error("在 Supabase SQL Editor 中执行该脚本");
      console.error();
    }

    // 检查其他 AI 表
    const requiredTables = ["ai_logs", "ai_filters", "ai_rag_docs", "ai_daily_summary"];
    const missingTables = requiredTables.filter((table) => !tables.includes(table));
    
    if (missingTables.length > 0) {
      console.warn("⚠️  以下表不存在:");
      missingTables.forEach((table) => {
        console.warn(`   - ${table}`);
      });
      console.log();
    } else {
      console.log("✅ 所有必需的 AI 表都存在");
      console.log();
    }

    client.release();
    console.log("=".repeat(60));
    console.log("✅ 数据库连接测试完成!");
    console.log("=".repeat(60));
  } catch (error) {
    console.error("❌ 数据库连接失败:");
    if (error instanceof Error) {
      console.error(`   错误: ${error.message}`);
      if (error.stack) {
        console.error(`   堆栈: ${error.stack.split("\n").slice(0, 3).join("\n")}`);
      }
    } else {
      console.error(`   错误: ${String(error)}`);
    }
    console.error();
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// 运行测试
testAiDatabaseConnection().catch((error) => {
  console.error("❌ 测试脚本执行失败:");
  console.error(error);
  process.exit(1);
});

