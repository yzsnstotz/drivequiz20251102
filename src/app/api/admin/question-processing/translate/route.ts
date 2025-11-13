import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { badRequest, internalError, success } from "@/app/api/_lib/errors";

function getProcessorUrl(): string {
  const url = process.env.QUESTION_PROCESSOR_URL || `http://127.0.0.1:${process.env.QUESTION_PROCESSOR_PORT || 8083}`;
  return url.replace(/\/+$/, "");
}

export const POST = withAdminAuth(async (req: Request) => {
  const requestId = `api-translate-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  try {
    console.log(`[API Translate] [${requestId}] Request received`);
    const body = await req.json().catch(() => ({}));
    const { questionId, contentHash, from, to } = body || {};
    console.log(`[API Translate] [${requestId}] Body:`, { questionId, contentHash, from, to });
    
    if ((!questionId && !contentHash) || !from || !to) {
      console.error(`[API Translate] [${requestId}] Missing required fields`);
      return badRequest("questionId/contentHash, from, to are required");
    }
    
    const processorUrl = getProcessorUrl();
    console.log(`[API Translate] [${requestId}] Calling processor: ${processorUrl}/translate`);
    
    const upstream = await fetch(`${processorUrl}/translate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ questionId, contentHash, from, to })
    });
    
    console.log(`[API Translate] [${requestId}] Processor response status: ${upstream.status}`);
    const text = await upstream.text();
    console.log(`[API Translate] [${requestId}] Processor response text length: ${text.length}`);
    
    let json: any;
    try { 
      json = JSON.parse(text); 
      console.log(`[API Translate] [${requestId}] Processor response parsed successfully`);
    } catch (e) {
      console.error(`[API Translate] [${requestId}] Failed to parse JSON:`, text.substring(0, 200));
      return internalError(`Processor returned invalid JSON: ${text.substring(0, 200)}`);
    }
    
    if (!upstream.ok || !json?.ok) {
      console.error(`[API Translate] [${requestId}] Processor error:`, json?.message || upstream.status);
      return internalError(json?.message || `Processor error: ${upstream.status}`);
    }
    
    console.log(`[API Translate] [${requestId}] Request completed successfully`);
    return success(json.data || { ok: true });
  } catch (e: any) {
    console.error(`[API Translate] [${requestId}] Error:`, e?.message, e?.stack);
    return internalError(e?.message || "Translate failed");
  }
});


