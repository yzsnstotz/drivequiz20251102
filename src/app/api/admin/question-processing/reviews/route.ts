import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { internalError, success } from "@/app/api/_lib/errors";

function getProcessorUrl(): string {
  const url = process.env.QUESTION_PROCESSOR_URL || `http://127.0.0.1:${process.env.QUESTION_PROCESSOR_PORT || 8083}`;
  return url.replace(/\/+$/, "");
}

export const GET = withAdminAuth(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") || "";
    const upstream = await fetch(`${getProcessorUrl()}/reviews${status ? `?status=${encodeURIComponent(status)}` : ""}`);
    const text = await upstream.text();
    let json: any;
    try { json = JSON.parse(text); } catch { return internalError("Processor non-JSON"); }
    if (!upstream.ok || !json?.ok) {
      return internalError(json?.message || `Processor error: ${upstream.status}`);
    }
    return success(json.data);
  } catch {
    return internalError("List reviews failed");
  }
});


