"use client";

import { useEffect, useState } from "react";

interface Review {
  id: number;
  content_hash: string;
  locale: string;
  proposed_content: string;
  proposed_options?: string[];
  proposed_explanation?: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem("ADMIN_TOKEN");
  } catch {
    return null;
  }
}

export default function PolishReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected" | "">("pending");

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = getAdminToken();
      const res = await fetch(`/api/admin/question-processing/reviews${statusFilter ? `?status=${statusFilter}` : ""}`, {
        cache: "no-store",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || "加载失败");
      }
      setReviews(json.data || []);
    } catch (e: any) {
      setError(e?.message || "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [statusFilter]);

  const approve = async (id: number) => {
    const token = getAdminToken();
    const res = await fetch(`/api/admin/question-processing/reviews/${id}/approve`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (res.ok) load();
  };

  const reject = async (id: number) => {
    const notes = prompt("请输入驳回原因（可选）") || "";
    const token = getAdminToken();
    const res = await fetch(`/api/admin/question-processing/reviews/${id}/reject`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ notes })
    });
    if (res.ok) load();
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">题目润色审核</h1>

      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm">状态筛选:</label>
        <select
          className="border rounded px-2 py-1"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
        >
          <option value="">全部</option>
          <option value="pending">待审核</option>
          <option value="approved">已通过</option>
          <option value="rejected">已驳回</option>
        </select>
        <button className="ml-2 px-3 py-1 border rounded" onClick={load} disabled={loading}>
          刷新
        </button>
        {loading && <span className="text-sm text-gray-500">加载中...</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>

      <div className="grid gap-4">
        {reviews.map((r) => (
          <div key={r.id} className="border rounded p-4">
            <div className="text-sm text-gray-500">ID: {r.id} · Hash: {r.content_hash.slice(0, 12)}... · 语言: {r.locale} · 状态: {r.status}</div>
            <div className="mt-2">
              <div className="font-semibold">建议的题干：</div>
              <div className="whitespace-pre-wrap">{r.proposed_content}</div>
            </div>
            {r.proposed_options && r.proposed_options.length > 0 && (
              <div className="mt-2">
                <div className="font-semibold">建议的选项：</div>
                <ul className="list-disc pl-6">
                  {r.proposed_options.map((opt, idx) => (
                    <li key={idx}>{opt}</li>
                  ))}
                </ul>
              </div>
            )}
            {r.proposed_explanation && (
              <div className="mt-2">
                <div className="font-semibold">建议的解析：</div>
                <div className="whitespace-pre-wrap">{r.proposed_explanation}</div>
              </div>
            )}
            <div className="mt-4 flex gap-3">
              {r.status === "pending" && (
                <>
                  <button className="px-3 py-1 rounded bg-green-600 text-white" onClick={() => approve(r.id)}>通过</button>
                  <button className="px-3 py-1 rounded bg-red-600 text-white" onClick={() => reject(r.id)}>驳回</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


