"use client";

import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError, apiDelete, apiFetch } from "@/lib/apiClient";

type ActivationCode = {
  id: number;
  code: string;
  status: "enabled" | "disabled" | "suspended" | "expired";
  usageLimit: number;
  usedCount: number;
  createdAt?: string; // ISO
  enabledAt?: string | null; // ISO
  expiresAt?: string | null; // ISO
  notes?: string | null;
};

type ListResponse = {
  items: ActivationCode[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages?: number; // 兼容旧字段
    totalPages?: number; // 实际API返回的字段
    hasPrev?: boolean;
    hasNext?: boolean;
  };
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  pages?: number; // 兼容旧字段
  totalPages?: number; // 实际API返回的字段
  hasPrev?: boolean;
  hasNext?: boolean;
};

type SortBy =
  | "createdAt"
  | "enabledAt"
  | "expiresAt"
  | "usedCount"
  | "usageLimit"
  | "status";

type SortOrder = "asc" | "desc";

type Filters = {
  page: number;
  limit: number;
  status: "" | "enabled" | "disabled" | "suspended" | "expired";
  code: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  sortBy: SortBy;
  sortOrder: SortOrder;
};

const DEFAULT_FILTERS: Filters = {
  page: 1,
  limit: 20,
  status: "",
  code: "",
  start: "",
  end: "",
  sortBy: "createdAt",
  sortOrder: "desc",
};

