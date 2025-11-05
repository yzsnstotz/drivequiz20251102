#!/usr/bin/env tsx
/**
 * 测试 AI 数据库连接脚本（Vercel 生产环境验证）
 * 
 * 用途：验证 AI_DATABASE_URL 是否正确配置并连接到 AI Service 数据库
 * 特别测试：ai_logs 表的查询功能
 * 
 * 使用方法：
 * npx tsx scripts/test-ai-db-connection-vercel.ts
 */

import { Pool } from "pg";
import { Kysely, PostgresDialect } from "kysely";

// 用户提供的连接字符串
const AI_DATABASE_URL = process.env.AI_DATABASE_URL || 
  "postgresql://postgres:zKV0rtIV1QOByu89@db.cgpmpfnjzlzbquakmmrj.supabase.co:5432/postgres?sslmode=require";

interface AiLogsTable {
  id: number;
  user_id: string | null;
  question: string;
  answer: string | null;
  locale: string | null;
  model: string | null;
  rag_hits: number | null;
  cost_est: number | null;
  safety_flag: string;
  sources?: any;
  created_at: Date;
}

interface AiDatabase {
  ai_logs: AiLogsTable;
}

async function testAiDatabaseConnection(): Promise<void> {
  console.log("=".repeat(80));
  console.log("🔍 测试 AI Service 数据库连接（Vercel 生产环境验证）");
  console.log("=".repeat(80));
  console.log();

  // 步骤 1: 检查环境变量
  console.log("[Step 1] 📋 检查环境变量...");
  console.log(`   AI_DATABASE_URL exists: ${!!process.env.AI_DATABASE_URL}`);
  console.log(`   Using connection string: ${AI_DATABASE_URL.substring(0, 60)}...`);
  console.log();

  // 步骤 2: 验证连接字符串格式
  console.log("[Step 2] ✅ 验证连接字符串格式...");
  const expectedDbId = "cgpmpfnjzlzbquakmmrj";
  const expectedPassword = "zKV0rtIV1QOByu89";
  const hasCorrectDbId = AI_DATABASE_URL.includes(expectedDbId);
  const hasCorrectPassword = AI_DATABASE_URL.includes(expectedPassword);
  const hasCorrectPort = AI_DATABASE_URL.includes(":5432");
  const hasSSL = AI_DATABASE_URL.includes("sslmode=require");

  console.log(`   ✅ 数据库 ID: ${hasCorrectDbId ? "✅" : "❌"} ${expectedDbId}`);
  console.log(`   ✅ 密码: ${hasCorrectPassword ? "✅" : "❌"} (已隐藏)`);
  console.log(`   ✅ 端口: ${hasCorrectPort ? "✅" : "❌"} 5432 (DIRECT)`);
  console.log(`   ✅ SSL: ${hasSSL ? "✅" : "❌"} sslmode=require`);
  console.log();

  if (!hasCorrectDbId || !hasCorrectPassword || !hasCorrectPort || !hasSSL) {
    console.error("❌ 连接字符串格式验证失败！");
    console.error("   预期格式: postgresql://postgres:zKV0rtIV1QOByu89@db.cgpmpfnjzlzbquakmmrj.supabase.co:5432/postgres?sslmode=require");
    process.exit(1);
  }

  // 步骤 3: 创建 Pool 连接
  console.log("[Step 3] 🔌 创建数据库连接池...");
  const poolConfig = {
    connectionString: AI_DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  };

  console.log("   Pool 配置:");
  console.log(`   - SSL enabled: ${!!poolConfig.ssl}`);
  console.log(`   - SSL rejectUnauthorized: ${poolConfig.ssl.rejectUnauthorized}`);
  console.log();

  const pool = new Pool(poolConfig);

  try {
    // 步骤 4: 测试基础连接
    console.log("[Step 4] 🔌 测试基础连接...");
    const client = await pool.connect();
    console.log("   ✅ 数据库连接成功!");
    console.log();

    // 步骤 5: 检查 ai_logs 表是否存在
    console.log("[Step 5] 📊 检查 ai_logs 表...");
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'ai_logs'
      );
    `);
    
    const tableExists = tableCheck.rows[0].exists;
    console.log(`   ai_logs 表存在: ${tableExists ? "✅" : "❌"}`);
    console.log();

    if (!tableExists) {
      console.error("❌ ai_logs 表不存在！");
      client.release();
      await pool.end();
      process.exit(1);
    }

    // 步骤 6: 检查 ai_logs 表结构
    console.log("[Step 6] 📋 检查 ai_logs 表结构...");
    const columnsResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'ai_logs'
      ORDER BY ordinal_position;
    `);
    
    console.log(`   ✅ 找到 ${columnsResult.rows.length} 列:`);
    const requiredColumns = ['id', 'user_id', 'question', 'answer', 'locale', 'model', 'rag_hits', 'safety_flag', 'cost_est', 'created_at'];
    const existingColumns = columnsResult.rows.map((row: any) => row.column_name);
    
    requiredColumns.forEach((col) => {
      const exists = existingColumns.includes(col);
      console.log(`      ${exists ? "✅" : "❌"} ${col}`);
    });
    
    // 检查 sources 列是否存在
    const hasSources = existingColumns.includes('sources');
    console.log(`      ${hasSources ? "✅" : "⚠️"} sources (可选)`);
    console.log();

    // 步骤 7: 测试查询（使用原生 SQL）
    console.log("[Step 7] 🔍 测试原生 SQL 查询...");
    try {
      const countResult = await client.query(`
        SELECT COUNT(*) as count FROM ai_logs;
      `);
      const count = parseInt(countResult.rows[0].count);
      console.log(`   ✅ 查询成功: ai_logs 表中有 ${count} 条记录`);
      console.log();

      if (count > 0) {
        console.log("   📊 查询前 5 条记录...");
        const sampleResult = await client.query(`
          SELECT id, user_id, question, answer, locale, model, rag_hits, safety_flag, cost_est, created_at
          FROM ai_logs 
          ORDER BY created_at DESC 
          LIMIT 5;
        `);
        
        console.log(`   ✅ 成功查询 ${sampleResult.rows.length} 条记录`);
        sampleResult.rows.forEach((row: any, index: number) => {
          console.log(`      [${index + 1}] ID: ${row.id}, Question: ${row.question.substring(0, 50)}...`);
        });
        console.log();
      }
    } catch (err) {
      console.error("   ❌ 原生 SQL 查询失败:", err instanceof Error ? err.message : String(err));
      throw err;
    }

    // 步骤 8: 测试 Kysely 查询（模拟实际 API 路由）
    console.log("[Step 8] 🔍 测试 Kysely 查询（模拟 API 路由）...");
    try {
      const dialect = new PostgresDialect({ pool });
      const db = new Kysely<AiDatabase>({ dialect });

      // 测试 count 查询
      console.log("   测试 count 查询...");
      const countQuery = db
        .selectFrom("ai_logs")
        .select((eb) => eb.fn.countAll<number>().as("cnt"));
      
      const totalRow = await countQuery.executeTakeFirst();
      const total = Number(totalRow?.cnt ?? 0);
      console.log(`   ✅ Kysely count 查询成功: ${total} 条记录`);
      console.log();

      // 测试 select 查询
      console.log("   测试 select 查询...");
      const selectQuery = db
        .selectFrom("ai_logs")
        .select([
          "id",
          "user_id",
          "question",
          "answer",
          "locale",
          "model",
          "rag_hits",
          "safety_flag",
          "cost_est",
          "created_at",
        ])
        .orderBy("created_at", "desc")
        .limit(5);
      
      const rows = await selectQuery.execute();
      console.log(`   ✅ Kysely select 查询成功: ${rows.length} 条记录`);
      if (rows.length > 0) {
        rows.forEach((row, index) => {
          console.log(`      [${index + 1}] ID: ${row.id}, Question: ${row.question.substring(0, 50)}...`);
        });
      }
      console.log();

      // 清理
      await db.destroy();
    } catch (err) {
      console.error("   ❌ Kysely 查询失败:", err instanceof Error ? err.message : String(err));
      if (err instanceof Error && err.stack) {
        console.error("   堆栈:", err.stack.split("\n").slice(0, 5).join("\n"));
      }
      throw err;
    }

    client.release();
    console.log("=".repeat(80));
    console.log("✅ 所有测试通过！数据库连接和查询功能正常！");
    console.log("=".repeat(80));
  } catch (error) {
    console.error();
    console.error("=".repeat(80));
    console.error("❌ 数据库连接测试失败");
    console.error("=".repeat(80));
    console.error();
    
    if (error instanceof Error) {
      console.error("错误类型:", error.constructor.name);
      console.error("错误消息:", error.message);
      
      if (error.message.includes("ENOTFOUND") || error.message.includes("getaddrinfo")) {
        console.error();
        console.error("🔍 诊断: DNS 解析错误");
        console.error("   可能原因:");
        console.error("   1. 数据库主机名无法解析");
        console.error("   2. 数据库可能已暂停（Supabase 免费版在闲置时会暂停）");
        console.error("   3. 网络连接问题");
        console.error();
        console.error("   解决方案:");
        console.error("   1. 检查 Supabase Dashboard 确认数据库是否活跃");
        console.error("   2. 检查网络连接");
        console.error("   3. 尝试使用连接池（端口 6543）而不是直接连接（端口 5432）");
      } else if (error.message.includes("timeout") || error.message.includes("timed out")) {
        console.error();
        console.error("🔍 诊断: 连接超时");
        console.error("   可能原因:");
        console.error("   1. 数据库服务器响应慢");
        console.error("   2. 网络延迟过高");
        console.error("   3. 防火墙阻止连接");
      } else if (error.message.includes("connection") && error.message.includes("refused")) {
        console.error();
        console.error("🔍 诊断: 连接被拒绝");
        console.error("   可能原因:");
        console.error("   1. 数据库端口未开放");
        console.error("   2. 数据库服务器未运行");
        console.error("   3. IP 地址被防火墙阻止");
      } else if (error.message.includes("authentication") || error.message.includes("password")) {
        console.error();
        console.error("🔍 诊断: 认证失败");
        console.error("   可能原因:");
        console.error("   1. 用户名或密码错误");
        console.error("   2. 数据库用户权限不足");
      }
      
      if (error.stack) {
        console.error();
        console.error("堆栈跟踪:");
        console.error(error.stack.split("\n").slice(0, 10).join("\n"));
      }
    } else {
      console.error("错误:", String(error));
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

