import { NextRequest, NextResponse } from "next/server";
import { insertAiLog, aiDbDebugTag } from "@/lib/aiDb";
import { resolveUserIdForLogs } from "@/app/api/ai/_lib/logUserIdResolver";

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
    // 调试：打印请求携带的 Cookie（用于排查 userId 解析为空的问题）
    console.debug("[AI_DEBUG][cookie]", req.headers.get("cookie"));

    let body: LogRequestBody;
    try {
      body = (await req.json()) as LogRequestBody;
    } catch (err) {
      console.error("[AI_ERROR][log] Failed to parse JSON body:", err);
      return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
    }
    const { question, answer = "", from } = body;

    if (!question || typeof question !== "string") {
      return NextResponse.json(
        {
          ok: false,
          errorCode: "INVALID_PAYLOAD",
          message: "question、from 为必填字段，answer 允许为空",
        },
        { status: 400 }
      );
    }
    if (!from || typeof from !== "string") {
      return NextResponse.json(
        {
          ok: false,
          errorCode: "INVALID_PAYLOAD",
          message: "from 必须为非空字符串",
        },
        { status: 400 }
      );
    }

    let userId: string | null = null;
    try {
      userId = await resolveUserIdForLogs(req);
      console.debug("[AI_DEBUG][resolvedUserId]", userId);
    } catch (err) {
      console.error("[AI_ERROR][resolveUserId]", err);
      userId = null; // 降级为匿名，避免 502
    }

    console.log("[/api/ai/log] inserting", {
      dbTag: aiDbDebugTag,
      from,
      userId,
      qSample: String(question).slice(0, 30),
    });
    console.log("[/api/ai/log] debug payload", {
      sources: body.sources,
      ragHits: body.ragHits,
      costEst: body.costEst,
      cached: body.cached,
    });

    const contextTag: string | null = null;
    const insertedId = await insertAiLog({
      userId,
      question: String(question),
      answer: answer != null ? String(answer) : "",
      from: String(from),
      locale: body.locale ?? null,
      model: body.model ?? null,
      ragHits: body.ragHits ?? null,
      safetyFlag: body.safetyFlag ?? "ok",
      costEst: body.costEst ?? null,
      // 路由层简单埋点，JSON 字段统一置 null，避免非法 JSON 触发 500
      sources: null,
      aiProvider: body.aiProvider ?? null,
      cached: body.cached ?? false,
      contextTag,
    });

    console.log("[/api/ai/log] inserted", {
      dbTag: aiDbDebugTag,
      insertedId,
    });

    return NextResponse.json({ ok: true, insertedId, dbTag: aiDbDebugTag });
  } catch (err: any) {
    console.error("[AI_ERROR][log-route]", err);
    return NextResponse.json(
      { success: false, error: "AI service unavailable", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
