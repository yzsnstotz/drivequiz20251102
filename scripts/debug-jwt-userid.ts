/**
 * JWT UserID 诊断脚本
 * 用途：检查 JWT token 中是否包含有效的用户 ID
 */

// 从 Supabase JWT token 中提取用户 ID（不验证签名）
function extractUserIdFromJwt(token: string): string | null {
  try {
    const [header, payload, signature] = token.split(".");
    if (!header || !payload) {
      console.error("❌ JWT token 格式错误（缺少 header 或 payload）");
      return null;
    }

    // 解码 payload（Base64URL）
    const atobUrlSafe = (str: string) => {
      return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString();
    };

    const json = JSON.parse(atobUrlSafe(payload)) as {
      sub?: string;
      user_id?: string;
      userId?: string;
      id?: string;
      [key: string]: unknown;
    };

    console.log("📋 JWT Payload 内容：");
    console.log(JSON.stringify(json, null, 2));

    // 尝试多种可能的字段名
    const userId = json.sub || json.user_id || json.userId || json.id || null;

    if (!userId || typeof userId !== "string") {
      console.error("❌ JWT payload 中未找到用户 ID 字段（sub, user_id, userId, id）");
      return null;
    }

    console.log(`✅ 找到用户 ID 字段: ${userId}`);

    // 验证是否为有效的 UUID 格式
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      console.warn(`⚠️  用户 ID 不是有效的 UUID 格式: ${userId}`);
      console.warn("   代码会将其视为 null（匿名用户）");
      return null;
    }

    console.log(`✅ 用户 ID 格式有效: ${userId}`);
    return userId;
  } catch (e) {
    console.error("❌ 解析 JWT token 失败:", (e as Error).message);
    return null;
  }
}

// 主函数
async function main() {
  console.log("🔍 JWT UserID 诊断工具\n");

  // 从命令行参数或环境变量获取 JWT token
  const token = process.argv[2] || process.env.USER_TOKEN || null;

  if (!token) {
    console.error("❌ 未提供 JWT token");
    console.log("\n使用方法：");
    console.log("  npm run debug-jwt <token>");
    console.log("  或");
    console.log("  USER_TOKEN=<token> npm run debug-jwt");
    process.exit(1);
  }

  console.log("📝 JWT Token（前20字符）:", token.substring(0, 20) + "...\n");

  const userId = extractUserIdFromJwt(token);

  console.log("\n" + "=".repeat(50));
  if (userId) {
    console.log("✅ 诊断结果：JWT token 包含有效的用户 ID");
    console.log(`   用户 ID: ${userId}`);
  } else {
    console.log("❌ 诊断结果：JWT token 中未找到有效的用户 ID");
    console.log("\n可能的原因：");
    console.log("1. JWT token 的 payload 中没有 sub/user_id/userId/id 字段");
    console.log("2. 用户 ID 不是有效的 UUID 格式");
    console.log("3. JWT token 格式错误");
  }
  console.log("=".repeat(50));
}

main().catch(console.error);
