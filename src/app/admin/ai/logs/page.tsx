"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ApiError, apiGet } from "@/lib/apiClient";

type SourceInfo = {
  title: string;
  url: string;
  snippet?: string;
  score?: number;
  version?: string;
};

type LogItem = {
  id: number;
  userId: string | null;
  question: string;
  answer: string | null;
  locale: string | null;
  model: string | null;
  ragHits: number;
  safetyFlag: "ok" | "needs_human" | "blocked";
  costEstimate: number | null;
  sources: SourceInfo[];
  from: string | null; // "study" | "question" | "chat" 等，标识来源
  aiProvider: string | null; // "openai" | "local" | "openrouter" | "openrouter_direct" | "openai_direct" | "cache"
  cached: boolean | null; // 是否是缓存
  cacheSource: string | null; // "json" | "database"，缓存来源
  createdAt: string;
};

type ListResponse = {
  items: LogItem[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages?: number;
    pages?: number;
    hasPrev?: boolean;
    hasNext?: boolean;
  };
};

type Filters = {
  page: number;
  limit: number;
  from: string;
  to: string;
  userId: string;
  locale: string;
  model: string;
  q: string;
  sortBy: "createdAt" | "ragHits" | "costEstimate";
  sortOrder: "asc" | "desc";
};

const DEFAULT_FILTERS: Filters = {
  page: 1,
  limit: 20,
  from: "",
  to: "",
  userId: "",
  locale: "",
  model: "",
  q: "",
  sortBy: "createdAt",
  sortOrder: "desc",
};

