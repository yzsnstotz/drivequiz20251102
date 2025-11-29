#!/usr/bin/env tsx
/**
 * 查询 ai_scene_config 表中 chat 场景的配置
 * 用法: npx tsx scripts/query-chat-scene-config.ts
 * 
 * 此脚本用于诊断首页AI助手en和ja语言下lang is not defined错误
 */

// 加载环境变量
import { config } from "dotenv";
import { resolve } from "path";

// 加载 .env.local 文件
config({ path: resolve(__dirname, "../.env.local") });
// 也尝试加载 .env 文件
config({ path: resolve(__dirname, "../.env") });

import { aiDb } from "../src/lib/aiDb";

async function queryChatSceneConfig() {
  try {
    console.log("🔍 查询 ai_scene_config 表中 chat 场景的配置...\n");

    // 查询 chat 场景的配置
    const chatScene = await (aiDb as any)
      .selectFrom("ai_scene_config")
      .selectAll()
      .where("scene_key", "=", "chat")
      .executeTakeFirst();

    if (!chatScene) {
      console.log("❌ 未找到 chat 场景配置");
      return;
    }

    console.log("✅ 找到 chat 场景配置:\n");
    console.log(`- ID: ${chatScene.id}`);
    console.log(`- Scene Key: ${chatScene.scene_key}`);
    console.log(`- Scene Name: ${chatScene.scene_name}`);
    console.log(`- Enabled: ${chatScene.enabled}`);
    console.log(`- Updated At: ${chatScene.updated_at || "未知"}`);
    console.log(`- Updated By: ${chatScene.updated_by || "未知"}\n`);

    // 检查中文prompt
    console.log("📋 中文 Prompt (system_prompt_zh):");
    if (chatScene.system_prompt_zh) {
      console.log(`   长度: ${chatScene.system_prompt_zh.length} 字符`);
      console.log(`   内容预览: ${chatScene.system_prompt_zh.substring(0, 200)}...`);
      
      // 检查是否包含 {lang} 占位符（包括大小写变体）
      const langPlaceholders = [
        /\{lang\}/gi,
        /\{Lang\}/g,
        /\{LANG\}/g,
        /\{language\}/gi,
        /\{Language\}/g,
        /\{LANGUAGE\}/g,
      ];
      
      let foundPlaceholder = false;
      for (const pattern of langPlaceholders) {
        if (pattern.test(chatScene.system_prompt_zh)) {
          console.log(`   ⚠️  发现占位符: ${pattern.source}`);
          foundPlaceholder = true;
        }
      }
      
      if (!foundPlaceholder) {
        console.log("   ✅ 未发现 {lang} 相关占位符");
      }
    } else {
      console.log("   ❌ 未配置");
    }

    console.log("\n📋 日文 Prompt (system_prompt_ja):");
    if (chatScene.system_prompt_ja) {
      console.log(`   长度: ${chatScene.system_prompt_ja.length} 字符`);
      console.log(`   内容预览: ${chatScene.system_prompt_ja.substring(0, 200)}...`);
      
      // 检查是否包含 {lang} 占位符
      const langPlaceholders = [
        /\{lang\}/gi,
        /\{Lang\}/g,
        /\{LANG\}/g,
        /\{language\}/gi,
        /\{Language\}/g,
        /\{LANGUAGE\}/g,
      ];
      
      let foundPlaceholder = false;
      for (const pattern of langPlaceholders) {
        if (pattern.test(chatScene.system_prompt_ja)) {
          console.log(`   ⚠️  发现占位符: ${pattern.source}`);
          foundPlaceholder = true;
        }
      }
      
      if (!foundPlaceholder) {
        console.log("   ✅ 未发现 {lang} 相关占位符");
      }
    } else {
      console.log("   ❌ 未配置");
    }

    console.log("\n📋 英文 Prompt (system_prompt_en):");
    if (chatScene.system_prompt_en) {
      console.log(`   长度: ${chatScene.system_prompt_en.length} 字符`);
      console.log(`   内容预览: ${chatScene.system_prompt_en.substring(0, 200)}...`);
      
      // 检查是否包含 {lang} 占位符
      const langPlaceholders = [
        /\{lang\}/gi,
        /\{Lang\}/g,
        /\{LANG\}/g,
        /\{language\}/gi,
        /\{Language\}/g,
        /\{LANGUAGE\}/g,
      ];
      
      let foundPlaceholder = false;
      for (const pattern of langPlaceholders) {
        if (pattern.test(chatScene.system_prompt_en)) {
          console.log(`   ⚠️  发现占位符: ${pattern.source}`);
          foundPlaceholder = true;
        }
      }
      
      if (!foundPlaceholder) {
        console.log("   ✅ 未发现 {lang} 相关占位符");
      }
    } else {
      console.log("   ❌ 未配置");
    }

    // 显示完整内容（用于详细检查）
    console.log("\n📄 完整配置内容:");
    console.log("=" .repeat(80));
    console.log("\n【中文 Prompt】:");
    console.log(chatScene.system_prompt_zh || "(未配置)");
    console.log("\n【日文 Prompt】:");
    console.log(chatScene.system_prompt_ja || "(未配置)");
    console.log("\n【英文 Prompt】:");
    console.log(chatScene.system_prompt_en || "(未配置)");
    console.log("\n" + "=".repeat(80));

    // 总结
    console.log("\n📊 诊断总结:");
    const hasZh = !!chatScene.system_prompt_zh;
    const hasJa = !!chatScene.system_prompt_ja;
    const hasEn = !!chatScene.system_prompt_en;
    
    console.log(`- 中文 Prompt: ${hasZh ? "✅ 已配置" : "❌ 未配置"}`);
    console.log(`- 日文 Prompt: ${hasJa ? "✅ 已配置" : "❌ 未配置"}`);
    console.log(`- 英文 Prompt: ${hasEn ? "✅ 已配置" : "❌ 未配置"}`);
    
    if (!hasJa || !hasEn) {
      console.log("\n⚠️  警告: 日文或英文 Prompt 未配置，可能导致语言切换问题");
    }

  } catch (error) {
    console.error("❌ 查询失败:", error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error("堆栈:", error.stack);
    }
    process.exit(1);
  }
}

// 执行查询
queryChatSceneConfig()
  .then(() => {
    console.log("\n✅ 查询完成");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ 执行失败:", error);
    process.exit(1);
  });

