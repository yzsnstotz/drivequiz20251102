import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { badRequest, internalError, success } from "@/app/api/_lib/errors";

function getProcessorUrl(): string {
  const url = process.env.QUESTION_PROCESSOR_URL || `http://127.0.0.1:${process.env.QUESTION_PROCESSOR_PORT || 8083}`;
  return url.replace(/\/+$/, "");
}

export const POST = withAdminAuth(async (req: Request) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { questionId, contentHash, locale } = body || {};
    if ((!questionId && !contentHash) || !locale) {
      return badRequest("questionId/contentHash and locale are required");
    }
    const upstream = await fetch(`${getProcessorUrl()}/polish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ questionId, contentHash, locale })
    });
    const text = await upstream.text();
    let json: any;
    try { json = JSON.parse(text); } catch { 
      return internalError(`Processor returned invalid JSON: ${text.substring(0, 200)}`);
    }
    if (!upstream.ok || !json?.ok) {
      return internalError(json?.message || `Processor error: ${upstream.status}`);
    }
    return success(json.data || { ok: true });
  } catch (e: any) {
    return internalError(e?.message || "Polish failed");
  }
});


