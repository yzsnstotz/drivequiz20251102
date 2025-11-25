#!/usr/bin/env tsx
/**
 * 检查 ai_config 表是否存在以及所有配置项
 * 用法: npx tsx scripts/check-ai-config-table.ts
 */

import { aiDb } from "../src/lib/aiDb";

async function checkAiConfigTable() {
  try {
    console.log("🔍 检查 ai_config 表...\n");

    // 1. 查询所有配置项
    console.log("📋 查询所有 ai_config 配置项:");
    const allConfigs = await (aiDb as any)
      .selectFrom("ai_config")
      .selectAll()
      .orderBy("key", "asc")
      .execute();

    if (allConfigs.length === 0) {
      console.log("   ⚠️  ai_config 表存在，但没有任何配置数据");
      console.log("\n💡 建议:");
      console.log("   1. 执行迁移脚本初始化配置:");
      console.log("      - src/migrations/20251108_create_ai_config.sql");
      console.log("      - src/migrations/20250115_add_ai_provider_config.sql");
      console.log("      - src/migrations/20250120_add_provider_timeout_config.sql");
      console.log("      - src/migrations/20250211_add_gemini_provider_config.sql");
    } else {
      console.log(`   ✅ 找到 ${allConfigs.length} 个配置项:\n`);
      console.table(
        allConfigs.map((row: any) => ({
          key: row.key,
          value: row.value,
          description: row.description ? row.description.substring(0, 50) + "..." : "无描述",
          updated_at: row.updated_at ? new Date(row.updated_at).toLocaleString("zh-CN") : "未知",
        }))
      );

      // 按类型分组显示
      console.log("\n📊 配置项分类:");
      const providerConfigs = allConfigs.filter((c: any) => c.key === "aiProvider");
      const timeoutConfigs = allConfigs.filter((c: any) => c.key.startsWith("timeout_"));
      const otherConfigs = allConfigs.filter(
        (c: any) => c.key !== "aiProvider" && !c.key.startsWith("timeout_")
      );

      console.log(`   - AI Provider 配置: ${providerConfigs.length} 个`);
      if (providerConfigs.length > 0) {
        providerConfigs.forEach((c: any) => {
          console.log(`     • ${c.key}: ${c.value}`);
        });
      }

      console.log(`   - 超时配置: ${timeoutConfigs.length} 个`);
      if (timeoutConfigs.length > 0) {
        timeoutConfigs.forEach((c: any) => {
          console.log(`     • ${c.key}: ${c.value}ms`);
        });
      }

      console.log(`   - 其他配置: ${otherConfigs.length} 个`);
      if (otherConfigs.length > 0) {
        otherConfigs.forEach((c: any) => {
          console.log(`     • ${c.key}: ${c.value}`);
        });
      }
    }

    // 2. 检查环境变量
    console.log("\n🔑 环境变量检查:");
    const aiDbUrl = process.env.AI_DATABASE_URL;
    if (aiDbUrl) {
      // 隐藏密码
      const maskedUrl = aiDbUrl.replace(/:([^:@]+)@/, ":****@");
      console.log(`   ✅ AI_DATABASE_URL 已设置: ${maskedUrl}`);
    } else {
      console.log("   ❌ AI_DATABASE_URL 未设置");
    }

    process.exit(0);
  } catch (error: any) {
    console.error("\n❌ 检查失败:");
    console.error(error);
    if (error.message) {
      console.error(`   错误信息: ${error.message}`);
      
      if (error.message.includes("does not exist")) {
        console.error("\n💡 表不存在，请执行迁移脚本:");
        console.error("   src/migrations/20251108_create_ai_config.sql");
      } else if (error.message.includes("permission denied")) {
        console.error("\n💡 权限不足，请检查数据库连接配置");
      } else if (error.message.includes("connection")) {
        console.error("\n💡 数据库连接失败，请检查:");
        console.error("   1. AI_DATABASE_URL 环境变量是否正确");
        console.error("   2. 数据库是否可访问");
        console.error("   3. 网络连接是否正常");
      }
    }
    process.exit(1);
  }
}

checkAiConfigTable();

