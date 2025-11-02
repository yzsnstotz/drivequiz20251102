#!/usr/bin/env tsx
// ==========================================================
// 创建默认管理员账户脚本
// 说明: 在数据库中创建默认超级管理员
// ==========================================================

import { Pool } from "pg";
import { readFileSync } from "fs";
import { resolve } from "path";
import { config } from "dotenv";

// 加载 .env.local 文件
config({ path: resolve(process.cwd(), ".env.local") });

const connectionString = process.env.DATABASE_URL;
const DEFAULT_ADMIN_USERNAME = "admin";
const DEFAULT_ADMIN_TOKEN = "Aa123456";

if (!connectionString) {
  console.error("❌ 错误: DATABASE_URL 环境变量未设置");
  process.exit(1);
}

async function createDefaultAdmin() {
  const pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    console.log("🔄 正在连接到数据库...");
    const client = await pool.connect();
    console.log("✅ 数据库连接成功");

    // 检查是否已存在默认管理员
    const existingAdmin = await client.query(
      `SELECT id, username, token, is_active FROM admins WHERE username = $1 OR token = $2`,
      [DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_TOKEN]
    );

    if (existingAdmin.rows.length > 0) {
      console.log("ℹ️  默认管理员已存在:");
      existingAdmin.rows.forEach((row) => {
        console.log(`   - ID: ${row.id}`);
        console.log(`   - 用户名: ${row.username}`);
        console.log(`   - Token: ${row.token.substring(0, 8)}***`);
        console.log(`   - 状态: ${row.is_active ? "活跃" : "禁用"}`);
      });
      
      // 如果token不匹配，更新token
      const admin = existingAdmin.rows[0];
      if (admin.token !== DEFAULT_ADMIN_TOKEN) {
        console.log(`\n🔄 更新管理员token...`);
        await client.query(
          `UPDATE admins SET token = $1, updated_at = NOW() WHERE id = $2`,
          [DEFAULT_ADMIN_TOKEN, admin.id]
        );
        console.log("✅ Token已更新为: Aa123456");
      }
      
      client.release();
      await pool.end();
      return;
    }

    // 创建默认管理员
    console.log("📝 正在创建默认管理员账户...");
    const result = await client.query(
      `INSERT INTO admins (username, token, is_active, created_at, updated_at)
       VALUES ($1, $2, true, NOW(), NOW())
       RETURNING id, username, token, is_active`,
      [DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_TOKEN]
    );

    const newAdmin = result.rows[0];
    console.log("✅ 默认管理员创建成功！");
    console.log(`   - ID: ${newAdmin.id}`);
    console.log(`   - 用户名: ${newAdmin.username}`);
    console.log(`   - Token: ${newAdmin.token}`);
    console.log(`   - 状态: ${newAdmin.is_active ? "活跃" : "禁用"}`);
    console.log(`\n💡 登录信息:`);
    console.log(`   - 用户名: ${DEFAULT_ADMIN_USERNAME}`);
    console.log(`   - Token: ${DEFAULT_ADMIN_TOKEN}`);

    client.release();
  } catch (error) {
    console.error("❌ 创建默认管理员失败:");
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createDefaultAdmin();

