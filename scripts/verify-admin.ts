#!/usr/bin/env tsx
// 验证管理员账户脚本

import { Pool } from "pg";
import { resolve } from "path";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), ".env.local") });

const connectionString = process.env.DATABASE_URL;
const TEST_TOKEN = "Aa123456";

async function verifyAdmin() {
  const pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    const client = await pool.connect();
    
    // 查询使用token的管理员
    const result = await client.query(
      `SELECT id, username, token, is_active FROM admins WHERE token = $1`,
      [TEST_TOKEN]
    );

    console.log(`\n查询token "${TEST_TOKEN}" 的结果:`);
    if (result.rows.length > 0) {
      const admin = result.rows[0];
      console.log(`✅ 找到管理员:`);
      console.log(`   - ID: ${admin.id}`);
      console.log(`   - 用户名: ${admin.username}`);
      console.log(`   - Token: ${admin.token}`);
      console.log(`   - 状态: ${admin.is_active ? "活跃" : "禁用"}`);
      
      if (admin.is_active) {
        console.log(`\n✅ 该管理员账户可以正常登录！`);
      } else {
        console.log(`\n⚠️  该管理员账户已被禁用，无法登录。`);
      }
    } else {
      console.log(`❌ 未找到token为 "${TEST_TOKEN}" 的管理员账户`);
    }

    // 查询所有管理员
    const allAdmins = await client.query(`SELECT id, username, token, is_active FROM admins`);
    console.log(`\n📊 所有管理员账户:`);
    allAdmins.rows.forEach((row) => {
      console.log(`   - ${row.username} (token: ${row.token.substring(0, 8)}***, 状态: ${row.is_active ? "活跃" : "禁用"})`);
    });

    client.release();
  } catch (error) {
    console.error("❌ 验证失败:", error);
  } finally {
    await pool.end();
  }
}

verifyAdmin();

