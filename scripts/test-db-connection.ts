#!/usr/bin/env tsx
// 测试数据库连接脚本

import { Pool } from "pg";
import { resolve } from "path";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), ".env.local") });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ DATABASE_URL未设置");
  process.exit(1);
}

// 检测是否需要SSL连接
const needsSSL = connectionString.includes('sslmode=require') || 
                  connectionString.includes('supabase.com');

console.log(`连接字符串包含 'sslmode=require': ${connectionString.includes('sslmode=require')}`);
console.log(`连接字符串包含 'supabase.com': ${connectionString.includes('supabase.com')}`);
console.log(`需要SSL: ${needsSSL}`);

async function testConnection() {
  const pool = new Pool({
    connectionString,
    ssl: needsSSL ? {
      rejectUnauthorized: false,
    } : false,
  });

  try {
    console.log("\n🔄 正在测试数据库连接...");
    const client = await pool.connect();
    console.log("✅ 数据库连接成功！");
    
    // 测试查询
    const result = await client.query('SELECT NOW() as current_time');
    console.log(`✅ 查询成功: ${result.rows[0].current_time}`);
    
    // 测试管理员查询
    const adminResult = await client.query('SELECT COUNT(*) as count FROM admins');
    console.log(`✅ 管理员数量: ${adminResult.rows[0].count}`);
    
    client.release();
    await pool.end();
    console.log("\n✅ 所有测试通过！");
  } catch (error) {
    console.error("❌ 连接失败:", error);
    process.exit(1);
  }
}

testConnection();

