#!/usr/bin/env tsx
/**
 * 测试 AI 数据库连接并查询场景配置
 * 用法: npx tsx scripts/test-ai-db-connection.ts
 */

// 加载环境变量
import { config } from "dotenv";
import { resolve } from "path";

// 加载 .env.local 文件
config({ path: resolve(__dirname, "../.env.local") });
// 也尝试加载 .env 文件
config({ path: resolve(__dirname, "../.env") });

// 对于 Supabase 自签名证书，临时禁用 SSL 验证（仅用于本地测试）
if (process.env.AI_DATABASE_URL?.includes("supabase.co")) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

import { aiDb } from "../src/lib/aiDb";

async function testAiDbConnection() {
  try {
    console.log("🔍 测试 AI 数据库连接...\n");

    // 检查环境变量
    const hasDbUrl = !!process.env.AI_DATABASE_URL;
    console.log(`📋 环境变量检查:`);
    console.log(`   - AI_DATABASE_URL: ${hasDbUrl ? "✅ 已配置" : "❌ 未配置"}`);
    
    if (hasDbUrl) {
      const dbUrl = process.env.AI_DATABASE_URL;
      // 只显示前80个字符，隐藏密码
      const maskedUrl = dbUrl?.replace(/:([^:@]+)@/, ':***@') || '';
      console.log(`   - 连接字符串预览: ${maskedUrl.substring(0, 80)}...`);
    }

    console.log("\n📋 尝试查询 ai_scene_config 表...");

    // 尝试查询所有场景配置
    const allScenes = await (aiDb as any)
      .selectFrom("ai_scene_config")
      .selectAll()
      .orderBy("scene_key", "asc")
      .execute();

    console.log(`✅ 查询成功！找到 ${allScenes.length} 个场景配置\n`);

    if (allScenes.length === 0) {
      console.log("⚠️  表存在但没有数据");
      return;
    }

    // 显示所有场景
    for (const scene of allScenes) {
      console.log(`📋 场景: ${scene.scene_key} (${scene.scene_name})`);
      console.log(`   - ID: ${scene.id}`);
      console.log(`   - Enabled: ${scene.enabled}`);
      console.log(`   - 中文: ${scene.system_prompt_zh ? `✅ (${scene.system_prompt_zh.length} 字符)` : "❌"}`);
      console.log(`   - 日文: ${scene.system_prompt_ja ? `✅ (${scene.system_prompt_ja.length} 字符)` : "❌"}`);
      console.log(`   - 英文: ${scene.system_prompt_en ? `✅ (${scene.system_prompt_en.length} 字符)` : "❌"}`);
      
      // 如果是 chat 场景，详细检查
      if (scene.scene_key === "chat") {
        console.log("\n   🔍 详细检查 chat 场景:");
        
        if (scene.system_prompt_ja) {
          const hasLang = /\{lang\}/gi.test(scene.system_prompt_ja);
          console.log(`   - 日文 Prompt:`);
          console.log(`     ${hasLang ? "⚠️  包含 {lang} 占位符" : "✅ 未包含 {lang} 占位符"}`);
          console.log(`     内容: ${scene.system_prompt_ja.substring(0, 100)}...`);
        }
        
        if (scene.system_prompt_en) {
          const hasLang = /\{lang\}/gi.test(scene.system_prompt_en);
          console.log(`   - 英文 Prompt:`);
          console.log(`     ${hasLang ? "⚠️  包含 {lang} 占位符" : "✅ 未包含 {lang} 占位符"}`);
          console.log(`     内容: ${scene.system_prompt_en.substring(0, 100)}...`);
        }
      }
      
      console.log("");
    }

    // 专门查询 chat 场景
    console.log("\n📋 专门查询 chat 场景:");
    const chatScene = await (aiDb as any)
      .selectFrom("ai_scene_config")
      .selectAll()
      .where("scene_key", "=", "chat")
      .executeTakeFirst();

    if (chatScene) {
      console.log("✅ 找到 chat 场景配置");
      console.log("\n完整配置内容:");
      console.log("=".repeat(80));
      console.log("\n【日文 Prompt】:");
      console.log(chatScene.system_prompt_ja || "(未配置)");
      console.log("\n【英文 Prompt】:");
      console.log(chatScene.system_prompt_en || "(未配置)");
      console.log("\n" + "=".repeat(80));
      
      // 检查占位符
      const jaHasLang = chatScene.system_prompt_ja ? /\{lang\}/gi.test(chatScene.system_prompt_ja) : false;
      const enHasLang = chatScene.system_prompt_en ? /\{lang\}/gi.test(chatScene.system_prompt_en) : false;
      
      console.log("\n📊 占位符检查结果:");
      console.log(`   - 日文 Prompt: ${jaHasLang ? "⚠️  包含 {lang} 占位符" : "✅ 未包含 {lang} 占位符"}`);
      console.log(`   - 英文 Prompt: ${enHasLang ? "⚠️  包含 {lang} 占位符" : "✅ 未包含 {lang} 占位符"}`);
      
      if (jaHasLang || enHasLang) {
        console.log("\n❌ 发现问题：prompt 中包含 {lang} 占位符，但代码不支持此占位符替换！");
        console.log("   这会导致 AI 收到包含 {lang} 的 prompt，从而返回 'lang is not defined' 错误。");
      } else {
        console.log("\n✅ 未发现 {lang} 占位符，配置看起来正常");
        console.log("   如果仍然出现错误，可能需要检查服务器日志确认实际发送的 prompt");
      }
    } else {
      console.log("❌ 未找到 chat 场景配置");
    }

  } catch (error) {
    console.error("\n❌ 查询失败:", error instanceof Error ? error.message : String(error));
    
    if (error instanceof Error) {
      if (error.message.includes("does not exist") || error.message.includes("relation")) {
        console.log("\n💡 提示: 可能是数据库表不存在，需要执行迁移脚本");
        console.log("   迁移脚本: src/migrations/20251113_create_ai_scene_config.sql");
      } else if (error.message.includes("connection") || error.message.includes("ECONNREFUSED")) {
        console.log("\n💡 提示: 可能是数据库连接问题");
        console.log("   请检查:");
        console.log("   1. AI_DATABASE_URL 环境变量是否正确配置");
        console.log("   2. 数据库服务是否正在运行");
        console.log("   3. 网络连接是否正常");
      } else if (error.message.includes("password") || error.message.includes("authentication")) {
        console.log("\n💡 提示: 可能是数据库认证失败");
        console.log("   请检查 AI_DATABASE_URL 中的用户名和密码是否正确");
      }
      
      if (error.stack && process.env.NODE_ENV === "development") {
        console.error("\n堆栈:", error.stack);
      }
    }
    
    process.exit(1);
  }
}

// 执行测试
testAiDbConnection()
  .then(() => {
    console.log("\n✅ 测试完成");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ 执行失败:", error);
    process.exit(1);
  });