export default function ActivationCodesPage() {
  const router = useRouter();
  const search = useSearchParams();

  // 从 URL 初始化筛选（便于分享链接 / 刷新保留状态）
  const [filters, setFilters] = useState<Filters>(() => {
    const q = (k: string, d = "") => (search?.get(k) ?? d);
    const n = (k: string, d: number) => {
      const v = Number(search?.get(k));
      return Number.isFinite(v) && v > 0 ? v : d;
    };
    const sortByQ = (q("sortBy", DEFAULT_FILTERS.sortBy) as SortBy) || "createdAt";
    const sortOrderQ = (q("sortOrder", DEFAULT_FILTERS.sortOrder) as SortOrder) || "desc";
    const statusQ = (q("status", DEFAULT_FILTERS.status) as Filters["status"]) || "";
    return {
      page: n("page", DEFAULT_FILTERS.page),
      limit: n("limit", DEFAULT_FILTERS.limit),
      status: statusQ,
      code: q("code", DEFAULT_FILTERS.code),
      start: q("start", DEFAULT_FILTERS.start),
      end: q("end", DEFAULT_FILTERS.end),
      sortBy: sortByQ,
      sortOrder: sortOrderQ,
    };
  });

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [items, setItems] = useState<ActivationCode[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const loadMoreRef = React.useRef<HTMLDivElement>(null);

  // 同步 filters 到 URL（浅刷新）
  useEffect(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v === "" || v === undefined || v === null) return;
      params.set(k, String(v));
    });
    const qs = params.toString();
    const href = qs ? `/admin/activation-codes?${qs}` : `/admin/activation-codes`;
    // 仅替换，不触发新的页面装载
    window.history.replaceState(null, "", href);
  }, [filters]);

  // 加载数据函数
  const loadData = useCallback(async (page: number, append: boolean = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
      }

      const params: Record<string, any> = {
        page,
        limit: filters.limit,
        sortBy: filters.sortBy,
        order: filters.sortOrder,
      };
      if (filters.status) params.status = filters.status;
      if (filters.code) params.code = filters.code;
      if (filters.start) params.expiresAfter = filters.start;
      if (filters.end) params.expiresBefore = filters.end;

      // 构建查询字符串
      const queryString = new URLSearchParams(
        Object.entries(params).reduce((acc, [k, v]) => {
          if (v !== undefined && v !== null && v !== "") {
            acc[k] = String(v);
          }
          return acc;
        }, {} as Record<string, string>)
      ).toString();

      const fullUrl = queryString ? `/api/admin/activation-codes?${queryString}` : "/api/admin/activation-codes";
      
      // 使用 apiFetch 获取完整响应（包括 pagination）
      const fullResponse = await apiFetch<ListResponse>(fullUrl, {
        method: "GET",
      });

      const payload = fullResponse.data as unknown as any;
      const newItems = (payload.items ?? payload) as ActivationCode[];
      const newPagination = fullResponse.pagination || null;

      if (append) {
        // 追加模式：添加到现有列表（去重，避免重复的 ID）
        setItems((prev) => {
          const existingIds = new Set(prev.map((item) => item.id));
          const uniqueNewItems = newItems.filter((item) => !existingIds.has(item.id));
          return [...prev, ...uniqueNewItems];
        });
      } else {
        // 重置模式：替换列表
        setItems(newItems);
      }

      setPagination(newPagination);
      
      // 检查是否还有更多数据
      if (newPagination) {
        // 优先使用 API 返回的 hasNext 字段（最准确）
        // 如果没有 hasNext，则使用 totalPages 计算
        if (newPagination.hasNext !== undefined) {
          setHasMore(newPagination.hasNext);
        } else {
          const totalPages = newPagination.totalPages || newPagination.pages || 0;
          const currentPage = newPagination.page || page;
          const hasMoreData = currentPage < totalPages;
          setHasMore(hasMoreData);
        }
      } else {
        setHasMore(false);
      }
    } catch (e) {
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
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filters.status, filters.code, filters.start, filters.end, filters.limit, filters.sortBy, filters.sortOrder]);

  // 初始加载或筛选条件改变时重置
  useEffect(() => {
    setItems([]);
    setHasMore(true);
    loadData(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status, filters.code, filters.start, filters.end, filters.sortBy, filters.sortOrder]);

  // 无限滚动：加载更多
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore || !pagination) return;
    
    const pag: ListResponse["pagination"] = pagination as ListResponse["pagination"];
    if (!pag) return;
    
    const nextPage = pag.page + 1;
    // 使用 API 返回的 totalPages 字段（兼容 pages 字段）
    const totalPages = pag.totalPages || pag.pages || 0;
    
    // 如果使用 hasNext，则根据 hasNext 判断
    if (pag.hasNext !== undefined) {
      if (!pag.hasNext) {
        setHasMore(false);
        return;
      }
    } else {
      // 否则使用 totalPages 计算
      if (nextPage > totalPages) {
        setHasMore(false);
        return;
      }
    }
    
    loadData(nextPage, true);
  }, [loadingMore, hasMore, pagination, loadData]);

  // Intersection Observer：检测滚动到底部
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target.isIntersecting && hasMore && !loadingMore && !loading) {
          loadMore();
        }
      },
      {
        root: null,
        rootMargin: "200px", // 提前200px开始加载，给更好的用户体验
        threshold: 0.1,
      }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [hasMore, loadingMore, loading, loadMore]);

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // 搜索时重置到第一页并清空列表
    setItems([]);
    setHasMore(true);
    // 触发重新加载（通过filters变化触发useEffect）
  };

  const onReset = () => {
    setFilters({ ...DEFAULT_FILTERS });
  };

  // 移除分页功能，改用无限滚动

  const changeSort = (key: SortBy) => {
    setFilters((f) => ({
      ...f,
      sortBy: key,
      sortOrder: f.sortBy === key ? (f.sortOrder === "asc" ? "desc" : "asc") : "desc",
    }));
    // 排序改变时重置列表（通过 useEffect 触发）
    setItems([]);
    setHasMore(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm(`确认删除激活码 #${id} ?`)) return;
    try {
      await apiDelete<unknown, { id: number }>("/api/admin/activation-codes", {
        id,
      });
      // 删除后重新加载第一页
      setItems([]);
      setHasMore(true);
      loadData(1, false);
    } catch (e) {
      if (e instanceof ApiError) {
        alert(`删除失败：${e.errorCode} - ${e.message}`);
      } else {
        alert("删除失败：未知错误");
      }
    }
  };

  // 状态徽标
  const StatusBadge: React.FC<{ s: ActivationCode["status"] }> = ({ s }) => {
    const map: Record<ActivationCode["status"], string> = {
      enabled: "bg-emerald-100 text-emerald-800",
      disabled: "bg-gray-200 text-gray-800",
      suspended: "bg-amber-100 text-amber-800",
      expired: "bg-rose-100 text-rose-800",
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[s]}`}>
        {s}
      </span>
    );
  };

  // 列头（可排序）
  const SortHeader: React.FC<{ k: SortBy; label: string }> = ({ k, label }) => {
    const active = filters.sortBy === k;
    return (
      <button
        type="button"
        onClick={() => changeSort(k)}
        className="inline-flex items-center gap-1"
        title="点击切换排序"
      >
        <span>{label}</span>
        <span className="text-[10px] text-gray-400">
          {active ? (filters.sortOrder === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    );
  };

  // 时间格式
  const fmt = (v?: string | null) =>
    v ? new Date(v).toISOString().replace(".000Z", "Z") : "—";

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* 顶部操作区 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0">
        <h2 className="text-base sm:text-lg font-semibold">Activation Codes</h2>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/activation-codes/new"
            className="inline-flex items-center rounded-md bg-gray-900 text-white text-sm px-3 py-2 sm:py-1.5 hover:bg-black active:bg-gray-800 touch-manipulation"
          >
            + 批量生成
          </Link>
          <button
            className="rounded-md border border-gray-300 text-sm px-3 py-2 sm:py-1.5 hover:bg-gray-100 active:bg-gray-200 touch-manipulation"
            onClick={() => {
              setItems([]);
              setHasMore(true);
              loadData(1, false);
            }}
          >
            刷新
          </button>
        </div>
      </div>

      {/* 检索表单 */}
      <form
        onSubmit={onSearchSubmit}
        className="bg-white rounded-2xl shadow-sm p-4 md:shadow-md md:p-4 grid grid-cols-1 md:grid-cols-6 gap-3 md:gap-4"
      >
        <div className="md:col-span-1">
          <label className="block text-xs text-gray-500 mb-1">状态</label>
          <select
            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
            value={filters.status}
            onChange={(e) =>
              setFilters((f) => ({ ...f, status: e.target.value as Filters["status"] }))
            }
          >
            <option value="">全部</option>
            <option value="enabled">enabled</option>
            <option value="disabled">disabled</option>
            <option value="suspended">suspended</option>
            <option value="expired">expired</option>
          </select>
        </div>

        <div className="md:col-span-1">
          <label className="block text-xs text-gray-500 mb-1">激活码</label>
          <input
            placeholder="按 code 精确或前缀"
            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
            value={filters.code}
            onChange={(e) => setFilters((f) => ({ ...f, code: e.target.value }))}
          />
        </div>

        <div className="md:col-span-1">
          <label className="block text-xs text-gray-500 mb-1">到期开始</label>
          <input
            type="date"
            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
            value={filters.start}
            onChange={(e) => setFilters((f) => ({ ...f, start: e.target.value }))}
          />
        </div>

        <div className="md:col-span-1">
          <label className="block text-xs text-gray-500 mb-1">到期结束</label>
          <input
            type="date"
            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
            value={filters.end}
            onChange={(e) => setFilters((f) => ({ ...f, end: e.target.value }))}
          />
        </div>

        <div className="md:col-span-1">
          <label className="block text-xs text-gray-500 mb-1">排序字段</label>
          <select
            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
            value={filters.sortBy}
            onChange={(e) => setFilters((f) => ({ ...f, sortBy: e.target.value as SortBy }))}
          >
            <option value="createdAt">createdAt</option>
            <option value="enabledAt">enabledAt</option>
            <option value="expiresAt">expiresAt</option>
            <option value="usedCount">usedCount</option>
            <option value="usageLimit">usageLimit</option>
            <option value="status">status</option>
          </select>
        </div>

        <div className="md:col-span-1">
          <label className="block text-xs text-gray-500 mb-1">排序方向</label>
          <select
            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
            value={filters.sortOrder}
            onChange={(e) =>
              setFilters((f) => ({ ...f, sortOrder: e.target.value as SortOrder }))
            }
          >
            <option value="desc">desc</option>
            <option value="asc">asc</option>
          </select>
        </div>

        <div className="md:col-span-6 flex items-center gap-2">
          <button
            type="submit"
            className="flex-1 sm:flex-none rounded-xl bg-blue-500 text-white text-sm font-medium px-4 py-2.5 sm:px-3 sm:py-2 hover:bg-blue-600 active:bg-blue-700 touch-manipulation transition-colors shadow-sm"
          >
            查询
          </button>
          <button
            type="button"
            className="flex-1 sm:flex-none rounded-xl bg-gray-100 text-gray-700 text-sm font-medium px-4 py-2.5 sm:px-3 sm:py-2 hover:bg-gray-200 active:bg-gray-300 touch-manipulation transition-colors"
            onClick={onReset}
          >
            重置
          </button>
        </div>
      </form>

      {/* 错误提示 */}
      {error && (
        <div className="border border-rose-200 bg-rose-50 text-rose-800 text-sm rounded-md px-3 py-2">
          {error}{" "}
          {error.includes("未授权") && (
            <Link href="/admin/login" className="underline underline-offset-4">
              去登录
            </Link>
          )}
        </div>
      )}

      {/* 列表区域 - 桌面端表格，移动端卡片 */}
      {/* 桌面端表格 */}
      <div className="hidden md:block bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-3 py-2 w-20">ID</th>
              <th className="text-left px-3 py-2">Code</th>
              <th className="text-left px-3 py-2">
                <SortHeader k="status" label="Status" />
              </th>
              <th className="text-left px-3 py-2">
                <SortHeader k="usageLimit" label="UsageLimit" />
              </th>
              <th className="text-left px-3 py-2">
                <SortHeader k="usedCount" label="UsedCount" />
              </th>
              <th className="text-left px-3 py-2">
                <SortHeader k="enabledAt" label="EnabledAt" />
              </th>
              <th className="text-left px-3 py-2">
                <SortHeader k="expiresAt" label="ExpiresAt" />
              </th>
              <th className="text-left px-3 py-2">
                <SortHeader k="createdAt" label="CreatedAt" />
              </th>
              <th className="text-left px-3 py-2 w-56">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-3 py-6 text-center text-gray-500" colSpan={9}>
                  正在加载…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-gray-400" colSpan={9}>
                  暂无数据
                </td>
              </tr>
            ) : (
              items.map((it, index) => (
                <tr key={`activation-code-${it.id}-${it.code}-${index}`} className="border-t border-gray-100">
                  <td className="px-3 py-2">{it.id}</td>
                  <td className="px-3 py-2 font-mono">{it.code}</td>
                  <td className="px-3 py-2">
                    <StatusBadge s={it.status} />
                  </td>
                  <td className="px-3 py-2">{it.usageLimit}</td>
                  <td className="px-3 py-2">{it.usedCount}</td>
                  <td className="px-3 py-2">{fmt(it.enabledAt)}</td>
                  <td className="px-3 py-2">{fmt(it.expiresAt)}</td>
                  <td className="px-3 py-2">{fmt(it.createdAt)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/activation-codes/${it.id}`}
                        className="px-2 py-1 rounded-md border border-gray-300 hover:bg-gray-100"
                        title="编辑"
                      >
                        编辑
                      </Link>
                      <button
                        onClick={() => handleDelete(it.id)}
                        className="px-2 py-1 rounded-md border border-rose-300 text-rose-700 hover:bg-rose-50"
                        title="删除"
                      >
                        删除
                      </button>
                    </div>
                    {it.notes ? (
                      <div className="text-xs text-gray-400 mt-1 line-clamp-1">{it.notes}</div>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 移动端卡片 */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="text-center py-8 text-gray-500 text-sm">正在加载…</div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">暂无数据</div>
        ) : (
          items.map((it, index) => (
            <div key={`activation-code-mobile-${it.id}-${it.code}-${index}`} className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">ID: {it.id}</span>
                <StatusBadge s={it.status} />
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Code</div>
                <div className="font-mono text-sm font-medium break-all">{it.code}</div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-500">限制:</span> {it.usageLimit}
                </div>
                <div>
                  <span className="text-gray-500">已用:</span> {it.usedCount}
                </div>
                <div>
                  <span className="text-gray-500">启用:</span> {fmt(it.enabledAt)}
                </div>
                <div>
                  <span className="text-gray-500">到期:</span> {fmt(it.expiresAt)}
                </div>
              </div>
              {it.notes && (
                <div className="text-xs text-gray-500 line-clamp-2">{it.notes}</div>
              )}
              <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
                <Link
                  href={`/admin/activation-codes/${it.id}`}
                  className="flex-1 text-center rounded-xl bg-blue-500 text-white px-4 py-2.5 text-sm font-medium hover:bg-blue-600 active:bg-blue-700 touch-manipulation transition-colors shadow-sm"
                >
                  编辑
                </Link>
                <button
                  onClick={() => handleDelete(it.id)}
                  className="flex-1 text-center rounded-xl bg-red-500 text-white px-4 py-2.5 text-sm font-medium hover:bg-red-600 active:bg-red-700 touch-manipulation transition-colors shadow-sm"
                >
                  删除
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 无限滚动触发器 */}
      <div ref={loadMoreRef} className="h-20 flex items-center justify-center">
        {loadingMore && (
          <div className="text-sm text-gray-500">加载中...</div>
        )}
        {!hasMore && items.length > 0 && (
          <div className="text-sm text-gray-500">没有更多数据了</div>
        )}
        {!loadingMore && hasMore && items.length > 0 && (
          <div className="text-sm text-gray-400">滚动加载更多</div>
        )}
      </div>

      {/* 数据统计 */}
      {pagination && (
        <div className="text-center text-xs text-gray-500 mt-2">
          已加载 {items.length} / {pagination.total} 条
          <span className="ml-2">
            (第 {pagination.page} / {pagination.totalPages || pagination.pages || 0} 页)
          </span>
        </div>
      )}
    </div>
  );
}
