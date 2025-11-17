import "server-only";
import { NextRequest, NextResponse } from "next/server";

/**
 * @deprecated 此路由已废弃
 * AI 调用现在由前端直接调用 ai-service，不再经过 Next.js
 * 保留此路由仅为向后兼容，返回错误提示
 * 指令版本：0002
 */
export async function POST(req: NextRequest) {
  console.warn("[api/ai/ask] Deprecated route was called. It should no longer be used.");
  
  return NextResponse.json(
    {
      ok: false,
      errorCode: "DEPRECATED_ROUTE",
      message:
        "AI API 已升级，当前端应直接调用 ai-service（callAiDirect），/api/ai/ask 已废弃。",
    },
    { status: 410 } // 410 Gone
  );
}
