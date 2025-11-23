#!/usr/bin/env tsx
/**
 * 查询 ai_config 表中的 aiProvider 配置
 * 用法: npx tsx scripts/query-ai-provider-config.ts
 */

import { aiDb } from "../src/lib/aiDb";

async function queryAiProviderConfig() {
  try {
    console.log("🔍 查询 ai_config 表中的 aiProvider 配置...\n");

    // 1. 查询当前 aiProvider 配置值
    console.log("📋 1. 当前 aiProvider 配置:");
    const aiProviderRow = await (aiDb as any)
      .selectFrom("ai_config")
      .select(["key", "value", "description", "updated_at", "updated_by"])
      .where("key", "=", "aiProvider")
      .executeTakeFirst();

    if (aiProviderRow) {
      console.log("   ✅ 找到配置:");
      console.log(`   - Key: ${aiProviderRow.key}`);
      console.log(`   - Value: ${aiProviderRow.value}`);
      console.log(`   - Description: ${aiProviderRow.description || "无描述"}`);
      console.log(`   - Updated At: ${aiProviderRow.updated_at || "未知"}`);
      console.log(`   - Updated By: ${aiProviderRow.updated_by || "未知"}`);
    } else {
      console.log("   ⚠️  未找到 aiProvider 配置");
    }

    // 2. 查询所有超时配置
    console.log("\n📋 2. 所有超时配置 (timeout_*):");
    const timeoutRows = await (aiDb as any)
      .selectFrom("ai_config")
      .select(["key", "value", "description", "updated_at"])
      .where("key", "like", "timeout_%")
      .orderBy("key", "asc")
      .execute();

    if (timeoutRows.length > 0) {
      console.log(`   ✅ 找到 ${timeoutRows.length} 个超时配置:\n`);
      console.table(
        timeoutRows.map((row: any) => ({
          key: row.key,
          value: `${row.value}ms (${Number(row.value) / 1000}秒)`,
          description: row.description || "无描述",
          updated_at: row.updated_at || "未知",
        }))
      );
    } else {
      console.log("   ⚠️  未找到任何超时配置");
    }

    // 3. 查询 model 配置
    console.log("\n📋 3. 当前 model 配置:");
    const modelRow = await (aiDb as any)
      .selectFrom("ai_config")
      .select(["key", "value", "description", "updated_at"])
      .where("key", "=", "model")
      .executeTakeFirst();

    if (modelRow) {
      console.log(`   ✅ Model: ${modelRow.value}`);
      console.log(`   - Description: ${modelRow.description || "无描述"}`);
      console.log(`   - Updated At: ${modelRow.updated_at || "未知"}`);
    } else {
      console.log("   ⚠️  未找到 model 配置");
    }

    // 4. 验证配置是否符合预期
    console.log("\n📊 4. 配置验证结果:");
    
    const expectedProviders = [
      "strategy",
      "openai",
      "openai_direct",
      "gemini",
      "gemini_direct",
      "openrouter",
      "openrouter_direct",
      "local",
    ];

    const expectedTimeoutKeys = [
      "timeout_openai",
      "timeout_openai_direct",
      "timeout_openrouter",
      "timeout_openrouter_direct",
      "timeout_gemini",
      "timeout_gemini_direct",
      "timeout_local",
    ];

    // 验证 aiProvider 值
    if (aiProviderRow) {
      const currentProvider = aiProviderRow.value;
      if (expectedProviders.includes(currentProvider)) {
        console.log(`   ✅ aiProvider 值 "${currentProvider}" 符合预期`);
      } else {
        console.log(`   ⚠️  aiProvider 值 "${currentProvider}" 不在预期列表中`);
        console.log(`   📝 预期值: ${expectedProviders.join(", ")}`);
      }
    } else {
      console.log("   ❌ aiProvider 配置不存在");
    }

    // 验证超时配置完整性
    const foundTimeoutKeys = timeoutRows.map((row: any) => row.key);
    const missingTimeoutKeys = expectedTimeoutKeys.filter(
      (key) => !foundTimeoutKeys.includes(key)
    );

    if (missingTimeoutKeys.length === 0) {
      console.log("   ✅ 所有预期的超时配置都已存在");
    } else {
      console.log(`   ⚠️  缺少以下超时配置: ${missingTimeoutKeys.join(", ")}`);
    }

    // 5. 总结
    console.log("\n📝 总结:");
    console.log(`   - 当前 aiProvider: ${aiProviderRow?.value || "未配置"}`);
    console.log(`   - 当前 model: ${modelRow?.value || "未配置"}`);
    console.log(`   - 超时配置数量: ${timeoutRows.length}/${expectedTimeoutKeys.length}`);

    // 6. 列出所有支持的 aiProvider 选项
    console.log("\n📋 5. 所有支持的 aiProvider 选项:");
    const providerDescriptions = [
      { value: "strategy", desc: "使用调用策略" },
      { value: "openai", desc: "OpenAI（通过 Render）" },
      { value: "openai_direct", desc: "直连 OpenAI" },
      { value: "gemini", desc: "Google Gemini（通过 Render）" },
      { value: "gemini_direct", desc: "直连 Google Gemini" },
      { value: "openrouter", desc: "OpenRouter（通过 Render）" },
      { value: "openrouter_direct", desc: "直连 OpenRouter" },
      { value: "local", desc: "本地 AI（Ollama）" },
    ];

    console.table(
      providerDescriptions.map((p) => ({
        value: p.value,
        description: p.desc,
        is_current: aiProviderRow?.value === p.value ? "✅" : "",
      }))
    );

    process.exit(0);
  } catch (error: any) {
    console.error("\n❌ 查询失败:");
    console.error(error);
    if (error.message) {
      console.error(`   错误信息: ${error.message}`);
    }
    if (error.stack) {
      console.error(`   错误堆栈: ${error.stack}`);
    }
    process.exit(1);
  }
}

queryAiProviderConfig();

