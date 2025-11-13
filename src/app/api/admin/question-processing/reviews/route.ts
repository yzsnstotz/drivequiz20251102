import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { internalError, success } from "@/app/api/_lib/errors";
import { getProcessorUrl } from "../_lib/getProcessorUrl";

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


