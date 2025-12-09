import { NextRequest, NextResponse } from "next/server";
import { insertAiLog } from "@/lib/aiDb";
import { getUserInfo } from "@/app/api/_lib/withUserAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LogRequestBody = {
  userId?: string | null;
  question?: string;
  answer?: string;
  from?: string;
  locale?: string | null;
  model?: string | null;
  ragHits?: number | null;
  safetyFlag?: "ok" | "needs_human" | "blocked";
  costEst?: number | null;
  sources?: unknown;
  aiProvider?: string | null;
  cached?: boolean;
  contextTag?: string | null;
};

export async function POST(req: NextRequest) {
  try {
    const body: LogRequestBody = (await req.json().catch(() => ({}))) as LogRequestBody;
    const { question, answer, from } = body;

    if (!question || !from) {
      return NextResponse.json(
        {
          ok: false,
          errorCode: "INVALID_PAYLOAD",
          message: "question、from 为必填字段，answer 允许为空",
        },
        { status: 400 }
      );
    }

    const userInfo = await getUserInfo(req);
    const userId = body.userId ?? userInfo?.userId ?? null; // 前端不可伪造，但保留 body.userId 兼容旧调用

    await insertAiLog({
      userId,
      question: String(question),
      answer: answer != null ? String(answer) : "",
      from: String(from),
      locale: body.locale ?? null,
      model: body.model ?? null,
      ragHits: body.ragHits ?? null,
      safetyFlag: body.safetyFlag ?? "ok",
      costEst: body.costEst ?? null,
      sources: body.sources ?? null,
      aiProvider: body.aiProvider ?? null,
      cached: body.cached ?? false,
      contextTag: body.contextTag ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[api/ai/log] insertAiLog failed", err);
    return NextResponse.json(
      {
        ok: false,
        errorCode: "INTERNAL_ERROR",
        message: err?.message || "日志写入失败",
      },
      { status: 500 }
    );
  }
}
