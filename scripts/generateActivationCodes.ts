import * as crypto from "crypto";
import { db } from "../src/lib/db"; // 使用Kysely实例

// 定义安全字符集（排除容易混淆的字符0, O, I, l等）
const SAFE_CHARS = "123456789ABCDEFGHJKMNPQRSTUVWXYZ";

/**
 * 生成安全的激活码
 * @param length 激活码长度
 * @returns 生成的激活码
 */
function generateSecureCode(length: number = 6): string {
  let result = "";
  const chars = SAFE_CHARS;
  const charsLength = chars.length;

  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(0, charsLength);
    result += chars[randomIndex];
  }

  return result;
}

/**
 * 生成指定数量的唯一激活码
 * @param count 需要生成的激活码数量
 * @param length 每个激活码的长度
 * @returns 唯一的激活码数组
 */
function generateUniqueCodes(count: number, length: number = 6): string[] {
  const codes = new Set<string>();

  while (codes.size < count) {
    const code = generateSecureCode(length);
    codes.add(code);
  }

  return Array.from(codes);
}

/**
 * 插入激活码到数据库 (使用Kysely)
 * @param codes 激活码数组
 */
async function insertActivationCodes(codes: string[]) {
  try {
    // Kysely 会自动处理批量插入
    await db
      .insertInto("activation_codes")
      .values(
        codes.map((code) => ({
          code: code,
          is_used: false,
          usage_limit: 1,
          used_count: 0,
          status: "disabled" as const, // 默认状态为 disabled
        })),
      )
      .onConflict((oc) => oc.column("code").doNothing()) // 处理唯一键冲突
      .execute();

    console.log(`Successfully processed ${codes.length} activation codes`);
  } catch (error) {
    console.error("Error inserting activation codes:", error);
    throw error;
  }
}

/**
 * 主函数
 */
async function main() {
  try {

    // 生成10000个唯一激活码
    console.log("Generating 10,000 activation codes...");
    const codes = generateUniqueCodes(10000, 6);
    console.log("Generated codes:", codes.length);

    // 插入数据库
    await insertActivationCodes(codes);

    console.log("All done! Generated and inserted 10,000 activation codes.");
  } catch (error) {
    console.error("Error in main process:", error);
  } finally {
    // 销毁数据库连接池
    await db.destroy();
  }
}

// 运行主函数
main();
