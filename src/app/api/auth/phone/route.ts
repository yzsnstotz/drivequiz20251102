import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// 检测是否在构建阶段
const IS_BUILD_TIME =
  typeof process.env.NEXT_PHASE !== "undefined" &&
  process.env.NEXT_PHASE === "phase-production-build";

export async function POST(request: NextRequest) {
  // 构建阶段不做任何 DB 读写，直接返回一个安全的占位响应
  if (IS_BUILD_TIME) {
    return NextResponse.json(
      {
        ok: true,
        buildTimeStub: true,
      },
      { status: 200 }
    );
  }

  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { phone } = body;

    if (!phone || typeof phone !== "string") {
      return NextResponse.json(
        { ok: false, message: "Phone number is required" },
        { status: 400 }
      );
    }

    // 简单的电话号码格式验证（可以根据需要加强）
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    if (!phoneRegex.test(phone) || phone.trim().length < 8) {
      return NextResponse.json(
        { ok: false, message: "Invalid phone number format" },
        { status: 400 }
      );
    }

    // 更新用户电话号码
    // ⚠️ 注意：session.user.id 现在是字符串类型（UUID），不再使用 parseInt
    const userId = session.user.id.toString();
    await db
      .updateTable("users")
      .set({
        phone: phone.trim(),
        updated_at: new Date(),
      })
      .where("id", "=", userId)
      .execute();

    return NextResponse.json({
      ok: true,
      message: "Phone number saved successfully",
    });
  } catch (error) {
    console.error("Phone save error:", error);
    return NextResponse.json(
      { ok: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

