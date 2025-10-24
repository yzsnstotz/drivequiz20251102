import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../lib/db"; // 导入Kysely实例

export async function POST(request: NextRequest) {
  try {
    const { email, activationCode, userAgent } = await request.json();

    // 验证必要字段
    if (!email || !activationCode) {
      return NextResponse.json(
        { success: false, message: "邮箱和激活码不能为空" },
        { status: 400 },
      );
    }

    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";

    // 使用Kysely事务来确保操作的原子性
    const result = await db.transaction().execute(async (trx) => {
      // 1. 查找激活码
      const code = await trx
        .selectFrom("activation_codes")
        .select(["id", "usage_limit", "used_count"])
        .where("code", "=", activationCode)
        .where("is_used", "=", false) // 仅查找未被完全使用的码
        .executeTakeFirst();

      if (!code) {
        return {
          success: false,
          message: "无效的激活码或激活码已被使用",
          status: 401,
        };
      }

      // 2. 检查使用限制
      if (code.used_count >= code.usage_limit) {
        // 理论上这个分支不会被命中，因为上面的查询已经包含了 is_used = false
        return {
          success: false,
          message: "激活码已达到使用次数限制",
          status: 401,
        };
      }

      // 3. 更新激活码使用次数
      const newUsedCount = code.used_count + 1;
      const isNowUsed = newUsedCount >= code.usage_limit;

      await trx
        .updateTable("activation_codes")
        .set({
          used_count: newUsedCount,
          is_used: isNowUsed,
          updated_at: new Date(),
        })
        .where("id", "=", code.id)
        .execute();

      // 4. 记录激活信息
      const activationRecord = await trx
        .insertInto("activations")
        .values({
          email,
          activation_code: activationCode,
          ip_address: ipAddress,
          user_agent: userAgent,
          activated_at: new Date(),
        })
        .returning("id")
        .executeTakeFirst();

      if (!activationRecord) {
        // 如果插入失败，事务将回滚
        throw new Error("Failed to record activation.");
      }

      return {
        success: true,
        message: "激活成功",
        status: 200,
        activationId: activationRecord.id,
      };
    });

    return NextResponse.json(
      {
        success: result.success,
        message: result.message,
        activationId: result.activationId,
      },
      { status: result.status },
    );
  } catch (error) {
    console.error("Activation error:", error);
    // 根据错误类型可以返回更具体的信息
    if (
      error instanceof Error &&
      error.message.includes("Failed to record activation")
    ) {
      return NextResponse.json(
        { success: false, message: "无法记录激活信息" },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { success: false, message: "服务器内部错误" },
      { status: 500 },
    );
  }
}
