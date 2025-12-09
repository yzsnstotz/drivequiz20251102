"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/apiClient";

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
  from: string | null; // chat | home_chat | study_chat | exam_chat | question 等
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
  const COLUMN_WIDTH_STORAGE_KEY = "ai_logs_column_widths";
  const [items, setItems] = useState<LogItem[]>([]);
  const [pagination, setPagination] = useState<ListResponse["pagination"] | null>(null);
  const [errorInfo, setErrorInfo] = useState<{ code: string; message: string } | null>(null);
  const [selectedSources, setSelectedSources] = useState<LogItem | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    id: 90,
    userId: 260,
    question: 280,
    answer: 280,
    locale: 100,
    model: 140,
    ragHits: 80,
    from: 140,
    provider: 160,
    safety: 110,
    cost: 120,
    createdAt: 180,
  });
  const resizingRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null);

  // 读取本地持久化的列宽
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(COLUMN_WIDTH_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object") {
          setColumnWidths((prev) => ({ ...prev, ...parsed }));
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // 持久化列宽到 localStorage（可选）
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(COLUMN_WIDTH_STORAGE_KEY, JSON.stringify(columnWidths));
    } catch {
      // ignore
    }
  }, [columnWidths]);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      const resizing = resizingRef.current;
      if (!resizing) return;
      const delta = e.clientX - resizing.startX;
      setColumnWidths((prev) => {
        const baseWidth = resizing.startWidth;
        const nextWidth = Math.max(80, baseWidth + delta);
        if (prev[resizing.key] === nextWidth) return prev;
        return { ...prev, [resizing.key]: nextWidth };
      });
    };

    const handleUp = () => {
      resizingRef.current = null;
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, []);

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
      setErrorInfo(null);
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

        // 构建查询字符串
        const queryString = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== "") {
            queryString.append(k, String(v));
          }
        });
        const url = `/api/admin/ai/logs${queryString.toString() ? `?${queryString.toString()}` : ""}`;
        
        // 使用 apiFetch 获取完整响应（包含 pagination）
        const response = await apiFetch<ListResponse>(url);
        if (!mounted) return;

        // apiFetch 返回 { ok: true, data: { items }, pagination }
        const items = response.data?.items || (Array.isArray(response.data) ? response.data : []);
        const pagination = response.pagination || null;
        setItems(items);
        setPagination(pagination);
      } catch (e) {
        if (!mounted) return;
        if (e instanceof ApiError) {
          if (e.status === 401) {
            setErrorInfo({ code: "AUTH_REQUIRED", message: "未授权：请先登录管理口令" });
          } else {
            setErrorInfo({ code: e.errorCode, message: e.message });
          }
        } else {
          setErrorInfo({ code: "UNKNOWN_ERROR", message: e instanceof Error ? e.message : "未知错误" });
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
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(async (res) => {
        if (!res.ok) {
          const ct = res.headers.get("content-type") || "";
          if (ct.includes("application/json")) {
            const j = await res.json();
            const code = j?.errorCode || "HTTP_ERROR";
            const msg = j?.message || `HTTP ${res.status}`;
            throw new ApiError({ status: res.status, errorCode: code, message: msg, details: j });
          }
          throw new ApiError({ status: res.status, errorCode: "HTTP_ERROR", message: `HTTP ${res.status}` });
        }
        return res.blob();
      })
      .then((blob) => {
        const urlObj = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = urlObj;
        a.download = `ai-logs-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(urlObj);
        document.body.removeChild(a);
      })
      .catch((err) => {
        if (err instanceof ApiError) {
          setErrorInfo({ code: err.errorCode, message: err.message });
          alert(`${err.errorCode}: ${err.message}`);
          return;
        }
        setErrorInfo({ code: "CSV_DOWNLOAD_FAILED", message: err instanceof Error ? err.message : "unknown error" });
        alert("下载失败：" + (err instanceof Error ? err.message : "unknown error"));
      });
  };

  const fmt = (v?: string | null) =>
    v ? new Date(v).toISOString().replace(".000Z", "Z").slice(0, 19).replace("T", " ") : "—";

  const beginResize = (key: string, e: React.MouseEvent) => {
    const th = (e.currentTarget as HTMLElement).parentElement;
    const fallbackWidth = th?.getBoundingClientRect()?.width ?? 150;
    const width = columnWidths[key] ?? fallbackWidth;
    resizingRef.current = { key, startX: e.clientX, startWidth: width };
    e.preventDefault();
    e.stopPropagation();
  };

  const getColumnStyle = (key: string) => {
    const width = columnWidths[key];
    return width ? { width, minWidth: width } : undefined;
  };

  const formatFromLabel = (value: string | null) => {
    if (!value) return "—";
    const mapping: Record<string, string> = {
      chat: "首页聊天",
      home_chat: "首页聊天",
      question: "题目解析",
      study_chat: "学科学习助手",
      exam_chat: "考试助手",
    };
    return mapping[value] ?? `其他（${value}）`;
  };

  const clearUserFilter = () => {
    setFilters((f) => ({ ...f, userId: "", page: 1 }));
  };

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
            disabled={!!errorInfo}
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

      {errorInfo && (
        <div className="p-3 bg-red-50 text-red-700 rounded border border-red-200 text-sm">
          {errorInfo.code === "AI_DATABASE_URL_NOT_CONFIGURED"
            ? "AI 日志数据库未配置：请在 Vercel 对应环境设置 AI_DATABASE_URL（直连 5432，sslmode=require）并重新部署。"
            : errorInfo.code === "AI_DB_DNS_ERROR"
            ? "数据库主机 DNS 解析失败，请检查连接字符串中的主机名是否正确。"
            : errorInfo.code === "AI_DB_TIMEOUT"
            ? "数据库连接超时，请检查网络或数据库状态。"
            : errorInfo.code === "AI_DB_CONNECTION_REFUSED"
            ? "数据库连接被拒绝，数据库可能不可达或已暂停。"
            : errorInfo.code === "AI_DB_AUTH_FAILED"
            ? "数据库认证失败，请检查用户名/密码。"
            : errorInfo.message}
        </div>
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

      {filters.userId && (
        <div className="flex items-center flex-wrap gap-2 text-sm bg-blue-50 border border-blue-100 text-blue-700 px-3 py-2 rounded">
          <span className="font-medium">当前过滤：</span>
          <span className="font-mono break-all">userId = {filters.userId}</span>
          <button
            onClick={clearUserFilter}
            className="text-blue-700 underline-offset-2 hover:underline"
          >
            清除用户过滤
          </button>
        </div>
      )}

      {/* 列表 */}
      {loading ? (
        <div className="p-8 text-center text-gray-500">加载中...</div>
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-fixed">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="relative px-4 py-2 text-left" style={getColumnStyle("id")}>
                      <span>ID</span>
                      <span
                        className="absolute right-0 top-0 h-full w-2 cursor-col-resize select-none"
                        onMouseDown={(e) => beginResize("id", e)}
                      />
                    </th>
                    <th className="relative px-4 py-2 text-left" style={getColumnStyle("userId")}>
                      <span>用户ID</span>
                      <span
                        className="absolute right-0 top-0 h-full w-2 cursor-col-resize select-none"
                        onMouseDown={(e) => beginResize("userId", e)}
                      />
                    </th>
                    <th className="relative px-4 py-2 text-left" style={getColumnStyle("question")}>
                      <span>问题</span>
                      <span
                        className="absolute right-0 top-0 h-full w-2 cursor-col-resize select-none"
                        onMouseDown={(e) => beginResize("question", e)}
                      />
                    </th>
                    <th className="relative px-4 py-2 text-left" style={getColumnStyle("answer")}>
                      <span>回答</span>
                      <span
                        className="absolute right-0 top-0 h-full w-2 cursor-col-resize select-none"
                        onMouseDown={(e) => beginResize("answer", e)}
                      />
                    </th>
                    <th className="relative px-4 py-2 text-left" style={getColumnStyle("locale")}>
                      <span>语言</span>
                      <span
                        className="absolute right-0 top-0 h-full w-2 cursor-col-resize select-none"
                        onMouseDown={(e) => beginResize("locale", e)}
                      />
                    </th>
                    <th className="relative px-4 py-2 text-left" style={getColumnStyle("model")}>
                      <span>模型</span>
                      <span
                        className="absolute right-0 top-0 h-full w-2 cursor-col-resize select-none"
                        onMouseDown={(e) => beginResize("model", e)}
                      />
                    </th>
                    <th className="relative px-4 py-2 text-left" style={getColumnStyle("ragHits")}>
                      <span>RAG</span>
                      <span
                        className="absolute right-0 top-0 h-full w-2 cursor-col-resize select-none"
                        onMouseDown={(e) => beginResize("ragHits", e)}
                      />
                    </th>
                    <th className="relative px-4 py-2 text-left" style={getColumnStyle("from")}>
                      <span>来源</span>
                      <span
                        className="absolute right-0 top-0 h-full w-2 cursor-col-resize select-none"
                        onMouseDown={(e) => beginResize("from", e)}
                      />
                    </th>
                    <th className="relative px-4 py-2 text-left" style={getColumnStyle("provider")}>
                      <span>Provider</span>
                      <span
                        className="absolute right-0 top-0 h-full w-2 cursor-col-resize select-none"
                        onMouseDown={(e) => beginResize("provider", e)}
                      />
                    </th>
                    <th className="relative px-4 py-2 text-left" style={getColumnStyle("safety")}>
                      <span>安全</span>
                      <span
                        className="absolute right-0 top-0 h-full w-2 cursor-col-resize select-none"
                        onMouseDown={(e) => beginResize("safety", e)}
                      />
                    </th>
                    <th className="relative px-4 py-2 text-left" style={getColumnStyle("cost")}>
                      <span>成本</span>
                      <span
                        className="absolute right-0 top-0 h-full w-2 cursor-col-resize select-none"
                        onMouseDown={(e) => beginResize("cost", e)}
                      />
                    </th>
                    <th className="relative px-4 py-2 text-left" style={getColumnStyle("createdAt")}>
                      <span>时间</span>
                      <span
                        className="absolute right-0 top-0 h-full w-2 cursor-col-resize select-none"
                        onMouseDown={(e) => beginResize("createdAt", e)}
                      />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="px-4 py-8 text-center text-gray-500">
                        暂无数据
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.id} className="border-t hover:bg-gray-50">
                        <td className="px-4 py-2 text-xs" style={getColumnStyle("id")}>{item.id}</td>
                        <td
                          className="px-4 py-2 text-xs font-mono"
                          style={getColumnStyle("userId")}
                          title={item.userId || "匿名用户"}
                        >
                          {item.userId ? (
                            <button
                              onClick={() => setFilters((f) => ({ ...f, userId: item.userId || "", page: 1 }))}
                              className="text-blue-600 hover:underline break-all text-left"
                            >
                              {item.userId}
                            </button>
                          ) : (
                            <span className="text-gray-400">匿名</span>
                          )}
                        </td>
                        <td className="px-4 py-2 max-w-xs truncate" style={getColumnStyle("question")} title={item.question}>
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
                        <td className="px-4 py-2 max-w-xs truncate" style={getColumnStyle("answer")} title={item.answer || ""}>
                          {item.answer || "—"}
                        </td>
                        <td className="px-4 py-2 text-xs" style={getColumnStyle("locale")}>{item.locale || "—"}</td>
                        <td className="px-4 py-2 text-xs" style={getColumnStyle("model")}>
                          {/* 如果是缓存，显示"Cached"，否则显示模型名称 */}
                          {item.cached ? (
                            <span className="text-orange-600 font-medium">Cached</span>
                          ) : (
                            item.model || "—"
                          )}
                        </td>
                        <td className="px-4 py-2 text-xs" style={getColumnStyle("ragHits")}>{item.ragHits}</td>
                        <td className="px-4 py-2 text-xs" style={getColumnStyle("from")}>
                          <span className="inline-flex items-center gap-2">
                            <span className="whitespace-nowrap">{formatFromLabel(item.from)}</span>
                          </span>
                        </td>
                        <td className="px-4 py-2 text-xs" style={getColumnStyle("provider")}>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-blue-600">
                              {item.aiProvider || "—"}
                            </span>
                            {item.cached && (
                              <span className="text-orange-600 text-[11px] font-medium">
                                缓存{item.cacheSource ? ` (${item.cacheSource})` : ""}
                              </span>
                            )}
                          </div>
                          {item.sources.length > 0 && (
                            <button
                              onClick={() => setSelectedSources(item)}
                              className="block mt-1 text-blue-600 hover:underline text-xs"
                            >
                              查看来源 ({item.sources.length})
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-2" style={getColumnStyle("safety")}>
                          <span
                            className={`px-2 py-1 rounded text-xs ${safetyFlagColors[item.safetyFlag]}`}
                          >
                            {safetyFlagLabels[item.safetyFlag]}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-xs" style={getColumnStyle("cost")}>
                          {item.costEstimate != null ? `$${item.costEstimate.toFixed(4)}` : "—"}
                        </td>
                        <td className="px-4 py-2 text-xs" style={getColumnStyle("createdAt")}>{fmt(item.createdAt)}</td>
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
