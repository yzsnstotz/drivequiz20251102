import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { badRequest, internalError, success } from "@/app/api/_lib/errors";

function getProcessorUrl(): string {
  const url = process.env.QUESTION_PROCESSOR_URL || `http://127.0.0.1:${process.env.QUESTION_PROCESSOR_PORT || 8083}`;
  return url.replace(/\/+$/, "");
}

export const POST = withAdminAuth(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    if (!id) return badRequest("Missing id");
    const upstream = await fetch(`${getProcessorUrl()}/reviews/${encodeURIComponent(id)}/approve`, { method: "POST" });
    const text = await upstream.text();
    let json: any;
    try { json = JSON.parse(text); } catch { return internalError("Processor non-JSON"); }
    if (!upstream.ok || !json?.ok) {
      return internalError(json?.message || `Processor error: ${upstream.status}`);
    }
    return success({ ok: true });
  } catch {
    return internalError("Approve failed");
  }
});


