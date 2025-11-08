#!/usr/bin/env node
/**
 * 检查 OpenRouter 配置脚本
 * 用于验证 OpenRouter 环境变量是否正确设置
 */

import dotenv from "dotenv";
import { resolve } from "path";

// 加载环境变量
const envPath = resolve(__dirname, "../.env");
const envLocalPath = resolve(__dirname, "../.env.local");

dotenv.config({ path: envLocalPath });
dotenv.config({ path: envPath });

console.log("🔍 检查 OpenRouter 配置...\n");

// 检查必需的环境变量
const checks = [
  {
    name: "OPENROUTER_API_KEY",
    value: process.env.OPENROUTER_API_KEY,
    required: false, // 如果使用 OpenRouter，这个才需要
    description: "OpenRouter API Key",
  },
  {
    name: "OPENAI_API_KEY",
    value: process.env.OPENAI_API_KEY,
    required: true,
    description: "OpenAI API Key (fallback)",
  },
  {
    name: "OPENAI_BASE_URL",
    value: process.env.OPENAI_BASE_URL,
    required: false,
    description: "OpenAI Base URL (should be https://openrouter.ai/api/v1 for OpenRouter)",
  },
  {
    name: "OPENROUTER_REFERER_URL",
    value: process.env.OPENROUTER_REFERER_URL,
    required: false,
    description: "OpenRouter Referer URL (optional)",
  },
  {
    name: "OPENROUTER_APP_NAME",
    value: process.env.OPENROUTER_APP_NAME,
    required: false,
    description: "OpenRouter App Name (optional)",
  },
];

let hasErrors = false;
const isOpenRouter = process.env.OPENAI_BASE_URL?.includes("openrouter.ai");

console.log(`📋 配置检查结果:\n`);
console.log(`是否使用 OpenRouter: ${isOpenRouter ? "✅ 是" : "❌ 否"}\n`);

if (isOpenRouter) {
  console.log("⚠️  检测到使用 OpenRouter，将检查 OpenRouter 相关配置\n");
}

for (const check of checks) {
  const isRequired = check.required || (isOpenRouter && check.name === "OPENROUTER_API_KEY");
  const hasValue = !!check.value;
  const isValid = isRequired ? hasValue : true;

  if (!isValid) {
    hasErrors = true;
    console.log(`❌ ${check.name}: 未设置 (${isRequired ? "必需" : "可选"})`);
    console.log(`   描述: ${check.description}`);
  } else if (hasValue) {
    const displayValue = check.name.includes("KEY") 
      ? `${check.value.substring(0, 10)}...${check.value.substring(check.value.length - 4)}`
      : check.value;
    console.log(`✅ ${check.name}: ${displayValue}`);
  } else {
    console.log(`⚪ ${check.name}: 未设置 (可选)`);
  }
}

console.log("\n");

// 检查 OpenRouter 配置逻辑
if (isOpenRouter) {
  console.log("🔍 OpenRouter 配置检查:\n");

  if (!process.env.OPENROUTER_API_KEY && !process.env.OPENAI_API_KEY) {
    console.log("❌ 错误: 使用 OpenRouter 时，必须设置 OPENROUTER_API_KEY 或 OPENAI_API_KEY");
    hasErrors = true;
  } else if (process.env.OPENROUTER_API_KEY) {
    console.log("✅ 使用 OPENROUTER_API_KEY");
  } else {
    console.log("⚠️  未设置 OPENROUTER_API_KEY，将使用 OPENAI_API_KEY");
  }

  if (process.env.OPENAI_BASE_URL !== "https://openrouter.ai/api/v1") {
    console.log(`⚠️  OPENAI_BASE_URL 设置为: ${process.env.OPENAI_BASE_URL}`);
    console.log(`   建议设置为: https://openrouter.ai/api/v1`);
  } else {
    console.log("✅ OPENAI_BASE_URL 正确设置为 OpenRouter");
  }
}

console.log("\n");

// 测试 API Key（如果设置了）
if (isOpenRouter && process.env.OPENROUTER_API_KEY) {
  console.log("🧪 测试 OpenRouter API Key...\n");
  
  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ API Key 有效`);
      console.log(`   可用模型数量: ${data.data?.length || 0}`);
    } else {
      const errorText = await response.text();
      console.log(`❌ API Key 验证失败: ${response.status} ${response.statusText}`);
      console.log(`   错误信息: ${errorText}`);
      hasErrors = true;
    }
  } catch (error) {
    console.log(`❌ 无法连接到 OpenRouter API: ${(error as Error).message}`);
    hasErrors = true;
  }
}

console.log("\n");

if (hasErrors) {
  console.log("❌ 配置检查失败，请修复上述问题");
  process.exit(1);
} else {
  console.log("✅ 配置检查通过");
  process.exit(0);
}