export default function AdminAiLogsPage() {
  const search = useSearchParams();

  const [filters, setFilters] = useState<Filters>(() => {
    const q = (k: string, d = "") => (search?.get(k) ?? d);
    const n = (k: string, d: number) => {
      const v = Number(search?.get(k));
      return Number.isFinite(v) && v > 0 ? v : d;
    };
    return {
      page: n("page", DEFAULT_FILTERS.page),
      limit: n("limit", DEFAULT_FILTERS.limit),
      from: q("from", DEFAULT_FILTERS.from),
      to: q("to", DEFAULT_FILTERS.to),
      userId: q("userId", DEFAULT_FILTERS.userId),
      locale: q("locale", DEFAULT_FILTERS.locale),
      model: q("model", DEFAULT_FILTERS.model),
      q: q("q", DEFAULT_FILTERS.q),
      sortBy: (q("sortBy", DEFAULT_FILTERS.sortBy) as Filters["sortBy"]) || "createdAt",
      sortOrder: (q("sortOrder", DEFAULT_FILTERS.sortOrder) as Filters["sortOrder"]) || "desc",
    };
  });

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<LogItem[]>([]);
  const [pagination, setPagination] = useState<ListResponse["pagination"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSources, setSelectedSources] = useState<LogItem | null>(null);

  // 同步 filters 到 URL
  useEffect(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v === "" || v === undefined || v === null) return;
      params.set(k, String(v));
    });
    const qs = params.toString();
    const href = qs ? `/admin/ai/logs?${qs}` : `/admin/ai/logs`;
    window.history.replaceState(null, "", href);
  }, [filters]);

  // 拉取列表
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const params: Record<string, any> = {
          page: filters.page,
          limit: filters.limit,
          sortBy: filters.sortBy,
          order: filters.sortOrder,
        };
        if (filters.from) params.from = filters.from;
        if (filters.to) params.to = filters.to;
        if (filters.userId) params.userId = filters.userId;
        if (filters.locale) params.locale = filters.locale;
        if (filters.model) params.model = filters.model;
        if (filters.q) params.q = filters.q;

        const data = await apiGet<ListResponse>("/api/admin/ai/logs", { query: params });
        if (!mounted) return;

        const payload = data as unknown as any;
        const items = (payload.items ?? payload) as LogItem[];
        setItems(items);
        setPagination(payload.pagination || null);
      } catch (e) {
        if (!mounted) return;
        if (e instanceof ApiError) {
          if (e.status === 401) {
            setError("未授权：请先登录管理口令");
          } else {
            setError(`${e.errorCode}: ${e.message}`);
          }
        } else {
          setError(e instanceof Error ? e.message : "未知错误");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [filters]);

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters((f) => ({ ...f, page: 1 }));
  };

  const onReset = () => {
    setFilters({ ...DEFAULT_FILTERS });
  };

  const changePage = (page: number) => {
    if (page < 1) return;
    if (pagination) {
      const totalPages = pagination.totalPages || pagination.pages || 1;
      if (page > totalPages) return;
    }
    setFilters((f) => ({ ...f, page }));
  };

  const handleDownloadCSV = () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v === "" || v === undefined || v === null) return;
      if (k === "page" || k === "limit") return; // CSV 不需要分页
      params.set(k, String(v));
    });
    params.set("format", "csv");
    params.set("order", filters.sortOrder);

    const base = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${base}/api/admin/ai/logs?${params.toString()}`;
    const token = typeof window !== "undefined" ? localStorage.getItem("ADMIN_TOKEN") : undefined;

    fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => res.blob())
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ai-logs-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      })
      .catch((err) => {
        console.error("Download CSV failed:", err);
        alert("下载失败：" + (err instanceof Error ? err.message : "unknown error"));
      });
  };

  const fmt = (v?: string | null) =>
    v ? new Date(v).toISOString().replace(".000Z", "Z").slice(0, 19).replace("T", " ") : "—";

  const safetyFlagColors: Record<LogItem["safetyFlag"], string> = {
    ok: "bg-green-100 text-green-800",
    needs_human: "bg-yellow-100 text-yellow-800",
    blocked: "bg-red-100 text-red-800",
  };

  const safetyFlagLabels: Record<LogItem["safetyFlag"], string> = {
    ok: "正常",
    needs_human: "需人工",
    blocked: "已拦截",
  };

  return (
    <div className="space-y-3 sm:space-y-4 p-4">
      {/* 顶部操作区 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0">
        <h1 className="text-xl font-semibold">AI 日志</h1>
        <div className="flex gap-2">
          <button
            onClick={handleDownloadCSV}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
          >
            导出 CSV
          </button>
          <button
            className="rounded-md border border-gray-300 text-sm px-3 py-2 hover:bg-gray-100 active:bg-gray-200"
            onClick={() => setFilters((f) => ({ ...f }))}
          >
            刷新
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded border border-red-200 text-sm">{error}</div>
      )}

      {/* 筛选表单 */}
      <form onSubmit={onSearchSubmit} className="border rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">开始日期</label>
            <input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value, page: 1 }))}
              className="w-full border rounded px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">结束日期</label>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value, page: 1 }))}
              className="w-full border rounded px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">用户ID</label>
            <input
              type="text"
              value={filters.userId}
              onChange={(e) => setFilters((f) => ({ ...f, userId: e.target.value, page: 1 }))}
              placeholder="UUID"
              className="w-full border rounded px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">语言</label>
            <input
              type="text"
              value={filters.locale}
              onChange={(e) => setFilters((f) => ({ ...f, locale: e.target.value, page: 1 }))}
              placeholder="ja, zh, en"
              className="w-full border rounded px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">模型</label>
            <input
              type="text"
              value={filters.model}
              onChange={(e) => setFilters((f) => ({ ...f, model: e.target.value, page: 1 }))}
              placeholder="gpt-4o-mini"
              className="w-full border rounded px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">搜索关键词</label>
            <input
              type="text"
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value, page: 1 }))}
              placeholder="问题/回答"
              className="w-full border rounded px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">排序字段</label>
            <select
              value={filters.sortBy}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  sortBy: e.target.value as Filters["sortBy"],
                  page: 1,
                }))
              }
              className="w-full border rounded px-2 py-1 text-sm"
            >
              <option value="createdAt">创建时间</option>
              <option value="ragHits">RAG 命中数</option>
              <option value="costEstimate">成本估算</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">排序方向</label>
            <select
              value={filters.sortOrder}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  sortOrder: e.target.value as "asc" | "desc",
                  page: 1,
                }))
              }
              className="w-full border rounded px-2 py-1 text-sm"
            >
              <option value="desc">降序</option>
              <option value="asc">升序</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="px-4 py-2 bg-black text-white rounded text-sm hover:bg-gray-800"
          >
            搜索
          </button>
          <button
            type="button"
            onClick={onReset}
            className="px-4 py-2 border rounded text-sm hover:bg-gray-100"
          >
            重置
          </button>
        </div>
      </form>

      {/* 列表 */}
      {loading ? (
        <div className="p-8 text-center text-gray-500">加载中...</div>
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">ID</th>
                    <th className="px-4 py-2 text-left">用户ID</th>
                    <th className="px-4 py-2 text-left">问题</th>
                    <th className="px-4 py-2 text-left">回答</th>
                    <th className="px-4 py-2 text-left">语言</th>
                    <th className="px-4 py-2 text-left">模型</th>
                    <th className="px-4 py-2 text-left">RAG</th>
                    <th className="px-4 py-2 text-left">来源</th>
                    <th className="px-4 py-2 text-left">安全</th>
                    <th className="px-4 py-2 text-left">成本</th>
                    <th className="px-4 py-2 text-left">时间</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-8 text-center text-gray-500">
                        暂无数据
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.id} className="border-t hover:bg-gray-50">
                        <td className="px-4 py-2 text-xs">{item.id}</td>
                        <td className="px-4 py-2 text-xs font-mono" title={item.userId || "匿名用户"}>
                          {item.userId ? (
                            <span className="text-blue-600">{item.userId.slice(0, 8)}...</span>
                          ) : (
                            <span className="text-gray-400">匿名</span>
                          )}
                        </td>
                        <td className="px-4 py-2 max-w-xs truncate" title={item.question}>
                          {/* 如果是习题调用，在问题开头添加标识 */}
                          {item.from === "question" ? (
                            <span className="inline-flex items-center gap-1">
                              <span className="text-purple-600 font-bold" title="习题调用AI助手">📚</span>
                              <span>{item.question}</span>
                            </span>
                          ) : (
                            item.question
                          )}
                        </td>
                        <td className="px-4 py-2 max-w-xs truncate" title={item.answer || ""}>
                          {item.answer || "—"}
                        </td>
                        <td className="px-4 py-2 text-xs">{item.locale || "—"}</td>
                        <td className="px-4 py-2 text-xs">
                          {/* 如果是缓存，显示"Cached"，否则显示模型名称 */}
                          {item.cached ? (
                            <span className="text-orange-600 font-medium">Cached</span>
                          ) : (
                            item.model || "—"
                          )}
                        </td>
                        <td className="px-4 py-2 text-xs">{item.ragHits}</td>
                        <td className="px-4 py-2 text-xs">
                          {/* 显示AI服务提供商和缓存来源 */}
                          {item.cached ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-orange-600 font-medium">缓存</span>
                              {item.cacheSource && (
                                <span className="text-gray-500 text-[10px]">
                                  {item.cacheSource === "json" ? "JSON缓存" : "数据库缓存"}
                                </span>
                              )}
                            </div>
                          ) : item.aiProvider ? (
                            <span className="text-blue-600">
                              {item.aiProvider === "openai" ? "OpenAI" :
                               item.aiProvider === "local" ? "Local" :
                               item.aiProvider === "openrouter" ? "OpenRouter" :
                               item.aiProvider === "openrouter_direct" ? "OpenRouter Direct" :
                               item.aiProvider === "openai_direct" ? "OpenAI Direct" :
                               item.aiProvider}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                          {/* 来源按钮（如果有sources） */}
                          {item.sources.length > 0 && (
                            <button
                              onClick={() => setSelectedSources(item)}
                              className="block mt-1 text-blue-600 hover:underline text-xs"
                            >
                              查看来源 ({item.sources.length})
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`px-2 py-1 rounded text-xs ${safetyFlagColors[item.safetyFlag]}`}
                          >
                            {safetyFlagLabels[item.safetyFlag]}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-xs">
                          {item.costEstimate != null ? `$${item.costEstimate.toFixed(4)}` : "—"}
                        </td>
                        <td className="px-4 py-2 text-xs">{fmt(item.createdAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 分页 */}
          {pagination && (pagination.totalPages || pagination.pages || 0) > 1 && (
            <div className="flex items-center justify-between border-t pt-3">
              <div className="text-sm text-gray-600">
                共 {pagination.total} 条，第 {pagination.page} / {pagination.totalPages || pagination.pages} 页
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => changePage(pagination.page - 1)}
                  disabled={!pagination.hasPrev && pagination.page <= 1}
                  className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  上一页
                </button>
                <button
                  onClick={() => changePage(pagination.page + 1)}
                  disabled={
                    !pagination.hasNext &&
                    pagination.page >= (pagination.totalPages || pagination.pages || 1)
                  }
                  className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* 来源抽屉 */}
      {selectedSources && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">来源详情</h2>
              <button
                onClick={() => setSelectedSources(null)}
                className="text-gray-500 hover:text-gray-700 text-xl"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3">
              {selectedSources.sources.length === 0 ? (
                <div className="text-gray-500 text-sm">无来源信息</div>
              ) : (
                selectedSources.sources.map((source, idx) => (
                  <div key={idx} className="border rounded p-3 text-sm">
                    <div className="font-medium mb-1">{source.title}</div>
                    {source.url && (
                      <div className="mb-1">
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-xs break-all"
                        >
                          {source.url}
                        </a>
                      </div>
                    )}
                    {source.snippet && (
                      <div className="text-gray-600 text-xs mb-1 line-clamp-3">{source.snippet}</div>
                    )}
                    <div className="flex gap-3 text-xs text-gray-500">
                      {source.score != null && <span>相似度: {(source.score * 100).toFixed(1)}%</span>}
                      {source.version && <span>版本: {source.version}</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
