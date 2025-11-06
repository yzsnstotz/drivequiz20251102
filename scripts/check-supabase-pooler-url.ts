#!/usr/bin/env tsx
/**
 * 检查 Supabase Pooler URL 脚本
 * 
 * 用途：帮助获取正确的 Supabase 连接池（Pooler）连接字符串
 * 
 * 使用方法：
 * npx tsx scripts/check-supabase-pooler-url.ts
 */

console.log("=".repeat(80));
console.log("🔍 Supabase 连接池（Pooler）URL 检查工具");
console.log("=".repeat(80));
console.log();

const PROJECT_ID = "cgpmpfnjzlzbquakmmrj";
const PASSWORD = "zKV0rtIV1QOByu89";

console.log("📋 项目信息:");
console.log(`   项目 ID: ${PROJECT_ID}`);
console.log(`   密码: ${PASSWORD.substring(0, 4)}***`);
console.log();

console.log("📝 可能的 Pooler 连接字符串（根据区域）:");
console.log();

// 常见的 Supabase Pooler 区域
const regions = [
  {
    name: "新加坡 (ap-southeast-1)",
    host: "aws-1-ap-southeast-1.pooler.supabase.com",
    port: 6543,
  },
  {
    name: "日本 (ap-northeast-1)",
    host: "aws-1-ap-northeast-1.pooler.supabase.com",
    port: 6543,
  },
  {
    name: "美国东部 (us-east-1)",
    host: "aws-0-us-east-1.pooler.supabase.com",
    port: 6543,
  },
  {
    name: "美国西部 (us-west-1)",
    host: "aws-0-us-west-1.pooler.supabase.com",
    port: 6543,
  },
  {
    name: "欧洲西部 (eu-west-1)",
    host: "aws-0-eu-west-1.pooler.supabase.com",
    port: 6543,
  },
];

regions.forEach((region, index) => {
  const connectionString = `postgresql://postgres.${PROJECT_ID}:${PASSWORD}@${region.host}:${region.port}/postgres?pgbouncer=true&sslmode=require`;
  
  console.log(`${index + 1}. ${region.name}`);
  console.log(`   ${connectionString}`);
  console.log();
});

console.log("=".repeat(80));
console.log("📌 如何确定正确的 Pooler 地址:");
console.log("=".repeat(80));
console.log();

console.log("1. 登录 Supabase Dashboard: https://app.supabase.com");
console.log("2. 选择项目:", PROJECT_ID);
console.log("3. 进入 Settings → Database");
console.log("4. 找到 'Connection Pooling' 部分");
console.log("5. 选择 'URI' 格式");
console.log("6. 复制 Pooler 连接字符串");
console.log();

console.log("⚠️  重要提示:");
console.log("   - Pooler 用户名格式: postgres.PROJECT_ID");
console.log("   - 必须添加参数: ?pgbouncer=true&sslmode=require");
console.log("   - 端口必须是: 6543");
console.log();

console.log("✅ 在 Vercel 中配置:");
console.log("   1. 进入 Vercel Dashboard → 项目 → Settings → Environment Variables");
console.log("   2. 添加或更新 AI_DATABASE_URL");
console.log("   3. 使用上面复制的 Pooler 连接字符串");
console.log("   4. 保存并重新部署");
console.log();

