import "server-only";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PostResp = { ok: boolean; data?: { docId: string; chunks: number }; message?: string };

async function uploadDoc(formData: FormData): Promise<void> {
  "use server";
  const base = process.env.NEXT_PUBLIC_APP_BASE_URL ?? "";
  const payload = {
    title: String(formData.get("title") || ""),
    url: String(formData.get("url") || ""),
    content: String(formData.get("content") || ""),
    version: String(formData.get("version") || "unversioned"),
  };
  const res = await fetch(`${base}/api/admin/ai/rag/docs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  await res.json();
}

export default function AdminAiRagPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">AI 知识库 · 上传文档</h1>
      <form action={uploadDoc} className="space-y-3 max-w-3xl">
        <div>
          <label className="block text-sm font-medium mb-1">标题</label>
          <input name="title" className="w-full border rounded p-2" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">来源 URL（可选）</label>
          <input name="url" className="w-full border rounded p-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">版本标签</label>
          <input name="version" className="w-full border rounded p-2" placeholder="2025Q4" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">正文内容</label>
          <textarea name="content" className="w-full border rounded p-2 h-48" required />
        </div>
        <button className="px-3 py-2 rounded bg-black text-white text-sm">提交向量化</button>
      </form>
    </div>
  );
}
