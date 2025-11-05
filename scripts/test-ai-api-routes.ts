#!/usr/bin/env tsx
/**
 * 测试 AI API 路由脚本
 * 
 * 用途：验证修复后的 AI API 路由是否正常工作
 * 
 * 使用方法：
 * npx tsx scripts/test-ai-api-routes.ts
 */

import * as dotenv from "dotenv";

// 加载环境变量
dotenv.config({ path: ".env.local" });
dotenv.config();

const BASE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL || "http://localhost:3001";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

async function testApiRoute(url: string, method: string = "GET", body?: any): Promise<{ ok: boolean; status: number; data?: any; error?: string }> {
  try {
    const options: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (ADMIN_TOKEN) {
      (options.headers as Record<string, string>)["Authorization"] = `Bearer ${ADMIN_TOKEN}`;
    }

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));

    return {
      ok: response.ok,
      status: response.status,
      data: response.ok ? data : undefined,
      error: response.ok ? undefined : (data.message || data.error || `HTTP ${response.status}`),
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function testAiApiRoutes(): Promise<void> {
  console.log("=".repeat(60));
  console.log("🔍 测试 AI API 路由");
  console.log("=".repeat(60));
  console.log();
  console.log(`📋 基础 URL: ${BASE_URL}`);
  console.log(`🔑 Admin Token: ${ADMIN_TOKEN ? "✅ 已配置" : "❌ 未配置（某些测试可能失败）"}`);
  console.log();

  const results: Array<{ name: string; ok: boolean; status: number; error?: string }> = [];

  // 测试 1: 配置 API - GET
  console.log("1️⃣  测试配置 API (GET /api/admin/ai/config)...");
  const configResult = await testApiRoute(`${BASE_URL}/api/admin/ai/config`);
  results.push({
    name: "配置 API (GET)",
    ok: configResult.ok,
    status: configResult.status,
    error: configResult.error,
  });
  
  if (configResult.ok) {
    console.log("   ✅ 成功");
    if (configResult.data && configResult.data.data) {
      console.log("   📊 配置数据:");
      Object.entries(configResult.data.data).forEach(([key, value]) => {
        console.log(`      - ${key}: ${value}`);
      });
    }
  } else {
    console.log(`   ❌ 失败: ${configResult.error || `HTTP ${configResult.status}`}`);
  }
  console.log();

  // 测试 2: 日志 API - GET
  console.log("2️⃣  测试日志 API (GET /api/admin/ai/logs)...");
  const logsResult = await testApiRoute(`${BASE_URL}/api/admin/ai/logs?limit=5`);
  results.push({
    name: "日志 API (GET)",
    ok: logsResult.ok,
    status: logsResult.status,
    error: logsResult.error,
  });
  
  if (logsResult.ok) {
    console.log("   ✅ 成功");
    if (logsResult.data && logsResult.data.data) {
      const items = logsResult.data.data.items || [];
      console.log(`   📊 返回 ${items.length} 条日志记录`);
    }
  } else {
    console.log(`   ❌ 失败: ${logsResult.error || `HTTP ${logsResult.status}`}`);
  }
  console.log();

  // 测试 3: 日志 API - CSV 导出
  console.log("3️⃣  测试日志 API CSV 导出 (GET /api/admin/ai/logs?format=csv)...");
  const csvResult = await testApiRoute(`${BASE_URL}/api/admin/ai/logs?format=csv&limit=5`);
  results.push({
    name: "日志 API (CSV)",
    ok: csvResult.ok && csvResult.status === 200,
    status: csvResult.status,
    error: csvResult.error,
  });
  
  if (csvResult.ok && csvResult.status === 200) {
    console.log("   ✅ 成功");
    console.log("   📄 CSV 格式响应已返回");
  } else {
    console.log(`   ❌ 失败: ${csvResult.error || `HTTP ${csvResult.status}`}`);
  }
  console.log();

  // 测试 4: 摘要 API
  console.log("4️⃣  测试摘要 API (GET /api/admin/ai/summary)...");
  const summaryResult = await testApiRoute(`${BASE_URL}/api/admin/ai/summary`);
  results.push({
    name: "摘要 API (GET)",
    ok: summaryResult.ok,
    status: summaryResult.status,
    error: summaryResult.error,
  });
  
  if (summaryResult.ok) {
    console.log("   ✅ 成功");
  } else {
    console.log(`   ❌ 失败: ${summaryResult.error || `HTTP ${summaryResult.status}`}`);
    if (summaryResult.status === 502) {
      console.log("   💡 提示: 这可能是 AI_SERVICE_URL 或 AI_SERVICE_TOKEN 未配置导致的");
    }
  }
  console.log();

  // 测试 5: 摘要重建 API
  console.log("5️⃣  测试摘要重建 API (POST /api/admin/ai/summary/rebuild)...");
  const rebuildResult = await testApiRoute(`${BASE_URL}/api/admin/ai/summary/rebuild?date=2025-11-03`, "POST");
  results.push({
    name: "摘要重建 API (POST)",
    ok: rebuildResult.ok || rebuildResult.status === 502, // 502 可能是服务未配置，但路由存在
    status: rebuildResult.status,
    error: rebuildResult.error,
  });
  
  if (rebuildResult.ok) {
    console.log("   ✅ 成功");
  } else if (rebuildResult.status === 404) {
    console.log("   ❌ 路由不存在 (404)");
  } else if (rebuildResult.status === 502) {
    console.log("   ⚠️  路由存在，但 AI Service 未配置或不可用");
    console.log("   💡 提示: 检查 AI_SERVICE_URL 和 AI_SERVICE_TOKEN 环境变量");
  } else {
    console.log(`   ❌ 失败: ${rebuildResult.error || `HTTP ${rebuildResult.status}`}`);
  }
  console.log();

  // 测试 6: 缓存预热 API
  console.log("6️⃣  测试缓存预热 API (POST /api/admin/ai/cache/prewarm)...");
  const prewarmResult = await testApiRoute(`${BASE_URL}/api/admin/ai/cache/prewarm`, "POST");
  results.push({
    name: "缓存预热 API (POST)",
    ok: prewarmResult.ok || prewarmResult.status === 502, // 502 可能是服务未配置，但路由存在
    status: prewarmResult.status,
    error: prewarmResult.error,
  });
  
  if (prewarmResult.ok) {
    console.log("   ✅ 成功");
  } else if (prewarmResult.status === 404) {
    console.log("   ❌ 路由不存在 (404)");
  } else if (prewarmResult.status === 502) {
    console.log("   ⚠️  路由存在，但 AI Service 未配置或不可用");
    console.log("   💡 提示: 检查 AI_SERVICE_URL 和 AI_SERVICE_TOKEN 环境变量");
  } else {
    console.log(`   ❌ 失败: ${prewarmResult.error || `HTTP ${prewarmResult.status}`}`);
  }
  console.log();

  // 总结
  console.log("=".repeat(60));
  console.log("📊 测试结果总结");
  console.log("=".repeat(60));
  console.log();

  const successCount = results.filter((r) => r.ok).length;
  const totalCount = results.length;

  results.forEach((result) => {
    const status = result.ok ? "✅" : "❌";
    console.log(`${status} ${result.name}: ${result.ok ? "通过" : `失败 (${result.status})`}`);
    if (result.error && !result.ok) {
      console.log(`   ${result.error}`);
    }
  });

  console.log();
  console.log(`总计: ${successCount}/${totalCount} 通过`);

  if (successCount === totalCount) {
    console.log();
    console.log("🎉 所有 API 路由测试通过！");
    process.exit(0);
  } else {
    console.log();
    console.log("⚠️  部分 API 路由测试失败，请检查上述错误信息");
    console.log();
    console.log("💡 提示:");
    console.log("   - 如果配置 API 失败，检查 AI_DATABASE_URL 环境变量");
    console.log("   - 如果日志 API 失败，检查 AI_DATABASE_URL 环境变量");
    console.log("   - 如果摘要/重建/预热 API 失败，检查 AI_SERVICE_URL 和 AI_SERVICE_TOKEN");
    process.exit(1);
  }
}

// 运行测试
testAiApiRoutes().catch((error) => {
  console.error("❌ 测试脚本执行失败:");
  console.error(error);
  process.exit(1);
});

