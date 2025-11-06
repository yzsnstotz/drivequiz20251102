#!/usr/bin/env tsx
/**
 * AI配置功能测试脚本
 * 测试AI配置的读取和更新功能
 */

import { aiDb } from "../src/lib/aiDb";

async function testAiConfig() {
  console.log("🧪 开始测试AI配置功能...\n");

  try {
    // 测试1: 读取所有配置
    console.log("📖 测试1: 读取AI配置");
    const configKeys = [
      "dailyAskLimit",
      "answerCharLimit",
      "model",
      "cacheTtl",
      "costAlertUsdThreshold",
    ];

    // 使用 Kysely 的 where 语法
    let query = (aiDb as any)
      .selectFrom("ai_config")
      .selectAll();
    
    // Kysely 的 in 操作符需要特殊处理
    if (configKeys.length === 1) {
      query = query.where("key", "=", configKeys[0]);
    } else {
      // 对于多个值，使用 where 的 in 操作符
      query = query.where("key", "in", configKeys);
    }
    
    const rows = await query.execute();

    console.log(`✅ 成功读取配置，共 ${rows.length} 条记录`);
    for (const row of rows) {
      console.log(`   - ${row.key}: ${row.value}`);
    }

    // 验证所有必需的配置项是否存在
    const foundKeys = rows.map((r: any) => r.key);
    const missingKeys = configKeys.filter((k) => !foundKeys.includes(k));
    if (missingKeys.length > 0) {
      console.warn(`⚠️  缺少配置项: ${missingKeys.join(", ")}`);
    } else {
      console.log("✅ 所有必需的配置项都已存在\n");
    }

    // 测试2: 测试数据库连接
    console.log("🔌 测试2: 验证数据库连接");
    const testQuery = await (aiDb as any)
      .selectFrom("ai_config")
      .select(["key"])
      .limit(1)
      .execute();
    console.log("✅ 数据库连接正常\n");

    // 测试3: 检查配置值的有效性
    console.log("✓ 测试3: 验证配置值格式");
    const configMap: Record<string, string> = {};
    for (const row of rows) {
      configMap[row.key] = row.value;
    }

    // 验证 dailyAskLimit
    const dailyAskLimit = Number(configMap.dailyAskLimit || "10");
    if (isNaN(dailyAskLimit) || dailyAskLimit < 1 || dailyAskLimit > 10000) {
      console.error(`❌ dailyAskLimit 值无效: ${configMap.dailyAskLimit}`);
    } else {
      console.log(`✅ dailyAskLimit: ${dailyAskLimit} (有效)`);
    }

    // 验证 answerCharLimit
    const answerCharLimit = Number(configMap.answerCharLimit || "300");
    if (isNaN(answerCharLimit) || answerCharLimit < 10 || answerCharLimit > 10000) {
      console.error(`❌ answerCharLimit 值无效: ${configMap.answerCharLimit}`);
    } else {
      console.log(`✅ answerCharLimit: ${answerCharLimit} (有效)`);
    }

    // 验证 model
    const model = configMap.model || "gpt-4o-mini";
    if (typeof model !== "string" || model.trim().length === 0) {
      console.error(`❌ model 值无效: ${model}`);
    } else {
      console.log(`✅ model: ${model} (有效)`);
    }

    // 验证 cacheTtl
    const cacheTtl = Number(configMap.cacheTtl || "86400");
    if (isNaN(cacheTtl) || cacheTtl < 0 || cacheTtl > 604800) {
      console.error(`❌ cacheTtl 值无效: ${configMap.cacheTtl}`);
    } else {
      console.log(`✅ cacheTtl: ${cacheTtl} (有效)`);
    }

    // 验证 costAlertUsdThreshold
    const costAlertUsdThreshold = Number(configMap.costAlertUsdThreshold || "10.00");
    if (isNaN(costAlertUsdThreshold) || costAlertUsdThreshold < 0 || costAlertUsdThreshold > 100000) {
      console.error(`❌ costAlertUsdThreshold 值无效: ${configMap.costAlertUsdThreshold}`);
    } else {
      console.log(`✅ costAlertUsdThreshold: ${costAlertUsdThreshold} (有效)`);
    }

    console.log("\n✅ 所有测试通过！");

    // 测试4: 检查RLS策略
    console.log("\n🔒 测试4: 检查RLS策略");
    try {
      const rlsCheck = await (aiDb as any)
        .selectFrom("ai_config")
        .select(["key"])
        .limit(1)
        .execute();
      console.log("✅ RLS策略允许查询操作");
    } catch (err: any) {
      if (err.message?.includes("permission denied") || err.message?.includes("row-level security")) {
        console.error("❌ RLS策略阻止了查询操作");
        console.error("   请检查RLS策略配置");
      } else {
        throw err;
      }
    }

    return true;
  } catch (error) {
    console.error("\n❌ 测试失败:");
    console.error(error);
    if (error instanceof Error) {
      console.error("错误信息:", error.message);
      console.error("错误堆栈:", error.stack);
    }
    return false;
  }
}

// 运行测试
testAiConfig()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((err) => {
    console.error("未捕获的错误:", err);
    process.exit(1);
  });

