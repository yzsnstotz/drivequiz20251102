#!/usr/bin/env tsx
/**
 * 测试 Supabase Pooler 连接字符串
 * 
 * 用途：验证 Pooler 连接字符串的格式和认证
 * 
 * 使用方法：
 * npx tsx scripts/test-pooler-connection.ts
 */

import { Pool } from "pg";

// 测试不同的连接字符串配置
const testConfigs = [
  {
    name: "Pooler (新加坡) - 当前配置",
    connectionString: "postgresql://postgres.cgpmpfnjzlzbquakmmrj:zKV0rtIV1QOByu89@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require",
  },
  {
    name: "Pooler (新加坡) - 无 pgbouncer 参数",
    connectionString: "postgresql://postgres.cgpmpfnjzlzbquakmmrj:zKV0rtIV1QOByu89@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require",
  },
  {
    name: "Direct Connection (备用)",
    connectionString: "postgresql://postgres:zKV0rtIV1QOByu89@db.cgpmpfnjzlzbquakmmrj.supabase.co:5432/postgres?sslmode=require",
  },
];

async function testConnection(name: string, connectionString: string): Promise<boolean> {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`测试: ${name}`);
  console.log("=".repeat(80));
  
  // 解析连接字符串
  try {
    const url = new URL(connectionString);
    console.log(`   Username: ${url.username}`);
    console.log(`   Hostname: ${url.hostname}`);
    console.log(`   Port: ${url.port || 'default'}`);
    console.log(`   Database: ${url.pathname.substring(1)}`);
    console.log(`   Search params: ${url.search}`);
  } catch (err) {
    console.error(`   ❌ 连接字符串格式错误: ${err}`);
    return false;
  }
  
  const pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
  });
  
  try {
    console.log(`   🔌 正在连接...`);
    const client = await pool.connect();
    console.log(`   ✅ 连接成功!`);
    
    // 测试查询
    const result = await client.query("SELECT COUNT(*) as count FROM ai_logs");
    const count = parseInt(result.rows[0].count);
    console.log(`   ✅ 查询成功: ai_logs 表中有 ${count} 条记录`);
    
    client.release();
    await pool.end();
    
    return true;
  } catch (error) {
    console.error(`   ❌ 连接失败:`);
    if (error instanceof Error) {
      console.error(`      错误类型: ${error.constructor.name}`);
      console.error(`      错误消息: ${error.message}`);
      
      if (error.message.includes("Tenant or user not found")) {
        console.error(`\n   🔍 诊断: 认证失败`);
        console.error(`      可能原因:`);
        console.error(`      1. 用户名格式错误（Pooler 需要: postgres.PROJECT_ID）`);
        console.error(`      2. 密码不正确`);
        console.error(`      3. 项目 ID 不匹配`);
        console.error(`      4. Pooler URL 区域不正确`);
      } else if (error.message.includes("ENOTFOUND") || error.message.includes("getaddrinfo")) {
        console.error(`\n   🔍 诊断: DNS 解析失败`);
        console.error(`      可能原因:`);
        console.error(`      1. 主机名不正确`);
        console.error(`      2. 数据库区域不正确`);
        console.error(`      3. 网络连接问题`);
      }
    } else {
      console.error(`      错误: ${String(error)}`);
    }
    
    await pool.end();
    return false;
  }
}

async function main() {
  console.log("=".repeat(80));
  console.log("🧪 Supabase Pooler 连接字符串测试");
  console.log("=".repeat(80));
  console.log();
  
  const results: Array<{ name: string; success: boolean }> = [];
  
  for (const config of testConfigs) {
    const success = await testConnection(config.name, config.connectionString);
    results.push({ name: config.name, success });
    
    // 如果第一个测试成功，就不需要测试其他配置
    if (success) {
      console.log(`\n✅ 找到可用的连接配置: ${config.name}`);
      break;
    }
  }
  
  console.log(`\n${"=".repeat(80)}`);
  console.log("📊 测试结果总结");
  console.log("=".repeat(80));
  
  results.forEach((result) => {
    console.log(`   ${result.success ? "✅" : "❌"} ${result.name}`);
  });
  
  const allFailed = results.every((r) => !r.success);
  if (allFailed) {
    console.log(`\n❌ 所有连接测试都失败了！`);
    console.log(`\n请检查:`);
    console.log(`1. 登录 Supabase Dashboard: https://app.supabase.com`);
    console.log(`2. 进入项目: cgpmpfnjzlzbquakmmrj`);
    console.log(`3. Settings → Database → Connection Pooling`);
    console.log(`4. 复制正确的 Pooler 连接字符串`);
    console.log(`5. 确保数据库没有被暂停`);
    process.exit(1);
  }
  
  console.log(`\n✅ 至少有一个连接配置可用！`);
}

main().catch((error) => {
  console.error("❌ 测试脚本执行失败:", error);
  process.exit(1);
});

