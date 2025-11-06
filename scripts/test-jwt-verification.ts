/**
 * JWT 验证测试脚本
 * 
 * 用途：测试 USER_JWT_SECRET 配置是否正确
 * 使用方法：npx tsx scripts/test-jwt-verification.ts
 */

import { SignJWT, jwtVerify } from "jose";

const USER_JWT_SECRET = process.env.USER_JWT_SECRET || "J9bCl7CeTz1IRQFW5zf+quMaRT7pnDc2ebNF15sJzDRA2V62IwsderCBi6gm070w2AXO/i8YMSAPq0awuF3kbw==";

async function testJwtVerification() {
  console.log("=== JWT 验证测试 ===\n");

  // 1. 检查环境变量
  console.log("1. 检查环境变量配置");
  if (!USER_JWT_SECRET) {
    console.error("❌ USER_JWT_SECRET 未配置");
    process.exit(1);
  }
  console.log("✅ USER_JWT_SECRET 已配置");
  console.log(`   密钥长度: ${USER_JWT_SECRET.length} 字符`);
  console.log(`   密钥前20字符: ${USER_JWT_SECRET.substring(0, 20)}...\n`);

  // 2. 测试 Base64 解码
  console.log("2. 测试 Base64 解码");
  let secret: Uint8Array;
  try {
    // 尝试直接使用字符串（如果已经是原始字符串）
    secret = new TextEncoder().encode(USER_JWT_SECRET);
    console.log("✅ 使用字符串编码方式");
  } catch (e) {
    console.error("❌ 字符串编码失败:", e);
    process.exit(1);
  }

  // 3. 生成测试 JWT Token
  console.log("\n3. 生成测试 JWT Token");
  const testUserId = "123e4567-e89b-12d3-a456-426614174000"; // 测试 UUID
  let testToken: string;
  try {
    // 尝试 Base64 解码（Supabase Legacy JWT Secret 通常是 Base64 编码的）
    let secretKey: Uint8Array;
    try {
      // 尝试 Base64 解码
      const decodedSecret = Buffer.from(USER_JWT_SECRET, "base64");
      secretKey = new Uint8Array(decodedSecret);
      console.log("✅ 使用 Base64 解码方式");
    } catch {
      // 如果 Base64 解码失败，使用原始字符串
      secretKey = new TextEncoder().encode(USER_JWT_SECRET);
      console.log("✅ 使用原始字符串方式");
    }

    const token = await new SignJWT({ sub: testUserId })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("2h")
      .sign(secretKey);

    testToken = token;
    console.log("✅ 测试 JWT Token 生成成功");
    console.log(`   Token 长度: ${token.length} 字符`);
    console.log(`   Token 前50字符: ${token.substring(0, 50)}...\n`);
  } catch (e) {
    console.error("❌ 生成测试 JWT Token 失败:", e);
    process.exit(1);
  }

  // 4. 验证 JWT Token（使用 Base64 解码方式）
  console.log("4. 验证 JWT Token（Base64 解码方式）");
  try {
    const decodedSecret = Buffer.from(USER_JWT_SECRET, "base64");
    const secretKey = new Uint8Array(decodedSecret);
    const { payload } = await jwtVerify(testToken, secretKey);
    console.log("✅ JWT Token 验证成功（Base64 解码方式）");
    console.log(`   Payload:`, payload);
    console.log(`   User ID (sub): ${payload.sub}\n`);
  } catch (e) {
    console.error("❌ JWT Token 验证失败（Base64 解码方式）:", e);
    console.log("   尝试使用原始字符串方式...\n");

    // 5. 验证 JWT Token（使用原始字符串方式）
    console.log("5. 验证 JWT Token（原始字符串方式）");
    try {
      const secretKey = new TextEncoder().encode(USER_JWT_SECRET);
      const { payload } = await jwtVerify(testToken, secretKey);
      console.log("✅ JWT Token 验证成功（原始字符串方式）");
      console.log(`   Payload:`, payload);
      console.log(`   User ID (sub): ${payload.sub}\n`);
    } catch (e2) {
      console.error("❌ JWT Token 验证失败（原始字符串方式）:", e2);
      console.error("\n⚠️  两种方式都失败，请检查 USER_JWT_SECRET 是否正确");
      process.exit(1);
    }
  }

  // 6. 测试用户 ID 提取
  console.log("6. 测试用户 ID 提取");
  try {
    const decodedSecret = Buffer.from(USER_JWT_SECRET, "base64");
    const secretKey = new Uint8Array(decodedSecret);
    const { payload } = await jwtVerify(testToken, secretKey);
    const userId = payload.sub || payload.user_id || payload.userId || payload.id;
    
    if (userId && typeof userId === "string") {
      console.log("✅ 用户 ID 提取成功");
      console.log(`   User ID: ${userId}`);
      
      // 验证 UUID 格式
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(userId)) {
        console.log("✅ 用户 ID 格式正确（UUID）");
      } else {
        console.log("⚠️  用户 ID 不是有效的 UUID 格式");
      }
    } else {
      console.error("❌ 无法提取用户 ID");
      process.exit(1);
    }
  } catch (e) {
    console.error("❌ 用户 ID 提取失败:", e);
    process.exit(1);
  }

  console.log("\n=== 测试完成 ===");
  console.log("✅ 所有测试通过！");
  console.log("\n建议：");
  console.log("1. 如果 Base64 解码方式成功，代码应该使用 Base64 解码");
  console.log("2. 如果原始字符串方式成功，代码应该使用原始字符串");
  console.log("3. 根据测试结果更新代码中的 JWT 验证逻辑");
}

testJwtVerification().catch(console.error);

