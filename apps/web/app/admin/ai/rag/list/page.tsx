"use client";

import { useState, useEffect } from "react";

type DocItem = {
  id: number;
  title: string;
  url?: string;
  lang?: string;
  tags?: string[];
  status?: string;
  version?: string;
  chunks: number;
  createdAt?: string;
  updatedAt?: string;
};

type ListResp = {
  ok: boolean;
  data?: { items?: DocItem[] };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasPrev: boolean;
    hasNext: boolean;
  };
  message?: string;
};

function getBaseUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_APP_BASE_URL ?? "";
}

function getAuthToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("ADMIN_TOKEN") || localStorage.getItem("adminToken");
  }
  return null;
}

async function fetchDocs(params: {
  page?: number;
  limit?: number;
  q?: string;
  version?: string;
  lang?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: string;
}): Promise<ListResp> {
  const base = getBaseUrl();
  const token = getAuthToken();
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set("page", String(params.page));
  if (params.limit) searchParams.set("limit", String(params.limit));
  if (params.q) searchParams.set("q", params.q);
  if (params.version) searchParams.set("version", params.version);
  if (params.lang) searchParams.set("lang", params.lang);
  if (params.status) searchParams.set("status", params.status);
  if (params.sortBy) searchParams.set("sortBy", params.sortBy);
  if (params.sortOrder) searchParams.set("sortOrder", params.sortOrder);

  const url = `${base}/api/admin/ai/rag/docs?${searchParams.toString()}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return res.json();
}

async function updateStatus(docId: number, status: "active" | "disabled"): Promise<{ ok: boolean; message?: string }> {
  const base = getBaseUrl();
  const token = getAuthToken();
  const res = await fetch(`${base}/api/admin/ai/rag/docs/${docId}/status`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ status }),
  });
  return res.json();
}

async function reindex(docId: number): Promise<{ ok: boolean; message?: string }> {
  const base = getBaseUrl();
  const token = getAuthToken();
  const res = await fetch(`${base}/api/admin/ai/rag/docs/${docId}/reindex`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  return res.json();
}

export default function AdminAiRagListPage() {
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [hasPrev, setHasPrev] = useState(false);
  const [hasNext, setHasNext] = useState(false);

  // 筛选条件
  const [searchQ, setSearchQ] = useState("");
  const [filterVersion, setFilterVersion] = useState("");
  const [filterLang, setFilterLang] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sortBy, setSortBy] = useState("updatedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // 操作状态
  const [reindexingDocId, setReindexingDocId] = useState<number | null>(null);
  const [showReindexConfirm, setShowReindexConfirm] = useState<number | null>(null);

  useEffect(() => {
    loadDocs();
  }, [page, searchQ, filterVersion, filterLang, filterStatus, sortBy, sortOrder]);

  const loadDocs = async () => {
    setLoading(true);
    try {
      const resp = await fetchDocs({
        page,
        limit,
        q: searchQ || undefined,
        version: filterVersion || undefined,
        lang: filterLang || undefined,
        status: filterStatus || undefined,
        sortBy,
        sortOrder,
      });
      if (resp.ok && resp.data?.items) {
        setDocs(resp.data.items);
        if (resp.pagination) {
          setTotal(resp.pagination.total);
          setTotalPages(resp.pagination.totalPages);
          setHasPrev(resp.pagination.hasPrev);
          setHasNext(resp.pagination.hasNext);
        }
      }
    } catch (err) {
      console.error("Failed to load docs:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusToggle = async (docId: number, currentStatus?: string) => {
    const newStatus = currentStatus === "active" ? "disabled" : "active";
    try {
      const resp = await updateStatus(docId, newStatus);
      if (resp.ok) {
        await loadDocs();
      } else {
        alert(resp.message || "状态更新失败");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "状态更新失败");
    }
  };

  const handleReindex = async (docId: number) => {
    setReindexingDocId(docId);
    try {
      const resp = await reindex(docId);
      if (resp.ok) {
        alert("重建向量任务已触发");
        await loadDocs();
      } else {
        alert(resp.message || "重建向量失败");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "重建向量失败");
    } finally {
      setReindexingDocId(null);
      setShowReindexConfirm(null);
    }
  };

  const handleRollback = async (docId: number) => {
    // 找到当前文档
    const currentDoc = docs.find((d) => d.id === docId);
    if (!currentDoc) return;

    // 找到同一标题的其他版本
    const sameTitleDocs = docs.filter((d) => d.title === currentDoc.title && d.id !== docId);
    if (sameTitleDocs.length === 0) {
      alert("未找到其他版本");
      return;
    }

    // 将当前版本设为 active，其他版本设为 disabled
    try {
      await updateStatus(docId, "active");
      for (const doc of sameTitleDocs) {
        if (doc.status === "active") {
          await updateStatus(doc.id, "disabled");
        }
      }
      alert("回滚成功");
      await loadDocs();
    } catch (err) {
      alert(err instanceof Error ? err.message : "回滚失败");
    }
  };

  const getStatusBadge = (status?: string) => {
    if (status === "active") {
      return <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-700">生效</span>;
    }
    if (status === "disabled") {
      return <span className="px-2 py-1 rounded text-xs bg-red-100 text-red-700">停用</span>;
    }
    return <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-700">未知</span>;
  };

  // 获取所有唯一的版本号
  const allVersions = Array.from(new Set(docs.map((d) => d.version).filter(Boolean) as string[]));

  // 获取所有唯一的语言
  const allLangs = Array.from(new Set(docs.map((d) => d.lang).filter(Boolean) as string[]));

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">AI 知识库 · 文档列表</h1>
      </div>

      {/* 搜索和筛选 */}
      <div className="border rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">搜索</label>
            <input
              type="text"
              value={searchQ}
              onChange={(e) => {
                setSearchQ(e.target.value);
                setPage(1);
              }}
              placeholder="标题或URL"
              className="w-full border rounded px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">版本</label>
            <select
              value={filterVersion}
              onChange={(e) => {
                setFilterVersion(e.target.value);
                setPage(1);
              }}
              className="w-full border rounded px-2 py-1 text-sm"
            >
              <option value="">全部</option>
              {allVersions.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">语言</label>
            <select
              value={filterLang}
              onChange={(e) => {
                setFilterLang(e.target.value);
                setPage(1);
              }}
              className="w-full border rounded px-2 py-1 text-sm"
            >
              <option value="">全部</option>
              {allLangs.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">状态</label>
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setPage(1);
              }}
              className="w-full border rounded px-2 py-1 text-sm"
            >
              <option value="">全部</option>
              <option value="active">生效</option>
              <option value="disabled">停用</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-600">排序:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="border rounded px-2 py-1 text-xs"
          >
            <option value="updatedAt">更新时间</option>
            <option value="createdAt">创建时间</option>
            <option value="title">标题</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            className="px-2 py-1 border rounded text-xs"
          >
            {sortOrder === "asc" ? "↑" : "↓"}
          </button>
        </div>
      </div>

      {/* 文档列表 */}
      <div className="border rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">加载中...</div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">标题</th>
                  <th className="px-4 py-2 text-left">URL</th>
                  <th className="px-4 py-2 text-left">版本</th>
                  <th className="px-4 py-2 text-left">语言</th>
                  <th className="px-4 py-2 text-left">状态</th>
                  <th className="px-4 py-2 text-left">分片数</th>
                  <th className="px-4 py-2 text-left">更新时间</th>
                  <th className="px-4 py-2 text-left">操作</th>
                </tr>
              </thead>
              <tbody>
                {docs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      暂无文档
                    </td>
                  </tr>
                ) : (
                  docs.map((doc) => (
                    <tr key={doc.id} className="border-t">
                      <td className="px-4 py-2">{doc.title}</td>
                      <td className="px-4 py-2">
                        {doc.url ? (
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline text-xs max-w-xs truncate block"
                          >
                            {doc.url}
                          </a>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs">{doc.version || "-"}</td>
                      <td className="px-4 py-2 text-xs">{doc.lang || "-"}</td>
                      <td className="px-4 py-2">{getStatusBadge(doc.status)}</td>
                      <td className="px-4 py-2 text-xs">{doc.chunks}</td>
                      <td className="px-4 py-2 text-xs">
                        {doc.updatedAt ? new Date(doc.updatedAt).toLocaleString() : "-"}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleStatusToggle(doc.id, doc.status)}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            {doc.status === "active" ? "停用" : "启用"}
                          </button>
                          {showReindexConfirm === doc.id ? (
                            <>
                              <button
                                onClick={() => handleReindex(doc.id)}
                                disabled={reindexingDocId === doc.id}
                                className="text-xs text-red-600 hover:underline"
                              >
                                {reindexingDocId === doc.id ? "重建中..." : "确认"}
                              </button>
                              <button
                                onClick={() => setShowReindexConfirm(null)}
                                className="text-xs text-gray-600 hover:underline"
                              >
                                取消
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setShowReindexConfirm(doc.id)}
                              className="text-xs text-orange-600 hover:underline"
                            >
                              重建向量
                            </button>
                          )}
                          <button
                            onClick={() => handleRollback(doc.id)}
                            className="text-xs text-purple-600 hover:underline"
                          >
                            回滚
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* 分页 */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  共 {total} 条，第 {page} / {totalPages} 页
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={!hasPrev}
                    className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    上一页
                  </button>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={!hasNext}
                    className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    下一页
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

