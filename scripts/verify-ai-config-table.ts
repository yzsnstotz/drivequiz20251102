#!/usr/bin/env tsx
/**
 * 验证 ai_config 表是否存在
 * 用法: npx tsx scripts/verify-ai-config-table.ts
 */

import { db } from "../src/lib/db";

async function verifyTable() {
  try {
    console.log("🔍 检查 ai_config 表是否存在...");
    
    // 尝试查询表
    const result = await db
      .selectFrom("ai_config" as any)
      .selectAll()
      .limit(1)
      .execute();
    
    console.log("✅ ai_config 表存在！");
    console.log(`📊 当前配置数量: ${result.length > 0 ? "有数据" : "无数据"}`);
    
    // 查询所有配置
    const allConfigs = await db
      .selectFrom("ai_config" as any)
      .selectAll()
      .execute();
    
    if (allConfigs.length > 0) {
      console.log("\n📋 当前配置项:");
      for (const config of allConfigs) {
        console.log(`  - ${(config as any).key}: ${(config as any).value}`);
      }
    } else {
      console.log("\n⚠️  表存在但没有配置数据");
    }
    
    process.exit(0);
  } catch (error: any) {
    if (error.message?.includes("does not exist")) {
      console.error("❌ ai_config 表不存在！");
      console.error("\n💡 解决方案:");
      console.error("   1. 确认数据库连接字符串是否正确（应指向 Supabase）");
      console.error("   2. 在 Supabase SQL Editor 中执行迁移脚本:");
      console.error("      src/migrations/20251108_create_ai_config.sql");
      console.error("   3. 检查 .env.local 文件中的 DATABASE_URL");
    } else {
      console.error("❌ 数据库连接错误:", error.message);
      console.error("\n💡 检查:");
      console.error("   1. .env.local 文件是否存在");
      console.error("   2. DATABASE_URL 是否正确配置");
      console.error("   3. 数据库是否可访问");
    }
    process.exit(1);
  }
}

verifyTable();

