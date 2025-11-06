#!/usr/bin/env tsx
/**
 * 测试特定的 Pooler 连接字符串
 * 
 * 使用方法：
 * NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/test-specific-pooler.ts
 */

import { Pool } from "pg";

const connectionString = process.argv[2] || 
  "postgresql://postgres.cgpmpfnjzlzbquakmmrj:zKV0rtIV1QOByu89@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require";

async function testConnection() {
  console.log("=".repeat(80));
  console.log("🧪 测试 Pooler 连接字符串");
  console.log("=".repeat(80));
  console.log();
  
  // 解析连接字符串
  try {
    const url = new URL(connectionString);
    console.log("📋 连接字符串分析:");
    console.log(`   Username: ${url.username}`);
    console.log(`   Hostname: ${url.hostname}`);
    console.log(`   Port: ${url.port || 'default'}`);
    console.log(`   Database: ${url.pathname.substring(1)}`);
    console.log(`   Search params: ${url.search}`);
    console.log();
    
    // 检查用户名格式
    const expectedUsername = "postgres.cgpmpfnjzlzbquakmmrj";
    if (url.username === expectedUsername) {
      console.log(`   ✅ 用户名格式正确: ${url.username}`);
    } else {
      console.log(`   ❌ 用户名格式错误:`);
      console.log(`      当前: ${url.username}`);
      console.log(`      预期: ${expectedUsername}`);
    }
    console.log();
  } catch (err) {
    console.error(`❌ 连接字符串格式错误: ${err}`);
    process.exit(1);
  }
  
  // 创建连接池
  console.log("🔌 创建连接池...");
  const pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
  });
  
  try {
    console.log("   ✅ 连接池创建成功");
    console.log();
    
    console.log("🔌 正在连接数据库...");
    const startTime = Date.now();
    const client = await pool.connect();
    const connectTime = Date.now() - startTime;
    console.log(`   ✅ 连接成功! (耗时: ${connectTime}ms)`);
    console.log();
    
    // 测试 1: 简单查询
    console.log("📊 测试 1: 简单查询 (SELECT 1)...");
    const test1Start = Date.now();
    const test1Result = await client.query("SELECT 1 as test");
    const test1Time = Date.now() - test1Start;
    console.log(`   ✅ 查询成功: ${test1Result.rows[0].test} (耗时: ${test1Time}ms)`);
    console.log();
    
    // 测试 2: 检查 ai_logs 表
    console.log("📊 测试 2: 检查 ai_logs 表...");
    const test2Start = Date.now();
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'ai_logs'
      ) as exists;
    `);
    const test2Time = Date.now() - test2Start;
    const tableExists = tableCheck.rows[0].exists;
    console.log(`   ✅ 查询成功: ai_logs 表 ${tableExists ? '存在' : '不存在'} (耗时: ${test2Time}ms)`);
    console.log();
    
    if (tableExists) {
      // 测试 3: 查询记录数
      console.log("📊 测试 3: 查询 ai_logs 记录数...");
      const test3Start = Date.now();
      const countResult = await client.query("SELECT COUNT(*) as count FROM ai_logs");
      const test3Time = Date.now() - test3Start;
      const count = parseInt(countResult.rows[0].count);
      console.log(`   ✅ 查询成功: ai_logs 表中有 ${count} 条记录 (耗时: ${test3Time}ms)`);
      console.log();
      
      // 测试 4: 查询前 3 条记录
      if (count > 0) {
        console.log("📊 测试 4: 查询前 3 条记录...");
        const test4Start = Date.now();
        const sampleResult = await client.query(`
          SELECT id, user_id, question, created_at 
          FROM ai_logs 
          ORDER BY created_at DESC 
          LIMIT 3
        `);
        const test4Time = Date.now() - test4Start;
        console.log(`   ✅ 查询成功: 获取到 ${sampleResult.rows.length} 条记录 (耗时: ${test4Time}ms)`);
        sampleResult.rows.forEach((row: any, index: number) => {
          console.log(`      [${index + 1}] ID: ${row.id}, Question: ${row.question.substring(0, 50)}...`);
        });
        console.log();
      }
    }
    
    client.release();
    await pool.end();
    
    console.log("=".repeat(80));
    console.log("✅ 所有测试通过！Pooler 连接正常工作！");
    console.log("=".repeat(80));
    
  } catch (error) {
    console.error();
    console.error("=".repeat(80));
    console.error("❌ 连接失败");
    console.error("=".repeat(80));
    console.error();
    
    if (error instanceof Error) {
      console.error(`错误类型: ${error.constructor.name}`);
      console.error(`错误消息: ${error.message}`);
      console.error();
      
      if (error.message.includes("Tenant or user not found")) {
        console.error("🔍 诊断: 认证失败 - 'Tenant or user not found'");
        console.error();
        console.error("可能原因:");
        console.error("1. ❌ 用户名格式错误");
        console.error("   - Pooler 用户名必须是: postgres.PROJECT_ID");
        console.error("   - 当前用户名:", new URL(connectionString).username);
        console.error("   - 预期用户名: postgres.cgpmpfnjzlzbquakmmrj");
        console.error();
        console.error("2. ❌ 密码不正确");
        console.error("   - 请检查密码是否正确");
        console.error();
        console.error("3. ❌ 项目 ID 不匹配");
        console.error("   - 请确认项目 ID 是否正确: cgpmpfnjzlzbquakmmrj");
        console.error();
        console.error("4. ❌ Pooler URL 区域不正确");
        console.error("   - 当前 Pooler URL: aws-1-ap-southeast-1.pooler.supabase.com");
        console.error("   - 请从 Supabase Dashboard 获取正确的 Pooler URL");
        console.error();
        console.error("解决方案:");
        console.error("1. 登录 Supabase Dashboard: https://app.supabase.com");
        console.error("2. 进入项目: cgpmpfnjzlzbquakmmrj");
        console.error("3. Settings → Database → Connection Pooling");
        console.error("4. 复制完整的 Pooler 连接字符串（不要手动构造）");
      } else if (error.message.includes("ENOTFOUND") || error.message.includes("getaddrinfo")) {
        console.error("🔍 诊断: DNS 解析失败");
        console.error();
        console.error("可能原因:");
        console.error("1. 主机名不正确");
        console.error("2. 网络连接问题");
        console.error("3. Pooler URL 区域不正确");
      } else if (error.message.includes("timeout") || error.message.includes("timed out")) {
        console.error("🔍 诊断: 连接超时");
        console.error();
        console.error("可能原因:");
        console.error("1. 数据库服务器响应慢");
        console.error("2. 网络延迟过高");
        console.error("3. 防火墙阻止连接");
      } else if (error.message.includes("connection") && error.message.includes("refused")) {
        console.error("🔍 诊断: 连接被拒绝");
        console.error();
        console.error("可能原因:");
        console.error("1. 数据库端口未开放");
        console.error("2. 数据库服务器未运行");
      }
      
      if (error.stack) {
        console.error();
        console.error("堆栈跟踪:");
        console.error(error.stack.split("\n").slice(0, 10).join("\n"));
      }
    } else {
      console.error(`错误: ${String(error)}`);
    }
    
    await pool.end();
    process.exit(1);
  }
}

testConnection().catch((error) => {
  console.error("❌ 测试脚本执行失败:", error);
  process.exit(1);
});

