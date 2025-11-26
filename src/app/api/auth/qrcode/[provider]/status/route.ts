import { NextRequest, NextResponse } from "next/server";
import { getQRToken, deleteQRToken } from "../../_lib/qrTokenStore";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    await params; // Next.js 15 requires awaiting params
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { ok: false, message: "Token is required" },
        { status: 400 }
      );
    }

    // 减少日志输出，只在开发环境或错误时输出
    const tokenData = getQRToken(token);

    if (!tokenData) {
      return NextResponse.json({
        ok: true,
        status: "expired",
      });
    }

    const now = Date.now();

    if (now > tokenData.expiresAt) {
      deleteQRToken(token);
      return NextResponse.json({
        ok: true,
        status: "expired",
      });
    }

    // 只在开发环境输出状态日志
    if (process.env.NODE_ENV === "development" && tokenData.status !== "pending") {
      console.log(`[QR Status] Token ${token.substring(0, 8)}... status: ${tokenData.status}`);
    }
    return NextResponse.json({
      ok: true,
      status: tokenData.status,
    });
  } catch (error) {
    console.error("[QR Status] Error:", error);
    return NextResponse.json(
      { ok: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

