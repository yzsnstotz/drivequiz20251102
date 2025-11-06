#!/usr/bin/env tsx
// ==========================================================
// 数据库初始化脚本
// 说明: 连接到云端数据库并执行初始化SQL
// ==========================================================

import { Pool } from "pg";
import { readFileSync } from "fs";
import { join, resolve } from "path";
import { config } from "dotenv";

// 加载 .env.local 文件
config({ path: resolve(process.cwd(), ".env.local") });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ 错误: DATABASE_URL 环境变量未设置");
  console.error("请在 .env.local 文件中设置 DATABASE_URL");
  process.exit(1);
}

async function initDatabase() {
  // 为 Supabase 配置 SSL - 必须设置 rejectUnauthorized: false
  const pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false, // Supabase 需要 SSL 连接，但证书链可能有自签名证书
    },
  });

  try {
    console.log("🔄 正在连接到云端数据库...");
    
    // 测试连接
    const client = await pool.connect();
    console.log("✅ 数据库连接成功");

    // 读取SQL文件
    const sqlPath = join(__dirname, "init-cloud-database.sql");
    let sql = readFileSync(sqlPath, "utf-8");

    console.log("📝 正在执行初始化SQL脚本...");
    
    // PostgreSQL 的 pg 库可以执行包含 BEGIN/COMMIT 的事务块
    // 但为了更可靠，我们直接执行整个SQL
    await client.query(sql);
    
    console.log("✅ 数据库初始化完成！");

    // 验证表是否创建成功
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);

    console.log("\n📊 已创建的表:");
    tables.rows.forEach((row) => {
      console.log(`   - ${row.table_name}`);
    });

    client.release();
  } catch (error) {
    console.error("❌ 数据库初始化失败:");
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initDatabase();

