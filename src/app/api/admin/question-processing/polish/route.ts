import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { badRequest, internalError, success } from "@/app/api/_lib/errors";
import { getProcessorUrl } from "../_lib/getProcessorUrl";

export const POST = withAdminAuth(async (req: Request) => {
  const requestId = `api-polish-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  try {
    console.log(`[API Polish] [${requestId}] Request received`);
    const body = await req.json().catch(() => ({}));
    const { questionId, contentHash, locale } = body || {};
    console.log(`[API Polish] [${requestId}] Body:`, { questionId, contentHash, locale });
    
    if ((!questionId && !contentHash) || !locale) {
      console.error(`[API Polish] [${requestId}] Missing required fields`);
      return badRequest("questionId/contentHash and locale are required");
    }
    
    const processorUrl = getProcessorUrl();
    console.log(`[API Polish] [${requestId}] Calling processor: ${processorUrl}/polish`);
    
    const upstream = await fetch(`${processorUrl}/polish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ questionId, contentHash, locale })
    });
    
    console.log(`[API Polish] [${requestId}] Processor response status: ${upstream.status}`);
    const text = await upstream.text();
    console.log(`[API Polish] [${requestId}] Processor response text length: ${text.length}`);
    
    let json: any;
    try { 
      json = JSON.parse(text); 
      console.log(`[API Polish] [${requestId}] Processor response parsed successfully`);
    } catch (e) {
      console.error(`[API Polish] [${requestId}] Failed to parse JSON:`, text.substring(0, 200));
      return internalError(`Processor returned invalid JSON: ${text.substring(0, 200)}`);
    }
    
    if (!upstream.ok || !json?.ok) {
      console.error(`[API Polish] [${requestId}] Processor error:`, json?.message || upstream.status);
      return internalError(json?.message || `Processor error: ${upstream.status}`);
    }
    
    console.log(`[API Polish] [${requestId}] Request completed successfully`);
    return success(json.data || { ok: true });
  } catch (e: any) {
    console.error(`[API Polish] [${requestId}] Error:`, e?.message, e?.stack);
    return internalError(e?.message || "Polish failed");
  }
});


