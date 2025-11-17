import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { aiDb } from "@/lib/aiDb";
import { mapDbProviderToClientProvider } from "@/lib/aiProviderMapping";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/ai/config
 * 公开接口：获取当前 AI Provider 配置（供前台用户端使用）
 * 不需要管理员认证
 * 指令版本：0003
 */
export async function GET(_req: NextRequest): Promise<NextResponse> {
  try {
    // 从数据库读取 aiProvider 和 model 配置
    const configRows = await (aiDb as any)
      .selectFrom("ai_config")
      .select(["key", "value"])
      .where("key", "in", ["aiProvider", "model"])
      .execute() as Array<{ key: string; value: string }>;

    let aiProvider: string | null = null;
    let model: string | null = null;

    for (const row of configRows) {
      if (row.key === "aiProvider") {
        aiProvider = row.value;
      } else if (row.key === "model") {
        model = row.value;
      }
    }

    // 映射 provider 到前端使用的格式
    const provider = mapDbProviderToClientProvider(aiProvider);

    // 添加调试日志
    console.log("[GET /api/ai/config] 读取配置:", {
      dbProvider: aiProvider,
      mappedProvider: provider,
      model: model || undefined,
    });

    return NextResponse.json({
      ok: true,
      data: {
        provider,
        model: model || undefined,
      },
    });
  } catch (error) {
    console.error("[GET /api/ai/config] Error:", error);
    // 返回默认值，确保前台可以正常工作
    return NextResponse.json({
      ok: true,
      data: {
        provider: "render",
        model: "gpt-4o-mini",
      },
    });
  }
}

